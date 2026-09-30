/**
 * Cuándo vence un preventivo. Módulo puro: sin base, sin fechas del sistema
 * (el "hoy" entra como parámetro), así se prueba.
 *
 * Un plan vence por tiempo, por uso (km u horas), o por lo que llegue primero.
 * Para el uso no hay fecha: se ESTIMA con el ritmo de las lecturas (km/día).
 */
export type EstadoVencimiento = "vencido" | "proximo" | "al_dia" | "sin_datos";

export type EntradaVencimiento = {
  cadaDias: number | null;
  cadaUso: number | null;
  avisoDias: number;
  avisoUso: number | null;
  /** Última vez hecho, o el punto de partida del plan. ISO yyyy-mm-dd. */
  baseFecha: string | null;
  baseUso: number | null;
  /** Última lectura del medidor. */
  usoActual: number | null;
  fechaUsoActual: string | null;
  /** Uso por día, de las lecturas. Null si no hay con qué calcular. */
  ritmo: number | null;
  hoy: string;
};

export type Vencimiento = {
  estado: EstadoVencimiento;
  /** Fecha en que vence por tiempo. */
  venceFecha: string | null;
  /** Lectura a la que vence por uso. */
  venceUso: number | null;
  /** Lo que falta (negativo = pasado). */
  faltanDias: number | null;
  faltaUso: number | null;
  /** La fecha que se muestra en la agenda: la menor entre tiempo y uso estimado. */
  fechaAgenda: string | null;
  /** Si la fecha de agenda sale de una estimación por uso. */
  estimada: boolean;
};

const DIA = 86_400_000;

export function aFecha(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aFecha(iso) + dias * DIA).toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta) - aFecha(desde)) / DIA);
}

export function calcularVencimiento(e: EntradaVencimiento): Vencimiento {
  let venceFecha: string | null = null;
  let faltanDias: number | null = null;
  if (e.cadaDias && e.baseFecha) {
    venceFecha = sumarDias(e.baseFecha, e.cadaDias);
    faltanDias = diasEntre(e.hoy, venceFecha);
  }

  let venceUso: number | null = null;
  let faltaUso: number | null = null;
  let fechaPorUso: string | null = null;
  if (e.cadaUso && e.baseUso != null) {
    venceUso = e.baseUso + e.cadaUso;
    if (e.usoActual != null) {
      faltaUso = venceUso - e.usoActual;
      if (faltaUso <= 0) {
        fechaPorUso = e.fechaUsoActual ?? e.hoy;
      } else if (e.ritmo && e.ritmo > 0 && e.fechaUsoActual) {
        fechaPorUso = sumarDias(e.fechaUsoActual, Math.ceil(faltaUso / e.ritmo));
        /**
         * Si la estimación ya pasó es que la última lectura es vieja: al ritmo
         * de siempre, ya tendría que estar llegando. Se muestra "hoy", no una
         * fecha pasada que parece un error.
         */
        if (fechaPorUso < e.hoy) fechaPorUso = e.hoy;
      }
    }
  }

  const sinTiempo = faltanDias == null;
  const sinUso = faltaUso == null;
  if (sinTiempo && sinUso) {
    return {
      estado: "sin_datos",
      venceFecha,
      venceUso,
      faltanDias,
      faltaUso,
      fechaAgenda: null,
      estimada: false,
    };
  }

  const vencido =
    (faltanDias != null && faltanDias <= 0) || (faltaUso != null && faltaUso <= 0);
  const proximo =
    (faltanDias != null && faltanDias <= e.avisoDias) ||
    (faltaUso != null && e.avisoUso != null && faltaUso <= e.avisoUso) ||
    (fechaPorUso != null && diasEntre(e.hoy, fechaPorUso) <= e.avisoDias);

  let fechaAgenda = venceFecha;
  let estimada = false;
  if (fechaPorUso && (!fechaAgenda || fechaPorUso < fechaAgenda)) {
    fechaAgenda = fechaPorUso;
    estimada = faltaUso != null && faltaUso > 0;
  }

  return {
    estado: vencido ? "vencido" : proximo ? "proximo" : "al_dia",
    venceFecha,
    venceUso,
    faltanDias,
    faltaUso,
    fechaAgenda,
    estimada,
  };
}

/**
 * Uso por día entre dos lecturas. Pide al menos 7 días de separación: dos
 * lecturas del mismo día o de días seguidos dan ritmos absurdos.
 */
export function ritmoDeUso(
  primera: { fecha: string; valor: number } | null,
  ultima: { fecha: string; valor: number } | null,
): number | null {
  if (!primera || !ultima) return null;
  const dias = diasEntre(primera.fecha, ultima.fecha);
  if (dias < 7) return null;
  const delta = ultima.valor - primera.valor;
  if (delta <= 0) return null;
  return delta / dias;
}
