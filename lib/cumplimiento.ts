/**
 * Avance y cumplimiento de obras. Módulo puro: el "hoy" entra por parámetro.
 *
 * Desvío = días entre lo comprometido y lo que pasó. Positivo = tarde.
 * Se promete empezar el 10/10 y se arranca el 15: +5. Se compromete el
 * local para el 5/11 y está el 20/11: +15.
 */
import { diasEntre } from "./vencimientos";

export const PASOS = [0, 25, 50, 75, 100] as const;
export type Paso = (typeof PASOS)[number];

export const ETIQUETA_PASO: Record<Paso, string> = {
  0: "Sin empezar",
  25: "Empezado",
  50: "Por la mitad",
  75: "Avanzado",
  100: "Finalizado",
};

export function esPaso(n: number): n is Paso {
  return (PASOS as readonly number[]).includes(n);
}

/** Avance de la obra: promedio de sus subtareas (todas pesan igual). */
export function avanceObra(subtareas: Array<{ progreso: number }>): number | null {
  if (subtareas.length === 0) return null;
  return Math.round(subtareas.reduce((s, x) => s + x.progreso, 0) / subtareas.length);
}

export type Desvio =
  | { tipo: "sin_plan" }
  | { tipo: "pendiente"; faltan: number } // todavía no pasó la fecha comprometida
  | { tipo: "cumplido"; dias: number } // ya pasó: dias > 0 tarde, <= 0 a tiempo
  | { tipo: "vencido"; dias: number }; // no pasó y la fecha comprometida ya venció

export function desvio(plan: string | null, real: string | null, hoy: string): Desvio {
  if (!plan) return { tipo: "sin_plan" };
  if (real) return { tipo: "cumplido", dias: diasEntre(plan, real) };
  const atraso = diasEntre(plan, hoy);
  return atraso > 0 ? { tipo: "vencido", dias: atraso } : { tipo: "pendiente", faltan: -atraso };
}

export function aTiempo(d: Desvio): boolean | null {
  if (d.tipo === "cumplido") return d.dias <= 0;
  if (d.tipo === "vencido") return false;
  return null;
}

export function textoDesvio(d: Desvio): string {
  switch (d.tipo) {
    case "sin_plan":
      return "sin fecha comprometida";
    case "pendiente":
      return d.faltan === 0 ? "vence hoy" : `faltan ${d.faltan} días`;
    case "vencido":
      return `${d.dias} días de atraso`;
    case "cumplido":
      return d.dias <= 0 ? (d.dias < 0 ? `${-d.dias} días antes` : "a tiempo") : `${d.dias} días tarde`;
  }
}

export type Resumen = {
  medidos: number;
  aTiempo: number;
  porcentaje: number | null;
  /** Atraso promedio de los que terminaron tarde o están vencidos. */
  atrasoPromedio: number | null;
};

/** Cuántos se cumplieron en fecha, de los que ya se pueden medir. */
export function resumir(desvios: Desvio[]): Resumen {
  const medibles = desvios.filter((d) => aTiempo(d) !== null);
  const ok = medibles.filter((d) => aTiempo(d)).length;
  const atrasos = medibles
    .map((d) => (d.tipo === "cumplido" || d.tipo === "vencido" ? d.dias : 0))
    .filter((x) => x > 0);
  return {
    medidos: medibles.length,
    aTiempo: ok,
    porcentaje: medibles.length ? Math.round((ok / medibles.length) * 100) : null,
    atrasoPromedio: atrasos.length ? Math.round((atrasos.reduce((s, x) => s + x, 0) / atrasos.length) * 10) / 10 : null,
  };
}

/**
 * Qué fechas reales quedan después de mover el avance de una subtarea.
 * El primer paso > 0 marca el inicio; llegar a 100 marca el fin; volver
 * atrás desde 100 lo borra (no está terminada); volver a 0 borra el inicio.
 */
export function fechasTrasAvance(
  antes: { progreso: number; inicioReal: string | null; finReal: string | null },
  progreso: number,
  fecha: string,
): { inicioReal: string | null; finReal: string | null } {
  let inicioReal = antes.inicioReal;
  let finReal = antes.finReal;
  if (progreso > 0 && !inicioReal) inicioReal = fecha;
  if (progreso === 0) inicioReal = null;
  if (progreso === 100) finReal = antes.progreso === 100 && finReal ? finReal : fecha;
  else finReal = null;
  return { inicioReal, finReal };
}
