import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { nombreActivo } from "@/lib/consultas";
import { resumenCombustible } from "@/lib/consultas-combustible";
import { borrarCarga } from "@/lib/acciones/combustible";
import { CONFIGURAN } from "@/lib/permisos";
import { ETIQUETA_COMBUSTIBLE, fmtFecha, fmtNum, fmtPesos, fmtRendimiento, hoyAR } from "@/lib/formato";
import type { Medidor } from "@/lib/db/schema";
import { BotonAccion } from "@/components/admin";
import { Chip, Titulo, Vacio } from "@/components/ui";
import { CargarCombustible } from "./formulario";

export const metadata = { title: "Combustible · Taller" };
export const dynamic = "force-dynamic";

export default async function Combustible({ searchParams }: { searchParams: Promise<{ activo?: string }> }) {
  const sesion = await requerirSesion();
  const { activo } = await searchParams;
  const esConductor = sesion.rol === "conductor";

  const [resumen, ultimas, insumos, cargas] = await Promise.all([
    resumenCombustible(),
    filas<{ activo_id: number; valor: number }>(sql`
      select distinct on (activo_id) activo_id, valor::float8 as valor from lecturas order by activo_id, fecha desc
    `),
    // El tambor de gasoil o nafta, si se lleva como insumo: categoría Combustibles.
    filas<{ id: number; nombre: string; stock: number; unidad: string }>(sql`
      select i.id, i.nombre, i.stock::float8 as stock, i.unidad from insumos i
        join categorias_insumo c on c.id = i.categoria_id
       where i.activo and c.nombre ilike '%combustible%'
       order by i.nombre
    `),
    filas<{
      id: number;
      fecha: string;
      litros: number;
      lectura: number | null;
      precio_litro: number | null;
      activo: string;
      patente: string | null;
      codigo: string | null;
      medidor: Medidor;
      usuario: string;
    }>(sql`
      select c.id, c.fecha::text as fecha, c.litros::float8 as litros, c.lectura::float8 as lectura,
             c.precio_litro::float8 as precio_litro, a.nombre as activo, a.patente, a.codigo, a.medidor, u.nombre as usuario
        from cargas_combustible c join activos a on a.id = c.activo_id join usuarios u on u.id = c.usuario_id
       ${esConductor ? sql`where c.usuario_id = ${sesion.uid}` : sql``}
       order by c.fecha desc, c.id desc limit 60
    `),
  ]);

  const permitidos = esConductor
    ? (
        await filas<{ id: number }>(sql`
          select id from activos where combustible is not null and estado <> 'baja' and clase = 'vehiculo'
             and (propiedad = 'empresa' or responsable_id = ${sesion.uid})
        `)
      ).map((x) => x.id)
    : null;
  const equipos = resumen
    .filter((e) => !permitidos || permitidos.includes(e.id))
    .map((e) => ({
      id: e.id,
      nombre: nombreActivo(e),
      medidor: e.medidor,
      combustible: ETIQUETA_COMBUSTIBLE[e.combustible],
      ultima: ultimas.find((u) => u.activo_id === e.id)?.valor ?? null,
    }));

  return (
    <>
      <Titulo detalle="Cada bidón que se carga, con las horas del horómetro. El consumo sale de litros cargados / horas trabajadas en el período.">
        Combustible
      </Titulo>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:order-2">
          {sesion.rol !== "auditor" &&
            (equipos.length ? (
              <CargarCombustible equipos={equipos} insumos={insumos} hoy={hoyAR()} inicial={Number(activo) || null} />
            ) : (
              <Vacio>No hay equipos con combustible. En la ficha de cada clark o vehículo, elegí qué combustible usa.</Vacio>
            ))}
        </div>

        <div className="space-y-5 lg:col-span-2">
          {!esConductor && (
            <section>
              <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Consumo por equipo (últimos 90 días)</h2>
              {resumen.length === 0 ? (
                <Vacio>Todavía no hay equipos con combustible.</Vacio>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {resumen.map((e) => {
                    const r = fmtRendimiento(e.medidor, e.periodo);
                    return (
                      <li key={e.id}>
                        <Link href={`/activos/${e.id}`} className="tarjeta block h-full p-4 hover:ring-slate-300">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold">{nombreActivo(e)}</p>
                            <Chip tono={e.combustible === "diesel" ? "oscuro" : "azul"}>{ETIQUETA_COMBUSTIBLE[e.combustible]}</Chip>
                          </div>
                          {r ? (
                            <>
                              <p className="cifra mt-1 text-2xl">{r.principal}</p>
                              <p className="text-xs text-slate-500">{r.secundario}</p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-slate-500">Faltan cargas con lectura para calcular.</p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            {fmtNum(e.litros30)} L en 30 días · última carga {fmtFecha(e.ultimaCarga)}
                          </p>
                          {e.alto && (
                            <p className="mt-1">
                              <Chip tono="rojo">consumo alto este mes</Chip>
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
              {esConductor ? "Tus últimas cargas" : "Últimas cargas"}
            </h2>
            {cargas.length === 0 ? (
              <Vacio>Sin cargas registradas.</Vacio>
            ) : (
              <div className="tarjeta overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Equipo</th>
                      <th className="text-right">Litros</th>
                      <th className="text-right">Lectura</th>
                      <th>Quién</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {cargas.map((c) => (
                      <tr key={c.id}>
                        <td className="whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                        <td>
                          {nombreActivo({ nombre: c.activo, patente: c.patente, codigo: c.codigo })}
                          {c.precio_litro != null && <span className="block text-xs text-slate-500">{fmtPesos(c.precio_litro)}/L</span>}
                        </td>
                        <td className="text-right cifra">{fmtNum(c.litros)}</td>
                        <td className="text-right tabular-nums">
                          {c.lectura != null ? `${fmtNum(c.lectura)} ${c.medidor === "km" ? "km" : "h"}` : "—"}
                        </td>
                        <td className="text-xs text-slate-500">{c.usuario}</td>
                        <td className="text-right">
                          {CONFIGURAN.includes(sesion.rol) && (
                            <BotonAccion accion={borrarCarga.bind(null, c.id)} clase="text-xs text-slate-400 underline" confirmar="¿Borrar esta carga?">
                              borrar
                            </BotonAccion>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
