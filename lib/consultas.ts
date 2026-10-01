import "server-only";
import { sql } from "drizzle-orm";
import { filas } from "./db/filas";
import { hoyAR } from "./formato";
import { calcularVencimiento, ritmoDeUso, type Vencimiento } from "./vencimientos";
import type { ClaseActivo, EstadoActivo, Etapa, Medidor, Rol, TipoDocumento } from "./db/schema";

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

/* -------------------------------------------------------------------------- */
/* Repuestos críticos                                                         */
/* -------------------------------------------------------------------------- */

export type FilaRepuesto = {
  vinculo_id: number;
  activo_id: number;
  activo: string;
  activo_codigo: string | null;
  activo_patente: string | null;
  insumo_id: number;
  nombre: string;
  codigo: string | null;
  unidad: string;
  stock: number;
  critico: number;
  atento: number;
  ideal: number;
  tiempo_reposicion_dias: number | null;
  proveedor: string | null;
  ubicacion: string | null;
  donde_va: string | null;
  criticidad: "alta" | "media" | "baja";
  nota: string | null;
};

export function repuestos(filtro: { activoId?: number } = {}) {
  return filas<FilaRepuesto>(sql`
    select ar.id as vinculo_id, a.id as activo_id, a.nombre as activo, a.codigo as activo_codigo,
           a.patente as activo_patente, i.id as insumo_id, i.nombre, i.codigo, i.unidad,
           i.stock::float8 as stock, i.critico::float8 as critico, i.atento::float8 as atento,
           i.ideal::float8 as ideal, i.tiempo_reposicion_dias, i.proveedor, i.ubicacion,
           ar.donde_va, ar.criticidad, ar.nota
      from activo_repuestos ar
      join activos a on a.id = ar.activo_id
      join insumos i on i.id = ar.insumo_id
     where a.estado <> 'baja' and i.activo
       ${filtro.activoId ? sql`and a.id = ${filtro.activoId}` : sql``}
     order by array_position(array['alta','media','baja']::text[], ar.criticidad::text), i.nombre
  `);
}

export function repuestosDisponibles() {
  return filas<{ id: number; nombre: string; codigo: string | null; unidad: string; stock: number }>(sql`
    select id, nombre, codigo, unidad, stock::float8 as stock from insumos
     where activo order by es_repuesto desc, nombre
  `);
}

/* -------------------------------------------------------------------------- */
/* Archivos                                                                   */
/* -------------------------------------------------------------------------- */

export type FilaDocumento = {
  id: number;
  titulo: string;
  tipo: TipoDocumento;
  etapa: Etapa | null;
  nota: string | null;
  archivado: boolean;
  activo_id: number | null;
  activo: string | null;
  obra_id: number | null;
  obra: string | null;
  insumo_id: number | null;
  insumo: string | null;
  producto_id: number | null;
  producto: string | null;
  version: number;
  url: string;
  fecha: string;
  nota_version: string | null;
  mime: string | null;
  nombre_archivo: string | null;
  tamano_bytes: number | null;
  en_drive: boolean;
  creado_en: string;
  creado_por_id: number;
  versiones: Array<{ version: number; url: string; fecha: string; nota: string | null; usuario: string }>;
};

export function documentos(filtro: {
  activoId?: number;
  obraId?: number;
  insumoId?: number;
  productoId?: number;
  tipo?: string;
  q?: string;
  archivados?: boolean;
}) {
  return filas<FilaDocumento>(sql`
    select d.id, d.titulo, d.tipo, d.etapa, d.nota, d.archivado,
           d.activo_id, a.nombre as activo, d.obra_id, o.titulo as obra, d.insumo_id, i.nombre as insumo,
           d.producto_id, pr.nombre as producto,
           v.version, v.url, v.fecha::text as fecha, v.nota as nota_version,
           v.mime, v.nombre_archivo, v.tamano_bytes, (v.drive_file_id is not null) as en_drive,
           d.creado_en::text as creado_en, d.creado_por_id,
           (select json_agg(json_build_object('version', x.version, 'url', x.url, 'fecha', x.fecha::text,
                                              'nota', x.nota, 'usuario', u.nombre) order by x.version desc)
              from documento_versiones x join usuarios u on u.id = x.creado_por_id
             where x.documento_id = d.id) as versiones
      from documentos d
      join lateral (
        select version, url, fecha, nota, mime, nombre_archivo, tamano_bytes, drive_file_id from documento_versiones
         where documento_id = d.id order by version desc limit 1
      ) v on true
      left join activos a on a.id = d.activo_id
      left join obras o on o.id = d.obra_id
      left join insumos i on i.id = d.insumo_id
      left join productos pr on pr.id = d.producto_id
     where ${filtro.archivados ? sql`d.archivado` : sql`not d.archivado`}
       ${filtro.activoId ? sql`and d.activo_id = ${filtro.activoId}` : sql``}
       ${filtro.obraId ? sql`and d.obra_id = ${filtro.obraId}` : sql``}
       ${filtro.insumoId ? sql`and d.insumo_id = ${filtro.insumoId}` : sql``}
       ${filtro.productoId ? sql`and d.producto_id = ${filtro.productoId}` : sql``}
       ${filtro.tipo ? sql`and d.tipo = ${filtro.tipo}` : sql``}
       ${filtro.q ? sql`and (d.titulo ilike ${"%" + filtro.q + "%"} or d.nota ilike ${"%" + filtro.q + "%"})` : sql``}
     order by d.tipo, d.titulo
  `);
}
