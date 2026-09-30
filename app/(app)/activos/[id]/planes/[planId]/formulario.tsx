"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarPlan } from "@/lib/acciones/activos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo, Interruptor } from "@/components/admin";
import type { AccionTarea, Medidor } from "@/lib/db/schema";

export type DatosPlan = {
  id?: number;
  activoId: number;
  nombre: string;
  descripcion: string;
  cadaDias: string;
  cadaUso: string;
  avisoDias: string;
  avisoUso: string;
  responsableId: number | null;
  responsableExterno: string;
  herramientas: string;
  desdeFecha: string;
  desdeUso: string;
  activo: boolean;
  tareas: Array<{ accion: AccionTarea; descripcion: string }>;
  materiales: Array<{ insumoId: number | null; descripcion: string; cantidad: string }>;
};

const ACCIONES: AccionTarea[] = ["chequear", "cambiar", "ajustar", "limpiar", "lubricar", "otro"];

/** Plantillas para no arrancar de cero. */
const PLANTILLAS: Record<string, Pick<DatosPlan, "nombre" | "tareas">> = {
  aceite: {
    nombre: "Cambio de aceite y filtros",
    tareas: [
      { accion: "cambiar", descripcion: "Aceite de motor" },
      { accion: "cambiar", descripcion: "Filtro de aceite" },
      { accion: "chequear", descripcion: "Filtro de aire (cambiar si hace falta)" },
      { accion: "chequear", descripcion: "Filtro de combustible" },
      { accion: "chequear", descripcion: "Niveles: refrigerante, frenos, dirección" },
    ],
  },
  general: {
    nombre: "Revisión general",
    tareas: [
      { accion: "chequear", descripcion: "Correas (tensión y desgaste)" },
      { accion: "chequear", descripcion: "Cubiertas: presión y desgaste" },
      { accion: "chequear", descripcion: "Frenos" },
      { accion: "chequear", descripcion: "Luces" },
      { accion: "chequear", descripcion: "Pérdidas de fluidos" },
    ],
  },
  engrase: {
    nombre: "Engrase general",
    tareas: [
      { accion: "lubricar", descripcion: "Puntos de engrase según manual" },
      { accion: "chequear", descripcion: "Juego en rodamientos" },
      { accion: "limpiar", descripcion: "Limpieza general del equipo" },
    ],
  },
};

