import "server-only";
import { eq } from "drizzle-orm";
import type { db } from "./db";
import { insumos, movimientosInsumo } from "./db/schema";
import { redondear } from "./semaforo";
import { hoyAR } from "./formato";
import { fallar } from "./acciones/comun";
import { aNumeric } from "./acciones/validacion";

/*
 * Vive fuera de lib/acciones a propósito: todo lo que exporta un archivo
 * "use server" es invocable desde el navegador, y esto no tiene que serlo.
 */

/* -------------------------------------------------------------------------- */
/* El motor de stock                                                          */
/* -------------------------------------------------------------------------- */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Movimiento = {
  insumoId: number;
  tipo: "ingreso" | "consumo" | "ajuste";
  /** Con signo: + entra, − sale. */
  delta: number;
  usuarioId: number;
  fecha?: string | null;
  activoId?: number | null;
  trabajoId?: number | null;
  obraId?: number | null;
  compraId?: number | null;
  ordenFabricacionId?: number | null;
  precioUnitario?: number | null;
  nota?: string | null;
};

/**
 * El ÚNICO lugar que cambia el stock. Bloquea la fila del insumo, escribe el
 * movimiento con su antes y después, y actualiza el cache, todo en la
 * transacción que recibe. Dos consumos simultáneos no se pisan.
 *
 * Un consumo que dejaría el stock negativo se rechaza: si falta, el número
 * del sistema ya estaba mal, y eso se arregla con un conteo (ajuste), no
 * escondiéndolo en un consumo.
 */
export async function moverStock(tx: Tx, m: Movimiento) {
  const [ins] = await tx
    .select({ stock: insumos.stock, nombre: insumos.nombre, unidad: insumos.unidad })
    .from(insumos)
    .where(eq(insumos.id, m.insumoId))
    .for("update");
  if (!ins) fallar("El insumo no existe.");

  const antes = Number(ins.stock);
  const despues = redondear(antes + m.delta);
  if (m.tipo === "consumo" && despues < 0) {
    fallar(
      `No hay stock suficiente de ${ins.nombre}: el sistema dice ${antes} ${ins.unidad}. ` +
        "Si en realidad hay, primero corregilo con un conteo.",
    );
  }

  await tx.insert(movimientosInsumo).values({
    insumoId: m.insumoId,
    tipo: m.tipo,
    cantidad: String(redondear(m.delta)),
    stockAntes: String(antes),
    stockDespues: String(despues),
    fecha: m.fecha ?? hoyAR(),
    usuarioId: m.usuarioId,
    activoId: m.activoId ?? null,
    trabajoId: m.trabajoId ?? null,
    obraId: m.obraId ?? null,
    compraId: m.compraId ?? null,
    ordenFabricacionId: m.ordenFabricacionId ?? null,
    precioUnitario: aNumeric(m.precioUnitario ?? null),
    nota: m.nota ?? null,
  });
  await tx.update(insumos).set({ stock: String(despues) }).where(eq(insumos.id, m.insumoId));
}

