"use client";

import { useState } from "react";
import { guardarCategoria } from "@/lib/acciones/insumos";
import { guardarCausa } from "@/lib/acciones/trabajos";
import { actualizarCotizacionesAhora, borrarCotizacion, elegirCasa, guardarCotizacion } from "@/lib/acciones/admin";
import { CASAS } from "@/lib/cotizacion-api";
import { useRouter } from "next/navigation";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
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

export function Cotizaciones({
  hoy,
  casa,
  total,
  items,
}: {
  hoy: string;
  casa: string;
  total: number;
  items: Array<{ fecha: string; ars_por_usd: number; nota: string | null; fuente: string }>;
}) {
  const router = useRouter();
  const [nueva, setNueva] = useState<{ fecha: string; arsPorUsd: string; nota: string } | null>(null);
  const { ejecutar, enviando, error } = useAccion();
  const [listo, setListo] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="tarjeta space-y-3 p-5">
        <p className="font-bold">Automática</p>
        <p className="text-sm text-slate-600">
          Todos los días hábiles la app trae el dólar de internet (argentinadatos.com, con dolarapi.com de respaldo) y completa los
          días que falten. Una cotización cargada a mano nunca se pisa.
        </p>
        {error && <Aviso>{error}</Aviso>}
        {listo && <Aviso tono="exito">{listo}</Aviso>}
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="etiqueta">Qué dólar usar</span>
            <select
              className="campo w-auto"
              value={casa}
              disabled={enviando}
              onChange={(e) => {
                const v = e.target.value;
                void ejecutar(() => elegirCasa(v), () => {
                  setListo(`Ahora se usa el dólar ${CASAS[v as keyof typeof CASAS]}.`);
                  router.refresh();
                });
              }}
            >
              {Object.entries(CASAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="boton-secundario"
            disabled={enviando}
            onClick={() =>
              void ejecutar(actualizarCotizacionesAhora, (r) => {
                setListo(`Listo: ${r.guardadas} día(s) desde ${r.fuente}. Último: ${r.ultima?.fecha.split("-").reverse().join("/")} a $${r.ultima?.arsPorUsd}.`);
                router.refresh();
              })
            }
          >
            {enviando ? "Consultando…" : "Actualizar ahora"}
          </button>
        </div>
        <p className="text-xs text-slate-500">{total} cotizaciones guardadas. Abajo, las últimas 60.</p>
      </div>
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
          + Cargar una a mano
        </button>
      )}
      <div className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Desde</th>
              <th className="text-right">$ por USD</th>
              <th>Origen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.fecha}>
                <td>{c.fecha.split("-").reverse().join("/")}</td>
                <td className="text-right cifra">{c.ars_por_usd.toLocaleString("es-AR")}</td>
                <td className="text-xs text-slate-500">
                  {c.fuente === "manual" ? "manual" : `automática (${CASAS[c.fuente.slice(5) as keyof typeof CASAS] ?? c.fuente})`}
                  {c.nota && ` · ${c.nota}`}
                </td>
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
