import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { insumosActivos } from "@/lib/consultas";
import { CONFIGURAN } from "@/lib/permisos";
import { fmtNum } from "@/lib/formato";
import { eficiencia, horasPorUnidad } from "@/lib/fabricacion";
import { Chip, Titulo, Vacio, Volver } from "@/components/ui";
import { BotonProducto } from "../formularios";

export const metadata = { title: "Productos · Fabricación" };
export const dynamic = "force-dynamic";

export default async function Productos({ searchParams }: { searchParams: Promise<{ inactivos?: string }> }) {
  const sesion = await requerirSesion();
  const { inactivos } = await searchParams;
  const [lista, insumos] = await Promise.all([
    filas<{
      id: number;
      nombre: string;
      modelo: string | null;
      horas_estandar: number | null;
      activo: boolean;
      materiales: number;
      fabricadas: number;
      horas: number;
      abiertas: number;
      archivos: number;
    }>(sql`
      select p.id, p.nombre, p.modelo, p.horas_estandar::float8 as horas_estandar, p.activo,
             (select count(*)::int from producto_materiales m where m.producto_id = p.id) as materiales,
             coalesce((select sum(x.unidades) from partes_fabricacion x join ordenes_fabricacion o on o.id = x.orden_id
                        where o.producto_id = p.id), 0)::int as fabricadas,
             coalesce((select sum(x.horas_hombre) from partes_fabricacion x join ordenes_fabricacion o on o.id = x.orden_id
                        where o.producto_id = p.id), 0)::float8 as horas,
             (select count(*)::int from ordenes_fabricacion o where o.producto_id = p.id and o.estado in ('pendiente','en_curso')) as abiertas,
             (select count(*)::int from documentos d where d.producto_id = p.id and not d.archivado) as archivos
        from productos p
       where ${inactivos === "1" ? sql`true` : sql`p.activo`}
       order by p.nombre
    `),
    insumosActivos(),
  ]);

  return (
    <>
      <Volver href="/fabricacion">Fabricación</Volver>
      <Titulo
        detalle="El catálogo de lo que fabrica el taller, con su receta (materiales por unidad), su tiempo estándar y sus planos."
        accion={
          CONFIGURAN.includes(sesion.rol) ? (
            <BotonProducto
              texto="+ Producto"
              insumos={insumos}
              inicial={{ nombre: "", modelo: "", descripcion: "", horasEstandar: "", activo: true, materiales: [] }}
            />
          ) : null
        }
      >
        Productos del taller
      </Titulo>
      {lista.length === 0 ? (
        <Vacio>Todavía no hay productos. Ejemplos: mesa vibradora, cajón de contramolde, esqueleto para molde.</Vacio>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {lista.map((p) => {
            const real = horasPorUnidad(p.horas, p.fabricadas);
            const ef = eficiencia(p.horas_estandar, real);
            return (
              <li key={p.id}>
                <Link href={`/fabricacion/productos/${p.id}`} className="tarjeta block h-full p-4 hover:ring-slate-300">
                  <p className="font-bold">
                    {p.nombre} {!p.activo && <Chip>inactivo</Chip>}
                  </p>
                  {p.modelo && <p className="text-sm text-slate-600">{p.modelo}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip>{p.horas_estandar != null ? `estándar ${fmtNum(p.horas_estandar)} h/u` : "sin tiempo estándar"}</Chip>
                    {real != null && <Chip tono={ef != null && ef < 90 ? "amarillo" : "verde"}>real {fmtNum(real)} h/u</Chip>}
                    {p.abiertas > 0 && <Chip tono="azul">{p.abiertas} orden(es) abierta(s)</Chip>}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {p.fabricadas} fabricadas · {p.materiales} materiales en la receta · {p.archivos} archivo(s)
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-center text-sm">
        <Link className="text-slate-500 underline" href={inactivos === "1" ? "/fabricacion/productos" : "/fabricacion/productos?inactivos=1"}>
          {inactivos === "1" ? "Ocultar inactivos" : "Ver también los inactivos"}
        </Link>
      </p>
    </>
  );
}
