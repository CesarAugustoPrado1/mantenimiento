"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { categoriasInsumo, insumos } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { redondear, validarUmbrales } from "../semaforo";
import { ejecutar, fallar, type Resultado } from "./comun";
import { moverStock } from "../motor-stock";
import { fechaOpcional, id, nombre, num, numOpcional, texto } from "./validacion";

/* -------------------------------------------------------------------------- */
/* Registrar desde la pantalla                                                */
/* -------------------------------------------------------------------------- */

const esquemaMovimiento = z.object({
  insumoId: id,
  tipo: z.enum(["ingreso", "consumo", "conteo"]),
  /** Ingreso y consumo: la cantidad. Conteo: lo que hay físicamente. */
  cantidad: num("Poné la cantidad."),
  fecha: fechaOpcional,
  activoId: id.nullable().optional(),
  obraId: id.nullable().optional(),
  precioUnitario: numOpcional,
  nota: texto(300),
});

export async function registrarMovimiento(
  entrada: z.input<typeof esquemaMovimiento>,
): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaMovimiento.parse(entrada);
    if (d.cantidad < 0) fallar("La cantidad no puede ser negativa.");
    if (d.tipo !== "conteo" && d.cantidad === 0) fallar("La cantidad tiene que ser mayor que cero.");

    await db.transaction(async (tx) => {
      let delta = d.cantidad;
      if (d.tipo === "consumo") delta = -d.cantidad;
      if (d.tipo === "conteo") {
        const [ins] = await tx
          .select({ stock: insumos.stock })
          .from(insumos)
          .where(eq(insumos.id, d.insumoId))
          .for("update");
        if (!ins) fallar("El insumo no existe.");
        delta = redondear(d.cantidad - Number(ins.stock));
        if (delta === 0) return;
      }
      await moverStock(tx, {
        insumoId: d.insumoId,
        tipo: d.tipo === "conteo" ? "ajuste" : d.tipo,
        delta,
        usuarioId: yo.uid,
        fecha: d.fecha,
        activoId: d.tipo === "consumo" ? (d.activoId ?? null) : null,
        obraId: d.tipo === "consumo" ? (d.obraId ?? null) : null,
        precioUnitario: d.tipo === "ingreso" ? d.precioUnitario : null,
        nota: d.nota,
      });
    });
    revalidatePath("/insumos");
    revalidatePath("/tablero");
  });
}

/* -------------------------------------------------------------------------- */
/* ABM                                                                        */
/* -------------------------------------------------------------------------- */

const esquemaInsumo = z.object({
  id: id.optional(),
  codigo: texto(40),
  nombre,
  categoriaId: id.nullable().optional(),
  unidad: z.string().trim().min(1, "Falta la unidad.").max(20),
  critico: num("Falta el nivel crítico."),
  atento: num("Falta el nivel de atento."),
  ideal: num("Falta el stock ideal."),
  infaltable: z.boolean(),
  ubicacion: texto(80),
  proveedor: texto(120),
  nota: texto(500),
  activo: z.boolean(),
  esRepuesto: z.boolean().default(false),
  tiempoReposicionDias: numOpcional,
  /** Solo al crear: el stock con el que arranca (entra como ajuste). */
  stockInicial: numOpcional,
});

export async function guardarInsumo(
  entrada: z.input<typeof esquemaInsumo>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar(...CONFIGURAN);
    const d = esquemaInsumo.parse(entrada);
    const error = validarUmbrales(d.critico, d.atento, d.ideal);
    if (error) fallar(error);

    if (d.codigo) {
      const [otro] = await db
        .select({ id: insumos.id })
        .from(insumos)
        .where(and(eq(insumos.codigo, d.codigo), d.id ? ne(insumos.id, d.id) : sql`true`))
        .limit(1);
      if (otro) fallar(`Ya hay un insumo con el código ${d.codigo}.`);
    }

    const valores = {
      codigo: d.codigo,
      nombre: d.nombre,
      categoriaId: d.categoriaId ?? null,
      unidad: d.unidad,
      critico: String(d.critico),
      atento: String(d.atento),
      ideal: String(d.ideal),
      infaltable: d.infaltable,
      ubicacion: d.ubicacion,
      proveedor: d.proveedor,
      nota: d.nota,
      activo: d.activo,
      esRepuesto: d.esRepuesto,
      tiempoReposicionDias: d.esRepuesto && d.tiempoReposicionDias != null ? Math.max(0, Math.round(d.tiempoReposicionDias)) : null,
    };

    const nuevoId = await db.transaction(async (tx) => {
      if (d.id) {
        await tx.update(insumos).set(valores).where(eq(insumos.id, d.id));
        return d.id;
      }
      const [creado] = await tx.insert(insumos).values(valores).returning({ id: insumos.id });
      if (d.stockInicial && d.stockInicial > 0) {
        await moverStock(tx, {
          insumoId: creado.id,
          tipo: "ajuste",
          delta: d.stockInicial,
          usuarioId: yo.uid,
          nota: "Stock inicial",
        });
      }
      return creado.id;
    });
    revalidatePath("/insumos");
    return { id: nuevoId };
  });
}

const esquemaCategoria = z.object({ id: id.optional(), nombre, activa: z.boolean() });

export async function guardarCategoria(
  entrada: z.input<typeof esquemaCategoria>,
): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaCategoria.parse(entrada);
    const [otra] = await db
      .select({ id: categoriasInsumo.id })
      .from(categoriasInsumo)
      .where(
        and(
          sql`lower(${categoriasInsumo.nombre}) = lower(${d.nombre})`,
          d.id ? ne(categoriasInsumo.id, d.id) : sql`true`,
        ),
      )
      .limit(1);
    if (otra) fallar("Ya hay una categoría con ese nombre.");
    if (d.id) {
      await db
        .update(categoriasInsumo)
        .set({ nombre: d.nombre, activa: d.activa })
        .where(eq(categoriasInsumo.id, d.id));
    } else {
      await db.insert(categoriasInsumo).values({ nombre: d.nombre, activa: d.activa });
    }
    revalidatePath("/", "layout");
  });
}
