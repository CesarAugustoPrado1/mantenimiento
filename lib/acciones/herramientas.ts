"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { categoriasHerramienta, herramientas, herramientaTipos } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { ejecutar, fallar, type Resultado } from "./comun";
import { id, nombre, num, texto } from "./validacion";

const esquemaTipo = z.object({
  id: id.optional(),
  nombre,
  categoriaId: id.nullable(),
  requeridas: num("¿Cuántas hacen falta?"),
  nota: texto(500),
  activo: z.boolean(),
});

export async function guardarTipoHerramienta(
  entrada: z.input<typeof esquemaTipo>,
): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaTipo.parse(entrada);
    if (d.requeridas < 0 || !Number.isInteger(d.requeridas)) fallar("La cantidad requerida es un entero.");
    const valores = {
      nombre: d.nombre,
      categoriaId: d.categoriaId,
      requeridas: d.requeridas,
      nota: d.nota,
      activo: d.activo,
    };
    let tid: number;
    if (d.id) {
      await db.update(herramientaTipos).set(valores).where(eq(herramientaTipos.id, d.id));
      tid = d.id;
    } else {
      const [c] = await db.insert(herramientaTipos).values(valores).returning({ id: herramientaTipos.id });
      tid = c.id;
    }
    revalidatePath("/herramientas");
    return { id: tid };
  });
}

const esquemaUnidad = z.object({
  id: id.optional(),
  tipoId: id,
  codigo: texto(40),
  marca: texto(60),
  estado: z.enum(["bueno", "regular", "en_reparacion", "baja"]),
  ubicacion: texto(80),
  nota: texto(300),
});

/** El técnico puede cambiar el estado (se rompió, la mandé a reparar). */
export async function guardarHerramienta(entrada: z.input<typeof esquemaUnidad>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaUnidad.parse(entrada);
    if (!d.id && yo.rol === "tecnico") fallar("El alta de herramientas la hace el jefe de taller.");
    const valores = {
      tipoId: d.tipoId,
      codigo: d.codigo,
      marca: d.marca,
      estado: d.estado,
      ubicacion: d.ubicacion,
      nota: d.nota,
      actualizadoEn: new Date(),
    };
    if (d.id) await db.update(herramientas).set(valores).where(eq(herramientas.id, d.id));
    else await db.insert(herramientas).values(valores);
    revalidatePath("/herramientas");
    revalidatePath("/tablero");
  });
}

const esquemaCategoria = z.object({ id: id.optional(), nombre, activa: z.boolean() });

export async function guardarCategoriaHerramienta(
  entrada: z.input<typeof esquemaCategoria>,
): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaCategoria.parse(entrada);
    const [otra] = await db
      .select({ id: categoriasHerramienta.id })
      .from(categoriasHerramienta)
      .where(
        and(
          sql`lower(${categoriasHerramienta.nombre}) = lower(${d.nombre})`,
          d.id ? ne(categoriasHerramienta.id, d.id) : sql`true`,
        ),
      )
      .limit(1);
    if (otra) fallar("Ya hay una categoría con ese nombre.");
    if (d.id) {
      await db
        .update(categoriasHerramienta)
        .set({ nombre: d.nombre, activa: d.activa })
        .where(eq(categoriasHerramienta.id, d.id));
    } else {
      await db.insert(categoriasHerramienta).values({ nombre: d.nombre, activa: d.activa });
    }
    revalidatePath("/", "layout");
  });
}
