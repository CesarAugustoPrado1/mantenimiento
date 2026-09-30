"use client";

import { useState } from "react";
import { guardarCategoria } from "@/lib/acciones/insumos";
import { guardarCausa } from "@/lib/acciones/trabajos";
import { borrarCotizacion, guardarCotizacion } from "@/lib/acciones/admin";
import { BotonAccion, Campo, Formulario, Interruptor } from "@/components/admin";
import { Chip } from "@/components/ui";

type Simple = { id?: number; nombre: string; descripcion?: string; activa: boolean; usos?: number };

/** ABM de una lista corta: categorías de insumo o causas de falla. */
export function ListaSimple({ tipo, items }: { tipo: "categoria" | "causa"; items: Simple[] }) {
  const [editando, setEditando] = useState<Simple | null>(null);
  const esCausa = tipo === "causa";
  return (
    <div className="space-y-3">
      {editando ? (
        <Formulario
          titulo={editando.id ? "Editar" : esCausa ? "Causa nueva" : "Categoría nueva"}
          puedeGuardar={editando.nombre.trim().length > 0}
          alGuardar={() =>
            esCausa
              ? guardarCausa({ id: editando.id, nombre: editando.nombre, descripcion: editando.descripcion ?? "", activa: editando.activa })
              : guardarCategoria({ id: editando.id, nombre: editando.nombre, activa: editando.activa })
          }
          cerrar={() => setEditando(null)}
        >
          <Campo etiqueta="Nombre">
            <input className="campo" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
          </Campo>
          {esCausa && (
            <Campo etiqueta="Cuándo usarla">
              <input className="campo" value={editando.descripcion ?? ""} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} />
            </Campo>
          )}
          <Interruptor valor={editando.activa} cambiar={(v) => setEditando({ ...editando, activa: v })} etiqueta="Activa" />
        </Formulario>
      ) : (
        <button type="button" className="boton-primario w-full" onClick={() => setEditando({ nombre: "", descripcion: "", activa: true })}>
          + Agregar
        </button>
      )}
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="tarjeta flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {i.nombre} {!i.activa && <Chip>inactiva</Chip>}
              </p>
              <p className="text-xs text-slate-500">
                {i.descripcion}
                {i.usos != null && ` · usada ${i.usos} ${i.usos === 1 ? "vez" : "veces"}`}
              </p>
            </div>
            <button type="button" className="boton-secundario text-sm" onClick={() => setEditando(i)}>
              Editar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Cotizaciones({ hoy, items }: { hoy: string; items: Array<{ fecha: string; ars_por_usd: number; nota: string | null }> }) {
  const [nueva, setNueva] = useState<{ fecha: string; arsPorUsd: string; nota: string } | null>(null);
  return (
    <div className="space-y-3">
      {nueva ? (
        <Formulario
          titulo="Cotización"
          puedeGuardar={nueva.arsPorUsd !== ""}
          alGuardar={() => guardarCotizacion(nueva)}
          cerrar={() => setNueva(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fecha">
              <input className="campo" type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} />
            </Campo>
            <Campo etiqueta="Pesos por dólar">
              <input className="campo" inputMode="decimal" value={nueva.arsPorUsd} onChange={(e) => setNueva({ ...nueva, arsPorUsd: e.target.value })} />
            </Campo>
          </div>
          <Campo etiqueta="Nota">
            <input className="campo" value={nueva.nota} onChange={(e) => setNueva({ ...nueva, nota: e.target.value })} placeholder="Oficial BNA venta" />
          </Campo>
        </Formulario>
      ) : (
        <button type="button" className="boton-primario w-full" onClick={() => setNueva({ fecha: hoy, arsPorUsd: "", nota: "" })}>
          + Cargar cotización
        </button>
      )}
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Desde</th>
              <th className="text-right">$ por USD</th>
              <th>Nota</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.fecha}>
                <td>{c.fecha.split("-").reverse().join("/")}</td>
                <td className="text-right cifra">{c.ars_por_usd.toLocaleString("es-AR")}</td>
                <td className="text-slate-500">{c.nota}</td>
                <td className="text-right">
                  <BotonAccion accion={() => borrarCotizacion(c.fecha)} clase="text-xs text-slate-400 underline" confirmar="¿Borrar?">
                    borrar
                  </BotonAccion>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-500">
                  Sin cotizaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
