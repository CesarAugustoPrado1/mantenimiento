"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirCorrectivo } from "@/lib/acciones/trabajos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";

export function AbrirCorrectivo({
  activos,
  activoInicial,
  hoy,
  tituloInicial,
  fallaInicial,
  irAlEquipo,
}: {
  activos: Array<{ id: number; nombre: string; medidor: string }>;
  activoInicial: number | null;
  hoy: string;
  tituloInicial: string;
  fallaInicial: string;
  /** El conductor no ve la pantalla del trabajo: vuelve a la ficha de su vehículo. */
  irAlEquipo: boolean;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [activoId, setActivoId] = useState<number | null>(activoInicial ?? (activos.length === 1 ? activos[0].id : null));
  const [titulo, setTitulo] = useState(tituloInicial);
  const [falla, setFalla] = useState(fallaInicial);
  const [prioridad, setPrioridad] = useState<"baja" | "media" | "alta" | "urgente">("media");
  const [fecha, setFecha] = useState(hoy);
  const [lectura, setLectura] = useState("");
  const [estado, setEstado] = useState<"operativo" | "con_falla" | "en_reparacion" | "fuera_de_servicio">("con_falla");
  const act = activos.find((a) => a.id === activoId);

  return (
    <div className="tarjeta space-y-4 p-5">
      {error && <Aviso>{error}</Aviso>}
      <Campo etiqueta="Equipo">
        <select className="campo" value={activoId ?? ""} onChange={(e) => setActivoId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Elegí la máquina o el vehículo</option>
          {activos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="¿Qué pasó? (corto)">
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Pierde aceite por el cárter" />
      </Campo>
      <Campo etiqueta="Detalle: qué se ve, qué se escucha, desde cuándo">
        <textarea className="campo" rows={3} value={falla} onChange={(e) => setFalla(e.target.value)} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Prioridad">
          <select className="campo" value={prioridad} onChange={(e) => setPrioridad(e.target.value as typeof prioridad)}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </Campo>
        <Campo etiqueta="Fecha">
          <input className="campo" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        {act && act.medidor !== "ninguno" && (
          <Campo etiqueta={act.medidor === "km" ? "Kilometraje" : "Horas"}>
            <input className="campo" inputMode="decimal" value={lectura} onChange={(e) => setLectura(e.target.value)} />
          </Campo>
        )}
      </div>
      <Campo etiqueta="¿Cómo queda el equipo?">
        <div className="grid gap-2 sm:grid-cols-4">
          {(
            [
              ["operativo", "Funciona normal"],
              ["con_falla", "Funciona con la falla"],
              ["en_reparacion", "En reparación"],
              ["fuera_de_servicio", "Parado, esperando"],
            ] as const
          ).map(([v, t]) => (
            <button
              key={v}
              type="button"
              onClick={() => setEstado(v)}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${
                estado === v ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-secundario" onClick={() => router.back()}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || !activoId || titulo.trim().length < 3}
          onClick={() =>
            void ejecutar(
              () =>
                abrirCorrectivo({
                  activoId: activoId!,
                  titulo,
                  falla,
                  prioridad,
                  fecha,
                  lectura,
                  estadoActivo: estado,
                }),
              (r) => {
                router.push(irAlEquipo ? `/activos/${activoId}` : `/trabajos/${r.id}`);
                router.refresh();
              },
            )
          }
        >
          {enviando ? "Guardando…" : "Reportar falla"}
        </button>
      </div>
    </div>
  );
}
