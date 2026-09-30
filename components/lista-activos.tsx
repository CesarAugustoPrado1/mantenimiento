import Link from "next/link";
import { sql } from "drizzle-orm";
import { filas } from "@/lib/db/filas";
import { agenda } from "@/lib/consultas";
import { fmtFecha, fmtNum, UNIDAD_MEDIDOR } from "@/lib/formato";
import type { ClaseActivo, EstadoActivo, Medidor } from "@/lib/db/schema";
import { Chip, ChipEstadoActivo, Vacio } from "./ui";

type Fila = {
  id: number;
  nombre: string;
  tipo: string;
  codigo: string | null;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  ubicacion: string | null;
  propiedad: "empresa" | "empleado";
  responsable: string | null;
  medidor: Medidor;
  estado: EstadoActivo;
  lec_valor: number | null;
  lec_fecha: string | null;
  abiertos: number;
};

/** La lista de máquinas o de vehículos: la misma pantalla con otro filtro. */
export async function ListaActivos({
  clase,
  soloDe,
  verBajas,
}: {
  clase: ClaseActivo;
  soloDe?: number;
  verBajas?: boolean;
}) {
  const [lista, items] = await Promise.all([
    filas<Fila>(sql`
      select a.id, a.nombre, a.tipo, a.codigo, a.patente, a.marca, a.modelo, a.anio, a.ubicacion,
             a.propiedad, u.nombre as responsable, a.medidor, a.estado,
             l.valor::float8 as lec_valor, l.fecha::text as lec_fecha,
             (select count(*)::int from trabajos t where t.activo_id = a.id
               and t.tipo = 'correctivo' and t.estado <> 'cerrado') as abiertos
        from activos a
        left join usuarios u on u.id = a.responsable_id
        left join lateral (select valor, fecha from lecturas where activo_id = a.id order by fecha desc limit 1) l on true
       where a.clase = ${clase}
         ${verBajas ? sql`` : sql`and a.estado <> 'baja'`}
         ${soloDe ? sql`and a.responsable_id = ${soloDe}` : sql``}
       order by a.tipo, a.nombre
    `),
    agenda(),
  ]);

  if (lista.length === 0) {
    return <Vacio>{soloDe ? "No tenés vehículos asignados." : "Todavía no hay nada cargado."}</Vacio>;
  }

  const vencidos = new Map<number, number>();
  const proximos = new Map<number, number>();
  for (const i of items) {
    if (i.venc.estado === "vencido") vencidos.set(i.activo_id, (vencidos.get(i.activo_id) ?? 0) + 1);
    if (i.venc.estado === "proximo") proximos.set(i.activo_id, (proximos.get(i.activo_id) ?? 0) + 1);
  }

  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {lista.map((a) => (
        <li key={a.id}>
          <Link href={`/activos/${a.id}`} className="tarjeta block h-full p-4 transition hover:ring-slate-300">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{a.nombre}</p>
                <p className="text-xs text-slate-500">
                  {[a.tipo, [a.marca, a.modelo].filter(Boolean).join(" "), a.anio].filter(Boolean).join(" · ")}
                </p>
              </div>
              {a.patente ? (
                <span className="codigo rounded-md bg-slate-900 px-2 py-0.5 text-xs text-white">{a.patente}</span>
              ) : (
                a.codigo && <span className="codigo text-xs text-slate-500">{a.codigo}</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChipEstadoActivo estado={a.estado} />
              {vencidos.get(a.id) ? <Chip tono="rojo">{vencidos.get(a.id)} vencido(s)</Chip> : null}
              {proximos.get(a.id) ? <Chip tono="amarillo">{proximos.get(a.id)} próximo(s)</Chip> : null}
              {a.abiertos > 0 && <Chip tono="amarillo">{a.abiertos} falla(s) abierta(s)</Chip>}
              {a.propiedad === "empleado" && <Chip tono="azul">de empleado</Chip>}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {a.medidor !== "ninguno" &&
                (a.lec_valor != null
                  ? `${fmtNum(a.lec_valor)} ${UNIDAD_MEDIDOR[a.medidor]} al ${fmtFecha(a.lec_fecha)}`
                  : `sin ${a.medidor === "km" ? "kilometraje" : "horas"} cargado`)}
              {a.responsable && ` · ${a.responsable}`}
              {a.ubicacion && ` · ${a.ubicacion}`}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
