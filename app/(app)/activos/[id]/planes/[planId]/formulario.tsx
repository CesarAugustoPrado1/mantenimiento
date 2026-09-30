"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarPlan } from "@/lib/acciones/activos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo, Interruptor } from "@/components/admin";
import { filasNumeradas } from "@/lib/planilla";
import type { AccionTarea, Medidor } from "@/lib/db/schema";

type Fila = { accion: AccionTarea; descripcion: string };
export type Seccion = { nombre: string; activoId: number | null; filas: Fila[] };

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
  columnas: string[];
  secciones: Seccion[];
  materiales: Array<{ insumoId: number | null; descripcion: string; cantidad: string }>;
};

const ACCIONES: AccionTarea[] = ["chequear", "cambiar", "ajustar", "limpiar", "lubricar", "otro"];

const filas = (accion: AccionTarea, ...descripciones: string[]): Fila[] =>
  descripciones.map((descripcion) => ({ accion, descripcion }));
const seccion = (nombre: string, ...f: Fila[][]): Seccion => ({ nombre, activoId: null, filas: f.flat() });

/**
 * Plantillas para no arrancar de cero. Las tres últimas son las planillas en
 * papel que ya se usan en planta, tal cual.
 */
const PLANTILLAS: Record<string, Pick<DatosPlan, "nombre" | "columnas" | "secciones"> & { cadaDias?: string }> = {
  aceite: {
    nombre: "Cambio de aceite y filtros",
    columnas: [],
    secciones: [
      seccion("", filas("cambiar", "Aceite de motor", "Filtro de aceite"), filas("chequear", "Filtro de aire (cambiar si hace falta)", "Filtro de combustible", "Niveles: refrigerante, frenos, dirección")),
    ],
  },
  general: {
    nombre: "Revisión general",
    columnas: [],
    secciones: [seccion("", filas("chequear", "Correas (tensión y desgaste)", "Cubiertas: presión y desgaste", "Frenos", "Luces", "Pérdidas de fluidos"))],
  },
  clark: {
    nombre: "Control de clark",
    columnas: [],
    secciones: [
      seccion(
        "",
        filas("chequear", "Nivel aceite motor", "Nivel aceite hidráulico", "Nivel líquido refrigerante"),
        filas("limpiar", "Limpieza filtro de aire"),
        filas("lubricar", "Engrase"),
      ),
    ],
  },
  carrusel: {
    nombre: "Control carrusel de mesas",
    columnas: ["Vidrios", "Ruedas", "Arrastres", "Guías", "Tramo de cadena"],
    secciones: [{ nombre: "", activoId: null, filas: filasNumeradas("Mesa", 1, 108).map((d) => ({ accion: "chequear", descripcion: d })) }],
  },
  sector: {
    nombre: "Revisión diaria sector",
    cadaDias: "1",
    columnas: ["Limpieza", "Rotura", "Desgaste", "Falla", "Cambiar"],
    secciones: [
      seccion("Trompo 2", filas("chequear", "Motor", "Reductor", "Tablero", "Tambor", "Plataforma")),
      seccion("Mesa vibrado", filas("chequear", "Resortes", "Teclas", "Cables", "Tapa de mesa", "Batea", "Cucharas", "Mezclador")),
      seccion("Sistema de agua", filas("chequear", "Manguera", "Pico de agua")),
      seccion("Túnel", filas("chequear", "Motores", "Cinta transportadora", "Resistencias", "Sensores", "Cuchilla", "Cinta de cuchilla", "Rodamientos")),
    ],
  },
};

const COLUMNAS_TIPICAS = [
  ["Limpieza", "Rotura", "Desgaste", "Falla", "Cambiar"],
  ["Vidrios", "Ruedas", "Arrastres", "Guías", "Tramo de cadena"],
];

