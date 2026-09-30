"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { activos, lecturas, planes, planMateriales, planTareas } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN } from "../permisos";
import { hoyAR } from "../formato";
import { ejecutar, fallar, type Resultado } from "./comun";
import { aNumeric, fecha, fechaOpcional, id, nombre, num, numOpcional, texto } from "./validacion";

/* -------------------------------------------------------------------------- */
/* Máquinas y vehículos                                                       */
/* -------------------------------------------------------------------------- */

const esquemaActivo = z.object({
  id: id.optional(),
  clase: z.enum(["maquina", "vehiculo"]),
  tipo: z.string().trim().min(1, "Decí qué tipo de equipo es.").max(60),
  nombre,
  codigo: texto(40),
  marca: texto(60),
  modelo: texto(60),
  anio: numOpcional,
  numeroSerie: texto(80),
  patente: texto(20),
  ubicacion: texto(80),
  propiedad: z.enum(["empresa", "empleado"]),
  responsableId: id.nullable().optional(),
  medidor: z.enum(["ninguno", "km", "horas"]),
  estado: z.enum(["operativo", "con_falla", "fuera_de_servicio", "baja"]),
  caracteristicas: z
    .array(z.object({ clave: z.string().trim().max(60), valor: z.string().trim().max(200) }))
    .max(40),
  nota: texto(1000),
});

export async function guardarActivo(
  entrada: z.input<typeof esquemaActivo>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaActivo.parse(entrada);
    if (d.anio != null && (d.anio < 1950 || d.anio > 2100)) fallar("El año no parece válido.");

    if (d.codigo) {
      const [otro] = await db
        .select({ id: activos.id })
        .from(activos)
        .where(and(eq(activos.codigo, d.codigo), d.id ? ne(activos.id, d.id) : sql`true`))
        .limit(1);
      if (otro) fallar(`Ya hay un equipo con el código ${d.codigo}.`);
    }

    const valores = {
      clase: d.clase,
      tipo: d.tipo,
      nombre: d.nombre,
      codigo: d.codigo,
      marca: d.marca,
      modelo: d.modelo,
      anio: d.anio,
      numeroSerie: d.numeroSerie,
      patente: d.patente ? d.patente.toUpperCase().replace(/\s+/g, "") : null,
      ubicacion: d.ubicacion,
      propiedad: d.propiedad,
      responsableId: d.responsableId ?? null,
      medidor: d.medidor,
      estado: d.estado,
      caracteristicas: d.caracteristicas.filter((c) => c.clave && c.valor),
      nota: d.nota,
    };

    let resultado: number;
    if (d.id) {
      await db.update(activos).set(valores).where(eq(activos.id, d.id));
      resultado = d.id;
    } else {
      const [creado] = await db.insert(activos).values(valores).returning({ id: activos.id });
      resultado = creado.id;
    }
    revalidatePath("/", "layout");
    return { id: resultado };
  });
}

/* -------------------------------------------------------------------------- */
/* Lecturas de km / horas                                                     */
/* -------------------------------------------------------------------------- */

const esquemaLectura = z.object({
  activoId: id,
  fecha,
  valor: num("Poné el kilometraje u horas."),
  nota: texto(200),
});

/**
 * Carga (o corrige) la lectura de un día. El conductor solo puede cargar la de
 * SUS vehículos. Una lectura tiene que quedar entre la anterior y la
 * siguiente: el odómetro no va para atrás, y un número al revés rompe el
 * cálculo de cuándo vence cada service.
 */
export async function cargarLectura(
  entrada: z.input<typeof esquemaLectura>,
): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar("admin", "jefe_taller", "tecnico", "conductor");
    const d = esquemaLectura.parse(entrada);
    if (d.valor < 0) fallar("La lectura no puede ser negativa.");
    if (d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");

    const [act] = await db
      .select({ medidor: activos.medidor, responsableId: activos.responsableId })
      .from(activos)
      .where(eq(activos.id, d.activoId));
    if (!act) fallar("El equipo no existe.");
    if (act.medidor === "ninguno") fallar("Este equipo no lleva km ni horas.");
    if (yo.rol === "conductor" && act.responsableId !== yo.uid) {
      fallar("Solo podés cargar el kilometraje de tus vehículos.");
    }

    const [anterior] = await db
      .select({ valor: lecturas.valor, fecha: lecturas.fecha })
      .from(lecturas)
      .where(and(eq(lecturas.activoId, d.activoId), lt(lecturas.fecha, d.fecha)))
      .orderBy(desc(lecturas.fecha))
      .limit(1);
    if (anterior && d.valor < Number(anterior.valor)) {
      fallar(`El ${anterior.fecha.split("-").reverse().join("/")} ya se cargó ${anterior.valor}: no puede ser menos.`);
    }
    const [siguiente] = await db
      .select({ valor: lecturas.valor, fecha: lecturas.fecha })
      .from(lecturas)
      .where(and(eq(lecturas.activoId, d.activoId), gt(lecturas.fecha, d.fecha)))
      .orderBy(lecturas.fecha)
      .limit(1);
    if (siguiente && d.valor > Number(siguiente.valor)) {
      fallar(`El ${siguiente.fecha.split("-").reverse().join("/")} hay cargado ${siguiente.valor}: no puede ser más.`);
    }

    await db
      .insert(lecturas)
      .values({
        activoId: d.activoId,
        fecha: d.fecha,
        valor: String(d.valor),
        usuarioId: yo.uid,
        nota: d.nota,
      })
      .onConflictDoUpdate({
        target: [lecturas.activoId, lecturas.fecha],
        set: { valor: String(d.valor), usuarioId: yo.uid, nota: d.nota },
      });
    revalidatePath("/", "layout");
  });
}

