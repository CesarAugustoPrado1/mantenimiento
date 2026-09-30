"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { activos, causas, lecturas, planes, trabajos, trabajoTareas } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { hoyAR } from "../formato";
import { moverStock, type Tx } from "../motor-stock";
import { ejecutar, fallar, type Resultado } from "./comun";
import { aNumeric, fecha, fechaOpcional, id, nombre, num, numOpcional, texto } from "./validacion";

const consumos = z
  .array(z.object({ insumoId: id, cantidad: num("Falta la cantidad de un insumo.") }))
  .max(40)
  .default([]);

const accion = z.enum(["chequear", "cambiar", "ajustar", "limpiar", "lubricar", "otro"]);
const estadoActivo = z.enum(["operativo", "con_falla", "fuera_de_servicio"]);

async function descontar(
  tx: Tx,
  lista: Array<{ insumoId: number; cantidad: number }>,
  ctx: { usuarioId: number; activoId: number; trabajoId: number; fecha: string },
) {
  for (const c of lista) {
    if (!(c.cantidad > 0)) continue;
    await moverStock(tx, {
      insumoId: c.insumoId,
      tipo: "consumo",
      delta: -c.cantidad,
      usuarioId: ctx.usuarioId,
      activoId: ctx.activoId,
      trabajoId: ctx.trabajoId,
      fecha: ctx.fecha,
    });
  }
}

/**
 * La lectura del trabajo también es una lectura del medidor: si el mecánico
 * anotó 84.500 km al cambiar el aceite, ese es el km de ese día. Solo se
 * guarda si no contradice lo ya cargado; si contradice, queda en el trabajo y
 * no se toca el historial de lecturas.
 */
async function registrarLectura(tx: Tx, activoId: number, dia: string, valor: number, usuarioId: number) {
  const [previa] = await tx
    .select({ valor: lecturas.valor })
    .from(lecturas)
    .where(and(eq(lecturas.activoId, activoId), sql`${lecturas.fecha} <= ${dia}`))
    .orderBy(desc(lecturas.fecha))
    .limit(1);
  const [posterior] = await tx
    .select({ valor: lecturas.valor })
    .from(lecturas)
    .where(and(eq(lecturas.activoId, activoId), sql`${lecturas.fecha} > ${dia}`))
    .orderBy(lecturas.fecha)
    .limit(1);
  if (previa && valor < Number(previa.valor)) return;
  if (posterior && valor > Number(posterior.valor)) return;
  await tx
    .insert(lecturas)
    .values({ activoId, fecha: dia, valor: String(valor), usuarioId, nota: "Desde un trabajo" })
    .onConflictDoNothing();
}

/* -------------------------------------------------------------------------- */
/* Preventivo hecho                                                           */
/* -------------------------------------------------------------------------- */

const esquemaPreventivo = z.object({
  planId: id,
  fecha,
  lectura: numOpcional,
  realizadoPorId: id.nullable().optional(),
  realizadoExterno: texto(120),
  tareas: z
    .array(
      z.object({
        accion,
        descripcion: z.string().trim().min(1).max(300),
        resultado: z.enum(["ok", "corregido", "no_ok", "no_aplica"]),
        nota: texto(300),
      }),
    )
    .max(60),
  consumos,
  horasHombre: numOpcional,
  costoManoObra: numOpcional,
  costoRepuestos: numOpcional,
  observaciones: texto(2000),
});

export async function registrarPreventivo(
  entrada: z.input<typeof esquemaPreventivo>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaPreventivo.parse(entrada);
    if (d.fecha > hoyAR()) fallar("No se puede registrar un trabajo en el futuro.");

    const [plan] = await db
      .select({ id: planes.id, activoId: planes.activoId, nombre: planes.nombre, medidor: activos.medidor })
      .from(planes)
      .innerJoin(activos, eq(activos.id, planes.activoId))
      .where(eq(planes.id, d.planId));
    if (!plan) fallar("El plan no existe.");
    if (plan.medidor !== "ninguno" && d.lectura == null) {
      fallar(`Poné ${plan.medidor === "km" ? "el kilometraje" : "las horas"} del equipo: es lo que reinicia la cuenta del plan.`);
    }

    const tid = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(trabajos)
        .values({
          activoId: plan.activoId,
          tipo: "preventivo",
          planId: plan.id,
          estado: "cerrado",
          titulo: plan.nombre,
          fecha: d.fecha,
          fechaCierre: d.fecha,
          lectura: aNumeric(d.lectura),
          reportadoPorId: yo.uid,
          realizadoPorId: d.realizadoPorId ?? (d.realizadoExterno ? null : yo.uid),
          realizadoExterno: d.realizadoExterno,
          horasHombre: aNumeric(d.horasHombre),
          costoManoObra: aNumeric(d.costoManoObra),
          costoRepuestos: aNumeric(d.costoRepuestos),
          observaciones: d.observaciones,
        })
        .returning({ id: trabajos.id });
      if (d.tareas.length) {
        await tx.insert(trabajoTareas).values(
          d.tareas.map((x) => ({
            trabajoId: t.id,
            accion: x.accion,
            descripcion: x.descripcion,
            resultado: x.resultado,
            nota: x.nota,
          })),
        );
      }
      await descontar(tx, d.consumos, {
        usuarioId: yo.uid,
        activoId: plan.activoId,
        trabajoId: t.id,
        fecha: d.fecha,
      });
      if (d.lectura != null) await registrarLectura(tx, plan.activoId, d.fecha, d.lectura, yo.uid);
      return t.id;
    });
    revalidatePath("/", "layout");
    return { id: tid };
  });
}

