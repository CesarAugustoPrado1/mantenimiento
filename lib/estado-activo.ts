import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "./motor-stock";
import { activoCambiosEstado, activos, type EstadoActivo } from "./db/schema";
import { fallar } from "./acciones/comun";

/**
 * El ÚNICO lugar que cambia el estado de un equipo. Deja el cambio en el
 * historial (desde, hasta, quién, por qué trabajo), que es de donde sale
 * cuánto tiempo estuvo parado. Si el estado no cambia, no hace nada.
 */
export async function cambiarEstado(
  tx: Tx,
  c: { activoId: number; estado: EstadoActivo; usuarioId: number; trabajoId?: number | null },
) {
  const [a] = await tx
    .select({ estado: activos.estado })
    .from(activos)
    .where(eq(activos.id, c.activoId))
    .for("update");
  if (!a) fallar("El equipo no existe.");
  if (a.estado === c.estado) return;
  await tx.update(activos).set({ estado: c.estado }).where(eq(activos.id, c.activoId));
  await tx.insert(activoCambiosEstado).values({
    activoId: c.activoId,
    desde: a.estado,
    hasta: c.estado,
    trabajoId: c.trabajoId ?? null,
    usuarioId: c.usuarioId,
  });
}
