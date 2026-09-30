import "server-only";
import type { SQL } from "drizzle-orm";
import { db } from "./index";

/**
 * Lectura con SQL a mano, tipada por quien la pide.
 *
 * Convención: los numeric se castean a `::float8` y las fechas a `::text` en
 * la consulta misma, así a la pantalla llegan números y "yyyy-mm-dd", nunca
 * strings de numeric ni objetos Date corridos por el huso.
 */
export async function filas<T>(consulta: SQL): Promise<T[]> {
  return (await db.execute(consulta)) as unknown as T[];
}

export async function fila<T>(consulta: SQL): Promise<T | undefined> {
  return (await filas<T>(consulta))[0];
}
