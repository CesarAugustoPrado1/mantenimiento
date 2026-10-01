/**
 * Borrar lo cargado por error. Módulo puro (lo usan las pantallas para decidir
 * si muestran el botón, y la action para decidir si lo permite).
 *
 * La regla: se puede borrar dentro de las 24 horas de haberlo cargado y si
 * todavía no tiene nada colgado (eso lo controla la base: si algo lo apunta,
 * el borrado falla). Pasado eso, el registro ya es historia y se da de baja.
 */
export const VENTANA_HORAS = 24;

export function dentroDeVentana(creadoEn: string | Date, ahora: Date = new Date()): boolean {
  // Postgres escribe "2026-10-02 09:00:00.123+00": a JavaScript le falta la "T" y los minutos del huso.
  const t =
    typeof creadoEn === "string"
      ? Date.parse(creadoEn.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"))
      : creadoEn.getTime();
  if (!Number.isFinite(t)) return false;
  return ahora.getTime() - t <= VENTANA_HORAS * 3_600_000 && ahora.getTime() >= t - 60_000;
}

export type TipoBorrable =
  | "activo"
  | "insumo"
  | "herramienta"
  | "obra"
  | "plan"
  | "trabajo"
  | "compra"
  | "documento"
  | "producto"
  | "orden";

/** Postgres: violación de clave foránea (alguien lo está apuntando). */
export function esViolacionFK(e: unknown): boolean {
  const codigo = (x: unknown) => (x && typeof x === "object" && "code" in x ? (x as { code: unknown }).code : undefined);
  return codigo(e) === "23503" || codigo((e as { cause?: unknown })?.cause) === "23503";
}
