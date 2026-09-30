import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { nombreActivo } from "@/lib/consultas";
import { fmtFecha, fmtNum, hoyAR, UNIDAD_MEDIDOR } from "@/lib/formato";
import type { Medidor } from "@/lib/db/schema";
import { CargarLectura } from "@/components/cargar-lectura";
import { Chip, Titulo, Vacio } from "@/components/ui";

export const metadata = { title: "Cargar km · Taller" };
export const dynamic = "force-dynamic";

/**
 * La pantalla del conductor: sus vehículos y un campo para el km. Con eso
 * alcanza para que los services por kilometraje se calculen solos.
 */
export default async function CargarKm() {
  const sesion = await requerirSesion();
  const hoy = hoyAR();
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const soloMios = sesion.rol === "conductor";

  const lista = await filas<{
    id: number;
    nombre: string;
    tipo: string;
    patente: string | null;
    codigo: string | null;
    medidor: Medidor;
    responsable: string | null;
    valor: number | null;
    fecha: string | null;
  }>(sql`
    select a.id, a.nombre, a.tipo, a.patente, a.codigo, a.medidor, u.nombre as responsable,
           l.valor::float8 as valor, l.fecha::text as fecha
      from activos a
      left join usuarios u on u.id = a.responsable_id
      left join lateral (select valor, fecha from lecturas where activo_id = a.id order by fecha desc limit 1) l on true
     where a.medidor <> 'ninguno' and a.estado <> 'baja'
       ${soloMios ? sql`and a.responsable_id = ${sesion.uid}` : sql``}
     order by (l.fecha is null or l.fecha < ${inicioMes}) desc, a.clase desc, a.nombre
  `);

  return (
    <>
      <Titulo detalle="Una vez por mes como mínimo. Con eso la agenda calcula cuándo le toca el service a cada uno.">
        Cargar kilometraje y horas
      </Titulo>
      {lista.length === 0 && (
        <Vacio>{soloMios ? "No tenés vehículos asignados. Pedíselo al jefe de taller." : "No hay equipos con medidor."}</Vacio>
      )}
      <ul className="space-y-3">
        {lista.map((a) => {
          const alDia = a.fecha != null && a.fecha >= inicioMes;
          const u = UNIDAD_MEDIDOR[a.medidor];
          return (
            <li key={a.id} className="tarjeta p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <Link href={`/activos/${a.id}`} className="font-bold hover:underline">
                    {nombreActivo(a)}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {a.tipo}
                    {!soloMios && a.responsable && ` · ${a.responsable}`} ·{" "}
                    {a.valor != null ? `${fmtNum(a.valor)} ${u} al ${fmtFecha(a.fecha)}` : "nunca cargado"}
                  </p>
                </div>
                {alDia ? <Chip tono="verde">este mes ✓</Chip> : <Chip tono="amarillo">falta este mes</Chip>}
              </div>
              <CargarLectura activoId={a.id} unidad={u} hoy={hoy} ultima={a.valor} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
