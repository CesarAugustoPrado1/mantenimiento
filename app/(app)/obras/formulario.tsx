"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { agregarNotaObra, guardarObra } from "@/lib/acciones/obras";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";
import type { DatosObra } from "@/lib/etiquetas";

const TIPOS = ["Armado de local", "Reparación edilicia", "Instalación eléctrica", "Plomería", "Pintura", "Mudanza / traslado", "Mobiliario"];

export function FormularioObra({
  inicial,
  usuarios,
  cerrar,
}: {
  inicial: DatosObra;
  usuarios: Array<{ id: number; nombre: string }>;
  cerrar: () => void;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState(inicial);
  const set = <K extends keyof DatosObra>(k: K, v: DatosObra[K]) => setD({ ...d, [k]: v });

  return (
    <div className="tarjeta space-y-4 p-5">
      <p className="font-bold">{d.id ? "Editar obra" : "Obra o tarea nueva"}</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Título">
          <input className="campo" value={d.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Armado local Av. Colón" />
        </Campo>
        <Campo etiqueta="Dónde">
          <input className="campo" value={d.lugar} onChange={(e) => set("lugar", e.target.value)} placeholder="Local Córdoba centro / Oficinas planta" />
        </Campo>
        <Campo etiqueta="Tipo">
          <input className="campo" list="tipos-obra" value={d.tipo} onChange={(e) => set("tipo", e.target.value)} />
          <datalist id="tipos-obra">
            {TIPOS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Estado">
            <select className="campo" value={d.estado} onChange={(e) => set("estado", e.target.value as DatosObra["estado"])}>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="terminada">Terminada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </Campo>
          <Campo etiqueta="Prioridad">
            <select className="campo" value={d.prioridad} onChange={(e) => set("prioridad", e.target.value as DatosObra["prioridad"])}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </Campo>
        </div>
      </div>
      <Campo etiqueta="Qué hay que hacer">
        <textarea className="campo" rows={4} value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
      </Campo>
      <div className="grid gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-2">
        <p className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Lo comprometido <span className="font-normal text-slate-500">— contra esto se mide el cumplimiento</span>
        </p>
        <Campo etiqueta="Empieza el">
          <input className="campo" type="date" value={d.inicioPlan} onChange={(e) => set("inicioPlan", e.target.value)} />
        </Campo>
        <Campo etiqueta="Tiene que estar el">
          <input className="campo" type="date" value={d.finPlan} onChange={(e) => set("finPlan", e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Empezó realmente el" ayuda="Si la obra tiene subtareas, se completa solo con la primera que arranca.">
          <input className="campo" type="date" value={d.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)} />
        </Campo>
        <Campo etiqueta="Terminó realmente el" ayuda="Con subtareas, se completa solo cuando termina la última.">
          <input className="campo" type="date" value={d.fechaFin} onChange={(e) => set("fechaFin", e.target.value)} />
        </Campo>
      </div>
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
        <Campo etiqueta="Contratista externo">
          <input className="campo" value={d.responsableExterno} onChange={(e) => set("responsableExterno", e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Horas hombre">
          <input className="campo" inputMode="decimal" value={d.horasHombre} onChange={(e) => set("horasHombre", e.target.value)} />
        </Campo>
        <Campo etiqueta="Mano de obra externa ($)">
          <input className="campo" inputMode="decimal" value={d.costoManoObra} onChange={(e) => set("costoManoObra", e.target.value)} />
        </Campo>
        <Campo etiqueta="Materiales comprados aparte ($)">
          <input className="campo" inputMode="decimal" value={d.costoMateriales} onChange={(e) => set("costoMateriales", e.target.value)} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-secundario" onClick={cerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || d.titulo.trim().length < 3 || !d.lugar.trim()}
          onClick={() =>
            void ejecutar(
              () => guardarObra(d),
              (r) => {
                cerrar();
                if (!d.id) router.push(`/obras/${r.id}`);
                router.refresh();
              },
            )
          }
        >
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function BotonObra({
  inicial,
  usuarios,
  texto,
  clase = "boton-primario",
}: {
  inicial: DatosObra;
  usuarios: Array<{ id: number; nombre: string }>;
  texto: string;
  clase?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  if (abierto) {
    return (
      <div className="w-full">
        <FormularioObra inicial={inicial} usuarios={usuarios} cerrar={() => setAbierto(false)} />
      </div>
    );
  }
  return (
    <button type="button" className={clase} onClick={() => setAbierto(true)}>
      {texto}
    </button>
  );
}

export function NuevaNota({ obraId }: { obraId: number }) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [texto, setTexto] = useState("");
  return (
    <div className="space-y-2">
      {error && <Aviso>{error}</Aviso>}
      <textarea className="campo" rows={2} placeholder="Avance, problema, lo que falta…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <button
        type="button"
        className="boton-secundario"
        disabled={enviando || !texto.trim()}
        onClick={() =>
          void ejecutar(
            () => agregarNotaObra({ obraId, texto }),
            () => {
              setTexto("");
              router.refresh();
            },
          )
        }
      >
        {enviando ? "…" : "Agregar nota"}
      </button>
    </div>
  );
}
