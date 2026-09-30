import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { nombreActivo } from "@/lib/consultas";
import { fmtNum, fmtPesos, fmtUsd, hoyAR } from "@/lib/formato";
import { Aviso, Pestanas, Titulo } from "@/components/ui";

export const metadata = { title: "Informes · Taller" };
export const dynamic = "force-dynamic";

/**
 * Todos los gastos del taller en una sola lista, cada uno con la cotización
 * vigente a SU fecha. Se calcula al leer, nunca se guarda convertido: si una
 * cotización estaba mal, se corrige y el informe se arregla solo.
 *
 * Si no hay cotización anterior a un gasto, se usa la primera posterior (la
 * más cercana que hay); si no hay ninguna, el gasto queda sin dólares y se
 * avisa.
 */
const GASTOS = sql`
  with g as (
    select t.fecha, (coalesce(t.costo_mano_obra, 0) + coalesce(t.costo_repuestos, 0)) as ars,
           'Trabajos (externos)' as rubro, t.activo_id
      from trabajos t
     where coalesce(t.costo_mano_obra, 0) + coalesce(t.costo_repuestos, 0) > 0
    union all
    select coalesce(o.fecha_fin, o.fecha_inicio, o.creado_en::date),
           coalesce(o.costo_mano_obra, 0) + coalesce(o.costo_materiales, 0), 'Obras', null
      from obras o
     where coalesce(o.costo_mano_obra, 0) + coalesce(o.costo_materiales, 0) > 0
    union all
    select m.fecha, m.cantidad * m.precio_unitario, 'Compras de insumos', null
      from movimientos_insumo m
     where m.tipo = 'ingreso' and m.precio_unitario is not null
  )
  select g.fecha, g.ars, g.rubro, g.activo_id,
         g.ars / nullif(coalesce(
           (select c.ars_por_usd from cotizaciones c where c.fecha <= g.fecha order by c.fecha desc limit 1),
           (select c.ars_por_usd from cotizaciones c where c.fecha > g.fecha order by c.fecha asc limit 1)
         ), 0) as usd
    from g
`;

