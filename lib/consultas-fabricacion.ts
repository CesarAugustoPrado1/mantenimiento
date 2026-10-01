import "server-only";
import { sql } from "drizzle-orm";
import { filas } from "./db/filas";

export type FilaOrden = {
  id: number;
  producto_id: number;
  producto: string;
  modelo: string | null;
  horas_estandar: number | null;
  cantidad: number;
  hechas: number;
  horas: number;
  destino: string | null;
  estado: "pendiente" | "en_curso" | "terminada" | "cancelada";
  prioridad: string;
  inicio_plan: string | null;
  fin_plan: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_id: number | null;
  responsable: string | null;
  responsable_externo: string | null;
  nota: string | null;
  creado_en: string;
};

export function ordenes(filtro: { abiertas?: boolean; productoId?: number; id?: number; anio?: number } = {}) {
  return filas<FilaOrden>(sql`
    select o.id, o.producto_id, p.nombre as producto, p.modelo, p.horas_estandar::float8 as horas_estandar,
           o.cantidad,
           coalesce((select sum(unidades) from partes_fabricacion x where x.orden_id = o.id), 0)::int as hechas,
           coalesce((select sum(horas_hombre) from partes_fabricacion x where x.orden_id = o.id), 0)::float8 as horas,
           o.destino, o.estado, o.prioridad,
           o.inicio_plan::text as inicio_plan, o.fin_plan::text as fin_plan,
           o.fecha_inicio::text as fecha_inicio, o.fecha_fin::text as fecha_fin,
           o.responsable_id, u.nombre as responsable, o.responsable_externo, o.nota, o.creado_en::text as creado_en
      from ordenes_fabricacion o
      join productos p on p.id = o.producto_id
      left join usuarios u on u.id = o.responsable_id
     where true
       ${filtro.id ? sql`and o.id = ${filtro.id}` : sql``}
       ${filtro.productoId ? sql`and o.producto_id = ${filtro.productoId}` : sql``}
       ${filtro.abiertas === true ? sql`and o.estado in ('pendiente', 'en_curso')` : sql``}
       ${filtro.abiertas === false ? sql`and o.estado in ('terminada', 'cancelada')` : sql``}
       ${filtro.anio ? sql`and extract(year from coalesce(o.fin_plan, o.fecha_fin, o.creado_en::date)) = ${filtro.anio}` : sql``}
     order by (o.estado in ('pendiente','en_curso')) desc,
              array_position(array['urgente','alta','media','baja']::text[], o.prioridad::text), o.fin_plan nulls last, o.id desc
  `);
}
