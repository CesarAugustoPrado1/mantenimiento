"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  activoCambiosEstado,
  activos,
  compras,
  documentos,
  herramientas,
  herramientaTipos,
  insumos,
  movimientosInsumo,
  obras,
  ordenesFabricacion,
  partesFabricacion,
  planes,
  productos,
  trabajos,
} from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { dentroDeVentana, esViolacionFK, VENTANA_HORAS, type TipoBorrable } from "../borrado";
import { ErrorDeNegocio, ejecutar, fallar, type Resultado } from "./comun";
import { id } from "./validacion";

const esquema = z.object({
  tipo: z.enum(["activo", "insumo", "herramienta", "obra", "plan", "trabajo", "compra", "documento", "producto", "orden"]),
  id,
});

const NOMBRE: Record<TipoBorrable, string> = {
  activo: "el equipo",
  insumo: "el insumo",
  herramienta: "la herramienta",
  obra: "la obra",
  plan: "el plan",
  trabajo: "el trabajo",
  compra: "la compra",
  documento: "el archivo",
  producto: "el producto",
  orden: "la orden",
};

const BAJA: Record<TipoBorrable, string> = {
  activo: "Si ya no va, dalo de baja desde «Editar».",
  insumo: "Si ya no va, desactivalo desde «Editar».",
  herramienta: "Si ya no va, desactivala desde «Editar».",
  obra: "Si no se hace, cancelala desde «Editar».",
  plan: "Si ya no va, desactivalo desde el plan.",
  trabajo: "Corregí los datos desde el seguimiento.",
  compra: "Si no va, cancelala.",
  documento: "Si ya no va, archivalo.",
  producto: "Si ya no se hace, desactivalo.",
  orden: "Si no se hace, cancelala desde «Editar».",
};

function noSePuede(tipo: TipoBorrable, porque: string): never {
  fallar(`No se puede borrar ${NOMBRE[tipo]}: ${porque}. ${BAJA[tipo]}`);
}

/**
 * Borrar algo cargado por error: un equipo con un error de tipeo, una obra
 * duplicada. Solo dentro de las 24 horas y si todavía no tiene nada colgado.
 *
 * Lo de "nada colgado" lo controla la base: cada tabla que apunta a otra
 * tiene clave foránea, así que si algo lo usa el DELETE falla y se explica.
 * Las únicas excepciones se resuelven a mano abajo, y son lo que el propio
 * alta genera solo (el stock inicial, el cambio de estado al reportar).
 */
