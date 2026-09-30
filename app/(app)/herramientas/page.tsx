import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { CONFIGURAN, OPERAN } from "@/lib/permisos";
import { ESTADO_HERRAMIENTA } from "@/lib/etiquetas";
import type { EstadoHerramienta } from "@/lib/db/schema";
import { Chip, Pestanas, Titulo, Vacio } from "@/components/ui";
import { EditarTipo, EditarUnidad } from "./panel";

export const metadata = { title: "Herramientas · Taller" };
export const dynamic = "force-dynamic";

type Tipo = {
  id: number;
  nombre: string;
  categoria: string | null;
  requeridas: number;
  nota: string | null;
  activo: boolean;
};
type Unidad = {
  id: number;
  tipo_id: number;
  codigo: string | null;
  marca: string | null;
  estado: EstadoHerramienta;
  ubicacion: string | null;
  nota: string | null;
};

const UTILIZABLE: EstadoHerramienta[] = ["bueno", "regular"];

/**
 * Inventario de herramientas contra lo que el taller necesita. Una en
 * reparación no cuenta como disponible: hoy no está.
 */
export default async function Herramientas({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const sesion = await requerirSesion();
  const { ver = "todas" } = await searchParams;
  const [tipos, unidades] = await Promise.all([
    filas<Tipo>(sql`select id, nombre, categoria, requeridas, nota, activo from herramienta_tipos where activo order by categoria nulls last, nombre`),
    filas<Unidad>(sql`select id, tipo_id, codigo, marca, estado, ubicacion, nota from herramientas where estado <> 'baja' order by id`),
  ]);

  const filasTipo = tipos.map((t) => {
    const us = unidades.filter((u) => u.tipo_id === t.id);
    const utiles = us.filter((u) => UTILIZABLE.includes(u.estado)).length;
    return { ...t, us, utiles, falta: Math.max(0, t.requeridas - utiles) };
  });
  const visibles = ver === "faltantes" ? filasTipo.filter((t) => t.falta > 0) : filasTipo;
  const totalFalta = filasTipo.reduce((s, t) => s + t.falta, 0);
  const configura = CONFIGURAN.includes(sesion.rol);
  const opera = OPERAN.includes(sesion.rol);

  return (
    <>
      <Titulo
        detalle="Cuántas hay de cada una, en qué estado, y cuántas faltan para que el taller funcione bien."
        accion={
          configura ? (
            <EditarTipo clase="boton-primario" texto="+ Herramienta" inicial={{ nombre: "", categoria: "", requeridas: "1", nota: "", activo: true }} />
          ) : null
        }
      >
        Herramientas del taller
      </Titulo>
      <Pestanas
        actual={ver}
        opciones={[
          { valor: "todas", etiqueta: `Todas · ${filasTipo.length}`, href: "/herramientas" },
          { valor: "faltantes", etiqueta: `Con faltantes · ${totalFalta} unidades`, href: "/herramientas?ver=faltantes" },
        ]}
      />
      {visibles.length === 0 ? (
        <Vacio>{ver === "faltantes" ? "No falta nada. 👌" : "Todavía no hay herramientas cargadas."}</Vacio>
      ) : (
        <ul className="space-y-2">
          {visibles.map((t) => (
            <li key={t.id} className="tarjeta p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{t.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {t.categoria ?? "Sin categoría"} · hay {t.utiles} utilizable(s) de {t.requeridas} necesaria(s)
                    {t.nota && ` · ${t.nota}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.falta > 0 ? <Chip tono="rojo">faltan {t.falta}</Chip> : <Chip tono="verde">completo</Chip>}
                  {configura && (
                    <EditarTipo
                      clase="text-sm font-semibold text-slate-500 underline"
                      texto="Editar"
                      inicial={{ id: t.id, nombre: t.nombre, categoria: t.categoria ?? "", requeridas: String(t.requeridas), nota: t.nota ?? "", activo: t.activo }}
                    />
                  )}
                </div>
              </div>
              {t.us.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {t.us.map((u, i) => (
                    <li key={u.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          #{i + 1} {u.marca ?? ""} {u.codigo && <span className="codigo text-xs">{u.codigo}</span>}
                          {u.ubicacion && <span className="text-xs text-slate-500"> · {u.ubicacion}</span>}
                          {u.nota && <span className="block text-xs text-slate-500">{u.nota}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          <Chip tono={ESTADO_HERRAMIENTA[u.estado].tono}>{ESTADO_HERRAMIENTA[u.estado].texto}</Chip>
                          {opera && (
                            <EditarUnidad
                              clase="text-xs font-semibold text-slate-500 underline"
                              texto="Cambiar"
                              titulo={`${t.nombre} #${i + 1}`}
                              inicial={{
                                id: u.id,
                                tipoId: t.id,
                                codigo: u.codigo ?? "",
                                marca: u.marca ?? "",
                                estado: u.estado,
                                ubicacion: u.ubicacion ?? "",
                                nota: u.nota ?? "",
                              }}
                            />
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {configura && (
                <div className="mt-2">
                  <EditarUnidad
                    clase="text-sm font-semibold text-slate-600 underline"
                    texto="+ Agregar unidad"
                    titulo={`Nueva unidad de ${t.nombre}`}
                    inicial={{ tipoId: t.id, codigo: "", marca: "", estado: "bueno", ubicacion: "", nota: "" }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
