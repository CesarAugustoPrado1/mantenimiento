import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { usuariosActivos } from "@/lib/consultas";
import { ordenes } from "@/lib/consultas-fabricacion";
import { CONFIGURAN } from "@/lib/permisos";
import { ESTADO_OBRA } from "@/lib/etiquetas";
import { fmtFecha, hoyAR } from "@/lib/formato";
import { desvio } from "@/lib/cumplimiento";
import { avanceOrden } from "@/lib/fabricacion";
import { Chip, ChipPrioridad, Pestanas, Titulo, Vacio } from "@/components/ui";
import { ChipDesvio } from "@/components/avance";
import { BotonOrden } from "./formularios";

export const metadata = { title: "Fabricación · Taller" };
export const dynamic = "force-dynamic";

export default async function Fabricacion({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const sesion = await requerirSesion();
  const { ver = "abiertas" } = await searchParams;
  const hoy = hoyAR();
  const [lista, productos, usuarios] = await Promise.all([
    ordenes({ abiertas: ver !== "cerradas" }),
    filas<{ id: number; nombre: string; modelo: string | null }>(sql`select id, nombre, modelo from productos where activo order by nombre`),
    usuariosActivos(),
  ]);
  const configura = CONFIGURAN.includes(sesion.rol);

  return (
    <>
      <Titulo
        detalle="Lo que fabrica el taller: mesas vibradoras, cajones de contramolde, esqueletos… Órdenes con fecha comprometida, partes de producción y tiempos."
        accion={
          <div className="flex flex-wrap gap-2">
            <Link href="/fabricacion/productos" className="boton-secundario">
              Productos
            </Link>
            <Link href="/fabricacion/estadisticas" className="boton-secundario">
              📊 Estadísticas
            </Link>
            {configura && productos.length > 0 && (
              <BotonOrden
                texto="+ Orden"
                productos={productos}
                usuarios={usuarios.filter((u) => u.rol !== "auditor" && u.rol !== "conductor")}
                inicial={{
                  productoId: null,
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
        Fabricación
      </Titulo>
      <Pestanas
        actual={ver}
        opciones={[
          { valor: "abiertas", etiqueta: "Órdenes abiertas", href: "/fabricacion" },
          { valor: "cerradas", etiqueta: "Terminadas y canceladas", href: "/fabricacion?ver=cerradas" },
        ]}
      />
      {productos.length === 0 ? (
        <Vacio>
          Primero cargá los productos que fabrica el taller, con su receta y su tiempo estándar:{" "}
          <Link href="/fabricacion/productos" className="underline">
            Productos
          </Link>
          .
        </Vacio>
      ) : lista.length === 0 ? (
        <Vacio>No hay órdenes {ver === "cerradas" ? "cerradas" : "abiertas"}.</Vacio>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {lista.map((o) => {
            const av = avanceOrden(o.cantidad, o.hechas);
            return (
              <li key={o.id}>
                <Link href={`/fabricacion/ordenes/${o.id}`} className="tarjeta block h-full p-4 hover:ring-slate-300">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">
                        {o.cantidad} × {o.producto}
                      </p>
                      <p className="text-xs text-slate-500">{[o.modelo, o.destino].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className="text-xs text-slate-400">#{o.id}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                      <div className={`h-2.5 rounded-full ${av >= 100 ? "bg-verde" : "bg-blue-600"}`} style={{ width: `${av}%` }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums">
                      {o.hechas} de {o.cantidad}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip tono={ESTADO_OBRA[o.estado].tono}>{ESTADO_OBRA[o.estado].texto}</Chip>
                    {o.estado !== "terminada" && o.estado !== "cancelada" && <ChipPrioridad prioridad={o.prioridad} />}
                    {o.estado !== "cancelada" && <ChipDesvio que="Fin" desvio={desvio(o.fin_plan, o.fecha_fin, hoy)} />}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {o.responsable ?? o.responsable_externo ?? "sin responsable"}
                    {o.fin_plan && ` · para el ${fmtFecha(o.fin_plan)}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