export async function borrarCargadoPorError(entrada: z.input<typeof esquema>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const { tipo, id: rid } = esquema.parse(entrada);
    const configura = CONFIGURAN.includes(yo.rol);
    const vencido = () => noSePuede(tipo, `pasaron más de ${VENTANA_HORAS} horas desde que se cargó y ya forma parte del historial`);
    const soloConfig = () => {
      if (!configura) fallar("Esto lo borra el jefe de taller.");
    };

    try {
      await db.transaction(async (tx) => {
        switch (tipo) {
          case "activo": {
            soloConfig();
            const [a] = await tx.select({ creadoEn: activos.creadoEn }).from(activos).where(eq(activos.id, rid));
            if (!a) fallar("No existe.");
            if (!dentroDeVentana(a.creadoEn)) vencido();
            await tx.delete(activos).where(eq(activos.id, rid));
            break;
          }
          case "insumo": {
            soloConfig();
            const [i] = await tx.select({ creadoEn: insumos.creadoEn }).from(insumos).where(eq(insumos.id, rid));
            if (!i) fallar("No existe.");
            if (!dentroDeVentana(i.creadoEn)) vencido();
            // El stock inicial lo genera el alta: se va con el insumo. Cualquier otro movimiento lo frena.
            const [{ otros }] = await tx
              .select({ otros: sql<number>`count(*)::int` })
              .from(movimientosInsumo)
              .where(and(eq(movimientosInsumo.insumoId, rid), sql`coalesce(${movimientosInsumo.nota}, '') <> 'Stock inicial'`));
            if (otros > 0) noSePuede(tipo, "ya tiene movimientos de stock");
            await tx.delete(movimientosInsumo).where(eq(movimientosInsumo.insumoId, rid));
            await tx.delete(insumos).where(eq(insumos.id, rid));
            break;
          }
          case "herramienta": {
            soloConfig();
            const [t] = await tx.select({ id: herramientaTipos.id }).from(herramientaTipos).where(eq(herramientaTipos.id, rid));
            if (!t) fallar("No existe.");
            const unidades = await tx.select({ en: herramientas.actualizadoEn }).from(herramientas).where(eq(herramientas.tipoId, rid));
            // El tipo no guarda fecha de alta: vale la de su unidad más vieja, o se deja borrar si no tiene ninguna.
            if (unidades.some((u) => !dentroDeVentana(u.en))) vencido();
            await tx.delete(herramientas).where(eq(herramientas.tipoId, rid));
            await tx.delete(herramientaTipos).where(eq(herramientaTipos.id, rid));
            break;
          }
          case "obra": {
            soloConfig();
            const [o] = await tx.select({ creadoEn: obras.creadoEn }).from(obras).where(eq(obras.id, rid));
            if (!o) fallar("No existe.");
            if (!dentroDeVentana(o.creadoEn)) vencido();
            const [{ avances }] = await tx.execute(sql`
              select count(*)::int as avances from obra_subtarea_avances a join obra_subtareas s on s.id = a.subtarea_id
               where s.obra_id = ${rid}`) as unknown as Array<{ avances: number }>;
            if (avances > 0) noSePuede(tipo, "ya tiene avances registrados");
            await tx.delete(obras).where(eq(obras.id, rid));
            break;
          }
          case "plan": {
            soloConfig();
            const [p] = await tx.select({ creadoEn: planes.creadoEn }).from(planes).where(eq(planes.id, rid));
            if (!p) fallar("No existe.");
            if (!dentroDeVentana(p.creadoEn)) vencido();
            await tx.delete(planes).where(eq(planes.id, rid));
            break;
          }
          case "trabajo": {
            const [t] = await tx
              .select({ creadoEn: trabajos.creadoEn, reportadoPorId: trabajos.reportadoPorId, activoId: trabajos.activoId })
              .from(trabajos)
              .where(eq(trabajos.id, rid));
            if (!t) fallar("No existe.");
            if (!configura && t.reportadoPorId !== yo.uid) fallar("Solo podés borrar lo que cargaste vos.");
            if (!dentroDeVentana(t.creadoEn)) vencido();
            // Si al cargarlo cambió el estado del equipo, se deshace: era parte del error.
            const cambios = await tx
              .select()
              .from(activoCambiosEstado)
              .where(eq(activoCambiosEstado.trabajoId, rid))
              .orderBy(asc(activoCambiosEstado.creadoEn));
            if (cambios.length) {
              const [otroPosterior] = await tx
                .select({ id: activoCambiosEstado.id })
                .from(activoCambiosEstado)
                .where(
                  and(
                    eq(activoCambiosEstado.activoId, t.activoId),
                    // Como texto ISO: a una fecha suelta en un sql`` el driver no la sabe mandar.
                    sql`${activoCambiosEstado.creadoEn} > ${cambios[cambios.length - 1].creadoEn.toISOString()}`,
                    sql`${activoCambiosEstado.trabajoId} is distinct from ${rid}`,
                  ),
                )
                .orderBy(desc(activoCambiosEstado.creadoEn))
                .limit(1);
              if (!otroPosterior) {
                await tx.update(activos).set({ estado: cambios[0].desde }).where(eq(activos.id, t.activoId));
              }
              await tx.delete(activoCambiosEstado).where(eq(activoCambiosEstado.trabajoId, rid));
            }
            await tx.delete(trabajos).where(eq(trabajos.id, rid));
            break;
          }
          case "compra": {
            soloConfig();
            const [c] = await tx.select({ creadoEn: compras.creadoEn, estado: compras.estado }).from(compras).where(eq(compras.id, rid));
            if (!c) fallar("No existe.");
            if (c.estado === "recibida") noSePuede(tipo, "ya se recibió y sumó stock");
            if (!dentroDeVentana(c.creadoEn)) vencido();
            await tx.delete(compras).where(eq(compras.id, rid));
            break;
          }
          case "documento": {
            const [d] = await tx
              .select({ creadoEn: documentos.creadoEn, creadoPorId: documentos.creadoPorId })
              .from(documentos)
              .where(eq(documentos.id, rid));
            if (!d) fallar("No existe.");
            if (!configura && d.creadoPorId !== yo.uid) fallar("Solo podés borrar lo que cargaste vos.");
            if (!dentroDeVentana(d.creadoEn)) vencido();
            await tx.delete(documentos).where(eq(documentos.id, rid));
            break;
          }
          case "producto": {
            soloConfig();
            const [p] = await tx.select({ creadoEn: productos.creadoEn }).from(productos).where(eq(productos.id, rid));
            if (!p) fallar("No existe.");
            if (!dentroDeVentana(p.creadoEn)) vencido();
            await tx.delete(productos).where(eq(productos.id, rid));
            break;
          }
          case "orden": {
            soloConfig();
            const [o] = await tx.select({ creadoEn: ordenesFabricacion.creadoEn }).from(ordenesFabricacion).where(eq(ordenesFabricacion.id, rid));
            if (!o) fallar("No existe.");
            if (!dentroDeVentana(o.creadoEn)) vencido();
            const [{ n }] = await tx
              .select({ n: sql<number>`count(*)::int` })
              .from(partesFabricacion)
              .where(eq(partesFabricacion.ordenId, rid));
            if (n > 0) noSePuede(tipo, "ya tiene producción registrada (borrá primero los partes)");
            await tx.delete(ordenesFabricacion).where(eq(ordenesFabricacion.id, rid));
            break;
          }
        }
      });
    } catch (e) {
      if (e instanceof ErrorDeNegocio) throw e;
      if (esViolacionFK(e)) noSePuede(tipo, "ya tiene otras cosas cargadas que lo usan");
      throw e;
    }
    revalidatePath("/", "layout");
  });
}

