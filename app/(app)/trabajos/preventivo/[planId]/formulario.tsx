"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPreventivo } from "@/lib/acciones/trabajos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";
import { EditorConsumos, consumosValidos, type LineaConsumo } from "@/components/consumos";
import type { AccionTarea, ResultadoTarea } from "@/lib/db/schema";

const RESULTADOS: Array<{ valor: ResultadoTarea; texto: string; clase: string }> = [
  { valor: "ok", texto: "OK", clase: "bg-verde text-white" },
  { valor: "corregido", texto: "Corregido", clase: "bg-blue-600 text-white" },
  { valor: "no_ok", texto: "Mal", clase: "bg-rojo text-white" },
  { valor: "no_aplica", texto: "N/A", clase: "bg-slate-500 text-white" },
];

export function RegistrarPreventivo({
  planId,
  activoId,
  medidor,
  hoy,
  ultimaLectura,
  yo,
  responsableId,
  responsableExterno,
  tareas: tareasPlan,
  consumos: consumosPlan,
  usuarios,
  insumos,
}: {
  planId: number;
  activoId: number;
  medidor: "ninguno" | "km" | "horas";
  hoy: string;
  ultimaLectura: number | null;
  yo: number;
  responsableId: number | null;
  responsableExterno: string | null;
  tareas: Array<{ accion: AccionTarea; descripcion: string }>;
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
  const [tareas, setTareas] = useState(
    tareasPlan.map((t) => ({ ...t, resultado: "ok" as ResultadoTarea, nota: "" })),
  );
  const [consumos, setConsumos] = useState<LineaConsumo[]>(consumosPlan);
  const [horas, setHoras] = useState("");
  const [manoObra, setManoObra] = useState("");
  const [repuestos, setRepuestos] = useState("");
  const [obs, setObs] = useState("");

  const malos = tareas.filter((t) => t.resultado === "no_ok");
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
          <p className="mb-3 font-bold">Checklist</p>
          <ul className="space-y-3">
            {tareas.map((t, i) => (
              <li key={i} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm">
                  <span className="font-semibold capitalize">{t.accion}</span> {t.descripcion}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {RESULTADOS.map((r) => (
                    <button
                      key={r.valor}
                      type="button"
                      onClick={() => setTareas(tareas.map((x, j) => (j === i ? { ...x, resultado: r.valor } : x)))}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        t.resultado === r.valor ? r.clase : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.texto}
                    </button>
                  ))}
                </div>
                {t.resultado !== "ok" && (
                  <input
                    className="campo mt-2"
                    placeholder="¿Qué se encontró?"
                    value={t.nota}
                    onChange={(e) => setTareas(tareas.map((x, j) => (j === i ? { ...x, nota: e.target.value } : x)))}
                  />
                )}
              </li>
            ))}
          </ul>
          {malos.length > 0 && (
            <p className="mt-3">
              <Aviso tono="alerta">
                Hay {malos.length} punto(s) mal. Después de guardar, conviene abrir un correctivo desde la ficha del equipo.
              </Aviso>
            </p>
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
          disabled={enviando}
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
                router.push(malos.length ? `/trabajos/nuevo?activo=${activoId}&desde=${r.id}` : `/trabajos/${r.id}`);
                router.refresh();
              },
            )
          }
        >
          {enviando ? "Guardando…" : "Registrar como hecho"}
        </button>
      </div>
    </div>
  );
}
