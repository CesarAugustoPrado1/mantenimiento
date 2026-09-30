import "server-only";
import { sql } from "drizzle-orm";
import { filas } from "./db/filas";
import { consumoAlto, rendimientoMensual, rendimientoPeriodo, type Mes, type Rendimiento } from "./combustible";
import { hoyAR } from "./formato";
import { sumarDias } from "./vencimientos";
import type { Combustible, Medidor } from "./db/schema";

export type ResumenCombustible = {
  id: number;
  nombre: string;
  patente: string | null;
  codigo: string | null;
  tipo: string;
  combustible: Combustible;
  medidor: Medidor;
  litros30: number;
  ultimaCarga: string | null;
  periodo: Rendimiento | null;
  meses: Mes[];
  alto: boolean;
};

/** Consumo de cada equipo que carga combustible: últimos 90 días y por mes. */
export async function resumenCombustible(activoId?: number): Promise<ResumenCombustible[]> {
  const hoy = hoyAR();
  const desde = sumarDias(hoy, -400);
  const [equipos, lecturas, cargas] = await Promise.all([
    filas<{ id: number; nombre: string; patente: string | null; codigo: string | null; tipo: string; combustible: Combustible; medidor: Medidor }>(sql`
      select id, nombre, patente, codigo, tipo, combustible, medidor from activos
       where combustible is not null and estado <> 'baja' ${activoId ? sql`and id = ${activoId}` : sql``}
       order by nombre
    `),
    filas<{ activo_id: number; fecha: string; valor: number }>(sql`
      select activo_id, fecha::text as fecha, valor::float8 as valor from lecturas
       where fecha >= ${desde} ${activoId ? sql`and activo_id = ${activoId}` : sql``}
    `),
    filas<{ activo_id: number; fecha: string; litros: number }>(sql`
      select activo_id, fecha::text as fecha, litros::float8 as litros from cargas_combustible
       where fecha >= ${desde} ${activoId ? sql`and activo_id = ${activoId}` : sql``}
    `),
  ]);
  const hace30 = sumarDias(hoy, -30);
  return equipos.map((e) => {
    const l = lecturas.filter((x) => x.activo_id === e.id);
    const c = cargas.filter((x) => x.activo_id === e.id);
    const meses = rendimientoMensual(l, c);
    return {
      ...e,
      litros30: c.filter((x) => x.fecha > hace30).reduce((s, x) => s + x.litros, 0),
      ultimaCarga: c.map((x) => x.fecha).sort().pop() ?? null,
      periodo: rendimientoPeriodo(l, c, sumarDias(hoy, -90), hoy),
      meses,
      alto: consumoAlto(meses),
    };
  });
}
