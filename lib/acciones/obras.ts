"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { obraNotas, obras, obraSubtareaAvances, obraSubtareas } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { esPaso, fechasTrasAvance } from "../cumplimiento";
import { hoyAR } from "../formato";
import type { Tx } from "../motor-stock";
import { ejecutar, fallar, type Resultado } from "./comun";
import { aNumeric, fecha, fechaOpcional, id, numOpcional, texto } from "./validacion";

const esquemaObra = z.object({
  id: id.optional(),
  titulo: z.string().trim().min(3, "Poné un título.").max(150),
  lugar: z.string().trim().min(1, "¿Dónde es?").max(120),
  tipo: texto(60),
  descripcion: texto(3000),
  estado: z.enum(["pendiente", "en_curso", "terminada", "cancelada"]),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]),
  inicioPlan: fechaOpcional,
  finPlan: fechaOpcional,
  fechaInicio: fechaOpcional,
  fechaFin: fechaOpcional,
  responsableId: id.nullable().optional(),
  responsableExterno: texto(120),
  horasHombre: numOpcional,
  costoManoObra: numOpcional,
  costoMateriales: numOpcional,
});

function validarFechas(inicio: string | null, fin: string | null, que: string) {
  if (inicio && fin && fin < inicio) fallar(`El fin ${que} no puede ser anterior al inicio ${que}.`);
}

export async function guardarObra(
  entrada: z.input<typeof esquemaObra>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar(...CONFIGURAN);
    const d = esquemaObra.parse(entrada);
    validarFechas(d.inicioPlan, d.finPlan, "comprometido");
    validarFechas(d.fechaInicio, d.fechaFin, "real");
    const valores = {
      titulo: d.titulo,
      lugar: d.lugar,
      tipo: d.tipo,
      descripcion: d.descripcion,
      estado: d.estado,
      prioridad: d.prioridad,
      inicioPlan: d.inicioPlan,
      finPlan: d.finPlan,
      fechaInicio: d.fechaInicio ?? (d.estado === "en_curso" || d.estado === "terminada" ? hoyAR() : null),
      fechaFin: d.estado === "terminada" ? (d.fechaFin ?? hoyAR()) : d.fechaFin,
      responsableId: d.responsableId ?? null,
      responsableExterno: d.responsableExterno,
      horasHombre: aNumeric(d.horasHombre),
      costoManoObra: aNumeric(d.costoManoObra),
      costoMateriales: aNumeric(d.costoMateriales),
    };
    let oid: number;
    if (d.id) {
      await db.update(obras).set(valores).where(eq(obras.id, d.id));
      oid = d.id;
    } else {
      const [c] = await db
        .insert(obras)
        .values({ ...valores, creadoPorId: yo.uid })
        .returning({ id: obras.id });
      oid = c.id;
    }
    revalidatePath("/obras");
    revalidatePath("/tablero");
    return { id: oid };
  });
}

const esquemaNota = z.object({
  obraId: id,
  texto: z.string().trim().min(1, "La nota está vacía.").max(2000),
});

/** Bitácora de la obra: avances, problemas, lo que falta. */
export async function agregarNotaObra(entrada: z.input<typeof esquemaNota>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaNota.parse(entrada);
    await db.insert(obraNotas).values({ obraId: d.obraId, usuarioId: yo.uid, texto: d.texto });
    revalidatePath(`/obras/${d.obraId}`);
  });
}

/* -------------------------------------------------------------------------- */
/* Subtareas                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * La obra sigue a sus subtareas: arranca cuando arranca la primera y termina
 * cuando termina la última, con esas fechas. Así nadie tiene que acordarse de
 * cambiar el estado de la obra. Una obra cancelada no se toca.
 */
async function sincronizarObra(tx: Tx, obraId: number) {
  const [o] = await tx.select().from(obras).where(eq(obras.id, obraId));
  if (!o || o.estado === "cancelada") return;
  const subs = await tx.select().from(obraSubtareas).where(eq(obraSubtareas.obraId, obraId));
  if (subs.length === 0) return;

  const inicios = subs.map((s) => s.inicioReal).filter((x): x is string => !!x).sort();
  const todas = subs.every((s) => s.progreso === 100);
  const alguna = subs.some((s) => s.progreso > 0);
  const fines = subs.map((s) => s.finReal).filter((x): x is string => !!x).sort();

  await tx
    .update(obras)
    .set({
      estado: todas ? "terminada" : alguna ? "en_curso" : "pendiente",
      fechaInicio: inicios[0] ?? null,
      fechaFin: todas ? (fines[fines.length - 1] ?? hoyAR()) : null,
    })
    .where(eq(obras.id, obraId));
}

