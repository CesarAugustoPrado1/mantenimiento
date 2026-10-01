/**
 * Fabricación propia. Módulo puro.
 *
 * El avance de una orden es por unidades terminadas (7 de 12), no por
 * escalones: acá sí hay algo que contar.
 */
export function avanceOrden(cantidad: number, hechas: number): number {
  if (!(cantidad > 0)) return 0;
  return Math.min(100, Math.round((hechas / cantidad) * 100));
}

/** Horas hombre reales por unidad terminada. Null si todavía no terminó ninguna. */
export function horasPorUnidad(horas: number, unidades: number): number | null {
  if (!(unidades > 0) || !(horas > 0)) return null;
  return Math.round((horas / unidades) * 100) / 100;
}

/**
 * Eficiencia contra el estándar: 100% = tardó lo previsto; 80% = tardó más
 * (el estándar es el 80% de lo real); 125% = tardó menos.
 */
export function eficiencia(estandar: number | null, real: number | null): number | null {
  if (!estandar || !real) return null;
  return Math.round((estandar / real) * 100);
}

/** Lo que hay que descontar del pañol por las unidades terminadas, según la receta. */
export function materialesPara(
  receta: Array<{ insumoId: number | null; cantidad: number }>,
  unidades: number,
): Array<{ insumoId: number; cantidad: number }> {
  if (!(unidades > 0)) return [];
  const total = new Map<number, number>();
  for (const r of receta) {
    if (!r.insumoId || !(r.cantidad > 0)) continue;
    total.set(r.insumoId, (total.get(r.insumoId) ?? 0) + r.cantidad * unidades);
  }
  return [...total].map(([insumoId, cantidad]) => ({ insumoId, cantidad: Math.round(cantidad * 1000) / 1000 }));
}
