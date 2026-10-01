import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { usuariosActivos } from "@/lib/consultas";
import { CONFIGURAN } from "@/lib/permisos";
import { fmtFecha, hoyAR } from "@/lib/formato";
import { desvio } from "@/lib/cumplimiento";
import { Chip, ChipPrioridad, Pestanas, Titulo, Vacio } from "@/components/ui";
import { BarraAvance, ChipDesvio } from "@/components/avance";
import { BotonObra } from "./formulario";
import { ESTADO_OBRA, OBRA_VACIA } from "@/lib/etiquetas";

export const metadata = { title: "Obras · Taller" };
export const dynamic = "force-dynamic";

export default async function Obras({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const sesion = await requerirSesion();
  const { ver = "abiertas" } = await searchParams;
  const hoy = hoyAR();
  const [lista, usuarios] = await Promise.all([
    filas<{
      id: number;
      titulo: string;
      lugar: string;
      tipo: string | null;
      estado: keyof typeof ESTADO_OBRA;
      prioridad: string;
      inicio_plan: string | null;
      fin_plan: string | null;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      responsable: string | null;
      subtareas: number;
      avance: number | null;
    }>(sql`
      select o.id, o.titulo, o.lugar, o.tipo, o.estado, o.prioridad,
             o.inicio_plan::text as inicio_plan, o.fin_plan::text as fin_plan,
             o.fecha_inicio::text as fecha_inicio, o.fecha_fin::text as fecha_fin,
             coalesce(u.nombre, o.responsable_externo) as responsable,
             (select count(*)::int from obra_subtareas s where s.obra_id = o.id) as subtareas,
             (select round(avg(s.progreso))::int from obra_subtareas s where s.obra_id = o.id) as avance
        from obras o left join usuarios u on u.id = o.responsable_id
       where ${ver === "cerradas" ? sql`o.estado in ('terminada','cancelada')` : sql`o.estado in ('pendiente','en_curso')`}
       order by array_position(array['urgente','alta','media','baja']::text[], o.prioridad::text), o.fin_plan nulls last, o.id desc
    `),
    usuariosActivos(),
  ]);

  return (
    <>
      <Titulo
        detalle="Tareas fuera de las máquinas: armado de locales, arreglos en oficinas propias, obras edilicias."
        accion={
          <div className="flex flex-wrap gap-2">
            <Link href="/obras/cumplimiento" className="boton-secundario">
              📊 Cumplimiento
            </Link>
            {CONFIGURAN.includes(sesion.rol) && (
              <BotonObra inicial={OBRA_VACIA} usuarios={usuarios.filter((u) => u.rol !== "auditor")} texto="+ Obra" />
            )}
          </div>
        }
      >
        Obras y tareas externas
      </Titulo>
      <Pestanas
        actual={ver}
        opciones={[
          { valor: "abiertas", etiqueta: "Abiertas", href: "/obras" },
          { valor: "cerradas", etiqueta: "Terminadas y canceladas", href: "/obras?ver=cerradas" },
        ]}
      />
      {lista.length === 0 ? (
        <Vacio>No hay obras {ver === "cerradas" ? "cerradas" : "abiertas"}.</Vacio>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {lista.map((o) => {
            const avance = o.avance ?? (o.estado === "terminada" ? 100 : 0);
            return (
              <li key={o.id}>
                <Link href={`/obras/${o.id}`} className="tarjeta block h-full p-4 hover:ring-slate-300">
                  <p className="font-bold">{o.titulo}</p>
                  <p className="text-sm text-slate-600">📍 {o.lugar}</p>
                  <div className="mt-2">
                    <BarraAvance progreso={avance} />
                    {o.subtareas === 0 && <p className="mt-0.5 text-[11px] text-slate-400">sin subtareas</p>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip tono={ESTADO_OBRA[o.estado].tono}>{ESTADO_OBRA[o.estado].texto}</Chip>
                    {o.estado !== "terminada" && o.estado !== "cancelada" && <ChipPrioridad prioridad={o.prioridad} />}
                    {o.estado !== "cancelada" && <ChipDesvio que="Fin" desvio={desvio(o.fin_plan, o.fecha_fin, hoy)} />}
                    {o.tipo && <Chip>{o.tipo}</Chip>}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {o.responsable ?? "sin responsable"}
                    {o.fin_plan && ` · comprometida para el ${fmtFecha(o.fin_plan)}`}
                    {o.fecha_fin && ` · terminó el ${fmtFecha(o.fecha_fin)}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
