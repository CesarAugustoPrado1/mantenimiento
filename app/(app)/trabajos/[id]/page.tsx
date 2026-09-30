import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { causasActivas, insumosActivos, nombreActivo, usuariosActivos } from "@/lib/consultas";
import { OPERAN } from "@/lib/permisos";
import { fmtFecha, fmtNum, fmtPesos, hoyAR, UNIDAD_MEDIDOR } from "@/lib/formato";
import type { EstadoActivo, Medidor } from "@/lib/db/schema";
import { Chip, ChipEstadoActivo, ChipPrioridad, Titulo, Volver } from "@/components/ui";
import { Seguimiento } from "./seguimiento";

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
  ok: { texto: "OK", tono: "verde" },
  corregido: { texto: "Corregido", tono: "azul" },
  no_ok: { texto: "Mal", tono: "rojo" },
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

  const [tareas, consumos] = await Promise.all([
    filas<{ accion: string; descripcion: string; resultado: keyof typeof RESULTADO; nota: string | null }>(sql`
      select accion, descripcion, resultado, nota from trabajo_tareas where trabajo_id = ${id} order by id
    `),
    filas<{ nombre: string; unidad: string; cantidad: number; fecha: string }>(sql`
      select i.nombre, i.unidad, (-m.cantidad)::float8 as cantidad, m.fecha::text as fecha
        from movimientos_insumo m join insumos i on i.id = m.insumo_id
       where m.trabajo_id = ${id} order by m.id
    `),
  ]);

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

          {tareas.length > 0 && (
            <div className="tarjeta p-5">
              <p className="mb-2 font-bold">Checklist</p>
              <ul className="space-y-1.5 text-sm">
                {tareas.map((x, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="capitalize">{x.accion}</span> {x.descripcion}
                      {x.nota && <span className="block text-xs text-slate-500">{x.nota}</span>}
                    </span>
                    <Chip tono={RESULTADO[x.resultado].tono}>{RESULTADO[x.resultado].texto}</Chip>
                  </li>
                ))}
              </ul>
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
              estadoActivo: t.estado_activo === "baja" ? "fuera_de_servicio" : t.estado_activo,
            }}
          />
        )}
      </div>
    </>
  );
}
