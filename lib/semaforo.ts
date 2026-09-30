/**
 * El semáforo de insumos. Módulo puro: lo usan las pantallas y los tests.
 *
 *   stock <= critico            rojo      (ej. caño 40x40x1,6: 5 o menos)
 *   critico < stock <= atento   amarillo  (entre 6 y 10)
 *   stock > atento              verde     (más de 10)
 */
export type Nivel = "rojo" | "amarillo" | "verde";

export function nivelDeStock(stock: number, critico: number, atento: number): Nivel {
  if (stock <= critico) return "rojo";
  if (stock <= atento) return "amarillo";
  return "verde";
}

/** Cuánto pedir para volver al ideal. Cero si no está en amarillo o rojo. */
export function compraSugerida(
  stock: number,
  critico: number,
  atento: number,
  ideal: number,
): number {
  if (nivelDeStock(stock, critico, atento) === "verde") return 0;
  return Math.max(0, redondear(ideal - stock));
}

/**
 * Días que alcanza el stock al ritmo de consumo actual. Null si no hay consumo
 * registrado: "no sé" es distinto de "infinito".
 */
export function coberturaDias(stock: number, consumoMensual: number): number | null {
  if (!(consumoMensual > 0)) return null;
  return Math.max(0, Math.floor((stock / consumoMensual) * 30));
}

export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  rojo: "Crítico",
  amarillo: "Atento",
  verde: "OK",
};

/** Umbrales coherentes: crítico < atento <= ideal. Devuelve el error o null. */
export function validarUmbrales(critico: number, atento: number, ideal: number): string | null {
  if (critico < 0 || atento < 0 || ideal < 0) return "Los umbrales no pueden ser negativos.";
  if (!(critico < atento)) return "El nivel crítico tiene que ser menor que el de atento.";
  if (!(atento <= ideal)) return "El stock ideal tiene que ser mayor o igual que el de atento.";
  return null;
}
