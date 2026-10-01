"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarRepuesto } from "@/lib/acciones/repuestos";
import { useAccion } from "./usar-accion";
import { Aviso } from "./ui";
import { Campo } from "./admin";

type Criticidad = "alta" | "media" | "baja";

const CRITICIDADES: Array<{ valor: Criticidad; texto: string; ayuda: string }> = [
  { valor: "alta", texto: "Alta", ayuda: "Si se rompe y no está, para la producción" },
  { valor: "media", texto: "Media", ayuda: "Se puede seguir un tiempo, con problemas" },
  { valor: "baja", texto: "Baja", ayuda: "Conviene tenerlo, pero no frena nada" },
];

export function AgregarRepuesto({
  activoId,
  disponibles,
  inicial,
}: {
  activoId: number;
  disponibles: Array<{ id: number; nombre: string; codigo: string | null; unidad: string; stock: number }>;
  /** Para editar un vínculo existente (dónde va, criticidad). */
  inicial?: { insumoId: number; nombre: string; dondeVa: string; criticidad: Criticidad; nota: string };
}) {
  const router = useRouter();
  const { ejecutar, enviando, error, limpiar } = useAccion();
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<"existente" | "nuevo">(inicial ? "existente" : "nuevo");
  const [insumoId, setInsumoId] = useState<number | null>(inicial?.insumoId ?? null);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    codigo: "",
    unidad: "unidad",
    minimo: "1",
    stockActual: "",
    tiempoReposicionDias: "",
    proveedor: "",
    ubicacion: "",
  });
  const [dondeVa, setDondeVa] = useState(inicial?.dondeVa ?? "");
  const [criticidad, setCriticidad] = useState<Criticidad>(inicial?.criticidad ?? "alta");
  const [nota, setNota] = useState(inicial?.nota ?? "");
  const setN = (k: keyof typeof nuevo, v: string) => setNuevo({ ...nuevo, [k]: v });

  if (!abierto) {
    return (
      <button
        type="button"
        className={inicial ? "text-xs font-semibold text-slate-500 underline" : "text-sm font-semibold text-slate-700 underline"}
        onClick={() => setAbierto(true)}
      >
        {inicial ? "Editar" : "+ Repuesto"}
      </button>
    );
  }

  const puede = modo === "existente" ? insumoId != null : nuevo.nombre.trim().length > 0 && Number(nuevo.minimo) >= 1;

  return (
    <div className="tarjeta mt-2 space-y-3 p-4">
      <p className="font-bold">{inicial ? `Editar: ${inicial.nombre}` : "Repuesto que conviene tener"}</p>
      {error && <Aviso>{error}</Aviso>}
      {!inicial && (
        <div className="flex gap-2">
          {(["nuevo", "existente"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${
                modo === m ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300"
              }`}
            >
              {m === "nuevo" ? "Cargar uno nuevo" : "Ya está en el pañol"}
            </button>
          ))}
        </div>
      )}

      {!inicial && modo === "existente" && (
        <Campo etiqueta="Repuesto" ayuda="Si sirve para varias máquinas (un rulemán), se carga una vez y se vincula a cada una.">
          <select className="campo" value={insumoId ?? ""} onChange={(e) => setInsumoId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Elegí</option>
            {disponibles.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
                {x.codigo ? ` (${x.codigo})` : ""} · hay {x.stock} {x.unidad}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {!inicial && modo === "nuevo" && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Campo etiqueta="Repuesto">
                <input className="campo" value={nuevo.nombre} onChange={(e) => setN("nombre", e.target.value)} placeholder="Eje de la corona" />
              </Campo>
            </div>
            <Campo etiqueta="Código / medida">
              <input className="campo" value={nuevo.codigo} onChange={(e) => setN("codigo", e.target.value)} placeholder="6205-2RS" />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo etiqueta="Conviene tener">
              <input className="campo" inputMode="numeric" value={nuevo.minimo} onChange={(e) => setN("minimo", e.target.value)} />
            </Campo>
            <Campo etiqueta="Hay hoy">
              <input className="campo" inputMode="numeric" value={nuevo.stockActual} onChange={(e) => setN("stockActual", e.target.value)} placeholder="0" />
            </Campo>
            <Campo etiqueta="Se cuenta en">
              <input className="campo" value={nuevo.unidad} onChange={(e) => setN("unidad", e.target.value)} />
            </Campo>
            <Campo etiqueta="Días para conseguirlo">
              <input className="campo" inputMode="numeric" value={nuevo.tiempoReposicionDias} onChange={(e) => setN("tiempoReposicionDias", e.target.value)} placeholder="7" />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Proveedor / tornería">
              <input className="campo" value={nuevo.proveedor} onChange={(e) => setN("proveedor", e.target.value)} />
            </Campo>
            <Campo etiqueta="Dónde se guarda">
              <input className="campo" value={nuevo.ubicacion} onChange={(e) => setN("ubicacion", e.target.value)} />
            </Campo>
          </div>
        </div>
      )}

      <Campo etiqueta="Dónde va en esta máquina">
        <input className="campo" value={dondeVa} onChange={(e) => setDondeVa(e.target.value)} placeholder="Ruedas de las mesas" />
      </Campo>
      <div>
        <p className="etiqueta">¿Qué tan crítico es para esta máquina?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {CRITICIDADES.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setCriticidad(c.valor)}
              className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ${
                criticidad === c.valor ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300"
              }`}
            >
              <span className="font-semibold">{c.texto}</span>
              <span className={`block text-xs ${criticidad === c.valor ? "text-slate-300" : "text-slate-500"}`}>{c.ayuda}</span>
            </button>
          ))}
        </div>
      </div>
      <Campo etiqueta="Nota (plano, medidas, quién lo fabrica…)">
        <input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="boton-secundario"
          onClick={() => {
            limpiar();
            setAbierto(false);
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || !puede}
          onClick={() =>
            void ejecutar(
              () =>
                guardarRepuesto({
                  activoId,
                  insumoId: modo === "existente" ? insumoId : null,
                  nuevo: modo === "nuevo" && !inicial ? nuevo : null,
                  dondeVa,
                  criticidad,
                  nota,
                }),
              () => {
                setAbierto(false);
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
