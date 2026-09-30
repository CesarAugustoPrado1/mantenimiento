/** Formatos para mostrar. Todo en castellano de Argentina. */

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const dolares = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const fmtNum = (n: number | string | null | undefined) =>
  n == null || n === "" ? "—" : numero.format(Number(n));

export const fmtPesos = (n: number | string | null | undefined) =>
  n == null || n === "" ? "—" : pesos.format(Number(n));

export const fmtUsd = (n: number | string | null | undefined) =>
  n == null || n === "" ? "—" : dolares.format(Number(n));

/** yyyy-mm-dd -> dd/mm/aaaa, sin pasar por Date para no correr el día por el huso. */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Hoy en Argentina, como yyyy-mm-dd. */
export function hoyAR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

export function plural(n: number, uno: string, varios: string) {
  return `${fmtNum(n)} ${n === 1 ? uno : varios}`;
}

export const UNIDAD_MEDIDOR = { km: "km", horas: "h", ninguno: "" } as const;

/** "3,2 L/h · 0,31 h por litro" o "11,4 L/100 km · 8,8 km/L". */
export function fmtRendimiento(
  medidor: "km" | "horas" | "ninguno",
  r: { porUnidad: number | null; unidadesPorLitro: number | null } | null,
): { principal: string; secundario: string } | null {
  if (!r || r.porUnidad == null || r.unidadesPorLitro == null) return null;
  const n = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  if (medidor === "km") return { principal: `${n(r.porUnidad * 100)} L/100 km`, secundario: `${n(r.unidadesPorLitro)} km por litro` };
  return { principal: `${n(r.porUnidad)} L/h`, secundario: `${n(r.unidadesPorLitro)} h por litro` };
}

export const ETIQUETA_COMBUSTIBLE = { diesel: "Diésel", nafta: "Nafta", gnc: "GNC", electrico: "Eléctrico" } as const;
