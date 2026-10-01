import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { documentos, nombreActivo } from "@/lib/consultas";
import { CONFIGURAN, OPERAN } from "@/lib/permisos";
import { ETIQUETA_TIPO } from "@/lib/archivos";
import type { TipoDocumento } from "@/lib/db/schema";
import { Pestanas, Titulo, Vacio, Volver } from "@/components/ui";
import { Carpeta, NuevoArchivo } from "@/components/archivos";
import { FilaArchivo } from "@/components/lista-archivos";

export const metadata = { title: "Archivos · Taller" };

type Contexto = { nombre: string; carpeta_url: string | null; patente: string | null; codigo: string | null };
export const dynamic = "force-dynamic";

/**
 * Planos, manuales, despieces y fotos. Sin filtro es el repositorio entero;
 * con ?activo=, ?obra= o ?insumo= son los archivos de esa máquina, obra o
 * repuesto (el botón "📁 Archivos" de cada ficha trae acá).
 */
export default async function Archivos({
  searchParams,
}: {
  searchParams: Promise<{ activo?: string; obra?: string; insumo?: string; producto?: string; tipo?: string; q?: string; ver?: string }>;
}) {
  const sesion = await requerirSesion();
  const sp = await searchParams;
  const activoId = Number(sp.activo) || undefined;
  const obraId = Number(sp.obra) || undefined;
  const insumoId = Number(sp.insumo) || undefined;
  const productoId = Number(sp.producto) || undefined;
  const tipo = sp.tipo && sp.tipo in ETIQUETA_TIPO ? sp.tipo : undefined;
  const archivados = sp.ver === "archivados";

  const [lista, contexto, opciones] = await Promise.all([
    documentos({ activoId, obraId, insumoId, productoId, tipo, q: sp.q, archivados }),
    activoId
      ? fila<Contexto>(sql`select nombre, carpeta_url, patente, codigo from activos where id = ${activoId}`)
      : obraId
        ? fila<Contexto>(sql`select titulo as nombre, carpeta_url, null as patente, null as codigo from obras where id = ${obraId}`)
        : insumoId
          ? fila<Contexto>(sql`select nombre, null as carpeta_url, null as patente, codigo from insumos where id = ${insumoId}`)
          : productoId
            ? fila<Contexto>(sql`select nombre, null as carpeta_url, null as patente, modelo as codigo from productos where id = ${productoId}`)
            : Promise.resolve(undefined),
    activoId || obraId || insumoId || productoId
      ? Promise.resolve(null)
      : Promise.all([
          filas<{ id: number; nombre: string; patente: string | null; codigo: string | null }>(sql`
            select id, nombre, patente, codigo from activos where estado <> 'baja' order by nombre`),
          filas<{ id: number; titulo: string }>(sql`select id, titulo from obras where estado <> 'cancelada' order by id desc`),
          filas<{ id: number; nombre: string }>(sql`select id, nombre from insumos where activo and es_repuesto order by nombre`),
          filas<{ id: number; nombre: string }>(sql`select id, nombre from productos where activo order by nombre`),
        ]),
  ]);

  const opera = OPERAN.includes(sesion.rol);
  const configura = CONFIGURAN.includes(sesion.rol);
  const base = activoId
    ? `activo=${activoId}`
    : obraId
      ? `obra=${obraId}`
      : insumoId
        ? `insumo=${insumoId}`
        : productoId
          ? `producto=${productoId}`
          : "";
  const qs = (c: Record<string, string | undefined>) => {
    const p = new URLSearchParams(base);
    for (const [k, v] of Object.entries({ tipo, q: sp.q, ver: sp.ver, ...c })) if (v) p.set(k, v);
    return `/archivos?${p}`;
  };
  const volver = activoId
    ? `/activos/${activoId}`
    : obraId
      ? `/obras/${obraId}`
      : insumoId
        ? `/insumos/${insumoId}`
        : productoId
          ? `/fabricacion/productos/${productoId}`
          : null;
  const titulo = contexto ? `Archivos de ${nombreActivo(contexto)}` : "Archivos";
  const tipos = Object.keys(ETIQUETA_TIPO) as TipoDocumento[];

  return (
    <>
      {volver && contexto && <Volver href={volver}>{contexto.nombre}</Volver>}
      <Titulo
        detalle={
          contexto
            ? "Planos, manuales, despieces y fotos, con todas sus versiones."
            : "Todos los planos, manuales, despieces y fotos de máquinas, obras y repuestos, con todas sus versiones."
        }
        accion={
          opera ? (
            <NuevoArchivo
              dueno={contexto ? { activoId, obraId, insumoId, productoId } : undefined}
              opciones={
                opciones
                  ? {
                      activos: opciones[0].map((a) => ({ id: a.id, nombre: nombreActivo(a) })),
                      obras: opciones[1],
                      insumos: opciones[2],
                      productos: opciones[3],
                    }
                  : undefined
              }
              tipoInicial={obraId ? "foto" : "plano"}
            />
          ) : null
        }
      >
        {titulo}
      </Titulo>

      {(activoId || obraId) && contexto && (
        <div className="mb-4">
          <Carpeta activoId={activoId} obraId={obraId} url={contexto.carpeta_url} puedeEditar={configura} />
        </div>
      )}

      <Pestanas
        actual={tipo ?? "todos"}
        opciones={[
          { valor: "todos", etiqueta: "Todos", href: qs({ tipo: "" }) },
          ...tipos.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO[t], href: qs({ tipo: t }) })),
        ]}
      />
      <form className="mb-4 flex flex-wrap gap-2" action="/archivos">
        {activoId && <input type="hidden" name="activo" value={activoId} />}
        {obraId && <input type="hidden" name="obra" value={obraId} />}
        {insumoId && <input type="hidden" name="insumo" value={insumoId} />}
        {productoId && <input type="hidden" name="producto" value={productoId} />}
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        <input name="q" defaultValue={sp.q} className="campo max-w-sm" placeholder="Buscar por nombre o nota" />
        <button className="boton-secundario">Buscar</button>
      </form>

      {lista.length === 0 ? (
        <Vacio>
          {archivados
            ? "No hay archivos archivados."
            : "Todavía no hay archivos. Subí el archivo a Drive, compartilo con «cualquiera con el vínculo» y pegá el link con «+ Archivo»."}
        </Vacio>
      ) : (
        <ul className="space-y-2">
          {lista.map((d) => (
            <FilaArchivo key={d.id} d={d} opera={opera} configura={configura} mostrarDueno={!contexto} yo={sesion.uid} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-center text-sm">
        <Link className="text-slate-500 underline" href={qs({ ver: archivados ? "" : "archivados" })}>
          {archivados ? "Volver a los vigentes" : "Ver archivados"}
        </Link>
      </p>
    </>
  );
}
