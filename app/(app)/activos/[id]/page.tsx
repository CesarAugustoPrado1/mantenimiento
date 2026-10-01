import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { agenda, repuestos as leerRepuestos, repuestosDisponibles } from "@/lib/consultas";
import { nivelDeStock } from "@/lib/semaforo";
import { AgregarRepuesto } from "@/components/repuestos";
import { CambiarEstadoRapido } from "@/components/estado-equipo";
import { BorrarPorError } from "@/components/borrar-error";
import { dentroDeVentana } from "@/lib/borrado";

import { BotonAccion } from "@/components/admin";
import { quitarRepuesto } from "@/lib/acciones/repuestos";
import { CONFIGURAN, OPERAN } from "@/lib/permisos";
import { ETIQUETA_COMBUSTIBLE, fmtFecha, fmtNum, fmtPesos, fmtRendimiento, hoyAR, UNIDAD_MEDIDOR } from "@/lib/formato";
import type { Caracteristica, ClaseActivo, Combustible, EstadoActivo, Medidor } from "@/lib/db/schema";
import { resumenCombustible } from "@/lib/consultas-combustible";
import { CargarLectura } from "@/components/cargar-lectura";
import { Chip, ChipCriticidad, ChipEstadoActivo, ChipPrioridad, ChipVencimiento, Semaforo, Titulo, Volver } from "@/components/ui";

export const dynamic = "force-dynamic";

type Activo = {
  id: number;
  clase: ClaseActivo;
  tipo: string;
  nombre: string;
  codigo: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  numero_serie: string | null;
  patente: string | null;
  ubicacion: string | null;
  propiedad: "empresa" | "empleado";
  responsable_id: number | null;
  responsable: string | null;
  medidor: Medidor;
  combustible: Combustible | null;
  estado: EstadoActivo;
  caracteristicas: Caracteristica[];
  nota: string | null;
  creado_en: string;
};

