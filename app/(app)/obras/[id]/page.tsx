import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { usuariosActivos } from "@/lib/consultas";
import { CONFIGURAN, OPERAN } from "@/lib/permisos";
import { ESTADO_OBRA, type DatosObra } from "@/lib/etiquetas";
import { fmtFecha, fmtNum, fmtPesos } from "@/lib/formato";
import { Chip, ChipPrioridad, Titulo, Volver } from "@/components/ui";
import { BotonObra, NuevaNota } from "../formulario";

export const dynamic = "force-dynamic";

export default async function FichaObra({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const o = await fila<{
    id: number;
    titulo: string;
    lugar: string;
    tipo: string | null;
    descripcion: string | null;
    estado: DatosObra["estado"];
    prioridad: DatosObra["prioridad"];
    fecha_inicio: string | null;
    fecha_estimada: string | null;
    fecha_fin: string | null;
    responsable_id: number | null;
    responsable: string | null;
    responsable_externo: string | null;
    horas_hombre: number | null;
    costo_mano_obra: number | null;
    costo_materiales: number | null;
    creado_por: string;
  }>(sql`
    select o.id, o.titulo, o.lugar, o.tipo, o.descripcion, o.estado, o.prioridad,
           o.fecha_inicio::text as fecha_inicio, o.fecha_estimada::text as fecha_estimada,
           o.fecha_fin::text as fecha_fin, o.responsable_id, u.nombre as responsable,
           o.responsable_externo, o.horas_hombre::float8 as horas_hombre,
           o.costo_mano_obra::float8 as costo_mano_obra, o.costo_materiales::float8 as costo_materiales,
           c.nombre as creado_por
      from obras o left join usuarios u on u.id = o.responsable_id join usuarios c on c.id = o.creado_por_id
     where o.id = ${id}
  `);
  if (!o) notFound();

  const [notas, materiales, usuarios] = await Promise.all([
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
  ]);

  const e = ESTADO_OBRA[o.estado];

  return (
    <>
      <Volver href="/obras">Obras</Volver>
      <Titulo
        detalle={`📍 ${o.lugar}${o.tipo ? ` · ${o.tipo}` : ""}`}
        accion={
          CONFIGURAN.includes(sesion.rol) ? (
            <BotonObra
              texto="Editar"
              clase="boton-secundario text-sm"
              usuarios={usuarios.filter((u) => u.rol !== "auditor")}
              inicial={{
                id: o.id,
                titulo: o.titulo,
                lugar: o.lugar,
                tipo: o.tipo ?? "",
                descripcion: o.descripcion ?? "",
                estado: o.estado,
                prioridad: o.prioridad,
                fechaInicio: o.fecha_inicio ?? "",
                fechaEstimada: o.fecha_estimada ?? "",
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

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip tono={e.tono}>{e.texto}</Chip>
        <ChipPrioridad prioridad={o.prioridad} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="tarjeta space-y-2 p-5 text-sm">
            {o.descripcion && <p className="whitespace-pre-line">{o.descripcion}</p>}
            <p className="text-slate-600">
              Responsable: {o.responsable ?? "—"}
              {o.responsable_externo && ` · externo: ${o.responsable_externo}`}
            </p>
            <p className="text-slate-600">
              Inicio {fmtFecha(o.fecha_inicio)} · estimado {fmtFecha(o.fecha_estimada)} · fin {fmtFecha(o.fecha_fin)}
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
        </div>
        <div className="tarjeta space-y-3 p-5">
          <p className="font-bold">Bitácora</p>
          {OPERAN.includes(sesion.rol) && <NuevaNota obraId={o.id} />}
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
    </>
  );
}