/* -------------------------------------------------------------------------- */
/* Planes preventivos                                                         */
/* -------------------------------------------------------------------------- */

const esquemaPlan = z.object({
  id: id.optional(),
  activoId: id,
  nombre,
  descripcion: texto(1000),
  cadaDias: numOpcional,
  cadaUso: numOpcional,
  avisoDias: num("Poné con cuántos días de anticipación avisar."),
  avisoUso: numOpcional,
  responsableId: id.nullable().optional(),
  responsableExterno: texto(120),
  herramientas: texto(500),
  desdeFecha: fechaOpcional,
  desdeUso: numOpcional,
  activo: z.boolean(),
  tareas: z
    .array(
      z.object({
        accion: z.enum(["chequear", "cambiar", "ajustar", "limpiar", "lubricar", "otro"]),
        descripcion: z.string().trim().max(300),
      }),
    )
    .max(60),
  materiales: z
    .array(
      z.object({
        insumoId: id.nullable(),
        descripcion: z.string().trim().max(200).nullable(),
        cantidad: num("Falta la cantidad de un material."),
      }),
    )
    .max(60),
});

/**
 * El plan se guarda entero: datos, checklist y materiales. Las tareas y los
 * materiales se reemplazan; los trabajos ya hechos guardan su propia copia del
 * checklist, así que cambiar el plan no reescribe la historia.
 */
export async function guardarPlan(
  entrada: z.input<typeof esquemaPlan>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaPlan.parse(entrada);
    if (!d.cadaDias && !d.cadaUso) {
      fallar("Poné cada cuántos días, cada cuántos km/horas, o las dos cosas.");
    }
    if ((d.cadaDias ?? 1) <= 0 || (d.cadaUso ?? 1) <= 0) fallar("La periodicidad tiene que ser positiva.");

    const [act] = await db
      .select({ medidor: activos.medidor })
      .from(activos)
      .where(eq(activos.id, d.activoId));
    if (!act) fallar("El equipo no existe.");
    if (d.cadaUso && act.medidor === "ninguno") {
      fallar("Este equipo no lleva km ni horas: el plan solo puede ir por días.");
    }

    /**
     * Un plan por km sin punto de partida arrancaría a contar desde cero y
     * saldría vencido al instante. Si no se dice desde cuándo, se cuenta desde
     * la última lectura cargada.
     */
    let desdeUso = d.desdeUso;
    if (d.cadaUso && desdeUso == null && !d.id) {
      const [ultima] = await db
        .select({ valor: lecturas.valor })
        .from(lecturas)
        .where(eq(lecturas.activoId, d.activoId))
        .orderBy(desc(lecturas.fecha))
        .limit(1);
      desdeUso = ultima ? Number(ultima.valor) : 0;
    }

    const tareas = d.tareas.filter((t) => t.descripcion);
    const materiales = d.materiales.filter((m) => m.insumoId || m.descripcion);
    const valores = {
      activoId: d.activoId,
      nombre: d.nombre,
      descripcion: d.descripcion,
      cadaDias: d.cadaDias ? Math.round(d.cadaDias) : null,
      cadaUso: d.cadaUso ? Math.round(d.cadaUso) : null,
      avisoDias: Math.max(0, Math.round(d.avisoDias)),
      avisoUso: d.avisoUso ? Math.round(d.avisoUso) : null,
      responsableId: d.responsableId ?? null,
      responsableExterno: d.responsableExterno,
      herramientas: d.herramientas,
      desdeFecha: d.desdeFecha ?? hoyAR(),
      desdeUso: aNumeric(desdeUso),
      activo: d.activo,
    };

    const planId = await db.transaction(async (tx) => {
      let pid: number;
      if (d.id) {
        await tx.update(planes).set(valores).where(eq(planes.id, d.id));
        pid = d.id;
        await tx.delete(planTareas).where(eq(planTareas.planId, pid));
        await tx.delete(planMateriales).where(eq(planMateriales.planId, pid));
      } else {
        const [creado] = await tx.insert(planes).values(valores).returning({ id: planes.id });
        pid = creado.id;
      }
      if (tareas.length) {
        await tx.insert(planTareas).values(
          tareas.map((t, i) => ({ planId: pid, orden: i, accion: t.accion, descripcion: t.descripcion })),
        );
      }
      if (materiales.length) {
        await tx.insert(planMateriales).values(
          materiales.map((m) => ({
            planId: pid,
            insumoId: m.insumoId,
            descripcion: m.descripcion || null,
            cantidad: String(m.cantidad),
          })),
        );
      }
      return pid;
    });
    revalidatePath("/", "layout");
    return { id: planId };
  });
}
