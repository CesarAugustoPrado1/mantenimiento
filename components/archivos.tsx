"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearDocumento, editarDocumento, guardarCarpeta, nuevaVersion } from "@/lib/acciones/archivos";
import { ETIQUETA_ETAPA, ETIQUETA_TIPO, esCarpetaDrive } from "@/lib/archivos";
import type { Etapa, TipoDocumento } from "@/lib/db/schema";
import { useAccion } from "./usar-accion";
import { Aviso } from "./ui";
import { Campo, Formulario, Interruptor } from "./admin";
import { subirArchivo, tituloDeArchivo } from "./subida";

const TIPOS = Object.keys(ETIQUETA_TIPO) as TipoDocumento[];
const ETAPAS = Object.keys(ETIQUETA_ETAPA) as Etapa[];

const AYUDA_LINK =
  "En Drive: clic derecho en el archivo → Compartir → «Cualquier persona con el vínculo» → Copiar vínculo. Pegalo acá.";

type Dueno = { activoId?: number | null; obraId?: number | null; insumoId?: number | null; productoId?: number | null };

export function NuevoArchivo({
  dueno,
  opciones,
  tipoInicial = "plano",
  etapaInicial = null,
  texto = "+ Archivo",
  clase = "boton-primario",
  subida = true,
}: {
  /** Si la app tiene configurada la subida (Vercel Blob). Si no, solo links. */
  subida?: boolean;
  /** Si viene, el archivo es de ese dueño y no se elige. */
  dueno?: Dueno;
  opciones?: {
    activos: Array<{ id: number; nombre: string }>;
    obras: Array<{ id: number; titulo: string }>;
    insumos: Array<{ id: number; nombre: string }>;
    productos?: Array<{ id: number; nombre: string }>;
  };
  tipoInicial?: TipoDocumento;
  etapaInicial?: Etapa | null;
  texto?: string;
  clase?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState({ titulo: "", tipo: tipoInicial, etapa: etapaInicial, url: "", nota: "", fecha: "", de: "" });
  const [archivos, setArchivos] = useState<File[]>([]);
  const [conLink, setConLink] = useState(!subida);
  const [progreso, setProgreso] = useState<string | null>(null);
  if (!abierto) {
    return (
      <button type="button" className={clase} onClick={() => setAbierto(true)}>
        {texto}
      </button>
    );
  }
  const [clave, valor] = d.de.split(":");
  const elegido: Dueno = dueno ?? {
    activoId: clave === "a" ? Number(valor) : null,
    obraId: clave === "o" ? Number(valor) : null,
    insumoId: clave === "i" ? Number(valor) : null,
    productoId: clave === "p" ? Number(valor) : null,
  };
  const esObra = !!elegido.obraId;
  return (
    <div className="mt-2 w-full">
      <Formulario
        titulo={archivos.length > 1 ? `${archivos.length} archivos nuevos` : "Archivo nuevo"}
        textoBoton={archivos.length > 1 ? `Subir ${archivos.length}` : "Guardar"}
        textoEnviando={progreso}
        puedeGuardar={
          conLink ? d.titulo.trim().length >= 2 && d.url.trim().length > 8 : archivos.length > 0 && (archivos.length > 1 || d.titulo.trim().length >= 2)
        }
        alGuardar={async () => {
          const base = { ...elegido, tipo: d.tipo, etapa: esObra ? d.etapa : null, nota: d.nota, fecha: d.fecha };
          if (conLink) return crearDocumento({ ...base, titulo: d.titulo, url: d.url });
          // Varias fotos de una: cada una es su propio archivo, con su nombre.
          let ultimo: Awaited<ReturnType<typeof crearDocumento>> = { ok: false, error: "No se eligió ningún archivo." };
          for (const [i, f] of archivos.entries()) {
            const etiqueta = archivos.length > 1 ? ` ${i + 1} de ${archivos.length}` : "";
            let subido;
            try {
              subido = await subirArchivo(f, (pct) => setProgreso(`Subiendo${etiqueta}… ${pct}%`));
            } catch (e) {
              // Se devuelve como error y no se relanza: relanzar haría que se reintente todo y duplique lo ya subido.
              setProgreso(null);
              console.error(e);
              const yaSubidos = i > 0 ? ` Ya se guardaron ${i} de ${archivos.length}: sacalos de la lista y volvé a intentar con el resto.` : "";
              return { ok: false as const, error: `No se pudo subir «${f.name}». Revisá la conexión.${yaSubidos}` };
            }
            const titulo = archivos.length === 1 ? d.titulo : d.titulo.trim() ? `${d.titulo.trim()} (${i + 1})` : tituloDeArchivo(f.name);
            ultimo = await crearDocumento({ ...base, titulo, archivo: subido });
            if (!ultimo.ok) break;
          }
          setProgreso(null);
          return ultimo;
        }}
        cerrar={() => setAbierto(false)}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo etiqueta={archivos.length > 1 ? "Nombre (opcional)" : "Nombre"}>
              <input className="campo" value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} placeholder="Plano eje de la corona" />
            </Campo>
          </div>
          <Campo etiqueta="Tipo">
            <select className="campo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as TipoDocumento })}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {!dueno && opciones && (
          <Campo etiqueta="Es de">
            <select className="campo" value={d.de} onChange={(e) => setD({ ...d, de: e.target.value })}>
              <option value="">General (de ninguna máquina u obra)</option>
              <optgroup label="Máquinas y vehículos">
                {opciones.activos.map((a) => (
                  <option key={a.id} value={`a:${a.id}`}>
                    {a.nombre}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Obras">
                {opciones.obras.map((o) => (
                  <option key={o.id} value={`o:${o.id}`}>
                    {o.titulo}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Repuestos">
                {opciones.insumos.map((i) => (
                  <option key={i.id} value={`i:${i.id}`}>
                    {i.nombre}
                  </option>
                ))}
              </optgroup>
              {opciones.productos && (
                <optgroup label="Productos del taller">
                  {opciones.productos.map((x) => (
                    <option key={x.id} value={`p:${x.id}`}>
                      {x.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Campo>
        )}
        {esObra && (
          <div>
            <p className="etiqueta">Etapa de la obra</p>
            <div className="flex flex-wrap gap-2">
              {[null, ...ETAPAS].map((e) => (
                <button
                  key={e ?? "ninguna"}
                  type="button"
                  onClick={() => setD({ ...d, etapa: e })}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${
                    d.etapa === e ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300"
                  }`}
                >
                  {e ? ETIQUETA_ETAPA[e] : "Sin etapa"}
                </button>
              ))}
            </div>
          </div>
        )}
        {!conLink ? (
          <div>
            <p className="etiqueta">Archivo</p>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:bg-slate-100">
              <span className="text-2xl">📤</span>
              <span className="text-sm font-semibold text-slate-700">
                {archivos.length === 0
                  ? d.tipo === "foto"
                    ? "Sacar foto o elegir (podés elegir varias)"
                    : "Elegir archivo (PDF, foto, plano, Excel…)"
                  : archivos.map((f) => f.name).join(", ")}
              </span>
              <input
                type="file"
                className="sr-only"
                multiple={d.tipo === "foto"}
                accept={d.tipo === "foto" ? "image/*" : undefined}
                onChange={(e) => {
                  const lista = [...(e.target.files ?? [])];
                  setArchivos(lista);
                  if (lista.length === 1 && !d.titulo) setD({ ...d, titulo: tituloDeArchivo(lista[0].name) });
                }}
              />
            </label>
            {archivos.length > 1 && <p className="mt-1 text-xs text-slate-500">Cada foto se guarda como un archivo. El nombre es opcional: si lo ponés, se numeran.</p>}
            <button type="button" className="mt-1 text-xs text-slate-500 underline" onClick={() => setConLink(true)}>
              o pegar un link a algo que ya está en otro lado
            </button>
          </div>
        ) : (
          <Campo etiqueta="Link" ayuda={subida ? undefined : AYUDA_LINK}>
            <input className="campo" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://…" />
            {subida && (
              <button type="button" className="mt-1 text-xs text-slate-500 underline" onClick={() => setConLink(false)}>
                mejor subir el archivo
              </button>
            )}
          </Campo>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo etiqueta="Nota (opcional)">
              <input className="campo" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} />
            </Campo>
          </div>
          <Campo etiqueta="Fecha (opcional)">
            <input className="campo" type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} />
          </Campo>
        </div>
      </Formulario>
    </div>
  );
}

export function NuevaVersion({ documentoId, version, subida = true }: { documentoId: number; version: number; subida?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState({ url: "", nota: "", fecha: "" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [conLink, setConLink] = useState(!subida);
  const [progreso, setProgreso] = useState<string | null>(null);
  if (!abierto) {
    return (
      <button type="button" className="text-xs font-semibold text-slate-600 underline" onClick={() => setAbierto(true)}>
        + Nueva versión
      </button>
    );
  }
  return (
    <div className="mt-2 w-full">
      <Formulario
        titulo={`Versión ${version + 1}`}
        textoEnviando={progreso}
        puedeGuardar={conLink ? d.url.trim().length > 8 : !!archivo}
        alGuardar={async () => {
          if (conLink) return nuevaVersion({ documentoId, url: d.url, nota: d.nota, fecha: d.fecha });
          let subido;
          try {
            subido = await subirArchivo(archivo!, (pct) => setProgreso(`Subiendo… ${pct}%`));
          } catch (e) {
            console.error(e);
            setProgreso(null);
            return { ok: false as const, error: "No se pudo subir el archivo. Revisá la conexión y volvé a intentar." };
          }
          setProgreso(null);
          return nuevaVersion({ documentoId, archivo: subido, nota: d.nota, fecha: d.fecha });
        }}
        cerrar={() => setAbierto(false)}
      >
        <p className="text-xs text-slate-500">La versión {version} queda guardada: nunca se pisa.</p>
        {!conLink ? (
          <div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              📤 {archivo ? archivo.name : "Elegir el archivo de la versión nueva"}
              <input type="file" className="sr-only" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            </label>
            <button type="button" className="mt-1 text-xs text-slate-500 underline" onClick={() => setConLink(true)}>
              o pegar un link
            </button>
          </div>
        ) : (
          <Campo etiqueta="Link de la versión nueva" ayuda={subida ? undefined : AYUDA_LINK}>
            <input className="campo" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />
          </Campo>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo etiqueta="Qué cambió">
              <input className="campo" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} placeholder="Se agrandó el diámetro del eje a 45 mm" />
            </Campo>
          </div>
          <Campo etiqueta="Fecha (opcional)">
            <input className="campo" type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} />
          </Campo>
        </div>
      </Formulario>
    </div>
  );
}

export function EditarArchivo({
  inicial,
}: {
  inicial: { id: number; titulo: string; tipo: TipoDocumento; etapa: Etapa | null; nota: string; archivado: boolean; esDeObra: boolean };
}) {
  const [d, setD] = useState<typeof inicial | null>(null);
  if (!d) {
    return (
      <button type="button" className="text-xs font-semibold text-slate-500 underline" onClick={() => setD(inicial)}>
        Editar
      </button>
    );
  }
  return (
    <div className="mt-2 w-full">
      <Formulario titulo={`Editar: ${inicial.titulo}`} puedeGuardar={d.titulo.trim().length >= 2} alGuardar={() => editarDocumento(d)} cerrar={() => setD(null)}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo etiqueta="Nombre">
              <input className="campo" value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} />
            </Campo>
          </div>
          <Campo etiqueta="Tipo">
            <select className="campo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as TipoDocumento })}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {d.esDeObra && (
          <Campo etiqueta="Etapa">
            <select className="campo" value={d.etapa ?? ""} onChange={(e) => setD({ ...d, etapa: (e.target.value || null) as Etapa | null })}>
              <option value="">Sin etapa</option>
              {ETAPAS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ETAPA[e]}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Nota">
          <input className="campo" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} />
        </Campo>
        <Interruptor
          valor={d.archivado}
          cambiar={(v) => setD({ ...d, archivado: v })}
          etiqueta="Archivado"
          ayuda="Deja de aparecer en la lista, pero no se borra: se ve en «Archivados»."
        />
      </Formulario>
    </div>
  );
}

/** El botón a la carpeta de Drive de la máquina u obra, y su carga. */
export function Carpeta({
  activoId,
  obraId,
  url,
  puedeEditar,
}: {
  activoId?: number;
  obraId?: number;
  url: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(url ?? "");

  if (editando) {
    return (
      <div className="w-full space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        {error && <Aviso>{error}</Aviso>}
        <Campo etiqueta="Link de la carpeta de Drive" ayuda="En Drive: clic derecho en la carpeta → Compartir → Copiar vínculo.">
          <input className="campo" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
        </Campo>
        {valor && !esCarpetaDrive(valor) && <p className="text-xs text-amber-700">Ojo: no parece el link de una carpeta de Drive.</p>}
        <div className="flex gap-2">
          <button type="button" className="boton-secundario min-h-10" onClick={() => setEditando(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton-primario min-h-10"
            disabled={enviando}
            onClick={() =>
              void ejecutar(() => guardarCarpeta({ activoId, obraId, url: valor }), () => {
                setEditando(false);
                router.refresh();
              })
            }
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="boton-secundario text-sm">
          📁 Abrir carpeta en Drive ↗
        </a>
      ) : (
        <span className="text-sm text-slate-500">Sin carpeta de Drive.</span>
      )}
      {puedeEditar && (
        <button type="button" className="text-xs font-semibold text-slate-500 underline" onClick={() => setEditando(true)}>
          {url ? "cambiar carpeta" : "+ vincular carpeta"}
        </button>
      )}
    </span>
  );
}
