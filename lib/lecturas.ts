import "server-only";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import type { Tx } from "./motor-stock";
import { lecturas } from "./db/schema";
import { fmtFecha } from "./formato";
import { fallar } from "./acciones/comun";

/**
 * Guarda la lectura de un día verificando que quede entre la anterior y la
 * siguiente: el horómetro no va para atrás. Si ese día ya había una, se
 * reemplaza (es una corrección).
 */
export async function guardarLectura(
  tx: Tx,
  l: { activoId: number; fecha: string; valor: number; usuarioId: number; nota?: string | null },
) {
  const [anterior] = await tx
    .select({ valor: lecturas.valor, fecha: lecturas.fecha })
    .from(lecturas)
    .where(and(eq(lecturas.activoId, l.activoId), lt(lecturas.fecha, l.fecha)))
    .orderBy(desc(lecturas.fecha))
    .limit(1);
  if (anterior && l.valor < Number(anterior.valor)) {
    fallar(`El ${fmtFecha(anterior.fecha)} ya se cargó ${Number(anterior.valor)}: no puede ser menos.`);
  }
  const [siguiente] = await tx
    .select({ valor: lecturas.valor, fecha: lecturas.fecha })
    .from(lecturas)
    .where(and(eq(lecturas.activoId, l.activoId), gt(lecturas.fecha, l.fecha)))
    .orderBy(lecturas.fecha)
    .limit(1);
  if (siguiente && l.valor > Number(siguiente.valor)) {
    fallar(`El ${fmtFecha(siguiente.fecha)} hay cargado ${Number(siguiente.valor)}: no puede ser más.`);
  }
  await tx
    .insert(lecturas)
    .values({ activoId: l.activoId, fecha: l.fecha, valor: String(l.valor), usuarioId: l.usuarioId, nota: l.nota ?? null })
    .onConflictDoUpdate({
      target: [lecturas.activoId, lecturas.fecha],
      set: { valor: String(l.valor), usuarioId: l.usuarioId, nota: l.nota ?? null },
    });
}
