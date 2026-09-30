/**
 * Lectura de las APIs públicas del dólar. Módulo puro (sin fetch): recibe el
 * JSON y devuelve filas limpias, así se prueba sin red.
 *
 *   api.argentinadatos.com/v1/cotizaciones/dolares/<casa>  historial completo
 *   dolarapi.com/v1/dolares/<casa>                         solo hoy (respaldo)
 */
export const CASAS = {
  oficial: "Oficial (BNA)",
  bolsa: "MEP (bolsa)",
  contadoconliqui: "Contado con liqui",
  blue: "Blue",
  mayorista: "Mayorista",
} as const;
export type Casa = keyof typeof CASAS;

export type Cotizacion = { fecha: string; arsPorUsd: number };

const esFecha = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);

/** Se usa el valor de VENTA: es lo que cuesta comprar un dólar. */
export function leerHistorial(json: unknown, desde: string): Cotizacion[] {
  if (!Array.isArray(json)) return [];
  const porFecha = new Map<string, number>();
  for (const f of json) {
    const venta = Number((f as { venta?: unknown })?.venta);
    const fecha = (f as { fecha?: unknown })?.fecha;
    if (!esFecha(fecha) || !(venta > 0)) continue;
    const dia = fecha.slice(0, 10);
    if (dia >= desde) porFecha.set(dia, venta);
  }
  return [...porFecha].map(([fecha, arsPorUsd]) => ({ fecha, arsPorUsd })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function leerHoy(json: unknown, hoy: string): Cotizacion | null {
  const venta = Number((json as { venta?: unknown })?.venta);
  return venta > 0 ? { fecha: hoy, arsPorUsd: venta } : null;
}