function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const ancho = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-blue-50">
      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${ancho}%` }} />
    </div>
  );
}

export default async function Informes({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requerirSesion();
  const hoy = hoyAR();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = Number((await searchParams).anio) || anioActual;
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;

  const [resumen, porMes, porAnio, porRubro, causas, equipos, sinCotizacion] = await Promise.all([
    fila<{ preventivos: number; correctivos: number; abiertos: number; horas_parada: number; horas_hombre: number; obras: number }>(sql`
      select count(*) filter (where tipo = 'preventivo')::int as preventivos,
             count(*) filter (where tipo = 'correctivo')::int as correctivos,
             count(*) filter (where tipo = 'correctivo' and estado <> 'cerrado')::int as abiertos,
             coalesce(sum(horas_parada), 0)::float8 as horas_parada,
             coalesce(sum(horas_hombre), 0)::float8 as horas_hombre,
             (select count(*) from obras where coalesce(fecha_fin, fecha_inicio, creado_en::date) between ${desde} and ${hasta})::int as obras
        from trabajos where fecha between ${desde} and ${hasta}
    `),
    filas<{ mes: number; ars: number; usd: number | null }>(sql`
      select extract(month from fecha)::int as mes, sum(ars)::float8 as ars, sum(usd)::float8 as usd
        from (${GASTOS}) x where fecha between ${desde} and ${hasta} group by 1 order by 1
    `),
    filas<{ anio: number; ars: number; usd: number | null }>(sql`
      select extract(year from fecha)::int as anio, sum(ars)::float8 as ars, sum(usd)::float8 as usd
        from (${GASTOS}) x group by 1 order by 1
    `),
    filas<{ rubro: string; ars: number; usd: number | null }>(sql`
      select rubro, sum(ars)::float8 as ars, sum(usd)::float8 as usd
        from (${GASTOS}) x where fecha between ${desde} and ${hasta} group by 1 order by 3 desc nulls last
    `),
    filas<{ causa: string; cantidad: number; horas: number }>(sql`
      select coalesce(c.nombre, 'Sin causa todavía') as causa, count(*)::int as cantidad,
             coalesce(sum(t.horas_parada), 0)::float8 as horas
        from trabajos t left join causas c on c.id = t.causa_id
       where t.tipo = 'correctivo' and t.fecha between ${desde} and ${hasta}
       group by 1 order by 2 desc
    `),
    filas<{ id: number; nombre: string; patente: string | null; codigo: string | null; clase: string; preventivos: number; correctivos: number; horas: number; usd: number | null; ars: number }>(sql`
      select a.id, a.nombre, a.patente, a.codigo, a.clase,
             count(t.id) filter (where t.tipo = 'preventivo')::int as preventivos,
             count(t.id) filter (where t.tipo = 'correctivo')::int as correctivos,
             coalesce(sum(t.horas_parada), 0)::float8 as horas,
             (select sum(usd) from (${GASTOS}) x where x.activo_id = a.id and x.fecha between ${desde} and ${hasta})::float8 as usd,
             coalesce((select sum(ars) from (${GASTOS}) x where x.activo_id = a.id and x.fecha between ${desde} and ${hasta}), 0)::float8 as ars
        from activos a
        left join trabajos t on t.activo_id = a.id and t.fecha between ${desde} and ${hasta}
       group by a.id
      having count(t.id) > 0
       order by correctivos desc, horas desc
    `),
    fila<{ n: number }>(sql`select count(*)::int as n from (${GASTOS}) x where usd is null`),
  ]);

  const anios = Array.from(new Set([anioActual, ...porAnio.map((a) => a.anio)])).sort((a, b) => b - a);
  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const maxMes = Math.max(0, ...porMes.map((m) => m.usd ?? 0));
  const maxAnio = Math.max(0, ...porAnio.map((m) => m.usd ?? 0));
  const maxCausa = Math.max(0, ...causas.map((c) => c.cantidad));
  const totalUsd = porMes.reduce((s, m) => s + (m.usd ?? 0), 0);
  const totalArs = porMes.reduce((s, m) => s + m.ars, 0);

  return (
    <>
      <Titulo detalle="Lo que se hizo, lo que se rompió y lo que costó. Los montos se comparan en dólares a la fecha de cada gasto.">
        Informes
      </Titulo>
      <Pestanas actual={String(anio)} opciones={anios.map((a) => ({ valor: String(a), etiqueta: String(a), href: `/informes?anio=${a}` }))} />

      {sinCotizacion && sinCotizacion.n > 0 && (
        <div className="mb-4">
          <Aviso tono="alerta">
            Hay {sinCotizacion.n} gasto(s) sin dólares porque no hay ninguna cotización cargada.{" "}
            <Link href="/admin/cotizaciones" className="underline">
              Cargar cotizaciones
            </Link>
          </Aviso>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Preventivos hechos", fmtNum(resumen?.preventivos ?? 0)],
          [resumen?.abiertos ? `Correctivos (${resumen.abiertos} abiertos)` : "Correctivos", fmtNum(resumen?.correctivos ?? 0)],
          ["Horas de equipo parado", fmtNum(resumen?.horas_parada ?? 0)],
          ["Horas hombre", fmtNum(resumen?.horas_hombre ?? 0)],
          ["Gasto del año", `${fmtUsd(totalUsd)}`],
        ].map(([t, v]) => (
          <div key={t} className="tarjeta p-4">
            <p className="cifra text-2xl">{v}</p>
            <p className="text-xs text-slate-500">{t}</p>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">Nominal en pesos: {fmtPesos(totalArs)} (no comparable entre años).</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="tarjeta p-5">
          <h2 className="mb-3 font-bold">Gasto por mes (USD)</h2>
          <table className="tabla">
            <tbody>
              {MESES.map((m, i) => {
                const f = porMes.find((x) => x.mes === i + 1);
                return (
                  <tr key={m}>
                    <td className="w-12">{m}</td>
                    <td className="w-1/2">
                      <Barra valor={f?.usd ?? 0} maximo={maxMes} />
                    </td>
                    <td className="text-right tabular-nums">{f ? fmtUsd(f.usd) : "—"}</td>
                    <td className="text-right text-xs text-slate-500 tabular-nums">{f ? fmtPesos(f.ars) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="space-y-5">
          <div className="tarjeta p-5">
            <h2 className="mb-3 font-bold">Año contra año (USD)</h2>
            <table className="tabla">
              <tbody>
                {porAnio.map((a) => (
                  <tr key={a.anio}>
                    <td className="w-14">{a.anio}</td>
                    <td className="w-1/2">
                      <Barra valor={a.usd ?? 0} maximo={maxAnio} />
                    </td>
                    <td className="text-right tabular-nums">{fmtUsd(a.usd)}</td>
                  </tr>
                ))}
                {porAnio.length === 0 && (
                  <tr>
                    <td className="text-slate-500">Sin gastos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="tarjeta p-5">
            <h2 className="mb-3 font-bold">Por rubro ({anio})</h2>
            <table className="tabla">
              <tbody>
                {porRubro.map((r) => (
                  <tr key={r.rubro}>
                    <td>{r.rubro}</td>
                    <td className="text-right tabular-nums">{fmtUsd(r.usd)}</td>
                    <td className="text-right text-xs text-slate-500 tabular-nums">{fmtPesos(r.ars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tarjeta p-5">
          <h2 className="mb-3 font-bold">Por qué se rompen las cosas ({anio})</h2>
          {causas.length === 0 ? (
            <p className="text-sm text-slate-500">Sin correctivos este año.</p>
          ) : (
            <table className="tabla">
              <tbody>
                {causas.map((c) => (
                  <tr key={c.causa}>
                    <td>{c.causa}</td>
                    <td className="w-1/3">
                      <Barra valor={c.cantidad} maximo={maxCausa} />
                    </td>
                    <td className="text-right tabular-nums">{c.cantidad}</td>
                    <td className="text-right text-xs text-slate-500 tabular-nums">{fmtNum(c.horas)} h parado</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta overflow-x-auto p-5">
          <h2 className="mb-3 font-bold">Por equipo ({anio})</h2>
          {equipos.length === 0 ? (
            <p className="text-sm text-slate-500">Sin trabajos este año.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th className="text-right">Prev.</th>
                  <th className="text-right">Corr.</th>
                  <th className="text-right">H. parado</th>
                  <th className="text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/activos/${e.id}`} className="hover:underline">
                        {e.clase === "vehiculo" ? "🚚" : "🏭"} {nombreActivo(e)}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{e.preventivos}</td>
                    <td className="text-right tabular-nums">{e.correctivos}</td>
                    <td className="text-right tabular-nums">{fmtNum(e.horas)}</td>
                    <td className="text-right tabular-nums">{e.ars ? fmtUsd(e.usd) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
