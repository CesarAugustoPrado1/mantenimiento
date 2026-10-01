import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { causasActivas, insumosActivos, nombreActivo, usuariosActivos } from "@/lib/consultas";
import { OPERAN } from "@/lib/permisos";
import { fmtFecha, fmtNum, fmtPesos, hoyAR, UNIDAD_MEDIDOR } from "@/lib/formato";
import type { EstadoActivo, Medidor, ValorCelda } from "@/lib/db/schema";
import { COLUMNA_UNICA, hallazgos, tituloHallazgo } from "@/lib/planilla";
import { Chip, ChipEstadoActivo, ChipPrioridad, Titulo, Volver } from "@/components/ui";
import { NuevoAvance, Seguimiento } from "./seguimiento";

export const dynamic = "force-dynamic";

type Trabajo = {
  id: number;
  tipo: "preventivo" | "correctivo";
  estado: "abierto" | "en_curso" | "cerrado";
  prioridad: "baja" | "media" | "alta" | "urgente";
  titulo: string;
  fecha: string;
  fecha_cierre: string | null;
  lectura: number | null;
  falla: string | null;
  causa_id: number | null;
  causa: string | null;
  solucion: string | null;
  horas_parada: number | null;
  horas_hombre: number | null;
  costo_mano_obra: number | null;
  costo_repuestos: number | null;
  observaciones: string | null;
  reportado: string;
  realizado_por_id: number | null;
  realizado: string | null;
  realizado_externo: string | null;
  plan_id: number | null;
  activo_id: number;
  activo: string;
  patente: string | null;
  codigo: string | null;
  medidor: Medidor;
  estado_activo: EstadoActivo;
  responsable_id: number | null;
};

const RESULTADO = {
  ok: { texto: "✓", tono: "verde" },
  corregido: { texto: "Corregido", tono: "azul" },
  no_ok: { texto: "✗", tono: "rojo" },
  no_aplica: { texto: "N/A", tono: "gris" },
} as const;

