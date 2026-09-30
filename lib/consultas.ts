import "server-only";
import { sql } from "drizzle-orm";
import { filas } from "./db/filas";
import { hoyAR } from "./formato";
import { calcularVencimiento, ritmoDeUso, type Vencimiento } from "./vencimientos";
import type { ClaseActivo, EstadoActivo, Medidor, Rol } from "./db/schema";

/* -------------------------------------------------------------------------- */
/* Opciones para los selects                                                  */
/* -------------------------------------------------------------------------- */

export type OpcionUsuario = { id: number; nombre: string; rol: Rol };

export function usuariosActivos() {
  return filas<OpcionUsuario>(sql`
    select id, nombre, rol from usuarios where activo order by nombre
  `);
}

export type OpcionInsumo = { id: number; nombre: string; unidad: string; stock: number; codigo: string | null };

export function insumosActivos() {
  return filas<OpcionInsumo>(sql`
    select id, nombre, unidad, stock::float8 as stock, codigo
      from insumos where activo order by nombre
  `);
}

export function categorias() {
  return filas<{ id: number; nombre: string; activa: boolean }>(sql`
    select id, nombre, activa from categorias_insumo order by nombre
  `);
}

export function causasActivas() {
  return filas<{ id: number; nombre: string }>(sql`
    select id, nombre from causas where activa order by nombre
  `);
}

export type OpcionActivo = {
  id: number;
  nombre: string;
  clase: ClaseActivo;
  tipo: string;
  medidor: Medidor;
  patente: string | null;
  codigo: string | null;
  responsable_id: number | null;
};

export function activosVigentes(soloDe?: number) {
  return filas<OpcionActivo>(sql`
    select id, nombre, clase, tipo, medidor, patente, codigo, responsable_id
      from activos
     where estado <> 'baja' ${soloDe ? sql`and responsable_id = ${soloDe}` : sql``}
     order by clase, nombre
  `);
}

/** Cómo se nombra un equipo en una lista: "Hilux (AB123CD)". */
export function nombreActivo(a: { nombre: string; patente?: string | null; codigo?: string | null }) {
  const extra = a.patente || a.codigo;
  return extra ? `${a.nombre} (${extra})` : a.nombre;
}

/* -------------------------------------------------------------------------- */
/* Agenda de preventivos                                                      */
/* -------------------------------------------------------------------------- */

export type ItemAgenda = {
  plan_id: number;
  plan: string;
  cada_dias: number | null;
  cada_uso: number | null;
  responsable_id: number | null;
  responsable: string | null;
  responsable_externo: string | null;
  activo_id: number;
  activo: string;
  clase: ClaseActivo;
  tipo: string;
  medidor: Medidor;
  patente: string | null;
  codigo: string | null;
  estado_activo: EstadoActivo;
  ult_fecha: string | null;
  ult_lectura: number | null;
  lec_fecha: string | null;
  lec_valor: number | null;
  materiales_faltantes: number;
  venc: Vencimiento;
};

type FilaAgenda = Omit<ItemAgenda, "venc"> & {
  aviso_dias: number;
  aviso_uso: number | null;
  desde_fecha: string | null;
  desde_uso: number | null;
  lec0_fecha: string | null;
  lec0_valor: number | null;
};

/**
 * Todos los planes activos con su vencimiento calculado. Las lecturas de los
 * últimos 180 días dan el ritmo (km/día) con el que se estima la fecha de los
 * planes por uso.
 */
export async function agenda(filtro: { activoId?: number; responsableId?: number } = {}) {
  const hoy = hoyAR();
  const crudas = await filas<FilaAgenda>(sql`
    select p.id as plan_id, p.nombre as plan, p.cada_dias, p.cada_uso, p.aviso_dias, p.aviso_uso,
           p.responsable_id, u.nombre as responsable, p.responsable_externo,
           p.desde_fecha::text as desde_fecha, p.desde_uso::float8 as desde_uso,
           a.id as activo_id, a.nombre as activo, a.clase, a.tipo, a.medidor, a.patente, a.codigo,
           a.estado as estado_activo,
           ut.fecha::text as ult_fecha, ut.lectura::float8 as ult_lectura,
           l1.fecha::text as lec_fecha, l1.valor::float8 as lec_valor,
           l0.fecha::text as lec0_fecha, l0.valor::float8 as lec0_valor,
           (select count(*)::int from plan_materiales pm join insumos i on i.id = pm.insumo_id
             where pm.plan_id = p.id and i.stock < pm.cantidad) as materiales_faltantes
      from planes p
      join activos a on a.id = p.activo_id
      left join usuarios u on u.id = p.responsable_id
      left join lateral (
        select t.fecha, t.lectura from trabajos t
         where t.plan_id = p.id and t.tipo = 'preventivo' and t.estado = 'cerrado'
         order by t.fecha desc, t.id desc limit 1
      ) ut on true
      left join lateral (
        select l.fecha, l.valor from lecturas l where l.activo_id = a.id
         order by l.fecha desc limit 1
      ) l1 on true
      left join lateral (
        select l.fecha, l.valor from lecturas l
         where l.activo_id = a.id and l.fecha >= l1.fecha - 180
         order by l.fecha asc limit 1
      ) l0 on true
     where p.activo and a.estado <> 'baja'
       ${filtro.activoId ? sql`and a.id = ${filtro.activoId}` : sql``}
       ${filtro.responsableId ? sql`and p.responsable_id = ${filtro.responsableId}` : sql``}
  `);

  return crudas
    .map((f): ItemAgenda => {
      const baseUso = f.ult_lectura ?? f.desde_uso;
      const usoActual =
        f.lec_valor != null && f.ult_lectura != null
          ? Math.max(f.lec_valor, f.ult_lectura)
          : (f.lec_valor ?? f.ult_lectura);
      const ritmo = ritmoDeUso(
        f.lec0_fecha ? { fecha: f.lec0_fecha, valor: f.lec0_valor! } : null,
        f.lec_fecha ? { fecha: f.lec_fecha, valor: f.lec_valor! } : null,
      );
      const venc = calcularVencimiento({
        cadaDias: f.cada_dias,
        cadaUso: f.medidor === "ninguno" ? null : f.cada_uso,
        avisoDias: f.aviso_dias,
        avisoUso: f.aviso_uso,
        baseFecha: f.ult_fecha ?? f.desde_fecha,
        baseUso,
        usoActual,
        fechaUsoActual: f.lec_fecha ?? f.ult_fecha,
        ritmo,
        hoy,
      });
      return { ...f, venc };
    })
    .sort((a, b) => {
      const orden = { vencido: 0, proximo: 1, al_dia: 2, sin_datos: 3 };
      const d = orden[a.venc.estado] - orden[b.venc.estado];
      if (d) return d;
      return (a.venc.fechaAgenda ?? "9999").localeCompare(b.venc.fechaAgenda ?? "9999");
    });
}
