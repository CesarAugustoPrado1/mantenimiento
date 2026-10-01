import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { usuariosActivos } from "@/lib/consultas";
import { ordenes } from "@/lib/consultas-fabricacion";
import { borrarParte } from "@/lib/acciones/fabricacion";
import { CONFIGURAN, OPERAN } from "@/lib/permisos";
import { ESTADO_OBRA } from "@/lib/etiquetas";
import { fmtFecha, fmtNum, hoyAR } from "@/lib/formato";
import { desvio } from "@/lib/cumplimiento";
import { avanceOrden, eficiencia, horasPorUnidad } from "@/lib/fabricacion";
import { BotonAccion } from "@/components/admin";
import { Chip, ChipPrioridad, Titulo, Volver } from "@/components/ui";
import { ChipDesvio } from "@/components/avance";
import { BotonOrden, NuevoParte } from "../../formularios";
import { BorrarPorError } from "@/components/borrar-error";
import { dentroDeVentana } from "@/lib/borrado";


export const dynamic = "force-dynamic";

export default async function FichaOrden({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const hoy = hoyAR();
  const [o] = await ordenes({ id });
  if (!o) notFound();

  const [partes, materiales, receta, usuarios] = await Promise.all([
    filas<{ id: number; fecha: string; unidades: number; horas: number | null; quien: string | null; nota: string | null; usuario_id: number }>(sql`
      select p.id, p.fecha::text as fecha, p.unidades, p.horas_hombre::float8 as horas, u.nombre as quien, p.nota, p.usuario_id
        from partes_fabricacion p left join usuarios u on u.id = p.realizado_por_id
       where p.orden_id = ${id} order by p.fecha desc, p.id desc
    `),
    filas<{ insumo_id: number; nombre: string; unidad: string; total: number }>(sql`
      select i.id as insumo_id, i.nombre, i.unidad, (-sum(m.cantidad))::float8 as total
        from movimientos_insumo m join insumos i on i.id = m.insumo_id
       where m.orden_fabricacion_id = ${id} group by i.id having sum(m.cantidad) <> 0 order by i.nombre
    `),
    filas<{ n: number }>(sql`select count(*)::int as n from producto_materiales where producto_id = ${o.producto_id} and insumo_id is not null`),
    usuariosActivos(),
  ]);

  const av = avanceOrden(o.cantidad, o.hechas);
  const real = horasPorUnidad(o.horas, o.hechas);
  const ef = eficiencia(o.horas_estandar, real);
  const opera = OPERAN.includes(sesion.rol);
  const configura = CONFIGURAN.includes(sesion.rol);
  const elegibles = usuarios.filter((u) => u.rol !== "auditor" && u.rol !== "conductor");
  const abierta = o.estado === "pendiente" || o.estado === "en_curso";

  return (
    <>
      <Volver href="/fabricacion">Fabricación</Volver>
      <Titulo
        detalle={
          <>
            <Link href={`/fabricacion/productos/${o.producto_id}`} className="underline">
              {o.producto}
            </Link>
            {o.modelo && ` · ${o.modelo}`}
            {o.destino && ` · para ${o.destino}`}
          </>
        }
        accion={
          configura ? (
            <BotonOrden
              texto="Editar"
              clase="boton-secundario text-sm"
              productos={[{ id: o.producto_id, nombre: o.producto, modelo: o.modelo }]}
              usuarios={elegibles}
              inicial={{
                id: o.id,
                productoId: o.producto_id,
                cantidad: String(o.cantidad),
                destino: o.destino ?? "",
                prioridad: o.prioridad as "media",
                inicioPlan: o.inicio_plan ?? "",
                finPlan: o.fin_plan ?? "",
                responsableId: o.responsable_id,
                responsableExterno: o.responsable_externo ?? "",
                nota: o.nota ?? "",
                cancelada: o.estado === "cancelada",
              }}
            />
          ) : null
        }
      >
        Orden #{o.id}: {o.cantidad} × {o.producto}
      </Titulo>

      {configura && partes.length === 0 && dentroDeVentana(o.creado_en) && (
        <div className="mb-3">
          <BorrarPorError tipo="orden" id={o.id} que={`la orden #${o.id}`} destino="/fabricacion" />
        </div>
      )}
      <div className="tarjeta mb-5 space-y-3 p-5">
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 rounded-full bg-slate-100">
            <div className={`h-3 rounded-full ${av >= 100 ? "bg-verde" : "bg-blue-600"}`} style={{ width: `${av}%` }} />
          </div>
          <span className={`text-sm font-bold tabular-nums ${av >= 100 ? "text-verde" : ""}`}>
            {o.hechas} de {o.cantidad} · {av}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tono={ESTADO_OBRA[o.estado].tono}>{ESTADO_OBRA[o.estado].texto}</Chip>
          {abierta && <ChipPrioridad prioridad={o.prioridad} />}
          {o.estado !== "cancelada" && <ChipDesvio que="Inicio" desvio={desvio(o.inicio_plan, o.fecha_inicio, hoy)} />}
          {o.estado !== "cancelada" && <ChipDesvio que="Fin" desvio={desvio(o.fin_plan, o.fecha_fin, hoy)} />}
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <span className="text-slate-500">Comprometido: </span>
            {fmtFecha(o.inicio_plan)} → {fmtFecha(o.fin_plan)}
          </p>
          <p>
            <span className="text-slate-500">Real: </span>
            {fmtFecha(o.fecha_inicio)} → {fmtFecha(o.fecha_fin)}
          </p>
          <p>
            <span className="text-slate-500">Horas: </span>
            {fmtNum(o.horas)} h{real != null && ` · ${fmtNum(real)} h/u`}
            {o.horas_estandar != null && ` (estándar ${fmtNum(o.horas_estandar)})`}
            {ef != null && (
              <span className={`ml-1 font-semibold ${ef >= 100 ? "text-verde" : ef >= 85 ? "text-amarillo-texto" : "text-rojo"}`}>
                {ef}%
              </span>
            )}
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Responsable: {o.responsable ?? o.responsable_externo ?? "—"}
          {o.nota && ` · ${o.nota}`}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          {opera && abierta && (
            <div className="tarjeta p-5">
              <p className="mb-3 font-bold">Registrar producción</p>
              <NuevoParte
                ordenId={o.id}
                hoy={hoy}
                yo={sesion.uid}
                usuarios={elegibles}
                faltan={Math.max(0, o.cantidad - o.hechas)}
                hayReceta={(receta[0]?.n ?? 0) > 0}
              />
            </div>
          )}
          <div>
            <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Partes de producción</h2>
            {partes.length === 0 ? (
              <p className="tarjeta p-4 text-sm text-slate-500">Todavía no se registró producción.</p>
            ) : (
              <ul className="tarjeta divide-y divide-slate-100">
                {partes.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="w-20 text-xs text-slate-500">{fmtFecha(p.fecha)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{p.unidades} unidad(es)</span>
                      {p.horas != null && <span className="text-slate-500"> · {fmtNum(p.horas)} h</span>}
                      <span className="block text-xs text-slate-500">
                        {p.quien}
                        {p.nota && ` · ${p.nota}`}
                      </span>
                    </span>
                    {(configura || p.usuario_id === sesion.uid) && opera && (
                      <BotonAccion
                        accion={borrarParte.bind(null, p.id)}
                        clase="text-xs text-slate-400 underline"
                        confirmar="¿Borrar el parte? Si descontó materiales, vuelven al pañol."
                      >
                        borrar
                      </BotonAccion>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Materiales usados</h2>
          {materiales.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguno descontado del pañol.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {materiales.map((m) => (
                <li key={m.insumo_id} className="flex justify-between gap-2">
                  <Link href={`/insumos/${m.insumo_id}`} className="hover:underline">
                    {m.nombre}
                  </Link>
                  <span className="cifra">
                    {fmtNum(m.total)} {m.unidad}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
