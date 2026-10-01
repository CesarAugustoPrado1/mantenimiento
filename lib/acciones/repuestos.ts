"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { activoRepuestos, activos, categoriasInsumo, insumos } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN } from "../permisos";
import { umbralesRepuesto } from "../semaforo";
import { moverStock } from "../motor-stock";
import { ejecutar, fallar, type Resultado } from "./comun";
import { id, nombre, num, numOpcional, texto } from "./validacion";

const CATEGORIA_REPUESTOS = "Repuestos";

const esquema = z.object({
  activoId: id,
  /** Repuesto que ya existe en el pañol (se reusa: un rulemán sirve a varias máquinas). */
  insumoId: id.nullable(),
  /** O uno nuevo. */
  nuevo: z
    .object({
      nombre,
      codigo: texto(40),
      unidad: z.string().trim().min(1).max(20).default("unidad"),
      minimo: num("¿Cuántos conviene tener?"),
      stockActual: numOpcional,
      tiempoReposicionDias: numOpcional,
      proveedor: texto(120),
      ubicacion: texto(80),
    })
    .nullable(),
  dondeVa: texto(120),
  criticidad: z.enum(["alta", "media", "baja"]),
  nota: texto(500),
});

/**
 * Vincula un repuesto a una máquina. Si es nuevo, lo da de alta en el pañol
 * con su semáforo armado desde "cuántos conviene tener" (0 = rojo, menos del
 * mínimo = amarillo), así entra solo en la compra cuando falta.
 */
export async function guardarRepuesto(entrada: z.input<typeof esquema>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...CONFIGURAN);
    const d = esquema.parse(entrada);
    if (!d.insumoId && !d.nuevo) fallar("Elegí un repuesto del pañol o cargá uno nuevo.");

    const [act] = await db.select({ id: activos.id }).from(activos).where(eq(activos.id, d.activoId));
    if (!act) fallar("El equipo no existe.");

    await db.transaction(async (tx) => {
      let insumoId = d.insumoId;
      if (!insumoId && d.nuevo) {
        const n = d.nuevo;
        if (n.minimo < 1) fallar("Conviene tener al menos 1.");
        if (n.codigo) {
          const [otro] = await tx.select({ id: insumos.id }).from(insumos).where(eq(insumos.codigo, n.codigo));
          if (otro) fallar(`Ya hay un insumo con el código ${n.codigo}: elegilo de la lista.`);
        }
        await tx.insert(categoriasInsumo).values({ nombre: CATEGORIA_REPUESTOS }).onConflictDoNothing();
        const [cat] = await tx
          .select({ id: categoriasInsumo.id })
          .from(categoriasInsumo)
          .where(eq(categoriasInsumo.nombre, CATEGORIA_REPUESTOS));
        const u = umbralesRepuesto(n.minimo);
        const [creado] = await tx
          .insert(insumos)
          .values({
            nombre: n.nombre,
            codigo: n.codigo,
            categoriaId: cat?.id ?? null,
            unidad: n.unidad,
            critico: String(u.critico),
            atento: String(u.atento),
            ideal: String(u.ideal),
            esRepuesto: true,
            tiempoReposicionDias: n.tiempoReposicionDias != null ? Math.max(0, Math.round(n.tiempoReposicionDias)) : null,
            proveedor: n.proveedor,
            ubicacion: n.ubicacion,
          })
          .returning({ id: insumos.id });
        insumoId = creado.id;
        if (n.stockActual && n.stockActual > 0) {
          await moverStock(tx, { insumoId, tipo: "ajuste", delta: n.stockActual, usuarioId: yo.uid, nota: "Stock inicial" });
        }
      } else if (insumoId) {
        // Un insumo existente pasa a ser repuesto al vincularlo a una máquina.
        await tx.update(insumos).set({ esRepuesto: true }).where(eq(insumos.id, insumoId));
      }

      await tx
        .insert(activoRepuestos)
        .values({ activoId: d.activoId, insumoId: insumoId!, dondeVa: d.dondeVa, criticidad: d.criticidad, nota: d.nota })
        .onConflictDoUpdate({
          target: [activoRepuestos.activoId, activoRepuestos.insumoId],
          set: { dondeVa: d.dondeVa, criticidad: d.criticidad, nota: d.nota },
        });
    });
    revalidatePath("/", "layout");
  });
}

/** Saca el repuesto de esta máquina. El repuesto y su stock siguen en el pañol. */
export async function quitarRepuesto(vinculoId: number): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    await db.delete(activoRepuestos).where(eq(activoRepuestos.id, vinculoId));
    revalidatePath("/", "layout");
  });
}

