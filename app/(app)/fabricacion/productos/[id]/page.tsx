import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { insumosActivos, usuariosActivos } from "@/lib/consultas";
import { ordenes } from "@/lib/consultas-fabricacion";
import { CONFIGURAN } from "@/lib/permisos";
import { ESTADO_OBRA } from "@/lib/etiquetas";
import { fmtFecha, fmtNum, hoyAR } from "@/lib/formato";
import { desvio } from "@/lib/cumplimiento";
import { eficiencia, horasPorUnidad } from "@/lib/fabricacion";
import { Chip, Titulo, Volver } from "@/components/ui";
import { ChipDesvio } from "@/components/avance";
import { BotonOrden, BotonProducto } from "../../formularios";
import { BorrarPorError } from "@/components/borrar-error";
import { dentroDeVentana } from "@/lib/borrado";


export const dynamic = "force-dynamic";

export default async function FichaProducto({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const hoy = hoyAR();

  const p = await fila<{
    id: number;
    nombre: string;
    modelo: string | null;
    descripcion: string | null;
    horas_estandar: number | null;
    activo: boolean;
    creado_en: string;
  }>(sql`select id, nombre, modelo, descripcion, horas_estandar::float8 as horas_estandar, activo, creado_en::text as creado_en
           from productos where id = ${id}`);
  if (!p) notFound();

  const [receta, lista, insumos, usuarios, archivos] = await Promise.all([
    filas<{ insumo_id: number | null; nombre: string | null; descripcion: string | null; unidad: string | null; cantidad: number; stock: number | null }>(sql`
      select m.insumo_id, i.nombre, m.descripcion, i.unidad, m.cantidad::float8 as cantidad, i.stock::float8 as stock
        from producto_materiales m left join insumos i on i.id = m.insumo_id
       where m.producto_id = ${id} order by m.id
    `),
    ordenes({ productoId: id }),
    insumosActivos(),
    usuariosActivos(),
    fila<{ n: number }>(sql`select count(*)::int as n from documentos where producto_id = ${id} and not archivado`),
  ]);

  const fabricadas = lista.reduce((s, o) => s + o.hechas, 0);
  const horas = lista.reduce((s, o) => s + o.horas, 0);
  const real = horasPorUnidad(horas, fabricadas);
  const ef = eficiencia(p.horas_estandar, real);
  const configura = CONFIGURAN.includes(sesion.rol);

  return (
    <>
      <Volver href="/fabricacion/productos">Productos</Volver>
      <Titulo
        detalle={[p.modelo, p.descripcion].filter(Boolean).join(" · ") || undefined}
        accion={
          <div className="flex flex-wrap gap-2">
            <Link href={`/archivos?producto=${p.id}`} className="boton-secundario text-sm">
              📁 Planos y archivos ({archivos?.n ?? 0})
            </Link>
            {configura && (
              <BotonProducto
                texto="Editar"
                clase="boton-secundario text-sm"
                insumos={insumos}
                inicial={{
                  id: p.id,
                  nombre: p.nombre,
                  modelo: p.modelo ?? "",
                  descripcion: p.descripcion ?? "",
                  horasEstandar: p.horas_estandar != null ? String(p.horas_estandar) : "",
                  activo: p.activo,
                  materiales: receta.map((r) => ({ insumoId: r.insumo_id, descripcion: r.descripcion ?? "", cantidad: String(r.cantidad) })),
                }}
              />
            )}
            {configura && p.activo && (
              <BotonOrden
                texto="+ Orden"
                clase="boton-primario text-sm"
                productos={[{ id: p.id, nombre: p.nombre, modelo: p.modelo }]}
                usuarios={usuarios.filter((u) => u.rol !== "auditor" && u.rol !== "conductor")}
                inicial={{
                  productoId: p.id,
                  cantidad: "",
                  destino: "",
                  prioridad: "media",
                  inicioPlan: "",
                  finPlan: "",
                  responsableId: null,
                  responsableExterno: "",
                  nota: "",
                  cancelada: false,
                }}
              />
            )}
          </div>
        }
      >
        {p.nombre} {!p.activo && <Chip>inactivo</Chip>}
      </Titulo>

      {configura && dentroDeVentana(p.creado_en) && (
        <div className="mb-3">
          <BorrarPorError tipo="producto" id={p.id} que={p.nombre} destino="/fabricacion/productos" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4">
          <p className="cifra text-2xl">{fabricadas}</p>
          <p className="text-xs text-slate-500">fabricadas en total</p>
        </div>
        <div className="tarjeta p-4">
          <p className="cifra text-2xl">{p.horas_estandar != null ? `${fmtNum(p.horas_estandar)} h` : "—"}</p>
          <p className="text-xs text-slate-500">estándar por unidad</p>
        </div>
        <div className="tarjeta p-4">
          <p className="cifra text-2xl">{real != null ? `${fmtNum(real)} h` : "—"}</p>
          <p className="text-xs text-slate-500">real por unidad (promedio)</p>
        </div>
        <div className="tarjeta p-4">
          <p className={`cifra text-2xl ${ef == null ? "" : ef >= 100 ? "text-verde" : ef >= 85 ? "text-amarillo-texto" : "text-rojo"}`}>
            {ef != null ? `${ef}%` : "—"}
          </p>
          <p className="text-xs text-slate-500">eficiencia (100% = lo previsto)</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Órdenes</h2>
          {lista.length === 0 ? (
            <p className="tarjeta p-4 text-sm text-slate-500">Todavía no se fabricó.</p>
          ) : (
            <ul className="tarjeta divide-y divide-slate-100">
              {lista.map((o) => (
                <li key={o.id}>
                  <Link href={`/fabricacion/ordenes/${o.id}`} className="flex flex-wrap items-center gap-2 p-3 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">
                        #{o.id} · {o.hechas} de {o.cantidad}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {o.destino ?? "—"} · {o.fin_plan ? `para el ${fmtFecha(o.fin_plan)}` : "sin fecha comprometida"}
                      </span>
                    </span>
                    <Chip tono={ESTADO_OBRA[o.estado].tono}>{ESTADO_OBRA[o.estado].texto}</Chip>
                    {o.estado !== "cancelada" && <ChipDesvio que="Fin" desvio={desvio(o.fin_plan, o.fecha_fin, hoy)} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">Receta (por unidad)</h2>
          {receta.length === 0 ? (
            <p className="text-sm text-slate-500">Sin materiales cargados.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {receta.map((r, i) => (
                <li key={i} className="flex justify-between gap-2">
                  {r.insumo_id ? (
                    <Link href={`/insumos/${r.insumo_id}`} className="hover:underline">
                      {r.nombre}
                    </Link>
                  ) : (
                    <span>{r.descripcion}</span>
                  )}
                  <span className="cifra">
                    {fmtNum(r.cantidad)} {r.unidad ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
