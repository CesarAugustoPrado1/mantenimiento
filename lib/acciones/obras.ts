"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { obraNotas, obras } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { ejecutar, fallar, type Resultado } from "./comun";
import { aNumeric, fechaOpcional, id, numOpcional, texto } from "./validacion";

const esquemaObra = z.object({
  id: id.optional(),
  titulo: z.string().trim().min(3, "Poné un título.").max(150),
  lugar: z.string().trim().min(1, "¿Dónde es?").max(120),
  tipo: texto(60),
  descripcion: texto(3000),
  estado: z.enum(["pendiente", "en_curso", "terminada", "cancelada"]),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]),
  fechaInicio: fechaOpcional,
  fechaEstimada: fechaOpcional,
  fechaFin: fechaOpcional,
  responsableId: id.nullable().optional(),
  responsableExterno: texto(120),
  horasHombre: numOpcional,
  costoManoObra: numOpcional,
  costoMateriales: numOpcional,
});

export async function guardarObra(
  entrada: z.input<typeof esquemaObra>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar(...CONFIGURAN);
    const d = esquemaObra.parse(entrada);
    if (d.fechaInicio && d.fechaFin && d.fechaFin < d.fechaInicio) {
      fallar("La fecha de fin no puede ser anterior a la de inicio.");
    }
    const valores = {
      titulo: d.titulo,
      lugar: d.lugar,
      tipo: d.tipo,
      descripcion: d.descripcion,
      estado: d.estado,
      prioridad: d.prioridad,
      fechaInicio: d.fechaInicio,
      fechaEstimada: d.fechaEstimada,
      fechaFin: d.estado === "terminada" ? (d.fechaFin ?? new Date().toISOString().slice(0, 10)) : d.fechaFin,
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
