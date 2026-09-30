"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPreventivo } from "@/lib/acciones/trabajos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";
import { EditorConsumos, consumosValidos, type LineaConsumo } from "@/components/consumos";
import type { AccionTarea } from "@/lib/db/schema";
import { CompletarPlanilla, type FilaPlanilla } from "@/components/planilla";

export function RegistrarPreventivo({
  planId,
  medidor,
  hoy,
  ultimaLectura,
  yo,
  responsableId,
  responsableExterno,
  columnas,
  tareas: tareasPlan,
  consumos: consumosPlan,
  usuarios,
  insumos,
}: {
  planId: number;
  medidor: "ninguno" | "km" | "horas";
  hoy: string;
  ultimaLectura: number | null;
  yo: number;
  responsableId: number | null;
  responsableExterno: string | null;
  columnas: string[];
  tareas: Array<{ seccion: string | null; activoId: number | null; accion: AccionTarea; descripcion: string }>;
  consumos: LineaConsumo[];
  usuarios: Array<{ id: number; nombre: string }>;
  insumos: Array<{ id: number; nombre: string; unidad: string; stock: number }>;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [fecha, setFecha] = useState(hoy);
  const [lectura, setLectura] = useState("");
  const [quien, setQuien] = useState<string>(
    responsableExterno && !responsableId ? "externo" : String(responsableId ?? yo),
  );
  const [externo, setExterno] = useState(responsableExterno ?? "");
  const [tareas, setTareas] = useState<FilaPlanilla[]>(tareasPlan.map((t) => ({ ...t, valores: {}, nota: "" })));
  const [consumos, setConsumos] = useState<LineaConsumo[]>(consumosPlan);
  const [horas, setHoras] = useState("");
  const [manoObra, setManoObra] = useState("");
  const [repuestos, setRepuestos] = useState("");
  const [obs, setObs] = useState("");

  const malos = tareas.filter((t) => Object.values(t.valores).includes("mal"));
  const marcadas = tareas.filter((t) => Object.values(t.valores).some((v) => v !== "na")).length;
  const u = medidor === "km" ? "km" : "horas";

  return (
    <div className="space-y-4">
      {error && <Aviso>{error}</Aviso>}
      <div className="tarjeta grid gap-3 p-5 sm:grid-cols-3">
        <Campo etiqueta="Fecha">
          <input className="campo" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        {medidor !== "ninguno" && (
          <Campo etiqueta={`${u === "km" ? "Kilometraje" : "Horas"} del equipo`} ayuda={ultimaLectura != null ? `Última cargada: ${ultimaLectura}` : undefined}>
            <input className="campo" inputMode="decimal" value={lectura} onChange={(e) => setLectura(e.target.value)} />
          </Campo>
        )}
        <Campo etiqueta="Lo hizo">
          <select className="campo" value={quien} onChange={(e) => setQuien(e.target.value)}>
            {usuarios.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
            <option value="externo">Un externo…</option>
          </select>
        </Campo>
        {quien === "externo" && (
          <div className="sm:col-span-3">
            <Campo etiqueta="¿Quién?">
              <input className="campo" value={externo} onChange={(e) => setExterno(e.target.value)} placeholder="Concesionaria Toyota" />
            </Campo>
          </div>
        )}
      </div>

      {tareas.length > 0 && (
        <div className="tarjeta p-5">
          <CompletarPlanilla columnas={columnas} filas={tareas} cambiar={setTareas} />
          {malos.length > 0 && (
            <div className="mt-3">
              <Aviso tono="alerta">
                {malos.length} fila(s) con ✗. Después de guardar vas a poder abrir un correctivo por cada hallazgo con un toque.
              </Aviso>
            </div>
          )}
        </div>
      )}

      <div className="tarjeta space-y-3 p-5">
        <p className="font-bold">Insumos usados</p>
        <EditorConsumos lineas={consumos} cambiar={setConsumos} insumos={insumos} />
      </div>

      <div className="tarjeta grid gap-3 p-5 sm:grid-cols-3">
        <Campo etiqueta="Horas hombre">
          <input className="campo" inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} />
        </Campo>
        <Campo etiqueta="Mano de obra externa ($)">
          <input className="campo" inputMode="decimal" value={manoObra} onChange={(e) => setManoObra(e.target.value)} />
        </Campo>
        <Campo etiqueta="Repuestos comprados afuera ($)">
          <input className="campo" inputMode="decimal" value={repuestos} onChange={(e) => setRepuestos(e.target.value)} />
        </Campo>
        <div className="sm:col-span-3">
          <Campo etiqueta="Observaciones">
            <textarea className="campo" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-secundario" onClick={() => router.back()}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || (tareas.length > 0 && marcadas === 0)}
          title={tareas.length > 0 && marcadas === 0 ? "La planilla está vacía" : undefined}
          onClick={() =>
            void ejecutar(
              () =>
                registrarPreventivo({
                  planId,
                  fecha,
                  lectura,
                  realizadoPorId: quien === "externo" ? null : Number(quien),
                  realizadoExterno: quien === "externo" ? externo : null,
                  tareas,
                  consumos: consumosValidos(consumos),
                  horasHombre: horas,
                  costoManoObra: manoObra,
                  costoRepuestos: repuestos,
                  observaciones: obs,
                }),
              (r) => {
                router.push(`/trabajos/${r.id}`);
                router.refresh();
              },
            )
          }
        >
          {enviando ? "Guardando…" : tareas.length > 0 && marcadas === 0 ? "Completá la planilla" : "Registrar como hecho"}
        </button>
      </div>
    </div>
  );
}
