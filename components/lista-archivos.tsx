import Link from "next/link";
import type { FilaDocumento } from "@/lib/consultas";
import { ETIQUETA_ETAPA, ETIQUETA_TIPO, ICONO_TIPO, miniatura } from "@/lib/archivos";
import { fmtFecha } from "@/lib/formato";
import { Chip } from "./ui";
import { EditarArchivo, NuevaVersion } from "./archivos";
import { BorrarPorError } from "./borrar-error";
import { dentroDeVentana } from "@/lib/borrado";

/** Un archivo: la versión vigente a un toque, y las anteriores debajo. */
export function FilaArchivo({
  d,
  opera,
  configura,
  mostrarDueno,
  yo,
  subida,
}: {
  d: FilaDocumento;
  opera: boolean;
  configura: boolean;
  mostrarDueno: boolean;
  yo: number;
  subida: boolean;
}) {
  const mini = d.tipo === "foto" || d.mime?.startsWith("image/") ? miniatura(d.url, 200, d.mime) : null;
  return (
    <li className="tarjeta p-4">
      <div className="flex items-start gap-3">
        {mini ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mini} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 object-cover" loading="lazy" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">{ICONO_TIPO[d.tipo]}</span>
        )}
        <div className="min-w-0 flex-1">
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
            {d.titulo} ↗
          </a>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip>{ETIQUETA_TIPO[d.tipo]}</Chip>
            <Chip tono={d.version > 1 ? "azul" : "gris"}>versión {d.version}</Chip>
            {d.etapa && <Chip tono="oscuro">{ETIQUETA_ETAPA[d.etapa]}</Chip>}
            {d.archivado && <Chip tono="amarillo">archivado</Chip>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {mostrarDueno && (d.activo || d.obra || d.insumo || d.producto) && (
              <>
                {d.activo_id && <Link href={`/activos/${d.activo_id}`} className="underline">{d.activo}</Link>}
                {d.obra_id && <Link href={`/obras/${d.obra_id}`} className="underline">{d.obra}</Link>}
                {d.insumo_id && <Link href={`/insumos/${d.insumo_id}`} className="underline">{d.insumo}</Link>}
                {d.producto_id && <Link href={`/fabricacion/productos/${d.producto_id}`} className="underline">{d.producto}</Link>}
                {" · "}
              </>
            )}
            {fmtFecha(d.fecha)}
            {d.tamano_bytes ? ` · ${tamano(d.tamano_bytes)}` : ""}
            {d.nombre_archivo && !d.en_drive && " · guardando…"}
            {d.nota_version && ` · ${d.nota_version}`}
            {d.nota && ` · ${d.nota}`}
          </p>
          {d.versiones.length > 1 && (
            <details className="mt-1 text-xs text-slate-500">
              <summary className="cursor-pointer">Versiones anteriores ({d.versiones.length - 1})</summary>
              <ul className="mt-1 space-y-0.5">
                {d.versiones.slice(1).map((v) => (
                  <li key={v.version}>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="underline">
                      versión {v.version}
                    </a>{" "}
                    · {fmtFecha(v.fecha)} · {v.usuario}
                    {v.nota && ` · ${v.nota}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-1.5 flex flex-wrap gap-3">
            {opera && <NuevaVersion documentoId={d.id} version={d.version} subida={subida} />}
            {opera && (configura || d.creado_por_id === yo) && dentroDeVentana(d.creado_en) && (
              <BorrarPorError tipo="documento" id={d.id} que={`«${d.titulo}»`} />
            )}
            {configura && (
              <EditarArchivo
                inicial={{ id: d.id, titulo: d.titulo, tipo: d.tipo, etapa: d.etapa, nota: d.nota ?? "", archivado: d.archivado, esDeObra: !!d.obra_id }}
              />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Las fotos de una obra en tres columnas: antes, durante, después. */
export function GaleriaObra({ fotos }: { fotos: FilaDocumento[] }) {
  const grupos: Array<{ etapa: FilaDocumento["etapa"]; titulo: string }> = [
    { etapa: "antes", titulo: "Antes" },
    { etapa: "durante", titulo: "Durante" },
    { etapa: "despues", titulo: "Después" },
    { etapa: null, titulo: "Sin etapa" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {grupos.map((g) => {
        const lista = fotos.filter((f) => f.etapa === g.etapa);
        if (g.etapa === null && lista.length === 0) return null;
        return (
          <div key={g.titulo} className={g.etapa === null ? "sm:col-span-3" : ""}>
            <p className="mb-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
              {g.titulo} · {lista.length}
            </p>
            {lista.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400 ring-1 ring-slate-100">Sin fotos.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {lista.map((f) => {
                  const mini = miniatura(f.url, 300, f.mime);
                  return (
                    <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" title={f.titulo} className="block">
                      {mini ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mini} alt={f.titulo} className="aspect-square w-full rounded-lg bg-slate-100 object-cover" loading="lazy" />
                      ) : (
                        <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100 p-2 text-center text-xs">
                          📷 {f.titulo}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function tamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}
