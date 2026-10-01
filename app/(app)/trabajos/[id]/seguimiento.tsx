"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarCorrectivo, registrarAvance } from "@/lib/acciones/trabajos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";
import { EditorConsumos, consumosValidos, type LineaConsumo } from "@/components/consumos";
import { PreguntarEstado, type EstadoOperable } from "@/components/estado-equipo";

type Estado = "abierto" | "en_curso" | "cerrado";

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
};

export function Seguimiento({
  inicial,
  causas,
  usuarios,
  insumos,
  hoy,
  equipo,
}: {
  inicial: DatosSeguimiento;
  causas: Array<{ id: number; nombre: string }>;
  usuarios: Array<{ id: number; nombre: string }>;
  insumos: Array<{ id: number; nombre: string; unidad: string; stock: number }>;
  hoy: string;
  equipo: { id: number; nombre: string; estado: string };
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState(inicial);
  const [preguntar, setPreguntar] = useState<EstadoOperable | null>(null);
  const [consumos, setConsumos] = useState<LineaConsumo[]>([]);
  const set = <K extends keyof DatosSeguimiento>(k: K, v: DatosSeguimiento[K]) => setD({ ...d, [k]: v });
  const cerrando = d.estado === "cerrado";

  return (
    <div className="tarjeta space-y-4 p-5">
      <p className="font-bold">Seguimiento</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Estado de la reparación">
          <select
            className="campo"
            value={d.estado}
            onChange={(e) => {
              const estado = e.target.value as Estado;
              setD({ ...d, estado, fechaCierre: d.fechaCierre || hoy });
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
              // Después de guardar, la pregunta: ¿cómo queda la máquina?
              setPreguntar(d.estado === "cerrado" ? "operativo" : d.estado === "en_curso" ? "en_reparacion" : "fuera_de_servicio");
              router.refresh();
            },
          )
        }
      >
        {enviando ? "Guardando…" : cerrando ? "Guardar y cerrar" : "Guardar"}
      </button>
      {preguntar && (
        <PreguntarEstado
          activoId={equipo.id}
          nombre={equipo.nombre}
          actual={equipo.estado}
          sugerido={preguntar}
          trabajoId={d.id}
          listo={() => setPreguntar(null)}
        />
      )}
    </div>
  );
}

/** La bitácora de la reparación. Después de cada avance, la pregunta por el estado. */
export function NuevoAvance({
  trabajoId,
  hoy,
  equipo,
}: {
  trabajoId: number;
  hoy: string;
  equipo: { id: number; nombre: string; estado: string };
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [preguntar, setPreguntar] = useState(false);
  return (
    <div className="space-y-2">
      {error && <Aviso>{error}</Aviso>}
      <textarea
        className="campo"
        rows={2}
        placeholder="Qué se hizo hoy: se desarmó el reductor, se pidió el rodamiento…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <input className="campo w-auto" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || texto.trim().length < 2}
          onClick={() =>
            void ejecutar(
              () => registrarAvance({ trabajoId, fecha, texto }),
              () => {
                setTexto("");
                setPreguntar(true);
                router.refresh();
              },
            )
          }
        >
          {enviando ? "Guardando…" : "Registrar avance"}
        </button>
      </div>
      {preguntar && (
        <PreguntarEstado
          activoId={equipo.id}
          nombre={equipo.nombre}
          actual={equipo.estado}
          trabajoId={trabajoId}
          listo={() => setPreguntar(false)}
        />
      )}
    </div>
  );
}
