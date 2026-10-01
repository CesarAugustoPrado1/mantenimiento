import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { config } from "./db/schema";
import { CASAS, type Casa } from "./cotizacion-api";

export const CLAVE_CASA = "cotizacion_casa";
export const CLAVE_DESDE = "cotizacion_desde";

export async function leerConfig(clave: string): Promise<string | null> {
  const [fila] = await db.select({ valor: config.valor }).from(config).where(eq(config.clave, clave)).limit(1);
  return fila?.valor ?? null;
}

export async function escribirConfig(clave: string, valor: string) {
  await db.insert(config).values({ clave, valor }).onConflictDoUpdate({ target: config.clave, set: { valor } });
}

/** Qué dólar se usa para los informes. Oficial si no se eligió otro. */
export async function casaCotizacion(): Promise<Casa> {
  const v = await leerConfig(CLAVE_CASA);
  return v && v in CASAS ? (v as Casa) : "oficial";
}

/** Desde cuándo se trae el historial. */
export async function desdeCotizacion(): Promise<string> {
  const v = await leerConfig(CLAVE_DESDE);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "2024-01-01";
}

export const CLAVE_MODO_PRUEBA = "modo_prueba";

/**
 * Si la instalación está en etapa de prueba. El default cuando la fila no
 * existe es "no", y eso es lo importante: una base nueva no puede nacer con el
 * botón de borrar todo puesto. Se prende a mano, desde Neon:
 *
 *   insert into config (clave, valor) values ('modo_prueba', 'si')
 *     on conflict (clave) do update set valor = 'si';
 */
export async function enModoPrueba(): Promise<boolean> {
  return (await leerConfig(CLAVE_MODO_PRUEBA)) === "si";
}
