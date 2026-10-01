import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { agenda, nombreActivo } from "@/lib/consultas";
import { fmtFecha, fmtNum, hoyAR } from "@/lib/formato";
import { nivelDeStock } from "@/lib/semaforo";
import { ChipPrioridad, ChipVencimiento, Chip, Indicador, Semaforo, Titulo } from "@/components/ui";

export const metadata = { title: "Tablero · Taller" };
export const dynamic = "force-dynamic";

/**
 * Lo que el jefe de taller necesita ver a primera hora: qué está vencido, qué
 * falta en el pañol, qué está roto. Cada cifra es un link a la pantalla que la
 * explica.
 */
export default async function Tablero() {
  await requerirSesion();
  const hoy = hoyAR();
  const inicioMes = `${hoy.slice(0, 8)}01`;

  const [items, n, criticos, correctivos, herramientas] = await Promise.all([
    agenda(),
    fila<Record<string, number>>(sql`
      select
        (select count(*) from insumos where activo and stock <= critico)::int as rojos,
        (select count(*) from insumos where activo and stock > critico and stock <= atento)::int as amarillos,
        (select count(*) from insumos where activo and infaltable and stock <= atento)::int as infaltables,
        (select count(*) from trabajos where tipo = 'correctivo' and estado <> 'cerrado')::int as correctivos,
        (select count(*) from activos where estado in ('con_falla', 'en_reparacion', 'fuera_de_servicio'))::int as equipos_mal,
        (select count(*) from activos where estado = 'en_reparacion')::int as en_reparacion,
        (select count(*) from activos where estado = 'fuera_de_servicio')::int as fuera_servicio,
        (select count(*) from obras where estado in ('pendiente', 'en_curso'))::int as obras,
        (select count(*) from ordenes_fabricacion where estado in ('pendiente', 'en_curso'))::int as ordenes,
        (select count(*) from ordenes_fabricacion where estado in ('pendiente', 'en_curso') and fin_plan < ${hoy})::int as ordenes_atrasadas,
        (select count(distinct i.id) from insumos i join activo_repuestos ar on ar.insumo_id = i.id
          join activos a on a.id = ar.activo_id
          where i.activo and a.estado <> 'baja' and ar.criticidad = 'alta' and i.stock <= i.critico)::int as repuestos_criticos,
        (select count(*) from activos a where a.medidor <> 'ninguno' and a.estado <> 'baja'
           and not exists (select 1 from lecturas l where l.activo_id = a.id and l.fecha >= ${inicioMes}))::int as sin_lectura
    `),
    filas<{
      id: number;
      nombre: string;
      unidad: string;
      stock: number;
      critico: number;
      atento: number;
      infaltable: boolean;
    }>(sql`
      select id, nombre, unidad, stock::float8 as stock, critico::float8 as critico,
             atento::float8 as atento, infaltable
        from insumos
       where activo and stock <= atento
       order by infaltable desc, (stock <= critico) desc, nombre
       limit 12
    `),
    filas<{
      id: number;
      titulo: string;
      prioridad: string;
      fecha: string;
      activo: string;
      patente: string | null;
      codigo: string | null;
      estado: string;
    }>(sql`
      select t.id, t.titulo, t.prioridad, t.fecha::text as fecha, t.estado,
             a.nombre as activo, a.patente, a.codigo
        from trabajos t join activos a on a.id = t.activo_id
       where t.tipo = 'correctivo' and t.estado <> 'cerrado'
       order by array_position(array['urgente','alta','media','baja']::text[], t.prioridad::text), t.fecha
       limit 8
    `),
    fila<{ faltantes: number; tipos: number }>(sql`
      select coalesce(sum(falta), 0)::int as faltantes, count(*) filter (where falta > 0)::int as tipos
        from (
          select greatest(ht.requeridas - count(h.id) filter (where h.estado in ('bueno', 'regular')), 0) as falta
            from herramienta_tipos ht left join herramientas h on h.tipo_id = ht.id
           where ht.activo group by ht.id
        ) x
    `),
  ]);

  const vencidos = items.filter((i) => i.venc.estado === "vencido");
  const proximos = items.filter((i) => i.venc.estado === "proximo");
  const urgentes = [...vencidos, ...proximos].slice(0, 10);

  return (
    <>
      <Titulo detalle={`Hoy, ${fmtFecha(hoy)}`}>Tablero</Titulo>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          href="/agenda"
          valor={vencidos.length}
          etiqueta="Preventivos vencidos"
          tono={vencidos.length ? "rojo" : "verde"}
          detalle={`${proximos.length} próximos`}
        />
        <Indicador
          href="/insumos?nivel=rojo"
          valor={n?.rojos ?? 0}
          etiqueta="Insumos en rojo"
          tono={n?.rojos ? "rojo" : "verde"}
          detalle={`${n?.amarillos ?? 0} en amarillo · ${n?.infaltables ?? 0} infaltables bajos`}
        />
        <Indicador
          href="/trabajos?tipo=correctivo&estado=pendientes"
          valor={n?.correctivos ?? 0}
          etiqueta="Correctivos abiertos"
          tono={n?.correctivos ? "amarillo" : "verde"}
          detalle={`${n?.equipos_mal ?? 0} equipos con problemas: ${n?.en_reparacion ?? 0} en reparación, ${n?.fuera_servicio ?? 0} fuera de servicio`}
        />
        <Indicador
          href="/herramientas"
          valor={herramientas?.faltantes ?? 0}
          etiqueta="Herramientas faltantes"
          tono={herramientas?.faltantes ? "amarillo" : "verde"}
          detalle={`en ${herramientas?.tipos ?? 0} tipos`}
        />
        <Indicador
          href="/repuestos"
          valor={n?.repuestos_criticos ?? 0}
          etiqueta="Repuestos críticos sin stock"
          tono={n?.repuestos_criticos ? "rojo" : "verde"}
          detalle="si se rompen, la máquina para"
        />
        <Indicador
          href="/obras"
          valor={n?.obras ?? 0}
          etiqueta="Obras abiertas"
          detalle="pendientes y en curso"
        />
        <Indicador
          href="/fabricacion"
          valor={n?.ordenes ?? 0}
          etiqueta="Órdenes de fabricación"
          tono={n?.ordenes_atrasadas ? "rojo" : "gris"}
          detalle={n?.ordenes_atrasadas ? `${n.ordenes_atrasadas} atrasada(s)` : "abiertas, ninguna atrasada"}
        />
        <Indicador
          href="/km"
          valor={n?.sin_lectura ?? 0}
          etiqueta="Sin km/horas este mes"
          tono={n?.sin_lectura ? "amarillo" : "verde"}
          detalle="vehículos y equipos con medidor"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
            Preventivos a atender
          </h2>
          {urgentes.length === 0 ? (
            <p className="tarjeta p-4 text-sm text-slate-500">Nada vencido ni próximo. 👌</p>
          ) : (
            <ul className="tarjeta divide-y divide-slate-100">
              {urgentes.map((i) => (
                <li key={i.plan_id}>
                  <Link href={`/trabajos/preventivo/${i.plan_id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{i.plan}</p>
                      <p className="truncate text-xs text-slate-500">
                        {nombreActivo({ nombre: i.activo, patente: i.patente, codigo: i.codigo })} · {i.responsable ?? i.responsable_externo ?? "sin responsable"}
                      </p>
                    </div>
                    <div className="text-right">
                      <ChipVencimiento estado={i.venc.estado} />
                      <p className="mt-0.5 text-xs text-slate-500">{fmtFecha(i.venc.fechaAgenda)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
            Insumos bajos
          </h2>
          {criticos.length === 0 ? (
            <p className="tarjeta p-4 text-sm text-slate-500">Todo el pañol en verde.</p>
          ) : (
            <ul className="tarjeta divide-y divide-slate-100">
              {criticos.map((i) => (
                <li key={i.id}>
                  <Link href={`/insumos/${i.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {i.nombre} {i.infaltable && <Chip tono="oscuro">infaltable</Chip>}
                      </p>
                      <p className="text-xs text-slate-500">
                        quedan <span className="cifra">{fmtNum(i.stock)}</span> {i.unidad}
                      </p>
                    </div>
                    <Semaforo nivel={nivelDeStock(i.stock, i.critico, i.atento)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
            Correctivos abiertos
          </h2>
          {correctivos.length === 0 ? (
            <p className="tarjeta p-4 text-sm text-slate-500">No hay fallas abiertas.</p>
          ) : (
            <ul className="tarjeta divide-y divide-slate-100">
              {correctivos.map((t) => (
                <li key={t.id}>
                  <Link href={`/trabajos/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.titulo}</p>
                      <p className="truncate text-xs text-slate-500">
                        {nombreActivo({ nombre: t.activo, patente: t.patente, codigo: t.codigo })} · desde {fmtFecha(t.fecha)}
                      </p>
                    </div>
                    <ChipPrioridad prioridad={t.prioridad} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
