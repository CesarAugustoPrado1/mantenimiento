import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { fmtFecha, hoyAR } from "@/lib/formato";
import { desvio, resumir, type Resumen } from "@/lib/cumplimiento";
import { Pestanas, Titulo, Vacio, Volver } from "@/components/ui";
import { ChipDesvio } from "@/components/avance";

export const metadata = { title: "Cumplimiento de obras · Taller" };
export const dynamic = "force-dynamic";

type Fila = {
  id: number;
  obra_id: number;
  titulo: string;
  obra: string;
  responsable: string | null;
  inicio_plan: string | null;
  fin_plan: string | null;
  inicio_real: string | null;
  fin_real: string | null;
};

function Tarjeta({ titulo, r, detalle }: { titulo: string; r: Resumen; detalle: string }) {
  const tono = r.porcentaje == null ? "text-slate-400" : r.porcentaje >= 80 ? "text-verde" : r.porcentaje >= 50 ? "text-amarillo-texto" : "text-rojo";
  return (
    <div className="tarjeta p-4">
      <p className={`cifra text-3xl ${tono}`}>{r.porcentaje == null ? "—" : `${r.porcentaje}%`}</p>
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="text-xs text-slate-500">
        {r.medidos ? `${r.aTiempo} de ${r.medidos} a tiempo` : "nada medible todavía"}
        {r.atrasoPromedio != null && ` · atraso promedio ${r.atrasoPromedio} días`}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">{detalle}</p>
    </div>
  );
}

/**
 * Lo comprometido contra lo que pasó. Cuenta lo que ya se puede medir: lo que
 * terminó (a tiempo o tarde) y lo que no terminó y ya se pasó de fecha. Lo
 * que todavía está en fecha no suma ni resta.
 */
export default async function Cumplimiento({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requerirSesion();
  const hoy = hoyAR();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = Number((await searchParams).anio) || anioActual;
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;

  const [obras, subtareas, anios] = await Promise.all([
    filas<Fila>(sql`
      select o.id, o.id as obra_id, o.titulo, o.titulo as obra, coalesce(u.nombre, o.responsable_externo) as responsable,
             o.inicio_plan::text as inicio_plan, o.fin_plan::text as fin_plan,
             o.fecha_inicio::text as inicio_real, o.fecha_fin::text as fin_real
        from obras o left join usuarios u on u.id = o.responsable_id
       where o.estado <> 'cancelada'
         and coalesce(o.fin_plan, o.inicio_plan) between ${desde} and ${hasta}
       order by o.fin_plan nulls last
    `),
    filas<Fila>(sql`
      select s.id, o.id as obra_id, s.titulo, o.titulo as obra,
             coalesce(u.nombre, s.responsable_externo, ou.nombre, o.responsable_externo) as responsable,
             s.inicio_plan::text as inicio_plan, s.fin_plan::text as fin_plan,
             s.inicio_real::text as inicio_real, s.fin_real::text as fin_real
        from obra_subtareas s
        join obras o on o.id = s.obra_id
        left join usuarios u on u.id = s.responsable_id
        left join usuarios ou on ou.id = o.responsable_id
       where o.estado <> 'cancelada'
         and coalesce(s.fin_plan, s.inicio_plan) between ${desde} and ${hasta}
    `),
    filas<{ anio: number }>(sql`
      select distinct extract(year from coalesce(fin_plan, inicio_plan))::int as anio from obras
       where coalesce(fin_plan, inicio_plan) is not null order by 1 desc
    `),
  ]);

  const finObras = resumir(obras.map((o) => desvio(o.fin_plan, o.fin_real, hoy)));
  const inicioObras = resumir(obras.map((o) => desvio(o.inicio_plan, o.inicio_real, hoy)));
  const finSubs = resumir(subtareas.map((s) => desvio(s.fin_plan, s.fin_real, hoy)));
  const inicioSubs = resumir(subtareas.map((s) => desvio(s.inicio_plan, s.inicio_real, hoy)));

  const responsables = [...new Set(subtareas.map((s) => s.responsable ?? "Sin responsable"))]
    .map((nombre) => {
      const suyas = subtareas.filter((s) => (s.responsable ?? "Sin responsable") === nombre);
      return { nombre, cantidad: suyas.length, fin: resumir(suyas.map((s) => desvio(s.fin_plan, s.fin_real, hoy))) };
    })
    .filter((r) => r.fin.medidos > 0)
    .sort((a, b) => (b.fin.porcentaje ?? 0) - (a.fin.porcentaje ?? 0));

  const opcionesAnio = [...new Set([anioActual, ...anios.map((a) => a.anio)])].sort((a, b) => b - a);

  return (
    <>
      <Volver href="/obras">Obras</Volver>
      <Titulo detalle="Lo comprometido contra lo que pasó. Cuenta lo que ya terminó y lo que se pasó de fecha sin terminar; lo que todavía está en fecha no suma ni resta.">
        Cumplimiento de obras
      </Titulo>
      <Pestanas actual={String(anio)} opciones={opcionesAnio.map((a) => ({ valor: String(a), etiqueta: String(a), href: `/obras/cumplimiento?anio=${a}` }))} />

      {obras.length === 0 && subtareas.length === 0 ? (
        <Vacio>No hay obras con fechas comprometidas en {anio}. Cargá en cada obra y subtarea cuándo empieza y cuándo tiene que estar.</Vacio>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta titulo="Obras terminadas en fecha" r={finObras} detalle={`${obras.length} obras con fecha comprometida`} />
            <Tarjeta titulo="Obras empezadas en fecha" r={inicioObras} detalle="contra el inicio comprometido" />
            <Tarjeta titulo="Subtareas terminadas en fecha" r={finSubs} detalle={`${subtareas.length} subtareas`} />
            <Tarjeta titulo="Subtareas empezadas en fecha" r={inicioSubs} detalle="contra el inicio comprometido" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <section className="tarjeta overflow-x-auto p-5 lg:col-span-2">
              <h2 className="mb-3 font-bold">Obra por obra</h2>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Obra</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {obras.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/obras/${o.id}`} className="font-semibold hover:underline">
                          {o.titulo}
                        </Link>
                        <span className="block text-xs text-slate-500">{o.responsable ?? "sin responsable"}</span>
                      </td>
                      <td className="text-xs">
                        <span className="block text-slate-500">
                          {fmtFecha(o.inicio_plan)} → {fmtFecha(o.inicio_real)}
                        </span>
                        <ChipDesvio que="Inicio" desvio={desvio(o.inicio_plan, o.inicio_real, hoy)} />
                      </td>
                      <td className="text-xs">
                        <span className="block text-slate-500">
                          {fmtFecha(o.fin_plan)} → {fmtFecha(o.fin_real)}
                        </span>
                        <ChipDesvio que="Fin" desvio={desvio(o.fin_plan, o.fin_real, hoy)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="tarjeta p-5">
              <h2 className="mb-1 font-bold">Por responsable</h2>
              <p className="mb-3 text-xs text-slate-500">Subtareas terminadas en fecha.</p>
              {responsables.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay subtareas medibles.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {responsables.map((r) => (
                    <li key={r.nombre}>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{r.nombre}</span>
                        <span className="cifra">{r.fin.porcentaje}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-blue-50">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${r.fin.porcentaje ?? 0}%` }} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.fin.aTiempo} de {r.fin.medidos} a tiempo
                        {r.fin.atrasoPromedio != null && ` · atraso promedio ${r.fin.atrasoPromedio} días`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
