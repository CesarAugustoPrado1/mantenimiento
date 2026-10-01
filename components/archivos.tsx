"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearDocumento, editarDocumento, guardarCarpeta, nuevaVersion } from "@/lib/acciones/archivos";
import { ETIQUETA_ETAPA, ETIQUETA_TIPO, esCarpetaDrive } from "@/lib/archivos";
import type { Etapa, TipoDocumento } from "@/lib/db/schema";
import { useAccion } from "./usar-accion";
import { Aviso } from "./ui";
import { Campo, Formulario, Interruptor } from "./admin";

const TIPOS = Object.keys(ETIQUETA_TIPO) as TipoDocumento[];
const ETAPAS = Object.keys(ETIQUETA_ETAPA) as Etapa[];

const AYUDA_LINK =
  "En Drive: clic derecho en el archivo → Compartir → «Cualquier persona con el vínculo» → Copiar vínculo. Pegalo acá.";

type Dueno = { activoId?: number | null; obraId?: number | null; insumoId?: number | null };

export function NuevoArchivo({
  dueno,
  opciones,
  tipoInicial = "plano",
  etapaInicial = null,
  texto = "+ Archivo",
  clase = "boton-primario",
}: {
  /** Si viene, el archivo es de ese dueño y no se elige. */
  dueno?: Dueno;
  opciones?: {
    activos: Array<{ id: number; nombre: string }>;
    obras: Array<{ id: number; titulo: string }>;
    insumos: Array<{ id: number; nombre: string }>;
  };
  tipoInicial?: TipoDocumento;
  etapaInicial?: Etapa | null;
  texto?: string;
  clase?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState({ titulo: "", tipo: tipoInicial, etapa: etapaInicial, url: "", nota: "", fecha: "", de: "" });
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
  };
  const esObra = !!elegido.obraId;
  return (
    <div className="mt-2 w-full">
      <Formulario
        titulo="Archivo nuevo"
        puedeGuardar={d.titulo.trim().length >= 2 && d.url.trim().length > 8}
        alGuardar={() => crearDocumento({ ...elegido, titulo: d.titulo, tipo: d.tipo, etapa: esObra ? d.etapa : null, url: d.url, nota: d.nota, fecha: d.fecha })}
        cerrar={() => setAbierto(false)}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo etiqueta="Nombre">
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
        <Campo etiqueta="Link" ayuda={AYUDA_LINK}>
          <input className="campo" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://drive.google.com/file/d/…" />
        </Campo>
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

export function NuevaVersion({ documentoId, version }: { documentoId: number; version: number }) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState({ url: "", nota: "", fecha: "" });
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
        puedeGuardar={d.url.trim().length > 8}
        alGuardar={() => nuevaVersion({ documentoId, ...d })}
        cerrar={() => setAbierto(false)}
      >
        <p className="text-xs text-slate-500">La versión {version} queda guardada: nunca se pisa.</p>
        <Campo etiqueta="Link de la versión nueva" ayuda={AYUDA_LINK}>
          <input className="campo" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />
        </Campo>
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
