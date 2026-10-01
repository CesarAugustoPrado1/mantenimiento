import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { documentos as leerDocumentos, usuariosActivos } from "@/lib/consultas";
import Link from "next/link";
import { NuevoArchivo } from "@/components/archivos";
import { subidaHabilitada } from "@/lib/archivos-servidor";
import { GaleriaObra } from "@/components/lista-archivos";
import { BorrarPorError } from "@/components/borrar-error";
import { dentroDeVentana } from "@/lib/borrado";

import { CONFIGURAN, OPERAN } from "@/lib/permisos";
import { ESTADO_OBRA, type DatosObra } from "@/lib/etiquetas";
import { fmtFecha, fmtNum, fmtPesos, hoyAR } from "@/lib/formato";
import { avanceObra, desvio, ETIQUETA_PASO, esPaso } from "@/lib/cumplimiento";
import { Chip, ChipPrioridad, Titulo, Volver } from "@/components/ui";
import { BarraAvance, ChipDesvio } from "@/components/avance";
import { BotonObra, NuevaNota } from "../formulario";
import { Avance, EditarSubtarea } from "./subtareas";

export const dynamic = "force-dynamic";

type Subtarea = {
  id: number;
  titulo: string;
  responsable_id: number | null;
  responsable: string | null;
  responsable_externo: string | null;
  inicio_plan: string | null;
  fin_plan: string | null;
  inicio_real: string | null;
  fin_real: string | null;
  progreso: number;
  nota: string | null;
};

