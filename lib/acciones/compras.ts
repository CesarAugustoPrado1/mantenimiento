"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { compraItems, compras, insumos } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN } from "../permisos";
import { compraSugerida } from "../semaforo";
import { hoyAR } from "../formato";
import { moverStock } from "../motor-stock";
import { ejecutar, fallar, type Resultado } from "./comun";
import { aNumeric, fecha, id, num, numOpcional, texto } from "./validacion";

const esquemaNueva = z.object({
  titulo: z.string().trim().min(3, "Poné un título, ej: «Compra 1ª quincena octubre».").max(120),
  fecha,
  desdeSemaforo: z.boolean(),
  soloInfaltables: z.boolean().default(false),
});

/**
 * Arma la compra. Con `desdeSemaforo` se precarga todo lo que está en
 * amarillo o rojo, con la cantidad que falta para llegar al ideal. Después se
 * ajusta a mano: la sugerencia es un punto de partida, no una orden.
 */
export async function crearCompra(
  entrada: z.input<typeof esquemaNueva>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar(...CONFIGURAN);
    const d = esquemaNueva.parse(entrada);
    const cid = await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(compras)
        .values({ titulo: d.titulo, fecha: d.fecha, creadoPorId: yo.uid })
        .returning({ id: compras.id });
      if (d.desdeSemaforo) {
        const lista = await tx
          .select({
            id: insumos.id,
            nombre: insumos.nombre,
            stock: insumos.stock,
            critico: insumos.critico,
            atento: insumos.atento,
            ideal: insumos.ideal,
            infaltable: insumos.infaltable,
          })
          .from(insumos)
          .where(and(eq(insumos.activo, true), sql`${insumos.stock} <= ${insumos.atento}`));
        const items = lista
          .filter((i) => !d.soloInfaltables || i.infaltable)
          .map((i) => ({
            compraId: c.id,
            insumoId: i.id,
            descripcion: i.nombre,
            cantidad: compraSugerida(Number(i.stock), Number(i.critico), Number(i.atento), Number(i.ideal)),
          }))
          .filter((i) => i.cantidad > 0)
          .map((i) => ({ ...i, cantidad: String(i.cantidad) }));
        if (items.length) await tx.insert(compraItems).values(items);
      }
      return c.id;
    });
    revalidatePath("/compras");
    return { id: cid };
  });
}

const esquemaItems = z.object({
  compraId: id,
  titulo: z.string().trim().min(3).max(120),
  proveedor: texto(120),
  nota: texto(1000),
  items: z
    .array(
      z.object({
        insumoId: id.nullable(),
        descripcion: z.string().trim().min(1, "Un renglón no tiene descripción.").max(200),
        cantidad: num("Un renglón no tiene cantidad."),
        precioUnitario: numOpcional,
      }),
    )
    .max(300),
});

export async function guardarCompra(entrada: z.input<typeof esquemaItems>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaItems.parse(entrada);
    const [c] = await db.select({ estado: compras.estado }).from(compras).where(eq(compras.id, d.compraId));
    if (!c) fallar("La compra no existe.");
    if (c.estado === "recibida" || c.estado === "cancelada") fallar("Esta compra ya está cerrada.");
    if (d.items.some((i) => i.cantidad <= 0)) fallar("Las cantidades tienen que ser mayores que cero.");
    await db.transaction(async (tx) => {
      await tx
        .update(compras)
        .set({ titulo: d.titulo, proveedor: d.proveedor, nota: d.nota })
        .where(eq(compras.id, d.compraId));
      await tx.delete(compraItems).where(eq(compraItems.compraId, d.compraId));
      if (d.items.length) {
        await tx.insert(compraItems).values(
          d.items.map((i) => ({
            compraId: d.compraId,
            insumoId: i.insumoId,
            descripcion: i.descripcion,
            cantidad: String(i.cantidad),
            precioUnitario: aNumeric(i.precioUnitario),
          })),
        );
      }
    });
    revalidatePath(`/compras/${d.compraId}`);
  });
}

export async function marcarPedida(compraId: number): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const [c] = await db.select({ estado: compras.estado }).from(compras).where(eq(compras.id, compraId));
    if (!c || c.estado !== "borrador") fallar("Solo se puede pedir una compra en borrador.");
    await db.update(compras).set({ estado: "pedida" }).where(eq(compras.id, compraId));
    revalidatePath(`/compras/${compraId}`);
    revalidatePath("/compras");
  });
}

export async function cancelarCompra(compraId: number): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const [c] = await db.select({ estado: compras.estado }).from(compras).where(eq(compras.id, compraId));
    if (!c || c.estado === "recibida") fallar("Una compra recibida no se cancela: ya movió stock.");
    await db.update(compras).set({ estado: "cancelada" }).where(eq(compras.id, compraId));
    revalidatePath("/compras");
  });
}

const esquemaRecepcion = z.object({
  compraId: id,
  fecha,
  items: z.array(z.object({ itemId: id, recibido: num(), precioUnitario: numOpcional })).max(300),
});

/**
 * Recibir: cada renglón con insumo genera un INGRESO de stock por lo que llegó
 * de verdad (que puede ser menos de lo pedido), con su precio. Todo en una
 * transacción: o entra la compra entera o no entra nada.
 */
export async function recibirCompra(entrada: z.input<typeof esquemaRecepcion>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...CONFIGURAN);
    const d = esquemaRecepcion.parse(entrada);
    if (d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");
    await db.transaction(async (tx) => {
      const [c] = await tx
        .select({ estado: compras.estado })
        .from(compras)
        .where(eq(compras.id, d.compraId))
        .for("update");
      if (!c) fallar("La compra no existe.");
      if (c.estado === "recibida") fallar("Esta compra ya se recibió.");
      if (c.estado === "cancelada") fallar("Esta compra está cancelada.");

      const items = await tx.select().from(compraItems).where(eq(compraItems.compraId, d.compraId));
      for (const r of d.items) {
        const item = items.find((i) => i.id === r.itemId);
        if (!item) fallar("Hay un renglón que no es de esta compra.");
        if (r.recibido < 0) fallar("Lo recibido no puede ser negativo.");
        await tx
          .update(compraItems)
          .set({ recibido: String(r.recibido), precioUnitario: aNumeric(r.precioUnitario) })
          .where(eq(compraItems.id, item.id));
        if (item.insumoId && r.recibido > 0) {
          await moverStock(tx, {
            insumoId: item.insumoId,
            tipo: "ingreso",
            delta: r.recibido,
            usuarioId: yo.uid,
            compraId: d.compraId,
            fecha: d.fecha,
            precioUnitario: r.precioUnitario,
          });
        }
      }
      await tx
        .update(compras)
        .set({ estado: "recibida", recibidaEn: d.fecha })
        .where(eq(compras.id, d.compraId));
    });
    revalidatePath("/", "layout");
  });
}