export function FormularioPlan({
  inicial,
  medidor,
  usuarios,
  insumos,
  activos,
}: {
  inicial: DatosPlan;
  medidor: Medidor;
  usuarios: Array<{ id: number; nombre: string; rol: string }>;
  insumos: Array<{ id: number; nombre: string; unidad: string; stock: number }>;
  activos: Array<{ id: number; nombre: string }>;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState(inicial);
  const [columnaNueva, setColumnaNueva] = useState("");
  const set = <K extends keyof DatosPlan>(k: K, v: DatosPlan[K]) => setD({ ...d, [k]: v });
  const u = medidor === "km" ? "km" : "horas";
  const hayUso = medidor !== "ninguno";
  const totalFilas = d.secciones.reduce((s, x) => s + x.filas.length, 0);

  const setSeccion = (i: number, x: Partial<Seccion>) =>
    set("secciones", d.secciones.map((s, j) => (j === i ? { ...s, ...x } : s)));
  const setMaterial = (i: number, m: Partial<DatosPlan["materiales"][number]>) =>
    set("materiales", d.materiales.map((x, j) => (j === i ? { ...x, ...m } : x)));

  function agregarColumna(nombre: string) {
    const n = nombre.trim();
    if (n && !d.columnas.includes(n)) set("columnas", [...d.columnas, n]);
    setColumnaNueva("");
  }

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
              onClick={() =>
                setD({
                  ...d,
                  nombre: p.nombre,
                  columnas: p.columnas,
                  secciones: structuredClone(p.secciones),
                  cadaDias: p.cadaDias ?? d.cadaDias,
                })
              }
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
            <Campo etiqueta="Cada cuántos días" ayuda="1 = revisión diaria.">
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
            <select className="campo" value={d.responsableId ?? ""} onChange={(e) => set("responsableId", e.target.value ? Number(e.target.value) : null)}>
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

      <div className="tarjeta space-y-4 p-5">
        <div>
          <p className="font-bold">La planilla</p>
          <p className="text-xs text-slate-500">
            Filas (lo que se revisa) por columnas (qué se mira de cada una). Cada celda se marca ✓ bien, ✗ mal o — no se revisó.
            Sin columnas, cada fila tiene una sola casilla.
          </p>
        </div>

        <div>
          <p className="etiqueta">Columnas</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {d.columnas.map((c) => (
              <span key={c} className="chip gap-1 bg-slate-900 py-1 text-white">
                {c}
                <button type="button" aria-label={`Quitar ${c}`} onClick={() => set("columnas", d.columnas.filter((x) => x !== c))}>
                  ✕
                </button>
              </span>
            ))}
            {d.columnas.length === 0 && <span className="text-sm text-slate-500">Una sola casilla por fila.</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="campo w-48"
              value={columnaNueva}
              placeholder="Nueva columna"
              onChange={(e) => setColumnaNueva(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregarColumna(columnaNueva)}
            />
            <button type="button" className="boton-secundario" onClick={() => agregarColumna(columnaNueva)}>
              Agregar
            </button>
            {COLUMNAS_TIPICAS.map((cs) => (
              <button key={cs[0]} type="button" className="text-sm font-semibold text-slate-600 underline" onClick={() => set("columnas", cs)}>
                {cs.join(" / ")}
              </button>
            ))}
          </div>
        </div>

        {d.secciones.map((s, i) => (
          <EditorSeccion
            key={i}
            seccion={s}
            activos={activos}
            varias={d.secciones.length > 1 || !!s.nombre}
            cambiar={(x) => setSeccion(i, x)}
            quitar={() => set("secciones", d.secciones.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          className="text-sm font-semibold text-slate-600 underline"
          onClick={() => set("secciones", [...d.secciones, { nombre: "", activoId: null, filas: [{ accion: "chequear", descripcion: "" }] }])}
        >
          + Sección
        </button>
        <p className="text-xs text-slate-500">{totalFilas} fila(s) en total.</p>
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
                  tareas: d.secciones.flatMap((s) =>
                    s.filas.map((f) => ({
                      seccion: s.nombre.trim() || null,
                      activoId: s.activoId,
                      accion: f.accion,
                      descripcion: f.descripcion,
                    })),
                  ),
                  materiales: d.materiales.map((m) => ({ insumoId: m.insumoId, descripcion: m.descripcion || null, cantidad: m.cantidad })),
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

function EditorSeccion({
  seccion: s,
  activos,
  varias,
  cambiar,
  quitar,
}: {
  seccion: Seccion;
  activos: Array<{ id: number; nombre: string }>;
  varias: boolean;
  cambiar: (x: Partial<Seccion>) => void;
  quitar: () => void;
}) {
  const [abierta, setAbierta] = useState(s.filas.length <= 20);
  const [numeradas, setNumeradas] = useState<{ prefijo: string; desde: string; hasta: string } | null>(null);
  const setFila = (i: number, f: Partial<Fila>) => cambiar({ filas: s.filas.map((x, j) => (j === i ? { ...x, ...f } : x)) });

  return (
    <div className="space-y-2 rounded-xl p-3 ring-1 ring-slate-200">
      {varias && (
        <div className="flex flex-wrap gap-2">
          <input className="campo min-w-40 flex-1 font-semibold" value={s.nombre} placeholder="Sección (ej. Túnel)" onChange={(e) => cambiar({ nombre: e.target.value })} />
          <select
            className="campo w-auto min-w-48"
            value={s.activoId ?? ""}
            title="Si la sección es otro equipo, un ✗ abre el correctivo sobre ese equipo."
            onChange={(e) => cambiar({ activoId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Es parte de este equipo</option>
            {activos.map((a) => (
              <option key={a.id} value={a.id}>
                Es el equipo: {a.nombre}
              </option>
            ))}
          </select>
          <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label="Quitar sección" onClick={quitar}>
            ✕
          </button>
        </div>
      )}
      {abierta ? (
        s.filas.map((f, i) => (
          <div key={i} className="flex gap-2">
            <select className="campo w-32" value={f.accion} onChange={(e) => setFila(i, { accion: e.target.value as AccionTarea })}>
              {ACCIONES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input className="campo flex-1" value={f.descripcion} onChange={(e) => setFila(i, { descripcion: e.target.value })} placeholder="Correa del alternador" />
            <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label="Quitar" onClick={() => cambiar({ filas: s.filas.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))
      ) : (
        <button type="button" className="text-sm text-slate-600 underline" onClick={() => setAbierta(true)}>
          {s.filas.length} filas ({s.filas[0]?.descripcion} … {s.filas[s.filas.length - 1]?.descripcion}) — mostrar
        </button>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="font-semibold text-slate-600 underline" onClick={() => cambiar({ filas: [...s.filas, { accion: "chequear", descripcion: "" }] })}>
          + Fila
        </button>
        {numeradas ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <input className="campo w-28" value={numeradas.prefijo} onChange={(e) => setNumeradas({ ...numeradas, prefijo: e.target.value })} />
            <input className="campo w-20" inputMode="numeric" value={numeradas.desde} onChange={(e) => setNumeradas({ ...numeradas, desde: e.target.value })} />
            a
            <input className="campo w-20" inputMode="numeric" value={numeradas.hasta} onChange={(e) => setNumeradas({ ...numeradas, hasta: e.target.value })} />
            <button
              type="button"
              className="boton-secundario min-h-10"
              onClick={() => {
                const nuevas = filasNumeradas(numeradas.prefijo, Number(numeradas.desde), Number(numeradas.hasta));
                cambiar({ filas: [...s.filas.filter((f) => f.descripcion), ...nuevas.map((descripcion) => ({ accion: "chequear" as const, descripcion }))] });
                setNumeradas(null);
              }}
            >
              Agregar
            </button>
          </span>
        ) : (
          <button type="button" className="font-semibold text-slate-600 underline" onClick={() => setNumeradas({ prefijo: "Mesa", desde: "1", hasta: "10" })}>
            + Filas numeradas (Mesa 1 … N)
          </button>
        )}
      </div>
    </div>
  );
}