export default async function FichaObra({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const hoy = hoyAR();

  const o = await fila<{
    id: number;
    titulo: string;
    lugar: string;
    tipo: string | null;
    descripcion: string | null;
    estado: DatosObra["estado"];
    prioridad: DatosObra["prioridad"];
    inicio_plan: string | null;
    fin_plan: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    responsable_id: number | null;
    responsable: string | null;
    responsable_externo: string | null;
    horas_hombre: number | null;
    costo_mano_obra: number | null;
    costo_materiales: number | null;
    carpeta_url: string | null;
    creado_por: string;
    creado_en: string;
  }>(sql`
    select o.id, o.titulo, o.lugar, o.tipo, o.descripcion, o.estado, o.prioridad,
           o.inicio_plan::text as inicio_plan, o.fin_plan::text as fin_plan,
           o.fecha_inicio::text as fecha_inicio, o.fecha_fin::text as fecha_fin,
           o.responsable_id, u.nombre as responsable,
           o.responsable_externo, o.horas_hombre::float8 as horas_hombre,
           o.costo_mano_obra::float8 as costo_mano_obra, o.costo_materiales::float8 as costo_materiales,
           o.carpeta_url, c.nombre as creado_por, o.creado_en::text as creado_en
      from obras o left join usuarios u on u.id = o.responsable_id join usuarios c on c.id = o.creado_por_id
     where o.id = ${id}
  `);
  if (!o) notFound();

  const [subtareas, avances, notas, materiales, usuarios, docs] = await Promise.all([
    filas<Subtarea>(sql`
      select s.id, s.titulo, s.responsable_id, u.nombre as responsable, s.responsable_externo,
             s.inicio_plan::text as inicio_plan, s.fin_plan::text as fin_plan,
             s.inicio_real::text as inicio_real, s.fin_real::text as fin_real, s.progreso, s.nota
        from obra_subtareas s left join usuarios u on u.id = s.responsable_id
       where s.obra_id = ${id} order by s.orden, s.id
    `),
    filas<{ subtarea_id: number; fecha: string; progreso_antes: number; progreso: number; usuario: string; nota: string | null }>(sql`
      select a.subtarea_id, a.fecha::text as fecha, a.progreso_antes, a.progreso, u.nombre as usuario, a.nota
        from obra_subtarea_avances a join obra_subtareas s on s.id = a.subtarea_id join usuarios u on u.id = a.usuario_id
       where s.obra_id = ${id} order by a.fecha desc, a.id desc
    `),
    filas<{ id: number; texto: string; usuario: string; cuando: string }>(sql`
      select n.id, n.texto, u.nombre as usuario, to_char(n.creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') as cuando
        from obra_notas n join usuarios u on u.id = n.usuario_id
       where n.obra_id = ${id} order by n.creado_en desc
    `),
    filas<{ nombre: string; unidad: string; total: number }>(sql`
      select i.nombre, i.unidad, (-sum(m.cantidad))::float8 as total
        from movimientos_insumo m join insumos i on i.id = m.insumo_id
       where m.obra_id = ${id} and m.tipo = 'consumo' group by i.id order by i.nombre
    `),
    usuariosActivos(),
    leerDocumentos({ obraId: id }),
  ]);
  const fotos = docs.filter((d) => d.tipo === "foto");

  const e = ESTADO_OBRA[o.estado];
  const avance = avanceObra(subtareas) ?? (o.estado === "terminada" ? 100 : 0);
  const configura = CONFIGURAN.includes(sesion.rol);
  const opera = OPERAN.includes(sesion.rol);
  const elegibles = usuarios.filter((u) => u.rol !== "auditor");
  const abierta = o.estado !== "cancelada";

  return (
    <>
      <Volver href="/obras">Obras</Volver>
      <Titulo
        detalle={`📍 ${o.lugar}${o.tipo ? ` · ${o.tipo}` : ""}`}
        accion={
          configura ? (
            <BotonObra
              texto="Editar"
              clase="boton-secundario text-sm"
              usuarios={elegibles}
              inicial={{
                id: o.id,
                titulo: o.titulo,
                lugar: o.lugar,
                tipo: o.tipo ?? "",
                descripcion: o.descripcion ?? "",
                estado: o.estado,
                prioridad: o.prioridad,
                inicioPlan: o.inicio_plan ?? "",
                finPlan: o.fin_plan ?? "",
                fechaInicio: o.fecha_inicio ?? "",
                fechaFin: o.fecha_fin ?? "",
                responsableId: o.responsable_id,
                responsableExterno: o.responsable_externo ?? "",
                horasHombre: o.horas_hombre != null ? String(o.horas_hombre) : "",
                costoManoObra: o.costo_mano_obra != null ? String(o.costo_mano_obra) : "",
                costoMateriales: o.costo_materiales != null ? String(o.costo_materiales) : "",
              }}
            />
          ) : null
        }
      >
        {o.titulo}
      </Titulo>

      {configura && dentroDeVentana(o.creado_en) && (
        <div className="mb-3">
          <BorrarPorError tipo="obra" id={o.id} que={o.titulo} destino="/obras" />
        </div>
      )}
      <div className="tarjeta mb-5 space-y-3 p-5">
        <BarraAvance progreso={avance} />
        <div className="flex flex-wrap gap-1.5">
          <Chip tono={e.tono}>{e.texto}</Chip>
          <ChipPrioridad prioridad={o.prioridad} />
          {abierta && <ChipDesvio que="Inicio" desvio={desvio(o.inicio_plan, o.fecha_inicio, hoy)} />}
          {abierta && <ChipDesvio que="Fin" desvio={desvio(o.fin_plan, o.fecha_fin, hoy)} />}
        </div>
        <table className="w-full max-w-md text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="text-left font-medium" />
              <th className="text-left font-medium">Comprometido</th>
              <th className="text-left font-medium">Real</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-slate-500">Inicio</td>
              <td>{fmtFecha(o.inicio_plan)}</td>
              <td className="font-semibold">{fmtFecha(o.fecha_inicio)}</td>
            </tr>
            <tr>
              <td className="text-slate-500">Fin</td>
              <td>{fmtFecha(o.fin_plan)}</td>
              <td className="font-semibold">{fmtFecha(o.fecha_fin)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Subtareas</h2>
            {configura && (
              <EditarSubtarea
                texto="+ Subtarea"
                clase="text-sm font-semibold text-slate-700 underline"
                usuarios={elegibles}
                inicial={{
                  obraId: o.id,
                  titulo: "",
                  responsableId: null,
                  responsableExterno: "",
                  inicioPlan: "",
                  finPlan: "",
                  inicioReal: "",
                  finReal: "",
                  nota: "",
                  progreso: 0,
                }}
              />
            )}
          </div>
          {subtareas.length === 0 && (
            <p className="tarjeta p-4 text-sm text-slate-500">
              Sin subtareas. Dividí la obra en partes (pintura, piso, instalación eléctrica, muestrarios, cartel…) para ver el avance y
              el cumplimiento de cada una.
            </p>
          )}
          {/* las subtareas */}
          {subtareas.map((s) => {
            const hist = avances.filter((a) => a.subtarea_id === s.id);
            return (
              <div key={s.id} className={`tarjeta p-4 ${s.progreso === 100 ? "ring-verde/40" : ""}`}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.titulo}</p>
                    <p className="text-xs text-slate-500">
                      {s.responsable ?? s.responsable_externo ?? "sin responsable"}
                      {s.fin_plan && ` · comprometida para el ${fmtFecha(s.fin_plan)}`}
                      {s.nota && ` · ${s.nota}`}
                    </p>
                  </div>
                  {configura && (
                    <EditarSubtarea
                      texto="Editar"
                      clase="text-xs font-semibold text-slate-500 underline"
                      usuarios={elegibles}
                      inicial={{
                        id: s.id,
                        obraId: o.id,
                        titulo: s.titulo,
                        responsableId: s.responsable_id,
                        responsableExterno: s.responsable_externo ?? "",
                        inicioPlan: s.inicio_plan ?? "",
                        finPlan: s.fin_plan ?? "",
                        inicioReal: s.inicio_real ?? "",
                        finReal: s.fin_real ?? "",
                        nota: s.nota ?? "",
                        progreso: s.progreso,
                      }}
                    />
                  )}
                </div>
                <Avance subtareaId={s.id} progreso={s.progreso} hoy={hoy} puede={opera && abierta} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ChipDesvio que="Inicio" desvio={desvio(s.inicio_plan, s.inicio_real, hoy)} />
                  <ChipDesvio que="Fin" desvio={desvio(s.fin_plan, s.fin_real, hoy)} />
                </div>
                {hist.length > 0 && (
                  <details className="mt-2 text-xs text-slate-500">
                    <summary className="cursor-pointer">Historial ({hist.length})</summary>
                    <ul className="mt-1 space-y-0.5">
                      {hist.map((a, i) => (
                        <li key={i}>
                          {fmtFecha(a.fecha)}: {a.progreso_antes}% → <strong>{a.progreso}%</strong>
                          {esPaso(a.progreso) && ` (${ETIQUETA_PASO[a.progreso]})`} · {a.usuario}
                          {a.nota && ` · ${a.nota}`}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}

          <div className="pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Fotos</h2>
              <span className="flex flex-wrap items-center gap-3">
                <Link href={`/archivos?obra=${o.id}`} className="text-sm font-semibold text-slate-700 underline">
                  📁 Todos los archivos ({docs.length})
                </Link>
                {opera && (
                  <NuevoArchivo
                    dueno={{ obraId: o.id }}
                    tipoInicial="foto"
                    etapaInicial="durante"
                    texto="+ Fotos"
                    clase="text-sm font-semibold text-slate-700 underline"
                    subida={subidaHabilitada()}
                  />
                )}
              </span>
            </div>
            <div className="tarjeta space-y-3 p-4">
              <GaleriaObra fotos={fotos} />
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <div className="tarjeta space-y-2 p-5 text-sm">
            {o.descripcion && <p className="whitespace-pre-line">{o.descripcion}</p>}
            <p className="text-slate-600">
              Responsable: {o.responsable ?? "—"}
              {o.responsable_externo && ` · externo: ${o.responsable_externo}`}
            </p>
            <p className="text-slate-600">
              {[
                o.horas_hombre != null && `${fmtNum(o.horas_hombre)} horas hombre`,
                o.costo_mano_obra != null && `mano de obra ${fmtPesos(o.costo_mano_obra)}`,
                o.costo_materiales != null && `materiales ${fmtPesos(o.costo_materiales)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-xs text-slate-400">Cargada por {o.creado_por}</p>
          </div>
          <div className="tarjeta p-5">
            <p className="mb-2 font-bold">Materiales del pañol</p>
            {materiales.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ninguno. Se cargan desde la ficha de cada insumo, eligiendo esta obra en «¿Para qué fue?».
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {materiales.map((m) => (
                  <li key={m.nombre} className="flex justify-between">
                    <span>{m.nombre}</span>
                    <span className="cifra">
                      {fmtNum(m.total)} {m.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="tarjeta space-y-3 p-5">
            <p className="font-bold">Bitácora</p>
            {opera && <NuevaNota obraId={o.id} />}
            <ul className="space-y-3">
              {notas.map((n) => (
                <li key={n.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                  <p className="whitespace-pre-line">{n.texto}</p>
                  <p className="text-xs text-slate-400">
                    {n.usuario} · {n.cuando}
                  </p>
                </li>
              ))}
              {notas.length === 0 && <li className="text-sm text-slate-500">Sin notas.</li>}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
