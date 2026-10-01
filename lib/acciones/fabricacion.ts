"use server";

import { revalidatePath } from "next/cache";
import { and, eq, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  movimientosInsumo,
  ordenesFabricacion,
  partesFabricacion,
  productoMateriales,
  productos,
} from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { hoyAR } from "../formato";
import { materialesPara } from "../fabricacion";
import { moverStock, type Tx } from "../motor-stock";
import { ejecutar, fallar, type Resultado } from "./comun";
import { aNumeric, fecha, fechaOpcional, id, nombre, num, numOpcional, texto } from "./validacion";

/* -------------------------------------------------------------------------- */
/* Productos                                                                  */
/* -------------------------------------------------------------------------- */

const esquemaProducto = z.object({
  id: id.optional(),
  nombre,
  modelo: texto(120),
  descripcion: texto(2000),
  horasEstandar: numOpcional,
  activo: z.boolean(),
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

export async function guardarProducto(entrada: z.input<typeof esquemaProducto>): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaProducto.parse(entrada);
    if (d.horasEstandar != null && d.horasEstandar < 0) fallar("Las horas no pueden ser negativas.");
    const materiales = d.materiales.filter((m) => (m.insumoId || m.descripcion) && m.cantidad > 0);
    const pid = await db.transaction(async (tx) => {
      const valores = {
        nombre: d.nombre,
        modelo: d.modelo,
        descripcion: d.descripcion,
        horasEstandar: aNumeric(d.horasEstandar),
        activo: d.activo,
      };
      let pid: number;
      if (d.id) {
        await tx.update(productos).set(valores).where(eq(productos.id, d.id));
        await tx.delete(productoMateriales).where(eq(productoMateriales.productoId, d.id));
        pid = d.id;
      } else {
        const [c] = await tx.insert(productos).values(valores).returning({ id: productos.id });
        pid = c.id;
      }
      if (materiales.length) {
        await tx.insert(productoMateriales).values(
          materiales.map((m) => ({
            productoId: pid,
            insumoId: m.insumoId,
            descripcion: m.descripcion || null,
            cantidad: String(m.cantidad),
          })),
        );
      }
      return pid;
    });
    revalidatePath("/fabricacion", "layout");
    return { id: pid };
  });
}

/* -------------------------------------------------------------------------- */
/* Órdenes                                                                    */
/* -------------------------------------------------------------------------- */

const esquemaOrden = z.object({
  id: id.optional(),
  productoId: id,
  cantidad: num("¿Cuántas unidades?"),
  destino: texto(200),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]),
  inicioPlan: fechaOpcional,
  finPlan: fechaOpcional,
  responsableId: id.nullable().optional(),
  responsableExterno: texto(120),
  nota: texto(1000),
  cancelada: z.boolean().default(false),
});

export async function guardarOrden(entrada: z.input<typeof esquemaOrden>): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar(...CONFIGURAN);
    const d = esquemaOrden.parse(entrada);
    if (!Number.isInteger(d.cantidad) || d.cantidad < 1) fallar("La cantidad es un número entero mayor que cero.");
    if (d.inicioPlan && d.finPlan && d.finPlan < d.inicioPlan) fallar("El fin comprometido no puede ser anterior al inicio.");
    const oid = await db.transaction(async (tx) => {
      const valores = {
        productoId: d.productoId,
        cantidad: d.cantidad,
        destino: d.destino,
        prioridad: d.prioridad,
        inicioPlan: d.inicioPlan,
        finPlan: d.finPlan,
        responsableId: d.responsableId ?? null,
        responsableExterno: d.responsableExterno,
        nota: d.nota,
      };
      let oid: number;
      if (d.id) {
        await tx.update(ordenesFabricacion).set(valores).where(eq(ordenesFabricacion.id, d.id));
        oid = d.id;
      } else {
        const [c] = await tx
          .insert(ordenesFabricacion)
          .values({ ...valores, creadoPorId: yo.uid })
          .returning({ id: ordenesFabricacion.id });
        oid = c.id;
      }
      if (d.cancelada) await tx.update(ordenesFabricacion).set({ estado: "cancelada" }).where(eq(ordenesFabricacion.id, oid));
      else await sincronizarOrden(tx, oid, true);
      return oid;
    });
    revalidatePath("/fabricacion", "layout");
    return { id: oid };
  });
}

/**
 * La orden sigue a sus partes: arranca con el primero y termina cuando se
 * llega a la cantidad, con esa fecha. Cambiar la cantidad la reabre o la
 * cierra según corresponda.
 */
