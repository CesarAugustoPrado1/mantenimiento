"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { activos, cargasCombustible } from "../db/schema";
import { autorizar } from "../auth";
import { hoyAR } from "../formato";
import { guardarLectura } from "../lecturas";
import { moverStock } from "../motor-stock";
import { ejecutar, fallar, type Resultado } from "./comun";
import { aNumeric, fecha, id, num, numOpcional, texto } from "./validacion";

const esquemaCarga = z.object({
  activoId: id,
  fecha,
  litros: num("¿Cuántos litros?"),
  lectura: numOpcional,
  precioLitro: numOpcional,
  insumoId: id.nullable().optional(),
  nota: texto(200),
});

/**
 * Registrar un bidón. Por protocolo, cada carga lleva la lectura del
 * horómetro (u odómetro): es lo que hace que el consumo salga exacto. Esa
 * lectura también queda como lectura del día.
 *
 * El conductor puede cargar en cualquier vehículo de la empresa (los clarks
 * los maneja quien esté) y en el suyo propio.
 */
export async function registrarCarga(entrada: z.input<typeof esquemaCarga>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar("admin", "jefe_taller", "tecnico", "conductor");
    const d = esquemaCarga.parse(entrada);
    if (!(d.litros > 0) || d.litros > 2000) fallar("Los litros no parecen correctos.");
    if (d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");

    const [a] = await db
      .select({
        combustible: activos.combustible,
        medidor: activos.medidor,
        propiedad: activos.propiedad,
        responsableId: activos.responsableId,
        clase: activos.clase,
      })
      .from(activos)
      .where(eq(activos.id, d.activoId));
    if (!a) fallar("El equipo no existe.");
    if (!a.combustible) fallar("Este equipo no tiene cargado qué combustible usa. Editá su ficha.");
    if (yo.rol === "conductor" && !(a.clase === "vehiculo" && (a.propiedad === "empresa" || a.responsableId === yo.uid))) {
      fallar("No podés registrar cargas en ese equipo.");
    }
    if (a.medidor !== "ninguno" && d.lectura == null) {
      fallar(`Poné ${a.medidor === "horas" ? "las horas del horómetro" : "el kilometraje"}: sin eso no se puede calcular el consumo.`);
    }

    await db.transaction(async (tx) => {
      if (d.lectura != null && a.medidor !== "ninguno") {
        await guardarLectura(tx, { activoId: d.activoId, fecha: d.fecha, valor: d.lectura, usuarioId: yo.uid, nota: "Carga de combustible" });
      }
      await tx.insert(cargasCombustible).values({
        activoId: d.activoId,
        fecha: d.fecha,
        litros: String(d.litros),
        lectura: aNumeric(d.lectura),
        precioLitro: aNumeric(d.precioLitro),
        insumoId: d.insumoId ?? null,
        usuarioId: yo.uid,
        nota: d.nota,
      });
      if (d.insumoId) {
        await moverStock(tx, {
          insumoId: d.insumoId,
          tipo: "consumo",
          delta: -d.litros,
          usuarioId: yo.uid,
          activoId: d.activoId,
          fecha: d.fecha,
          nota: "Carga de combustible",
        });
      }
    });
    revalidatePath("/", "layout");
  });
}

/** Una carga mal anotada se borra (y se devuelve al pañol si salió de ahí). */
export async function borrarCarga(cargaId: number): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar("admin", "jefe_taller");
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(cargasCombustible).where(eq(cargasCombustible.id, cargaId));
      if (!c) fallar("La carga no existe.");
      if (c.insumoId) {
        await moverStock(tx, {
          insumoId: c.insumoId,
          tipo: "ajuste",
          delta: Number(c.litros),
          usuarioId: yo.uid,
          activoId: c.activoId,
          nota: `Carga de combustible #${c.id} borrada`,
        });
      }
      await tx.delete(cargasCombustible).where(eq(cargasCombustible.id, cargaId));
    });
    revalidatePath("/", "layout");
  });
}
