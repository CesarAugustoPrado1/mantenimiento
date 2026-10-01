import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { activosVigentes, categorias, nombreActivo } from "@/lib/consultas";
import { CONFIGURAN, OPERAN } from "@/lib/permisos";
import { fmtFecha, fmtNum, fmtPesos, hoyAR } from "@/lib/formato";
import { coberturaDias, compraSugerida, nivelDeStock } from "@/lib/semaforo";
import { Chip, ChipCriticidad, Semaforo, Titulo, Volver } from "@/components/ui";
import Link from "next/link";
import { EditarInsumo, PanelMovimiento } from "./panel";

export const dynamic = "force-dynamic";

type Insumo = {
  id: number;
  codigo: string | null;
  nombre: string;
  categoria_id: number | null;
  categoria: string | null;
  unidad: string;
  stock: number;
  critico: number;
  atento: number;
  ideal: number;
  infaltable: boolean;
  ubicacion: string | null;
  proveedor: string | null;
  nota: string | null;
  activo: boolean;
  es_repuesto: boolean;
  tiempo_reposicion_dias: number | null;
  consumo_90: number;
  ultimo_precio: number | null;
  ultimo_precio_fecha: string | null;
};

export default async function FichaInsumo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [i, movimientos, activos, obras, cats, porEquipo, usos, archivos] = await Promise.all([
    fila<Insumo>(sql`
      select i.id, i.codigo, i.nombre, i.categoria_id, c.nombre as categoria, i.unidad,
             i.stock::float8 as stock, i.critico::float8 as critico, i.atento::float8 as atento,
             i.ideal::float8 as ideal, i.infaltable, i.ubicacion, i.proveedor, i.nota, i.activo,
             i.es_repuesto, i.tiempo_reposicion_dias,
             coalesce((select -sum(m.cantidad) from movimientos_insumo m
                        where m.insumo_id = i.id and m.tipo = 'consumo'
                          and m.fecha >= current_date - 90), 0)::float8 as consumo_90,
             p.precio_unitario::float8 as ultimo_precio, p.fecha::text as ultimo_precio_fecha
        from insumos i
        left join categorias_insumo c on c.id = i.categoria_id
        left join lateral (
          select precio_unitario, fecha from movimientos_insumo
           where insumo_id = i.id and precio_unitario is not null
           order by fecha desc, id desc limit 1
        ) p on true
       where i.id = ${id}
    `),
    filas<{
      id: number;
      tipo: string;
      cantidad: number;
      stock_despues: number;
      fecha: string;
      usuario: string;
      activo: string | null;
      patente: string | null;
      obra: string | null;
      trabajo_id: number | null;
      compra_id: number | null;
      precio_unitario: number | null;
      nota: string | null;
    }>(sql`
      select m.id, m.tipo, m.cantidad::float8 as cantidad, m.stock_despues::float8 as stock_despues,
             m.fecha::text as fecha, u.nombre as usuario, a.nombre as activo, a.patente,
             o.titulo as obra, m.trabajo_id, m.compra_id,
             m.precio_unitario::float8 as precio_unitario, m.nota
        from movimientos_insumo m
        join usuarios u on u.id = m.usuario_id
        left join activos a on a.id = m.activo_id
        left join obras o on o.id = m.obra_id
       where m.insumo_id = ${id}
       order by m.fecha desc, m.id desc
       limit 100
    `),
    activosVigentes(),
    filas<{ id: number; titulo: string }>(sql`
      select id, titulo from obras where estado in ('pendiente', 'en_curso') order by titulo
    `),
    categorias(),
    filas<{ nombre: string; patente: string | null; total: number }>(sql`
      select coalesce(a.nombre, o.titulo, 'Uso general') as nombre, a.patente,
             (-sum(m.cantidad))::float8 as total
        from movimientos_insumo m
        left join activos a on a.id = m.activo_id
        left join obras o on o.id = m.obra_id
       where m.insumo_id = ${id} and m.tipo = 'consumo' and m.fecha >= current_date - 365
       group by 1, 2 order by 3 desc limit 8
    `),
    filas<{ activo_id: number; activo: string; codigo: string | null; patente: string | null; donde_va: string | null; criticidad: "alta" | "media" | "baja" }>(sql`
      select a.id as activo_id, a.nombre as activo, a.codigo, a.patente, ar.donde_va, ar.criticidad
        from activo_repuestos ar join activos a on a.id = ar.activo_id
       where ar.insumo_id = ${id} and a.estado <> 'baja' order by a.nombre
    `),
    fila<{ n: number }>(sql`select count(*)::int as n from documentos where insumo_id = ${id} and not archivado`),
  ]);
  if (!i) notFound();

  const nivel = nivelDeStock(i.stock, i.critico, i.atento);
  const mensual = i.consumo_90 / 3;
  const dias = coberturaDias(i.stock, mensual);
  const sugerida = compraSugerida(i.stock, i.critico, i.atento, i.ideal);
  const puedeOperar = OPERAN.includes(sesion.rol);

  return (
    <>
      <Volver href="/insumos">Insumos</Volver>
      <Titulo
        detalle={[i.categoria, i.codigo, i.ubicacion].filter(Boolean).join(" · ") || undefined}
        accion={
          CONFIGURAN.includes(sesion.rol) ? (
            <EditarInsumo
              categorias={cats.filter((c) => c.activa || c.id === i.categoria_id)}
              datos={{
                id: i.id,
                codigo: i.codigo ?? "",
                nombre: i.nombre,
                categoriaId: i.categoria_id,
                unidad: i.unidad,
                critico: String(i.critico),
                atento: String(i.atento),
                ideal: String(i.ideal),
                infaltable: i.infaltable,
                ubicacion: i.ubicacion ?? "",
                proveedor: i.proveedor ?? "",
                nota: i.nota ?? "",
                activo: i.activo,
                esRepuesto: i.es_repuesto,
                tiempoReposicionDias: i.tiempo_reposicion_dias != null ? String(i.tiempo_reposicion_dias) : "",
              }}
            />
          ) : null
        }
      >
        {i.nombre} {i.infaltable && <Chip tono="oscuro">infaltable</Chip>}
        {i.es_repuesto && <Chip tono="azul">repuesto</Chip>}
        {!i.activo && <Chip>desactivado</Chip>}
      </Titulo>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase">Stock</p>
          <p className="cifra text-3xl">
            {fmtNum(i.stock)} <span className="text-base font-medium text-slate-500">{i.unidad}</span>
          </p>
          <div className="mt-1">
            <Semaforo nivel={nivel} />
          </div>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase">Umbrales</p>
          <p className="mt-1 text-sm">🔴 hasta {fmtNum(i.critico)}</p>
          <p className="text-sm">🟡 hasta {fmtNum(i.atento)}</p>
          <p className="text-sm">Ideal: {fmtNum(i.ideal)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase">Consumo</p>
          <p className="cifra text-2xl">{mensual > 0 ? fmtNum(Math.round(mensual * 10) / 10) : "—"}</p>
          <p className="text-xs text-slate-500">por mes (últimos 90 días)</p>
          <p className="mt-1 text-sm">{dias == null ? "Sin consumo registrado" : `Alcanza para ~${dias} días`}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase">Reposición</p>
          <p className="cifra text-2xl">{sugerida > 0 ? fmtNum(sugerida) : "—"}</p>
          <p className="text-xs text-slate-500">{sugerida > 0 ? "sugeridos para la próxima compra" : "no hace falta comprar"}</p>
          {i.ultimo_precio != null && (
            <p className="mt-1 text-xs text-slate-500">
              Último precio: {fmtPesos(i.ultimo_precio)} ({fmtFecha(i.ultimo_precio_fecha)})
            </p>
          )}
        </div>
      </div>

      {puedeOperar && i.activo && (
        <div className="mt-4">
          <PanelMovimiento
            insumoId={i.id}
            unidad={i.unidad}
            hoy={hoyAR()}
            activos={activos.map((a) => ({ id: a.id, nombre: nombreActivo(a) }))}
            obras={obras}
          />
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Movimientos</h2>
          <div className="tarjeta overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Qué</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Queda</th>
                  <th>Quién</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                    <td>
                      <span className="font-medium capitalize">{m.tipo}</span>
                      <span className="block text-xs text-slate-500">
                        {[
                          m.activo && nombreActivo({ nombre: m.activo, patente: m.patente }),
                          m.obra,
                          m.trabajo_id && `trabajo #${m.trabajo_id}`,
                          m.compra_id && `compra #${m.compra_id}`,
                          m.precio_unitario != null && `${fmtPesos(m.precio_unitario)} c/u`,
                          m.nota,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </td>
                    <td className={`text-right cifra ${m.cantidad < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {m.cantidad > 0 ? "+" : ""}
                      {fmtNum(m.cantidad)}
                    </td>
                    <td className="text-right tabular-nums">{fmtNum(m.stock_despues)}</td>
                    <td className="text-xs text-slate-500">{m.usuario}</td>
                  </tr>
                ))}
                {movimientos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500">
                      Sin movimientos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
            Quién lo consume (12 meses)
          </h2>
          <ul className="tarjeta divide-y divide-slate-100">
            {porEquipo.map((p) => (
              <li key={`${p.nombre}-${p.patente}`} className="flex justify-between gap-2 p-3 text-sm">
                <span>{nombreActivo(p)}</span>
                <span className="cifra">
                  {fmtNum(p.total)} {i.unidad}
                </span>
              </li>
            ))}
            {porEquipo.length === 0 && <li className="p-3 text-sm text-slate-500">Sin consumos.</li>}
          </ul>
          {(i.es_repuesto || usos.length > 0) && (
            <div className="tarjeta mt-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="mb-1 text-sm font-bold tracking-wide text-slate-500 uppercase">Repuesto de</p>
                <Link href={`/archivos?insumo=${i.id}`} className="text-sm font-semibold underline">
                  📁 Planos ({archivos?.n ?? 0})
                </Link>
              </div>
              {i.tiempo_reposicion_dias != null && (
                <p className="mb-2 text-sm">
                  Conseguirlo tarda <strong>{i.tiempo_reposicion_dias} días</strong>.
                </p>
              )}
              {usos.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no está vinculado a ninguna máquina.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {usos.map((u) => (
                    <li key={u.activo_id} className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/activos/${u.activo_id}`} className="hover:underline">
                        {nombreActivo({ nombre: u.activo, codigo: u.codigo, patente: u.patente })}
                        {u.donde_va && <span className="text-slate-500"> · {u.donde_va}</span>}
                      </Link>
                      <ChipCriticidad criticidad={u.criticidad} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {i.proveedor && <p className="mt-3 text-sm text-slate-600">Proveedor habitual: {i.proveedor}</p>}
          {i.nota && <p className="mt-1 text-sm text-slate-600">{i.nota}</p>}
        </section>
      </div>
    </>
  );
}