async function sincronizarOrden(tx: Tx, ordenId: number, reabrirCancelada = false) {
  const [o] = await tx.select().from(ordenesFabricacion).where(eq(ordenesFabricacion.id, ordenId));
  if (!o || (o.estado === "cancelada" && !reabrirCancelada)) return;
  const partes = await tx
    .select({ fecha: partesFabricacion.fecha, unidades: partesFabricacion.unidades })
    .from(partesFabricacion)
    .where(eq(partesFabricacion.ordenId, ordenId))
    .orderBy(partesFabricacion.fecha, partesFabricacion.id);
  let acumulado = 0;
  let fin: string | null = null;
  for (const p of partes) {
    acumulado += p.unidades;
    if (!fin && acumulado >= o.cantidad) fin = p.fecha;
  }
  await tx
    .update(ordenesFabricacion)
    .set({
      estado: fin ? "terminada" : partes.length ? "en_curso" : "pendiente",
      fechaInicio: partes[0]?.fecha ?? null,
      fechaFin: fin,
    })
    .where(eq(ordenesFabricacion.id, ordenId));
}

const esquemaParte = z.object({
  ordenId: id,
  fecha,
  unidades: num("¿Cuántas unidades se terminaron? (0 si ninguna)"),
  horasHombre: numOpcional,
  realizadoPorId: id.nullable().optional(),
  nota: texto(500),
  descontarMateriales: z.boolean(),
});

/**
 * Un parte de producción. Si se pide, descuenta del pañol los materiales de
 * la receta por las unidades terminadas, imputados a la orden.
 */
export async function registrarParte(entrada: z.input<typeof esquemaParte>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaParte.parse(entrada);
    if (!Number.isInteger(d.unidades) || d.unidades < 0) fallar("Las unidades son un entero, 0 o más.");
    if (d.unidades === 0 && !d.horasHombre) fallar("Poné las unidades terminadas o las horas trabajadas.");
    if (d.horasHombre != null && d.horasHombre < 0) fallar("Las horas no pueden ser negativas.");
    if (d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");
    await db.transaction(async (tx) => {
      const [o] = await tx.select().from(ordenesFabricacion).where(eq(ordenesFabricacion.id, d.ordenId)).for("update");
      if (!o) fallar("La orden no existe.");
      if (o.estado === "cancelada") fallar("La orden está cancelada.");
      const [parte] = await tx
        .insert(partesFabricacion)
        .values({
          ordenId: d.ordenId,
          fecha: d.fecha,
          unidades: d.unidades,
          horasHombre: aNumeric(d.horasHombre),
          realizadoPorId: d.realizadoPorId ?? yo.uid,
          nota: d.nota,
          usuarioId: yo.uid,
        })
        .returning({ id: partesFabricacion.id });
      if (d.descontarMateriales && d.unidades > 0) {
        const receta = await tx
          .select({ insumoId: productoMateriales.insumoId, cantidad: productoMateriales.cantidad })
          .from(productoMateriales)
          .where(eq(productoMateriales.productoId, o.productoId));
        for (const m of materialesPara(receta.map((r) => ({ insumoId: r.insumoId, cantidad: Number(r.cantidad) })), d.unidades)) {
          await moverStock(tx, {
            insumoId: m.insumoId,
            tipo: "consumo",
            delta: -m.cantidad,
            usuarioId: yo.uid,
            ordenFabricacionId: d.ordenId,
            fecha: d.fecha,
            nota: `Parte #${parte.id}`,
          });
        }
      }
      await sincronizarOrden(tx, d.ordenId);
    });
    revalidatePath("/fabricacion", "layout");
  });
}

/**
 * Borrar un parte cargado por error. Si descontó materiales, se devuelven al
 * pañol con un ajuste (el movimiento original queda: el historial no se toca).
 */
export async function borrarParte(parteId: number): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(partesFabricacion).where(eq(partesFabricacion.id, parteId));
      if (!p) fallar("El parte no existe.");
      if (yo.rol === "tecnico" && p.usuarioId !== yo.uid) fallar("Solo podés borrar los partes que cargaste vos.");
      const movs = await tx
        .select({ insumoId: movimientosInsumo.insumoId, cantidad: movimientosInsumo.cantidad })
        .from(movimientosInsumo)
        .where(and(eq(movimientosInsumo.ordenFabricacionId, p.ordenId), like(movimientosInsumo.nota, `Parte #${p.id}`)));
      for (const m of movs) {
        await moverStock(tx, {
          insumoId: m.insumoId,
          tipo: "ajuste",
          delta: -Number(m.cantidad),
          usuarioId: yo.uid,
          ordenFabricacionId: p.ordenId,
          nota: `Parte #${p.id} borrado: se devuelve`,
        });
      }
      await tx.delete(partesFabricacion).where(eq(partesFabricacion.id, parteId));
      await sincronizarOrden(tx, p.ordenId);
    });
    revalidatePath("/fabricacion", "layout");
  });
}