const esquemaSubtarea = z.object({
  id: id.optional(),
  obraId: id,
  titulo: z.string().trim().min(2, "Poné qué hay que hacer.").max(150),
  responsableId: id.nullable().optional(),
  responsableExterno: texto(120),
  inicioPlan: fechaOpcional,
  finPlan: fechaOpcional,
  /** Para corregir a mano una fecha real mal cargada. */
  inicioReal: fechaOpcional,
  finReal: fechaOpcional,
  nota: texto(500),
});

export async function guardarSubtarea(entrada: z.input<typeof esquemaSubtarea>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaSubtarea.parse(entrada);
    validarFechas(d.inicioPlan, d.finPlan, "comprometido");
    validarFechas(d.inicioReal, d.finReal, "real");
    await db.transaction(async (tx) => {
      const base = {
        titulo: d.titulo,
        responsableId: d.responsableId ?? null,
        responsableExterno: d.responsableExterno,
        inicioPlan: d.inicioPlan,
        finPlan: d.finPlan,
        nota: d.nota,
      };
      if (d.id) {
        const [s] = await tx.select().from(obraSubtareas).where(eq(obraSubtareas.id, d.id));
        if (!s || s.obraId !== d.obraId) fallar("La subtarea no existe.");
        // Las fechas reales solo se pueden corregir si el avance las respalda.
        await tx
          .update(obraSubtareas)
          .set({
            ...base,
            inicioReal: s.progreso > 0 ? (d.inicioReal ?? s.inicioReal) : null,
            finReal: s.progreso === 100 ? (d.finReal ?? s.finReal) : null,
          })
          .where(eq(obraSubtareas.id, d.id));
      } else {
        const existentes = await tx
          .select({ orden: obraSubtareas.orden })
          .from(obraSubtareas)
          .where(eq(obraSubtareas.obraId, d.obraId))
          .orderBy(asc(obraSubtareas.orden));
        await tx.insert(obraSubtareas).values({
          ...base,
          obraId: d.obraId,
          orden: (existentes[existentes.length - 1]?.orden ?? -1) + 1,
        });
      }
      await sincronizarObra(tx, d.obraId);
    });
    revalidatePath(`/obras/${d.obraId}`);
    revalidatePath("/obras");
  });
}

export async function borrarSubtarea(subtareaId: number): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const [s] = await db.select().from(obraSubtareas).where(eq(obraSubtareas.id, subtareaId));
    if (!s) fallar("La subtarea no existe.");
    await db.transaction(async (tx) => {
      await tx.delete(obraSubtareas).where(eq(obraSubtareas.id, subtareaId));
      await sincronizarObra(tx, s.obraId);
    });
    revalidatePath(`/obras/${s.obraId}`);
    revalidatePath("/obras");
  });
}

const esquemaAvance = z.object({
  subtareaId: id,
  progreso: z.number().int(),
  fecha,
  nota: texto(300),
});

/**
 * Mover el avance: queda registrado con su fecha (que puede ser de días
 * atrás: se anota cuando se puede), y las fechas reales de la subtarea y de
 * la obra se acomodan solas.
 */
export async function cambiarAvance(entrada: z.input<typeof esquemaAvance>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaAvance.parse(entrada);
    if (!esPaso(d.progreso)) fallar("El avance va de a 25%.");
    if (d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");
    const obraId = await db.transaction(async (tx) => {
      const [s] = await tx.select().from(obraSubtareas).where(eq(obraSubtareas.id, d.subtareaId)).for("update");
      if (!s) fallar("La subtarea no existe.");
      if (s.progreso === d.progreso) fallar("Ya estaba en ese avance.");
      if (s.inicioReal && d.progreso > 0 && d.fecha < s.inicioReal && s.progreso > 0) {
        fallar("La fecha no puede ser anterior al inicio de la subtarea.");
      }
      const fechas = fechasTrasAvance(s, d.progreso, d.fecha);
      await tx
        .update(obraSubtareas)
        .set({ progreso: d.progreso, ...fechas })
        .where(eq(obraSubtareas.id, s.id));
      await tx.insert(obraSubtareaAvances).values({
        subtareaId: s.id,
        fecha: d.fecha,
        progresoAntes: s.progreso,
        progreso: d.progreso,
        usuarioId: yo.uid,
        nota: d.nota,
      });
      await sincronizarObra(tx, s.obraId);
      return s.obraId;
    });
    revalidatePath(`/obras/${obraId}`);
    revalidatePath("/obras");
    revalidatePath("/tablero");
  });
}
