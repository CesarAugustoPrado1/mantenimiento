import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { agenda, insumosActivos, nombreActivo, usuariosActivos } from "@/lib/consultas";
import { fmtFecha, fmtNum, hoyAR, UNIDAD_MEDIDOR } from "@/lib/formato";
import { columnasDe } from "@/lib/planilla";
import type { AccionTarea, Medidor } from "@/lib/db/schema";
import { ChipVencimiento, Titulo, Volver } from "@/components/ui";
import { RegistrarPreventivo } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PantallaPreventivo({ params }: { params: Promise<{ planId: string }> }) {
  const sesion = await requerirRol("admin", "jefe_taller", "tecnico");
  const planId = Number((await params).planId);
  if (!Number.isInteger(planId)) notFound();

  const plan = await fila<{
    id: number;
    nombre: string;
    descripcion: string | null;
    herramientas: string | null;
    responsable_id: number | null;
    responsable_externo: string | null;
    activo_id: number;
    activo: string;
    patente: string | null;
    codigo: string | null;
    medidor: Medidor;
    columnas: string[];
  }>(sql`
    select p.id, p.nombre, p.descripcion, p.herramientas, p.responsable_id, p.responsable_externo, p.columnas,
           a.id as activo_id, a.nombre as activo, a.patente, a.codigo, a.medidor
      from planes p join activos a on a.id = p.activo_id where p.id = ${planId}
  `);
  if (!plan) notFound();

  const [tareas, materiales, usuarios, insumos, [estado], ultima, recurrentes] = await Promise.all([
    filas<{ seccion: string | null; activoId: number | null; accion: AccionTarea; descripcion: string }>(sql`
      select seccion, activo_id as "activoId", accion, descripcion from plan_tareas where plan_id = ${planId} order by orden
    `),
    filas<{ insumo_id: number | null; descripcion: string | null; cantidad: number; nombre: string | null; unidad: string | null; stock: number | null }>(sql`
      select pm.insumo_id, pm.descripcion, pm.cantidad::float8 as cantidad, i.nombre, i.unidad, i.stock::float8 as stock
        from plan_materiales pm left join insumos i on i.id = pm.insumo_id where pm.plan_id = ${planId}
    `),
    usuariosActivos(),
    insumosActivos(),
    agenda({ activoId: plan.activo_id }).then((l) => l.filter((x) => x.plan_id === planId)),
    fila<{ valor: number }>(sql`
      select valor::float8 as valor from lecturas where activo_id = ${plan.activo_id} order by fecha desc limit 1
    `),
    filas<{ donde: string; columna: string; veces: number; ultima: string }>(sql`
      select concat_ws(' · ', tt.seccion, tt.descripcion) as donde, c.key as columna,
             count(*)::int as veces, max(t.fecha)::text as ultima
        from trabajo_tareas tt
        join trabajos t on t.id = tt.trabajo_id
        cross join lateral jsonb_each_text(tt.valores) c
       where t.plan_id = ${planId} and t.fecha >= current_date - 90 and c.value = 'mal'
       group by 1, 2 order by 3 desc, 4 desc limit 10
    `),
  ]);

  const u = UNIDAD_MEDIDOR[plan.medidor];

  return (
    <>
      <Volver href={`/activos/${plan.activo_id}`}>{nombreActivo({ nombre: plan.activo, patente: plan.patente, codigo: plan.codigo })}</Volver>
      <Titulo
        detalle={
          estado
            ? `Vence ${estado.venc.estimada ? "≈ " : ""}${fmtFecha(estado.venc.fechaAgenda)}${
                estado.venc.venceUso != null ? ` o a los ${fmtNum(estado.venc.venceUso)} ${u}` : ""
              }`
            : undefined
        }
        accion={estado ? <ChipVencimiento estado={estado.venc.estado} /> : null}
      >
        {plan.nombre}
      </Titulo>

      {(plan.descripcion || plan.herramientas || materiales.length > 0) && (
        <div className="tarjeta mb-4 space-y-2 p-5 text-sm">
          {plan.descripcion && <p className="whitespace-pre-line text-slate-600">{plan.descripcion}</p>}
          {materiales.length > 0 && (
            <div>
              <p className="font-semibold">Hace falta:</p>
              <ul className="ml-4 list-disc">
                {materiales.map((m, i) => (
                  <li key={i}>
                    {fmtNum(m.cantidad)} {m.unidad ?? ""} {m.nombre ?? m.descripcion}
                    {m.stock != null && m.stock < m.cantidad && (
                      <span className="ml-2 font-semibold text-red-700">— hay {fmtNum(m.stock)} en el pañol</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.herramientas && (
            <p>
              <span className="font-semibold">Herramientas:</span> {plan.herramientas}
            </p>
          )}
        </div>
      )}

      {recurrentes.length > 0 && (
        <div className="tarjeta mb-4 p-5">
          <p className="mb-2 font-bold">Lo que más da mal en esta planilla (90 días)</p>
          <ul className="space-y-1 text-sm">
            {recurrentes.map((r) => (
              <li key={r.donde + r.columna} className="flex justify-between gap-2">
                <span>
                  {r.donde}
                  {r.columna !== "Estado" && <span className="text-slate-500"> · {r.columna}</span>}
                </span>
                <span className="text-slate-500">
                  <span className="cifra text-rojo">{r.veces}×</span> · última {fmtFecha(r.ultima)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RegistrarPreventivo
        planId={plan.id}
        medidor={plan.medidor}
        hoy={hoyAR()}
        ultimaLectura={ultima?.valor ?? null}
        yo={sesion.uid}
        responsableId={plan.responsable_id}
        responsableExterno={plan.responsable_externo}
        columnas={columnasDe(plan.columnas)}
        tareas={tareas}
        consumos={materiales
          .filter((m) => m.insumo_id)
          .map((m) => ({ insumoId: m.insumo_id, cantidad: String(m.cantidad) }))}
        usuarios={usuarios.filter((x) => x.rol !== "auditor" && x.rol !== "conductor")}
        insumos={insumos}
      />
    </>
  );
}