export default async function FichaTrabajo({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const t = await fila<Trabajo>(sql`
    select t.id, t.tipo, t.estado, t.prioridad, t.titulo, t.fecha::text as fecha,
           t.fecha_cierre::text as fecha_cierre, t.lectura::float8 as lectura, t.falla,
           t.causa_id, c.nombre as causa, t.solucion, t.horas_parada::float8 as horas_parada,
           t.horas_hombre::float8 as horas_hombre, t.costo_mano_obra::float8 as costo_mano_obra,
           t.costo_repuestos::float8 as costo_repuestos, t.observaciones,
           ur.nombre as reportado, t.realizado_por_id, uh.nombre as realizado, t.realizado_externo,
           t.plan_id, a.id as activo_id, a.nombre as activo, a.patente, a.codigo, a.medidor,
           a.estado as estado_activo, a.responsable_id
      from trabajos t
      join activos a on a.id = t.activo_id
      join usuarios ur on ur.id = t.reportado_por_id
      left join usuarios uh on uh.id = t.realizado_por_id
      left join causas c on c.id = t.causa_id
     where t.id = ${id}
  `);
  if (!t) notFound();
  if (sesion.rol === "conductor" && t.responsable_id !== sesion.uid) redirect("/sin-permiso");

  const [tareas, consumos, avances, cambios] = await Promise.all([
    filas<{
      seccion: string | null;
      activoId: number | null;
      accion: string;
      descripcion: string;
      valores: Record<string, ValorCelda>;
      resultado: keyof typeof RESULTADO;
      nota: string | null;
    }>(sql`
      select seccion, activo_id as "activoId", accion, descripcion, valores, resultado, nota
        from trabajo_tareas where trabajo_id = ${id} order by id
    `),
    filas<{ nombre: string; unidad: string; cantidad: number; fecha: string }>(sql`
      select i.nombre, i.unidad, (-m.cantidad)::float8 as cantidad, m.fecha::text as fecha
        from movimientos_insumo m join insumos i on i.id = m.insumo_id
       where m.trabajo_id = ${id} order by m.id
    `),
    filas<{ id: number; fecha: string; texto: string; usuario: string }>(sql`
      select a.id, a.fecha::text as fecha, a.texto, u.nombre as usuario
        from trabajo_avances a join usuarios u on u.id = a.usuario_id
       where a.trabajo_id = ${id} order by a.fecha desc, a.id desc
    `),
    filas<{ desde: string; hasta: string; cuando: string; usuario: string }>(sql`
      select c.desde, c.hasta, to_char(c.creado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') as cuando,
             u.nombre as usuario
        from activo_cambios_estado c join usuarios u on u.id = c.usuario_id
       where c.trabajo_id = ${id} order by c.creado_en desc
    `),
  ]);

  const encontrados = hallazgos(tareas).map((h) => ({
    ...h,
    nota: tareas.find((x) => x.descripcion === h.fila && x.seccion === h.seccion)?.nota ?? null,
  }));
  const u = UNIDAD_MEDIDOR[t.medidor];
  const puedeSeguir = t.tipo === "correctivo" && OPERAN.includes(sesion.rol);
  const [causas, usuarios, insumos] = puedeSeguir
    ? await Promise.all([causasActivas(), usuariosActivos(), insumosActivos()])
    : [[], [], []];
  const costoTotal = (t.costo_mano_obra ?? 0) + (t.costo_repuestos ?? 0);

  return (
    <>
      <Volver href={`/activos/${t.activo_id}`}>{nombreActivo({ nombre: t.activo, patente: t.patente, codigo: t.codigo })}</Volver>
      <Titulo
        detalle={`${t.tipo === "preventivo" ? "Preventivo" : "Correctivo"} #${t.id} · ${fmtFecha(t.fecha)}${
          t.lectura != null ? ` · ${fmtNum(t.lectura)} ${u}` : ""
        }`}
        accion={
          <div className="flex flex-wrap gap-1.5">
            <Chip tono={t.tipo === "preventivo" ? "verde" : "amarillo"}>{t.tipo}</Chip>
            {t.tipo === "correctivo" && (
              <Chip tono={t.estado === "cerrado" ? "verde" : "rojo"}>
                {t.estado === "en_curso" ? "en curso" : t.estado}
              </Chip>
            )}
            {t.tipo === "correctivo" && t.estado !== "cerrado" && <ChipPrioridad prioridad={t.prioridad} />}
          </div>
        }
      >
        {t.titulo}
      </Titulo>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="tarjeta space-y-2 p-5 text-sm">
            <p>
              <span className="text-slate-500">Equipo: </span>
              <Link className="font-semibold underline" href={`/activos/${t.activo_id}`}>
                {t.activo}
              </Link>{" "}
              <ChipEstadoActivo estado={t.estado_activo} />
            </p>
            <p>
              <span className="text-slate-500">Registró: </span>
              {t.reportado}
            </p>
            {(t.realizado || t.realizado_externo) && (
              <p>
                <span className="text-slate-500">Lo hizo: </span>
                {t.realizado ?? t.realizado_externo}
              </p>
            )}
            {t.falla && (
              <p className="whitespace-pre-line">
                <span className="text-slate-500">Falla: </span>
                {t.falla}
              </p>
            )}
            {t.causa && (
              <p>
                <span className="text-slate-500">Causa: </span>
                <strong>{t.causa}</strong>
              </p>
            )}
            {t.solucion && (
              <p className="whitespace-pre-line">
                <span className="text-slate-500">Solución: </span>
                {t.solucion}
              </p>
            )}
            {t.fecha_cierre && t.tipo === "correctivo" && (
              <p>
                <span className="text-slate-500">Cerrado: </span>
                {fmtFecha(t.fecha_cierre)}
              </p>
            )}
            <p className="text-slate-500">
              {[
                t.horas_parada != null && `${fmtNum(t.horas_parada)} h parado`,
                t.horas_hombre != null && `${fmtNum(t.horas_hombre)} horas hombre`,
                costoTotal > 0 && `${fmtPesos(costoTotal)} en externos`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {t.observaciones && <p className="whitespace-pre-line text-slate-600">{t.observaciones}</p>}
          </div>

          {tareas.length > 0 && <PlanillaHecha tareas={tareas} />}

          {encontrados.length > 0 && (
            <div className="tarjeta p-5">
              <p className="mb-1 font-bold">Hallazgos ({encontrados.length})</p>
              <p className="mb-3 text-xs text-slate-500">Cada ✗ de la planilla. Si hay que repararlo, abrí el correctivo desde acá.</p>
              <ul className="space-y-2 text-sm">
                {encontrados.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold text-rojo">✗</span> {tituloHallazgo(h)}
                      {h.nota && <span className="block text-xs text-slate-500">{h.nota}</span>}
                    </span>
                    {sesion.rol !== "auditor" && (
                      <Link
                        className="boton-secundario min-h-9 px-3 text-sm"
                        href={`/trabajos/nuevo?${new URLSearchParams({
                          activo: String(h.activoId ?? t.activo_id),
                          titulo: tituloHallazgo(h),
                          falla: `Hallazgo del control «${t.titulo}» del ${fmtFecha(t.fecha)}.${h.nota ? ` ${h.nota}` : ""}`,
                        })}`}
                      >
                        Abrir correctivo
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {t.tipo === "correctivo" && (
            <div className="tarjeta space-y-3 p-5">
              <p className="font-bold">Avances de la reparación</p>
              {puedeSeguir && t.estado !== "cerrado" && (
                <NuevoAvance trabajoId={t.id} hoy={hoyAR()} equipo={{ id: t.activo_id, nombre: t.activo, estado: t.estado_activo }} />
              )}
              <ul className="space-y-2">
                {avances.map((a) => (
                  <li key={a.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                    <p className="whitespace-pre-line">{a.texto}</p>
                    <p className="text-xs text-slate-400">
                      {fmtFecha(a.fecha)} · {a.usuario}
                    </p>
                  </li>
                ))}
                {avances.length === 0 && <li className="text-sm text-slate-500">Sin avances registrados.</li>}
              </ul>
              {cambios.length > 0 && (
                <div className="border-t border-slate-100 pt-2">
                  <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Cambios de estado del equipo</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {cambios.map((c, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-400">{c.cuando}</span>
                        <ChipEstadoActivo estado={c.desde as EstadoActivo} /> → <ChipEstadoActivo estado={c.hasta as EstadoActivo} />
                        <span className="text-slate-400">{c.usuario}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {consumos.length > 0 && (
            <div className="tarjeta p-5">
              <p className="mb-2 font-bold">Insumos usados</p>
              <ul className="space-y-1 text-sm">
                {consumos.map((c, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{c.nombre}</span>
                    <span className="cifra">
                      {fmtNum(c.cantidad)} {c.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {puedeSeguir && (
          <Seguimiento
            equipo={{ id: t.activo_id, nombre: t.activo, estado: t.estado_activo }}
            hoy={hoyAR()}
            causas={causas}
            usuarios={usuarios.filter((x) => x.rol !== "auditor" && x.rol !== "conductor")}
            insumos={insumos}
            inicial={{
              id: t.id,
              estado: t.estado,
              prioridad: t.prioridad,
              causaId: t.causa_id,
              solucion: t.solucion ?? "",
              realizadoPorId: t.realizado_por_id,
              realizadoExterno: t.realizado_externo ?? "",
              fechaCierre: t.fecha_cierre ?? "",
              horasParada: t.horas_parada != null ? String(t.horas_parada) : "",
              horasHombre: t.horas_hombre != null ? String(t.horas_hombre) : "",
              costoManoObra: t.costo_mano_obra != null ? String(t.costo_mano_obra) : "",
              costoRepuestos: t.costo_repuestos != null ? String(t.costo_repuestos) : "",
              observaciones: t.observaciones ?? "",
            }}
          />
        )}
      </div>
    </>
  );
}

const CELDA: Record<ValorCelda, string> = { ok: "✓", mal: "✗", na: "—" };

function PlanillaHecha({
  tareas,
}: {
  tareas: Array<{ seccion: string | null; accion: string; descripcion: string; valores: Record<string, ValorCelda>; resultado: keyof typeof RESULTADO; nota: string | null }>;
}) {
  const columnas = [...new Set(tareas.flatMap((x) => Object.keys(x.valores)))];
  const unica = columnas.length <= 1 && (columnas[0] ?? COLUMNA_UNICA) === COLUMNA_UNICA;
  const secciones = [...new Set(tareas.map((x) => x.seccion ?? ""))];
  const malas = tareas.filter((x) => x.resultado === "no_ok").length;
  return (
    <div className="tarjeta p-5">
      <p className="mb-2 font-bold">
        Planilla <span className="text-sm font-normal text-slate-500">· {tareas.length} filas · {malas} con ✗</span>
      </p>
      {secciones.map((sec) => {
        const lista = tareas.filter((x) => (x.seccion ?? "") === sec);
        return (
          <div key={sec} className="mb-3 last:mb-0">
            {sec && <p className="mb-1 text-sm font-semibold text-slate-700">{sec}</p>}
            {unica ? (
              <ul className="space-y-1.5 text-sm">
                {lista.map((x, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="capitalize">{x.accion}</span> {x.descripcion}
                      {x.nota && <span className="block text-xs text-slate-500">{x.nota}</span>}
                    </span>
                    <Chip tono={RESULTADO[x.resultado].tono}>{RESULTADO[x.resultado].texto}</Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th />
                      {columnas.map((c) => (
                        <th key={c} className="text-center">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((x, i) => (
                      <tr key={i} className={x.resultado === "no_ok" ? "bg-rojo-suave" : undefined}>
                        <td>
                          {x.descripcion}
                          {x.nota && <span className="block text-xs text-slate-500">{x.nota}</span>}
                        </td>
                        {columnas.map((c) => {
                          const v = x.valores[c] ?? "na";
                          return (
                            <td key={c} className={`text-center font-bold ${v === "mal" ? "text-rojo" : v === "ok" ? "text-verde" : "text-slate-300"}`}>
                              {CELDA[v]}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
