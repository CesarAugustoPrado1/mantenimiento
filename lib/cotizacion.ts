import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { cotizaciones } from "./db/schema";
import { hoyAR } from "./formato";
import { casaCotizacion, desdeCotizacion } from "./configuracion";
import { leerHistorial, leerHoy, type Casa, type Cotizacion } from "./cotizacion-api";

const HISTORIAL = "https://api.argentinadatos.com/v1/cotizaciones/dolares/";
const HOY = "https://dolarapi.com/v1/dolares/";

async function traer(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url} contestó ${r.status}`);
  return r.json();
}

export type ResultadoCotizacion = { casa: Casa; guardadas: number; ultima: Cotizacion | null; fuente: string };

/**
 * Trae el dólar de internet y lo guarda. Primero el historial completo
 * (argentinadatos), así se llenan los días que falten; si esa API no
 * contesta, al menos el valor de hoy (dolarapi).
 *
 * Nunca pisa una cotización cargada a mano: si alguien la corrigió, manda.
 * Si se cambió de casa (de oficial a MEP), las automáticas de la otra casa se
 * reemplazan, para que los informes no mezclen dos dólares distintos.
 */
export async function actualizarCotizaciones(): Promise<ResultadoCotizacion> {
  const [casa, desde] = await Promise.all([casaCotizacion(), desdeCotizacion()]);
  let filas: Cotizacion[] = [];
  let fuente = "argentinadatos.com";
  try {
    filas = leerHistorial(await traer(HISTORIAL + casa), desde);
  } catch (e) {
    console.warn("[cotizacion] historial:", e);
  }
  if (filas.length === 0) {
    fuente = "dolarapi.com";
    const hoy = leerHoy(await traer(HOY + casa), hoyAR());
    if (!hoy) throw new Error("Ninguna de las dos APIs devolvió una cotización.");
    filas = [hoy];
  }

  const etiqueta = `auto:${casa}`;
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from cotizaciones where fuente like 'auto:%' and fuente <> ${etiqueta}`);
    for (let i = 0; i < filas.length; i += 500) {
      await tx
        .insert(cotizaciones)
        .values(filas.slice(i, i + 500).map((f) => ({ fecha: f.fecha, arsPorUsd: String(f.arsPorUsd), fuente: etiqueta })))
        .onConflictDoUpdate({
          target: cotizaciones.fecha,
          set: { arsPorUsd: sql`excluded.ars_por_usd`, fuente: sql`excluded.fuente` },
          setWhere: sql`${cotizaciones.fuente} <> 'manual'`,
        });
    }
  });
  return { casa, guardadas: filas.length, ultima: filas[filas.length - 1] ?? null, fuente };
}