/* -------------------------------------------------------------------------- */
/* Correctivos                                                                */
/* -------------------------------------------------------------------------- */

const esquemaApertura = z.object({
  activoId: id,
  titulo: z.string().trim().min(3, "Contá en pocas palabras qué pasó.").max(150),
  falla: texto(2000),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]),
  fecha,
  lectura: numOpcional,
  estadoActivo,
});

/** Reportar una falla. Lo puede hacer el conductor, sobre su vehículo. */
export async function abrirCorrectivo(
  entrada: z.input<typeof esquemaApertura>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar("admin", "jefe_taller", "tecnico", "conductor");
    const d = esquemaApertura.parse(entrada);
    if (d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");

    const [act] = await db
      .select({ responsableId: activos.responsableId, estado: activos.estado })
      .from(activos)
      .where(eq(activos.id, d.activoId));
    if (!act) fallar("El equipo no existe.");
    if (act.estado === "baja") fallar("Ese equipo está dado de baja.");
    if (yo.rol === "conductor" && act.responsableId !== yo.uid) {
      fallar("Solo podés reportar fallas de tus vehículos.");
    }

    const tid = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(trabajos)
        .values({
          activoId: d.activoId,
          tipo: "correctivo",
          estado: "abierto",
          prioridad: d.prioridad,
          titulo: d.titulo,
          falla: d.falla,
          fecha: d.fecha,
          lectura: aNumeric(d.lectura),
          reportadoPorId: yo.uid,
        })
        .returning({ id: trabajos.id });
      await tx.update(activos).set({ estado: d.estadoActivo }).where(eq(activos.id, d.activoId));
      if (d.lectura != null) await registrarLectura(tx, d.activoId, d.fecha, d.lectura, yo.uid);
      return t.id;
    });
    revalidatePath("/", "layout");
    return { id: tid };
  });
}

const esquemaSeguimiento = z.object({
  id,
  estado: z.enum(["abierto", "en_curso", "cerrado"]),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]),
  causaId: id.nullable().optional(),
  solucion: texto(2000),
  realizadoPorId: id.nullable().optional(),
  realizadoExterno: texto(120),
  fechaCierre: fechaOpcional,
  horasParada: numOpcional,
  horasHombre: numOpcional,
  costoManoObra: numOpcional,
  costoRepuestos: numOpcional,
  observaciones: texto(2000),
  consumos,
  /** Cómo queda el equipo después. */
  estadoActivo,
});

export async function actualizarCorrectivo(
  entrada: z.input<typeof esquemaSeguimiento>,
): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaSeguimiento.parse(entrada);

    const [t] = await db
      .select({ activoId: trabajos.activoId, tipo: trabajos.tipo, estado: trabajos.estado, fecha: trabajos.fecha })
      .from(trabajos)
      .where(eq(trabajos.id, d.id));
    if (!t || t.tipo !== "correctivo") fallar("El correctivo no existe.");

    const cierre = d.estado === "cerrado" ? (d.fechaCierre ?? hoyAR()) : null;
    if (d.estado === "cerrado") {
      if (!d.causaId) fallar("Para cerrarlo, elegí la causa: es lo que después dice por qué se rompen las cosas.");
      if (!d.solucion) fallar("Para cerrarlo, contá qué se hizo.");
      if (cierre! < t.fecha) fallar("El cierre no puede ser anterior a la falla.");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(trabajos)
        .set({
          estado: d.estado,
          prioridad: d.prioridad,
          causaId: d.causaId ?? null,
          solucion: d.solucion,
          realizadoPorId: d.realizadoPorId ?? null,
          realizadoExterno: d.realizadoExterno,
          fechaCierre: cierre,
          horasParada: aNumeric(d.horasParada),
          horasHombre: aNumeric(d.horasHombre),
          costoManoObra: aNumeric(d.costoManoObra),
          costoRepuestos: aNumeric(d.costoRepuestos),
          observaciones: d.observaciones,
        })
        .where(eq(trabajos.id, d.id));
      await descontar(tx, d.consumos, {
        usuarioId: yo.uid,
        activoId: t.activoId,
        trabajoId: d.id,
        fecha: cierre ?? hoyAR(),
      });
      await tx.update(activos).set({ estado: d.estadoActivo }).where(eq(activos.id, t.activoId));
    });
    revalidatePath("/", "layout");
  });
}

/* -------------------------------------------------------------------------- */
/* Causas                                                                     */
/* -------------------------------------------------------------------------- */

const esquemaCausa = z.object({
  id: id.optional(),
  nombre,
  descripcion: texto(300),
  activa: z.boolean(),
});

export async function guardarCausa(entrada: z.input<typeof esquemaCausa>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaCausa.parse(entrada);
    const [otra] = await db
      .select({ id: causas.id })
      .from(causas)
      .where(and(sql`lower(${causas.nombre}) = lower(${d.nombre})`, d.id ? ne(causas.id, d.id) : sql`true`))
      .limit(1);
    if (otra) fallar("Ya hay una causa con ese nombre.");
    const valores = { nombre: d.nombre, descripcion: d.descripcion, activa: d.activa };
    if (d.id) await db.update(causas).set(valores).where(eq(causas.id, d.id));
    else await db.insert(causas).values(valores);
    revalidatePath("/", "layout");
  });
}
