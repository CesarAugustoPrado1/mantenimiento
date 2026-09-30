import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { nombreActivo } from "@/lib/consultas";
import { fmtFecha, fmtNum, fmtPesos } from "@/lib/formato";
import { Chip, ChipPrioridad, Pestanas, Titulo, Vacio } from "@/components/ui";

export const metadata = { title: "Trabajos · Taller" };
export const dynamic = "force-dynamic";

type Fila = {
  id: number;
  tipo: string;
  estado: string;
  prioridad: string;
  titulo: string;
  fecha: string;
  fecha_cierre: string | null;
  activo: string;
  clase: string;
  patente: string | null;
  codigo: string | null;
  realizado: string | null;
  causa: string | null;
  horas_parada: number | null;
  costo: number | null;
};

export default async function Trabajos({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string; clase?: string }>;
}) {
  const sesion = await requerirSesion();
  const { tipo = "todos", estado = "todos", q, clase } = await searchParams;

  const lista = await filas<Fila>(sql`
    select t.id, t.tipo, t.estado, t.prioridad, t.titulo, t.fecha::text as fecha,
           t.fecha_cierre::text as fecha_cierre, a.nombre as activo, a.clase, a.patente, a.codigo,
           coalesce(u.nombre, t.realizado_externo) as realizado, c.nombre as causa,
           t.horas_parada::float8 as horas_parada,
           (coalesce(t.costo_mano_obra, 0) + coalesce(t.costo_repuestos, 0))::float8 as costo
      from trabajos t
      join activos a on a.id = t.activo_id
      left join usuarios u on u.id = t.realizado_por_id
      left join causas c on c.id = t.causa_id
     where true
       ${tipo === "preventivo" || tipo === "correctivo" ? sql`and t.tipo = ${tipo}` : sql``}
       ${estado === "pendientes" ? sql`and t.estado <> 'cerrado'` : sql``}
       ${estado === "cerrados" ? sql`and t.estado = 'cerrado'` : sql``}
       ${clase === "maquina" || clase === "vehiculo" ? sql`and a.clase = ${clase}` : sql``}
       ${q ? sql`and (t.titulo ilike ${"%" + q + "%"} or a.nombre ilike ${"%" + q + "%"} or a.patente ilike ${"%" + q + "%"})` : sql``}
     order by (t.estado <> 'cerrado') desc, t.fecha desc, t.id desc
     limit 300
  `);

  const qs = (c: Record<string, string>) => {
    const p = new URLSearchParams({ tipo, estado, ...(q ? { q } : {}), ...(clase ? { clase } : {}), ...c });
    return `/trabajos?${p}`;
  };

  return (
    <>
      <Titulo
        detalle="Preventivos hechos y correctivos: todo lo que se le hizo a cada equipo."
        accion={
          sesion.rol !== "auditor" ? (
            <Link href="/trabajos/nuevo" className="boton-primario">
              ⚠ Reportar falla
            </Link>
          ) : null
        }
      >
        Trabajos
      </Titulo>
      <Pestanas
        actual={tipo}
        opciones={[
          { valor: "todos", etiqueta: "Todos", href: qs({ tipo: "todos" }) },
          { valor: "preventivo", etiqueta: "Preventivos", href: qs({ tipo: "preventivo" }) },
          { valor: "correctivo", etiqueta: "Correctivos", href: qs({ tipo: "correctivo" }) },
        ]}
      />
      <Pestanas
        actual={estado}
        opciones={[
          { valor: "todos", etiqueta: "Cualquier estado", href: qs({ estado: "todos" }) },
          { valor: "pendientes", etiqueta: "Abiertos", href: qs({ estado: "pendientes" }) },
          { valor: "cerrados", etiqueta: "Cerrados", href: qs({ estado: "cerrados" }) },
        ]}
      />
      <form className="mb-4 flex gap-2" action="/trabajos">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="estado" value={estado} />
        <input name="q" defaultValue={q} className="campo max-w-sm" placeholder="Buscar por título, equipo o patente" />
        <button className="boton-secundario">Buscar</button>
      </form>

      {lista.length === 0 ? (
        <Vacio>No hay trabajos con ese filtro.</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-slate-100">
          {lista.map((t) => (
            <li key={t.id}>
              <Link href={`/trabajos/${t.id}`} className="flex items-start gap-3 p-3 hover:bg-slate-50">
                <span className="w-20 shrink-0 pt-0.5 text-xs text-slate-500">{fmtFecha(t.fecha)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {t.clase === "vehiculo" ? "🚚" : "🏭"} {nombreActivo({ nombre: t.activo, patente: t.patente, codigo: t.codigo })}
                    {t.realizado && ` · ${t.realizado}`}
                    {t.causa && ` · causa: ${t.causa}`}
                    {t.horas_parada ? ` · ${fmtNum(t.horas_parada)} h parado` : ""}
                    {t.costo ? ` · ${fmtPesos(t.costo)}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Chip tono={t.tipo === "preventivo" ? "verde" : "amarillo"}>{t.tipo}</Chip>
                  {t.estado !== "cerrado" && (
                    <>
                      <Chip tono="rojo">{t.estado === "en_curso" ? "en curso" : "abierto"}</Chip>
                      <ChipPrioridad prioridad={t.prioridad} />
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
