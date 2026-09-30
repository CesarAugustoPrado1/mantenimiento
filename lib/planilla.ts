/**
 * Planillas de control: filas (agrupadas en secciones) × columnas, cada celda
 * ✓ / ✗ / —. Módulo puro, lo usan el formulario, las actions y los tests.
 */
import type { ValorCelda } from "./db/schema";

export const COLUMNA_UNICA = "Estado";

export function columnasDe(columnas: string[] | null | undefined): string[] {
  const limpias = (columnas ?? []).map((c) => c.trim()).filter(Boolean);
  return limpias.length ? limpias : [COLUMNA_UNICA];
}

/** El resumen de una fila: mal si alguna celda dio mal, n/a si no se revisó nada. */
export function resumenFila(valores: Record<string, ValorCelda>): "ok" | "no_ok" | "no_aplica" {
  const v = Object.values(valores);
  if (v.includes("mal")) return "no_ok";
  if (v.length === 0 || v.every((x) => x === "na")) return "no_aplica";
  return "ok";
}

/** Filas "Mesa 1" … "Mesa 108": el carrusel no se tipea a mano. */
export function filasNumeradas(prefijo: string, desde: number, hasta: number): string[] {
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || hasta < desde || hasta - desde > 299) return [];
  return Array.from({ length: hasta - desde + 1 }, (_, i) => `${prefijo.trim()} ${desde + i}`.trim());
}

export type Hallazgo = { seccion: string | null; fila: string; columna: string; activoId: number | null };

/** Las celdas en ✗: cada una es un posible correctivo. */
export function hallazgos(
  filas: Array<{ seccion: string | null; descripcion: string; activoId: number | null; valores: Record<string, ValorCelda> }>,
): Hallazgo[] {
  return filas.flatMap((f) =>
    Object.entries(f.valores)
      .filter(([, v]) => v === "mal")
      .map(([columna]) => ({ seccion: f.seccion, fila: f.descripcion, columna, activoId: f.activoId })),
  );
}

/** "Túnel · Cuchilla: Falla" (sin repetir la columna cuando es la única). */
export function tituloHallazgo(h: Hallazgo): string {
  const donde = [h.seccion, h.fila].filter(Boolean).join(" · ");
  return h.columna === COLUMNA_UNICA ? donde : `${donde}: ${h.columna}`;
}