export function FormularioPlan({
  inicial,
  medidor,
  usuarios,
  insumos,
}: {
  inicial: DatosPlan;
  medidor: Medidor;
  usuarios: Array<{ id: number; nombre: string; rol: string }>;
  insumos: Array<{ id: number; nombre: string; unidad: string; stock: number }>;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState(inicial);
  const set = <K extends keyof DatosPlan>(k: K, v: DatosPlan[K]) => setD({ ...d, [k]: v });
  const u = medidor === "km" ? "km" : "horas";
  const hayUso = medidor !== "ninguno";

  const setTarea = (i: number, t: Partial<DatosPlan["tareas"][number]>) =>
    set("tareas", d.tareas.map((x, j) => (j === i ? { ...x, ...t } : x)));
  const setMaterial = (i: number, m: Partial<DatosPlan["materiales"][number]>) =>
    set("materiales", d.materiales.map((x, j) => (j === i ? { ...x, ...m } : x)));

  return (
    <div className="space-y-4">
      {error && <Aviso>{error}</Aviso>}

      {!d.id && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Empezar desde:</span>
          {Object.entries(PLANTILLAS).map(([k, p]) => (
            <button
              key={k}
              type="button"
              className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-slate-300"
              onClick={() => setD({ ...d, nombre: p.nombre, tareas: p.tareas })}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="tarjeta space-y-4 p-5">
        <Campo etiqueta="Nombre del mantenimiento">
          <input className="campo" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Cambio de aceite y filtro" />
        </Campo>
        <Campo etiqueta="Descripción (opcional)">
          <textarea className="campo" rows={2} value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
        </Campo>

        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Periodicidad {hayUso && <span className="font-normal text-slate-500">— lo que llegue primero</span>}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Cada cuántos días">
              <input className="campo" inputMode="numeric" value={d.cadaDias} onChange={(e) => set("cadaDias", e.target.value)} placeholder="180" />
            </Campo>
            {hayUso && (
              <Campo etiqueta={`Cada cuántos ${u}`}>
                <input className="campo" inputMode="numeric" value={d.cadaUso} onChange={(e) => set("cadaUso", e.target.value)} placeholder={medidor === "km" ? "10000" : "250"} />
              </Campo>
            )}
            <Campo etiqueta="Avisar con (días de anticipación)">
              <input className="campo" inputMode="numeric" value={d.avisoDias} onChange={(e) => set("avisoDias", e.target.value)} />
            </Campo>
            {hayUso && (
              <Campo etiqueta={`Avisar con (${u} de anticipación)`}>
                <input className="campo" inputMode="numeric" value={d.avisoUso} onChange={(e) => set("avisoUso", e.target.value)} placeholder={medidor === "km" ? "1000" : "25"} />
              </Campo>
            )}
          </div>
          {!d.id && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Última vez que se hizo (fecha)" ayuda="Si no lo sabés, dejalo vacío: cuenta desde hoy.">
                <input className="campo" type="date" value={d.desdeFecha} onChange={(e) => set("desdeFecha", e.target.value)} />
              </Campo>
              {hayUso && (
                <Campo etiqueta={`Última vez que se hizo (${u})`} ayuda="Vacío: cuenta desde la última lectura cargada.">
                  <input className="campo" inputMode="numeric" value={d.desdeUso} onChange={(e) => set("desdeUso", e.target.value)} />
                </Campo>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="¿Quién lo hace?">
            <select
              className="campo"
              value={d.responsableId ?? ""}
              onChange={(e) => set("responsableId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Nadie de adentro / sin asignar</option>
              {usuarios.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="…o un externo" ayuda="Concesionaria, service oficial, tornería.">
            <input className="campo" value={d.responsableExterno} onChange={(e) => set("responsableExterno", e.target.value)} />
          </Campo>
        </div>
      </div>

      <div className="tarjeta space-y-3 p-5">
        <p className="font-bold">Qué hay que hacer</p>
        {d.tareas.map((t, i) => (
          <div key={i} className="flex gap-2">
            <select className="campo w-36" value={t.accion} onChange={(e) => setTarea(i, { accion: e.target.value as AccionTarea })}>
              {ACCIONES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input className="campo flex-1" value={t.descripcion} onChange={(e) => setTarea(i, { descripcion: e.target.value })} placeholder="Correa del alternador" />
            <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label="Quitar" onClick={() => set("tareas", d.tareas.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="text-sm font-semibold text-slate-600 underline" onClick={() => set("tareas", [...d.tareas, { accion: "chequear", descripcion: "" }])}>
          + Tarea
        </button>
      </div>

      <div className="tarjeta space-y-3 p-5">
        <p className="font-bold">Qué hace falta tener</p>
        <p className="text-xs text-slate-500">
          Si es un insumo del pañol, elegilo de la lista: así la agenda avisa si no hay stock y al registrar el trabajo se descuenta solo.
        </p>
        {d.materiales.map((m, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <select
              className="campo min-w-48 flex-1"
              value={m.insumoId ?? ""}
              onChange={(e) => setMaterial(i, { insumoId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Otra cosa (escribila)</option>
              {insumos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} ({x.stock} {x.unidad})
                </option>
              ))}
            </select>
            {m.insumoId == null && (
              <input className="campo min-w-40 flex-1" value={m.descripcion} onChange={(e) => setMaterial(i, { descripcion: e.target.value })} placeholder="Filtro de aire original" />
            )}
            <input className="campo w-24" inputMode="decimal" value={m.cantidad} onChange={(e) => setMaterial(i, { cantidad: e.target.value })} />
            <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label="Quitar" onClick={() => set("materiales", d.materiales.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-semibold text-slate-600 underline"
          onClick={() => set("materiales", [...d.materiales, { insumoId: null, descripcion: "", cantidad: "1" }])}
        >
          + Material
        </button>
        <Campo etiqueta="Herramientas necesarias">
          <input className="campo" value={d.herramientas} onChange={(e) => set("herramientas", e.target.value)} placeholder="Llave de filtro, bandeja, gato" />
        </Campo>
      </div>

      {d.id && (
        <Interruptor
          valor={d.activo}
          cambiar={(v) => set("activo", v)}
          etiqueta="Plan activo"
          ayuda="Un plan desactivado deja de aparecer en la agenda. Su historial queda."
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-secundario" onClick={() => router.back()}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || !d.nombre.trim() || (!d.cadaDias && !d.cadaUso)}
          onClick={() =>
            void ejecutar(
              () =>
                guardarPlan({
                  ...d,
                  materiales: d.materiales.map((m) => ({
                    insumoId: m.insumoId,
                    descripcion: m.descripcion || null,
                    cantidad: m.cantidad,
                  })),
                }),
              () => {
                router.push(`/activos/${d.activoId}`);
                router.refresh();
              },
            )
          }
        >
          {enviando ? "Guardando…" : "Guardar plan"}
        </button>
      </div>
    </div>
  );
}
