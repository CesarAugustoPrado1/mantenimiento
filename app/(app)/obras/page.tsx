import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { usuariosActivos } from "@/lib/consultas";
import { CONFIGURAN } from "@/lib/permisos";
import { fmtFecha } from "@/lib/formato";
import { Chip, ChipPrioridad, Pestanas, Titulo, Vacio } from "@/components/ui";
import { BotonObra } from "./formulario";
import { ESTADO_OBRA, OBRA_VACIA } from "@/lib/etiquetas";

export const metadata = { title: "Obras · Taller" };
export const dynamic = "force-dynamic";

export default async function Obras({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const sesion = await requerirSesion();
  const { ver = "abiertas" } = await searchParams;
  const [lista, usuarios] = await Promise.all([
    filas<{
      id: number;
      titulo: string;
      lugar: string;
      tipo: string | null;
      estado: keyof typeof ESTADO_OBRA;
      prioridad: string;
      fecha_inicio: string | null;
      fecha_estimada: string | null;
      fecha_fin: string | null;
      responsable: string | null;
      atrasada: boolean;
    }>(sql`
      select o.id, o.titulo, o.lugar, o.tipo, o.estado, o.prioridad, o.fecha_inicio::text as fecha_inicio,
             o.fecha_estimada::text as fecha_estimada, o.fecha_fin::text as fecha_fin,
             coalesce(u.nombre, o.responsable_externo) as responsable,
             (o.estado in ('pendiente','en_curso') and o.fecha_estimada < current_date) as atrasada
        from obras o left join usuarios u on u.id = o.responsable_id
       where ${ver === "cerradas" ? sql`o.estado in ('terminada','cancelada')` : sql`o.estado in ('pendiente','en_curso')`}
       order by array_position(array['urgente','alta','media','baja']::text[], o.prioridad::text), o.fecha_estimada nulls last, o.id desc
    `),
    usuariosActivos(),
  ]);

  return (
    <>
      <Titulo
        detalle="Tareas fuera de las máquinas: armado de locales, arreglos en oficinas propias, obras edilicias."
        accion={
          CONFIGURAN.includes(sesion.rol) ? (
            <BotonObra inicial={OBRA_VACIA} usuarios={usuarios.filter((u) => u.rol !== "auditor")} texto="+ Obra" />
          ) : null
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
          {lista.map((o) => (
            <li key={o.id}>
              <Link href={`/obras/${o.id}`} className="tarjeta block h-full p-4 hover:ring-slate-300">
                <p className="font-bold">{o.titulo}</p>
                <p className="text-sm text-slate-600">📍 {o.lugar}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip tono={ESTADO_OBRA[o.estado].tono}>{ESTADO_OBRA[o.estado].texto}</Chip>
                  {o.estado !== "terminada" && o.estado !== "cancelada" && <ChipPrioridad prioridad={o.prioridad} />}
                  {o.atrasada && <Chip tono="rojo">atrasada</Chip>}
                  {o.tipo && <Chip>{o.tipo}</Chip>}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {o.responsable ?? "sin responsable"}
                  {o.fecha_inicio && ` · desde ${fmtFecha(o.fecha_inicio)}`}
                  {o.fecha_estimada && !o.fecha_fin && ` · estimado ${fmtFecha(o.fecha_estimada)}`}
                  {o.fecha_fin && ` · terminó ${fmtFecha(o.fecha_fin)}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
