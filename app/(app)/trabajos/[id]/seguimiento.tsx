"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarCorrectivo } from "@/lib/acciones/trabajos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";
import { EditorConsumos, consumosValidos, type LineaConsumo } from "@/components/consumos";

type Estado = "abierto" | "en_curso" | "cerrado";
type EstadoActivo = "operativo" | "con_falla" | "fuera_de_servicio";

export type DatosSeguimiento = {
  id: number;
  estado: Estado;
  prioridad: "baja" | "media" | "alta" | "urgente";
  causaId: number | null;
  solucion: string;
  realizadoPorId: number | null;
  realizadoExterno: string;
  fechaCierre: string;
  horasParada: string;
  horasHombre: string;
  costoManoObra: string;
  costoRepuestos: string;
  observaciones: string;
  estadoActivo: EstadoActivo;
};

export function Seguimiento({
  inicial,
  causas,
  usuarios,
  insumos,
  hoy,
}: {
  inicial: DatosSeguimiento;
  causas: Array<{ id: number; nombre: string }>;
  usuarios: Array<{ id: number; nombre: string }>;
  insumos: Array<{ id: number; nombre: string; unidad: string; stock: number }>;
  hoy: string;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState(inicial);
  const [consumos, setConsumos] = useState<LineaConsumo[]>([]);
  const set = <K extends keyof DatosSeguimiento>(k: K, v: DatosSeguimiento[K]) => setD({ ...d, [k]: v });
  const cerrando = d.estado === "cerrado";

  return (
    <div className="tarjeta space-y-4 p-5">
      <p className="font-bold">Seguimiento</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Estado">
          <select
            className="campo"
            value={d.estado}
            onChange={(e) => {
              const estado = e.target.value as Estado;
              setD({ ...d, estado, estadoActivo: estado === "cerrado" ? "operativo" : d.estadoActivo, fechaCierre: d.fechaCierre || hoy });
            }}
          >
            <option value="abierto">Abierto</option>
            <option value="en_curso">En curso</option>
            <option value="cerrado">Resuelto (cerrar)</option>
          </select>
        </Campo>
        <Campo etiqueta="Prioridad">
          <select className="campo" value={d.prioridad} onChange={(e) => set("prioridad", e.target.value as DatosSeguimiento["prioridad"])}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </Campo>
        <Campo etiqueta="El equipo queda">
          <select className="campo" value={d.estadoActivo} onChange={(e) => set("estadoActivo", e.target.value as EstadoActivo)}>
            <option value="operativo">Operativo</option>
            <option value="con_falla">Con falla</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
          </select>
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta={`Causa${cerrando ? " (obligatoria para cerrar)" : ""}`}>
          <select className="campo" value={d.causaId ?? ""} onChange={(e) => set("causaId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Todavía no se sabe</option>
            {causas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Lo arregló">
          <select
            className="campo"
            value={d.realizadoPorId ?? (d.realizadoExterno ? "externo" : "")}
            onChange={(e) =>
              setD({
                ...d,
                realizadoPorId: e.target.value && e.target.value !== "externo" ? Number(e.target.value) : null,
                realizadoExterno: e.target.value === "externo" ? d.realizadoExterno || " " : "",
              })
            }
          >
            <option value="">—</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
            <option value="externo">Un externo…</option>
          </select>
        </Campo>
        {d.realizadoPorId == null && d.realizadoExterno !== "" && (
          <Campo etiqueta="¿Quién?">
            <input className="campo" value={d.realizadoExterno.trim()} onChange={(e) => set("realizadoExterno", e.target.value || " ")} />
          </Campo>
        )}
      </div>

      <Campo etiqueta={`Qué se hizo${cerrando ? " (obligatorio para cerrar)" : ""}`}>
        <textarea className="campo" rows={3} value={d.solucion} onChange={(e) => set("solucion", e.target.value)} />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-3">
        {cerrando && (
          <Campo etiqueta="Fecha de cierre">
            <input className="campo" type="date" max={hoy} value={d.fechaCierre} onChange={(e) => set("fechaCierre", e.target.value)} />
          </Campo>
        )}
        <Campo etiqueta="Horas parado">
          <input className="campo" inputMode="decimal" value={d.horasParada} onChange={(e) => set("horasParada", e.target.value)} />
        </Campo>
        <Campo etiqueta="Horas hombre">
          <input className="campo" inputMode="decimal" value={d.horasHombre} onChange={(e) => set("horasHombre", e.target.value)} />
        </Campo>
        <Campo etiqueta="Mano de obra externa ($)">
          <input className="campo" inputMode="decimal" value={d.costoManoObra} onChange={(e) => set("costoManoObra", e.target.value)} />
        </Campo>
        <Campo etiqueta="Repuestos comprados afuera ($)">
          <input className="campo" inputMode="decimal" value={d.costoRepuestos} onChange={(e) => set("costoRepuestos", e.target.value)} />
        </Campo>
      </div>

      <div>
        <p className="etiqueta">Insumos del pañol usados (se suman a los ya cargados)</p>
        <EditorConsumos lineas={consumos} cambiar={setConsumos} insumos={insumos} />
      </div>

      <Campo etiqueta="Observaciones">
        <textarea className="campo" rows={2} value={d.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
      </Campo>

      <button
        type="button"
        className="boton-primario w-full"
        disabled={enviando}
        onClick={() =>
          void ejecutar(
            () =>
              actualizarCorrectivo({
                ...d,
                realizadoExterno: d.realizadoExterno.trim() || null,
                consumos: consumosValidos(consumos),
              }),
            () => {
              setConsumos([]);
              router.refresh();
            },
          )
        }
      >
        {enviando ? "Guardando…" : cerrando ? "Guardar y cerrar" : "Guardar"}
      </button>
    </div>
  );
}