export default async function FichaActivo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const a = await fila<Activo>(sql`
    select a.id, a.clase, a.tipo, a.nombre, a.codigo, a.marca, a.modelo, a.anio, a.numero_serie,
           a.patente, a.ubicacion, a.propiedad, a.responsable_id, u.nombre as responsable,
           a.medidor, a.combustible, a.estado, a.caracteristicas, a.nota, a.creado_en::text as creado_en
      from activos a left join usuarios u on u.id = a.responsable_id
     where a.id = ${id}
  `);
  if (!a) notFound();
  if (sesion.rol === "conductor" && a.responsable_id !== sesion.uid) redirect("/sin-permiso");

  const [planes, trabajos, lecturasMes, consumos, [comb], reps, estados, archivos] = await Promise.all([
    agenda({ activoId: id }),
    filas<{
      id: number;
      tipo: string;
      estado: string;
      prioridad: string;
      titulo: string;
      fecha: string;
      lectura: number | null;
      realizado: string | null;
      causa: string | null;
      costo: number | null;
    }>(sql`
      select t.id, t.tipo, t.estado, t.prioridad, t.titulo, t.fecha::text as fecha,
             t.lectura::float8 as lectura, coalesce(u.nombre, t.realizado_externo) as realizado,
             c.nombre as causa,
             (coalesce(t.costo_mano_obra, 0) + coalesce(t.costo_repuestos, 0))::float8 as costo
        from trabajos t
        left join usuarios u on u.id = t.realizado_por_id
        left join causas c on c.id = t.causa_id
       where t.activo_id = ${id}
       order by t.fecha desc, t.id desc limit 60
    `),
    filas<{ mes: string; valor: number; fecha: string }>(sql`
      select distinct on (date_trunc('month', fecha)) to_char(fecha, 'YYYY-MM') as mes,
             valor::float8 as valor, fecha::text as fecha
        from lecturas where activo_id = ${id}
       order by date_trunc('month', fecha) desc, fecha desc
       limit 13
    `),
    filas<{ nombre: string; unidad: string; total: number }>(sql`
      select i.nombre, i.unidad, (-sum(m.cantidad))::float8 as total
        from movimientos_insumo m join insumos i on i.id = m.insumo_id
       where m.activo_id = ${id} and m.tipo = 'consumo' and m.fecha >= current_date - 365
       group by i.id order by 3 desc limit 10
    `),
    a.combustible ? resumenCombustible(id) : Promise.resolve([]),
    leerRepuestos({ activoId: id }),
    filas<{ desde: EstadoActivo; hasta: EstadoActivo; cuando: string; usuario: string; trabajo_id: number | null }>(sql`
      select c.desde, c.hasta, to_char(c.creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando,
             u.nombre as usuario, c.trabajo_id
        from activo_cambios_estado c join usuarios u on u.id = c.usuario_id
       where c.activo_id = ${id} order by c.creado_en desc limit 8
    `),
    fila<{ n: number }>(sql`select count(*)::int as n from documentos where activo_id = ${id} and not archivado`),
  ]);
  const disponibles = CONFIGURAN.includes(sesion.rol) ? await repuestosDisponibles() : [];

  const u = UNIDAD_MEDIDOR[a.medidor];
  const ultima = lecturasMes[0] ?? null;
  const configura = CONFIGURAN.includes(sesion.rol);
  const opera = OPERAN.includes(sesion.rol);
  const puedeCargarKm = a.medidor !== "ninguno" && sesion.rol !== "auditor";
  const volver = a.clase === "vehiculo" ? "/vehiculos" : "/maquinas";

  return (
    <>
      <Volver href={volver}>{a.clase === "vehiculo" ? "Vehículos" : "Máquinas"}</Volver>
      <Titulo
        detalle={[a.tipo, [a.marca, a.modelo].filter(Boolean).join(" "), a.anio, a.ubicacion].filter(Boolean).join(" · ")}
        accion={
          <div className="flex flex-wrap gap-2">
            {sesion.rol !== "conductor" && (
              <Link href={`/archivos?activo=${a.id}`} className="boton-secundario text-sm">
                📁 Archivos ({archivos?.n ?? 0})
              </Link>
            )}
            {opera && a.estado !== "baja" && <CambiarEstadoRapido activoId={a.id} nombre={a.nombre} actual={a.estado} />}
            {sesion.rol !== "auditor" && (
              <Link href={`/trabajos/nuevo?activo=${a.id}`} className="boton-secundario text-sm">
                ⚠ Reportar falla
              </Link>
            )}
            {configura && (
              <Link href={`/activos/${a.id}/editar`} className="boton-secundario text-sm">
                Editar
              </Link>
            )}
          </div>
        }
      >
        {a.nombre}{" "}
        {a.patente && <span className="codigo ml-1 rounded-md bg-slate-900 px-2 py-0.5 text-sm text-white">{a.patente}</span>}
      </Titulo>

      {configura && dentroDeVentana(a.creado_en) && (
        <div className="mb-3">
          <BorrarPorError tipo="activo" id={a.id} que={a.nombre} destino={volver} />
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-2">
        <ChipEstadoActivo estado={a.estado} />
        {a.propiedad === "empleado" && <Chip tono="azul">vehículo de empleado</Chip>}
        {a.responsable && <Chip>{a.clase === "vehiculo" ? "Conductor" : "Responsable"}: {a.responsable}</Chip>}
        {a.codigo && <Chip>Código {a.codigo}</Chip>}
        {a.numero_serie && <Chip>N° serie {a.numero_serie}</Chip>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Planes preventivos</h2>
              {configura && (
                <Link href={`/activos/${a.id}/planes/nuevo`} className="text-sm font-semibold text-slate-700 underline">
                  + Plan
                </Link>
              )}
            </div>
            {planes.length === 0 ? (
              <p className="tarjeta p-4 text-sm text-slate-500">
                Sin planes. {configura && "Agregá uno: cambio de aceite, engrase, revisión de correas, VTV…"}
              </p>
            ) : (
              <ul className="space-y-2">
                {planes.map((p) => (
                  <li key={p.plan_id} className="tarjeta flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.plan}</p>
                      <p className="text-xs text-slate-500">
                        {[p.cada_dias && `cada ${p.cada_dias} días`, p.cada_uso && a.medidor !== "ninguno" && `cada ${fmtNum(p.cada_uso)} ${u}`]
                          .filter(Boolean)
                          .join(" o ")}{" "}
                        · última {p.ult_fecha ? fmtFecha(p.ult_fecha) : "—"} · {p.responsable ?? p.responsable_externo ?? "sin responsable"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Vence {p.venc.estimada ? "≈ " : ""}
                        {fmtFecha(p.venc.fechaAgenda)}
                        {p.venc.venceUso != null && ` o a los ${fmtNum(p.venc.venceUso)} ${u}`}
                      </p>
                    </div>
                    <ChipVencimiento estado={p.venc.estado} />
                    <div className="flex gap-2">
                      {opera && (
                        <Link href={`/trabajos/preventivo/${p.plan_id}`} className="boton-primario min-h-10 px-3 text-sm">
                          Registrar
                        </Link>
                      )}
                      {configura && (
                        <Link href={`/activos/${a.id}/planes/${p.plan_id}`} className="boton-secundario min-h-10 px-3 text-sm">
                          Editar
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Repuestos críticos</h2>
              {configura && <AgregarRepuesto activoId={a.id} disponibles={disponibles} />}
            </div>
            {reps.length === 0 ? (
              <p className="tarjeta p-4 text-sm text-slate-500">
                Ningún repuesto cargado. Los que convienen tener son los que, si se rompen y no están, paran la producción mientras se consiguen.
              </p>
            ) : (
              <ul className="space-y-2">
                {reps.map((r) => {
                  const nivel = nivelDeStock(r.stock, r.critico, r.atento);
                  return (
                    <li key={r.vinculo_id} className={`tarjeta p-3 ${nivel === "rojo" && r.criticidad === "alta" ? "ring-2 ring-rojo" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/insumos/${r.insumo_id}`} className="font-semibold hover:underline">
                            {r.nombre}
                          </Link>
                          {r.codigo && <span className="codigo ml-1.5 text-xs text-slate-500">{r.codigo}</span>}
                          <p className="text-xs text-slate-500">
                            {[r.donde_va, r.proveedor && `proveedor: ${r.proveedor}`, r.nota].filter(Boolean).join(" · ")}
                          </p>
                          {nivel === "rojo" && r.tiempo_reposicion_dias ? (
                            <p className="mt-1 text-xs font-semibold text-rojo">
                              Sin stock: si se rompe, ~{r.tiempo_reposicion_dias} días hasta conseguirlo.
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="text-sm">
                            hay <span className="cifra">{fmtNum(r.stock)}</span> de {fmtNum(r.ideal)}
                          </span>
                          <Semaforo nivel={nivel} />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ChipCriticidad criticidad={r.criticidad} />
                        {r.tiempo_reposicion_dias != null && <Chip>reposición {r.tiempo_reposicion_dias} días</Chip>}
                        {configura && (
                          <span className="ml-auto flex items-center gap-3">
                            <AgregarRepuesto
                              activoId={a.id}
                              disponibles={disponibles}
                              inicial={{ insumoId: r.insumo_id, nombre: r.nombre, dondeVa: r.donde_va ?? "", criticidad: r.criticidad, nota: r.nota ?? "" }}
                            />
                            <BotonAccion accion={quitarRepuesto.bind(null, r.vinculo_id)} clase="text-xs text-slate-400 underline" confirmar="¿Sacarlo de esta máquina? Sigue en el pañol.">
                              quitar
                            </BotonAccion>
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Historial de trabajos</h2>
            {trabajos.length === 0 ? (
              <p className="tarjeta p-4 text-sm text-slate-500">Todavía no hay trabajos registrados.</p>
            ) : (
              <ul className="tarjeta divide-y divide-slate-100">
                {trabajos.map((t) => (
                  <li key={t.id}>
                    <Link href={`/trabajos/${t.id}`} className="flex items-start gap-3 p-3 hover:bg-slate-50">
                      <span className="w-20 shrink-0 text-xs text-slate-500">{fmtFecha(t.fecha)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{t.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {[
                            t.lectura != null && `${fmtNum(t.lectura)} ${u}`,
                            t.realizado,
                            t.causa && `causa: ${t.causa}`,
                            t.costo ? fmtPesos(t.costo) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Chip tono={t.tipo === "preventivo" ? "verde" : "amarillo"}>{t.tipo}</Chip>
                        {t.tipo === "correctivo" && t.estado !== "cerrado" && <ChipPrioridad prioridad={t.prioridad} />}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {a.medidor !== "ninguno" && (
            <section className="tarjeta p-4">
              <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">
                {a.medidor === "km" ? "Kilometraje" : "Horómetro"}
              </h2>
              <p className="cifra mt-1 text-2xl">
                {ultima ? `${fmtNum(ultima.valor)} ${u}` : "—"}
              </p>
              {ultima && <p className="text-xs text-slate-500">al {fmtFecha(ultima.fecha)}</p>}
              {puedeCargarKm && (
                <div className="mt-3">
                  <CargarLectura activoId={a.id} unidad={u} hoy={hoyAR()} ultima={ultima?.valor ?? null} />
                </div>
              )}
              {lecturasMes.length > 0 && (
                <table className="tabla mt-3">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th className="text-right">Lectura</th>
                      <th className="text-right">Recorrido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lecturasMes.slice(0, 12).map((l, i) => {
                      const previa = lecturasMes[i + 1];
                      return (
                        <tr key={l.mes}>
                          <td>{l.mes.split("-").reverse().join("/")}</td>
                          <td className="text-right tabular-nums">{fmtNum(l.valor)}</td>
                          <td className="text-right tabular-nums">{previa ? fmtNum(l.valor - previa.valor) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {comb && (
            <section className="tarjeta p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">
                  Combustible · {ETIQUETA_COMBUSTIBLE[comb.combustible]}
                </h2>
                {sesion.rol !== "auditor" && (
                  <Link href={`/combustible?activo=${a.id}`} className="text-sm font-semibold underline">
                    ⛽ Cargar
                  </Link>
                )}
              </div>
              {fmtRendimiento(a.medidor, comb.periodo) ? (
                <>
                  <p className="cifra mt-1 text-2xl">{fmtRendimiento(a.medidor, comb.periodo)!.principal}</p>
                  <p className="text-xs text-slate-500">
                    {fmtRendimiento(a.medidor, comb.periodo)!.secundario} · últimos 90 días
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Faltan cargas con lectura para calcular el consumo.</p>
              )}
              {comb.alto && (
                <p className="mt-1">
                  <Chip tono="rojo">consumo alto este mes: revisar pérdidas o uso</Chip>
                </p>
              )}
              {comb.meses.length > 0 && (
                <table className="tabla mt-3">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th className="text-right">Litros</th>
                      <th className="text-right">{a.medidor === "km" ? "Km" : "Horas"}</th>
                      <th className="text-right">{a.medidor === "km" ? "L/100km" : "L/h"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comb.meses.slice(0, 12).map((m) => (
                      <tr key={m.mes}>
                        <td>{m.mes.split("-").reverse().join("/")}</td>
                        <td className="text-right tabular-nums">{fmtNum(m.litros)}</td>
                        <td className="text-right tabular-nums">{fmtNum(m.uso)}</td>
                        <td className="text-right tabular-nums">
                          {m.porUnidad == null ? "—" : fmtNum(Math.round(m.porUnidad * (a.medidor === "km" ? 100 : 1) * 100) / 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {a.caracteristicas.length > 0 && (
            <section className="tarjeta p-4">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Ficha técnica</h2>
              <dl className="space-y-1.5 text-sm">
                {a.caracteristicas.map((c) => (
                  <div key={c.clave} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{c.clave}</dt>
                    <dd className="text-right font-medium">{c.valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="tarjeta p-4">
            <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Insumos usados (12 meses)</h2>
            {consumos.length === 0 ? (
              <p className="text-sm text-slate-500">Nada registrado.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {consumos.map((c) => (
                  <li key={c.nombre} className="flex justify-between gap-2">
                    <span>{c.nombre}</span>
                    <span className="cifra">
                      {fmtNum(c.total)} {c.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {estados.length > 0 && (
            <section className="tarjeta p-4">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Cambios de estado</h2>
              <ul className="space-y-1.5 text-xs">
                {estados.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1">
                    <span className="text-slate-400">{c.cuando}</span>
                    <ChipEstadoActivo estado={c.desde} /> → <ChipEstadoActivo estado={c.hasta} />
                    {c.trabajo_id && (
                      <Link href={`/trabajos/${c.trabajo_id}`} className="text-slate-500 underline">
                        #{c.trabajo_id}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {a.nota && <p className="tarjeta p-4 text-sm whitespace-pre-line text-slate-600">{a.nota}</p>}
        </div>
      </div>
    </>
  );
}
