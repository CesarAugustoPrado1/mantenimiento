/**
 * Rendimiento de combustible. Módulo puro.
 *
 * Con bidones no hay "tanque lleno", así que el método es el de períodos:
 * entre dos lecturas del horómetro, todo lo que se cargó DESPUÉS de la primera
 * y hasta la segunda es lo que se consumió en esas horas. En un período largo
 * los bidones sueltos se compensan.
 */
import { diasEntre } from "./vencimientos";

export type Lectura = { fecha: string; valor: number };
export type Carga = { fecha: string; litros: number };

export type Rendimiento = {
  litros: number;
  uso: number;
  /** Litros por hora (o por km). */
  porUnidad: number | null;
  /** Horas (o km) por litro. */
  unidadesPorLitro: number | null;
};

function rendimiento(litros: number, uso: number): Rendimiento {
  const ok = uso > 0 && litros > 0;
  return {
    litros,
    uso,
    porUnidad: ok ? litros / uso : null,
    unidadesPorLitro: ok ? uso / litros : null,
  };
}

/** Entre la primera y la última lectura de la ventana [desde, hasta]. */
export function rendimientoPeriodo(
  lecturas: Lectura[],
  cargas: Carga[],
  desde: string,
  hasta: string,
): Rendimiento | null {
  const enVentana = lecturas
    .filter((l) => l.fecha >= desde && l.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (enVentana.length < 2) return null;
  const primera = enVentana[0];
  const ultima = enVentana[enVentana.length - 1];
  const litros = cargas
    .filter((c) => c.fecha > primera.fecha && c.fecha <= ultima.fecha)
    .reduce((s, c) => s + c.litros, 0);
  return rendimiento(litros, ultima.valor - primera.valor);
}

export type Mes = { mes: string } & Rendimiento;

/**
 * Por mes: uso = última lectura del mes − última lectura del mes anterior;
 * litros = cargas del mes. Meses sin lectura quedan afuera.
 */
export function rendimientoMensual(lecturas: Lectura[], cargas: Carga[]): Mes[] {
  const cierre = new Map<string, number>();
  for (const l of [...lecturas].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    cierre.set(l.fecha.slice(0, 7), l.valor);
  }
  const meses = [...cierre.keys()].sort();
  const salida: Mes[] = [];
  for (let i = 1; i < meses.length; i++) {
    const mes = meses[i];
    const litros = cargas.filter((c) => c.fecha.slice(0, 7) === mes).reduce((s, c) => s + c.litros, 0);
    salida.push({ mes, ...rendimiento(litros, cierre.get(mes)! - cierre.get(meses[i - 1])!) });
  }
  return salida.reverse();
}

/**
 * ¿El consumo reciente está muy por encima de lo normal? Compara el último mes
 * con el promedio de los anteriores (al menos 3). Un salto así es una pérdida,
 * un motor que anda mal, o combustible que no va a donde se anota.
 */
export function consumoAlto(meses: Mes[], margen = 0.25): boolean {
  const validos = meses.filter((m) => m.porUnidad != null);
  if (validos.length < 4) return false;
  const [ultimo, ...previos] = validos;
  const base = previos.slice(0, 6);
  const promedio = base.reduce((s, m) => s + m.porUnidad!, 0) / base.length;
  return ultimo.porUnidad! > promedio * (1 + margen);
}

export { diasEntre };
