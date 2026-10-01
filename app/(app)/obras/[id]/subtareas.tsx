"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { borrarSubtarea, cambiarAvance, guardarSubtarea } from "@/lib/acciones/obras";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { BotonAccion, Campo, Formulario } from "@/components/admin";
import { ETIQUETA_PASO, PASOS, type Paso } from "@/lib/cumplimiento";

type DatosSub = {
  id?: number;
  obraId: number;
  titulo: string;
  responsableId: number | null;
  responsableExterno: string;
  inicioPlan: string;
  finPlan: string;
  inicioReal: string;
  finReal: string;
  nota: string;
  progreso: number;
};

export function EditarSubtarea({
  inicial,
  usuarios,
  texto,
  clase,
}: {
  inicial: DatosSub;
  usuarios: Array<{ id: number; nombre: string }>;
  texto: string;
  clase: string;
}) {
  const [d, setD] = useState<DatosSub | null>(null);
  if (!d) {
    return (
      <button type="button" className={clase} onClick={() => setD(inicial)}>
        {texto}
      </button>
    );
  }
  const set = <K extends keyof DatosSub>(k: K, v: DatosSub[K]) => setD({ ...d, [k]: v });
  return (
    <div className="mt-2 w-full">
      <Formulario
        titulo={d.id ? `Editar: ${inicial.titulo}` : "Subtarea nueva"}
        puedeGuardar={d.titulo.trim().length >= 2}
        alGuardar={() => guardarSubtarea(d)}
        cerrar={() => setD(null)}
      >
        <Campo etiqueta="Qué hay que hacer">
          <input className="campo" value={d.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Instalación eléctrica" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Responsable">
            <select className="campo" value={d.responsableId ?? ""} onChange={(e) => set("responsableId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="…o contratista">
            <input className="campo" value={d.responsableExterno} onChange={(e) => set("responsableExterno", e.target.value)} placeholder="Electricista" />
          </Campo>
        </div>
        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-2">
          <Campo etiqueta="Comprometido: empieza">
            <input className="campo" type="date" value={d.inicioPlan} onChange={(e) => set("inicioPlan", e.target.value)} />
          </Campo>
          <Campo etiqueta="Comprometido: termina">
            <input className="campo" type="date" value={d.finPlan} onChange={(e) => set("finPlan", e.target.value)} />
          </Campo>
        </div>
        {d.id && d.progreso > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Empezó realmente" ayuda="Se completó solo con el primer avance. Corregilo si se cargó tarde.">
              <input className="campo" type="date" value={d.inicioReal} onChange={(e) => set("inicioReal", e.target.value)} />
            </Campo>
            {d.progreso === 100 && (
              <Campo etiqueta="Terminó realmente">
                <input className="campo" type="date" value={d.finReal} onChange={(e) => set("finReal", e.target.value)} />
              </Campo>
            )}
          </div>
        )}
        <Campo etiqueta="Nota">
          <input className="campo" value={d.nota} onChange={(e) => set("nota", e.target.value)} />
        </Campo>
        {d.id && (
          <BotonAccion accion={borrarSubtarea.bind(null, d.id)} clase="text-sm text-red-600 underline" confirmar="¿Borrar la subtarea y su historial de avances?">
            Borrar subtarea
          </BotonAccion>
        )}
      </Formulario>
    </div>
  );
}

/**
 * Los cinco escalones. Tocar uno no lo guarda de una: pide la fecha (puede
 * ser de días atrás) y una nota opcional. La fecha es lo que alimenta el
 * cumplimiento, así que tiene que ser la real.
 */
export function Avance({ subtareaId, progreso, hoy, puede }: { subtareaId: number; progreso: number; hoy: string; puede: boolean }) {
  const router = useRouter();
  const { ejecutar, enviando, error, limpiar } = useAccion();
  const [elegido, setElegido] = useState<Paso | null>(null);
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState("");

  return (
    <div>
      <div className="grid grid-cols-5 gap-1">
        {PASOS.map((p) => {
          const hecho = progreso >= p && p > 0;
          const actual = progreso === p;
          return (
            <button
              key={p}
              type="button"
              disabled={!puede || enviando || actual}
              onClick={() => {
                limpiar();
                setFecha(hoy);
                setNota("");
                setElegido(p);
              }}
              title={ETIQUETA_PASO[p]}
              className={`rounded-lg px-1 py-1.5 text-center text-[11px] leading-tight font-semibold ring-1 transition ${
                actual ? "ring-2 ring-slate-900" : "ring-slate-200"
              } ${hecho ? (progreso === 100 ? "bg-verde text-white" : "bg-blue-600 text-white") : "bg-white text-slate-500"} ${
                elegido === p ? "ring-2 ring-amber-400" : ""
              } disabled:cursor-default`}
            >
              <span className="block text-xs">{p}%</span>
              <span className="hidden sm:block">{ETIQUETA_PASO[p]}</span>
            </button>
          );
        })}
      </div>
      {elegido !== null && (
        <div className="mt-2 space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
          {error && <Aviso>{error}</Aviso>}
          <p className="text-sm font-semibold">
            Pasar a {elegido}% · {ETIQUETA_PASO[elegido]}
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm">
              <span className="etiqueta">¿Cuándo?</span>
              <input className="campo w-auto" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="min-w-40 flex-1 text-sm">
              <span className="etiqueta">Nota (opcional)</span>
              <input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" className="boton-secundario min-h-10" onClick={() => setElegido(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="boton-primario min-h-10"
              disabled={enviando}
              onClick={() =>
                void ejecutar(
                  () => cambiarAvance({ subtareaId, progreso: elegido, fecha, nota }),
                  () => {
                    setElegido(null);
                    router.refresh();
                  },
                )
              }
            >
              {enviando ? "Guardando…" : "Guardar avance"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
