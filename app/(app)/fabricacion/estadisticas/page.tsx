import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { ordenes } from "@/lib/consultas-fabricacion";
import { fmtNum, hoyAR } from "@/lib/formato";
import { desvio, resumir } from "@/lib/cumplimiento";
import { eficiencia, horasPorUnidad } from "@/lib/fabricacion";
import { Pestanas, Titulo, Vacio, Volver } from "@/components/ui";

export const metadata = { title: "Estadísticas · Fabricación" };
export const dynamic = "force-dynamic";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Cuánto se fabricó, cuánto tardó contra el estándar y si se cumplieron las
 * fechas. La producción y las horas cuentan por la fecha del parte; el
 * cumplimiento, por la fecha comprometida de cada orden.
 */
export default async function Estadisticas({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requerirSesion();
  const hoy = hoyAR();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = Number((await searchParams).anio) || anioActual;
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;

  const [porProducto, porMes, lista, anios] = await Promise.all([
    filas<{ id: number; nombre: string; modelo: string | null; estandar: number | null; unidades: number; horas: number }>(sql`
      select p.id, p.nombre, p.modelo, p.horas_estandar::float8 as estandar,
             sum(x.unidades)::int as unidades, coalesce(sum(x.horas_hombre), 0)::float8 as horas
        from partes_fabricacion x
        join ordenes_fabricacion o on o.id = x.orden_id
        join productos p on p.id = o.producto_id
       where x.fecha between ${desde} and ${hasta}
       group by p.id order by 5 desc
    `),
    filas<{ mes: number; unidades: number; horas: number }>(sql`
      select extract(month from fecha)::int as mes, sum(unidades)::int as unidades, coalesce(sum(horas_hombre), 0)::float8 as horas
        from partes_fabricacion where fecha between ${desde} and ${hasta} group by 1 order by 1
    `),
    ordenes({ anio }),
    filas<{ anio: number }>(sql`select distinct extract(year from fecha)::int as anio from partes_fabricacion order by 1 desc`),
  ]);

  const vigentes = lista.filter((o) => o.estado !== "cancelada");
  const fin = resumir(vigentes.map((o) => desvio(o.fin_plan, o.fecha_fin, hoy)));
  const totalU = porProducto.reduce((s, p) => s + p.unidades, 0);
  const totalH = porProducto.reduce((s, p) => s + p.horas, 0);
  const maxMes = Math.max(0, ...porMes.map((m) => m.unidades));
  const opciones = [...new Set([anioActual, ...anios.map((a) => a.anio)])].sort((a, b) => b - a);

  return (
    <>
      <Volver href="/fabricacion">Fabricación</Volver>
      <Titulo detalle="Cuánto se fabricó, cuánto tardó contra el estándar y si se cumplieron las fechas comprometidas.">
        Estadísticas de fabricación
      </Titulo>
      <Pestanas actual={String(anio)} opciones={opciones.map((a) => ({ valor: String(a), etiqueta: String(a), href: `/fabricacion/estadisticas?anio=${a}` }))} />

      {totalU === 0 && lista.length === 0 ? (
        <Vacio>Sin producción registrada en {anio}.</Vacio>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="tarjeta p-4">
              <p className="cifra text-3xl">{totalU}</p>
              <p className="text-xs text-slate-500">unidades fabricadas</p>
            </div>
            <div className="tarjeta p-4">
              <p className="cifra text-3xl">{fmtNum(Math.round(totalH))}</p>
              <p className="text-xs text-slate-500">horas hombre</p>
            </div>
            <div className="tarjeta p-4">
              <p className={`cifra text-3xl ${fin.porcentaje == null ? "" : fin.porcentaje >= 80 ? "text-verde" : fin.porcentaje >= 50 ? "text-amarillo-texto" : "text-rojo"}`}>
                {fin.porcentaje == null ? "—" : `${fin.porcentaje}%`}
              </p>
              <p className="text-xs text-slate-500">
                órdenes en fecha{fin.medidos ? ` (${fin.aTiempo} de ${fin.medidos})` : ""}
              </p>
            </div>
            <div className="tarjeta p-4">
              <p className="cifra text-3xl">{fin.atrasoPromedio != null ? `${fin.atrasoPromedio} d` : "—"}</p>
              <p className="text-xs text-slate-500">atraso promedio de las tardías</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="tarjeta overflow-x-auto p-5">
              <h2 className="mb-3 font-bold">Por producto</h2>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">Unid.</th>
                    <th className="text-right">h/u real</th>
                    <th className="text-right">Estándar</th>
                    <th className="text-right">Eficiencia</th>
                  </tr>
                </thead>
                <tbody>
                  {porProducto.map((p) => {
                    const real = horasPorUnidad(p.horas, p.unidades);
                    const ef = eficiencia(p.estandar, real);
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/fabricacion/productos/${p.id}`} className="hover:underline">
                            {p.nombre}
                          </Link>
                          {p.modelo && <span className="block text-xs text-slate-500">{p.modelo}</span>}
                        </td>
                        <td className="text-right tabular-nums">{p.unidades}</td>
                        <td className="text-right tabular-nums">{real != null ? fmtNum(real) : "—"}</td>
                        <td className="text-right tabular-nums">{p.estandar != null ? fmtNum(p.estandar) : "—"}</td>
                        <td className={`text-right font-semibold tabular-nums ${ef == null ? "" : ef >= 100 ? "text-verde" : ef >= 85 ? "text-amarillo-texto" : "text-rojo"}`}>
                          {ef != null ? `${ef}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">Eficiencia: 100% es lo previsto; menos, tardó más que el estándar.</p>
            </section>
            <section className="tarjeta p-5">
              <h2 className="mb-3 font-bold">Unidades por mes</h2>
              <table className="tabla">
                <tbody>
                  {MESES.map((m, i) => {
                    const f = porMes.find((x) => x.mes === i + 1);
                    return (
                      <tr key={m}>
                        <td className="w-12">{m}</td>
                        <td className="w-2/3">
                          <div className="h-2 rounded-full bg-blue-50">
                            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${maxMes && f ? Math.max(2, (f.unidades / maxMes) * 100) : 0}%` }} />
                          </div>
                        </td>
                        <td className="text-right tabular-nums">{f ? f.unidades : "—"}</td>
                        <td className="text-right text-xs text-slate-500 tabular-nums">{f ? `${fmtNum(Math.round(f.horas))} h` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </>
  );
}
