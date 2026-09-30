"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelarCompra, guardarCompra, marcarPedida, recibirCompra } from "@/lib/acciones/compras";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { BotonAccion, Campo } from "@/components/admin";

type Item = { insumoId: number | null; descripcion: string; cantidad: string; precioUnitario: string };

export function EditorCompra({
  compraId,
  inicial,
  insumos,
}: {
  compraId: number;
  inicial: { titulo: string; proveedor: string; nota: string; items: Item[] };
  insumos: Array<{ id: number; nombre: string; unidad: string; stock: number }>;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState(inicial);
  const [cambios, setCambios] = useState(false);
  const setItem = (i: number, x: Partial<Item>) => {
    setCambios(true);
    setD({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...x } : it)) });
  };

  return (
    <div className="tarjeta space-y-4 p-5">
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Título">
          <input className="campo" value={d.titulo} onChange={(e) => (setCambios(true), setD({ ...d, titulo: e.target.value }))} />
        </Campo>
        <Campo etiqueta="Proveedor">
          <input className="campo" value={d.proveedor} onChange={(e) => (setCambios(true), setD({ ...d, proveedor: e.target.value }))} />
        </Campo>
      </div>
      <div className="space-y-2">
        <p className="etiqueta">Renglones</p>
        {d.items.map((it, i) => (
          <div key={i} className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-2">
            <select
              className="campo min-w-48 flex-1"
              value={it.insumoId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const ins = insumos.find((x) => x.id === id);
                setItem(i, { insumoId: id, descripcion: ins ? ins.nombre : it.descripcion });
              }}
            >
              <option value="">No es del pañol</option>
              {insumos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
            {it.insumoId == null && (
              <input className="campo min-w-40 flex-1" placeholder="Qué" value={it.descripcion} onChange={(e) => setItem(i, { descripcion: e.target.value })} />
            )}
            <input className="campo w-24" inputMode="decimal" placeholder="Cant." value={it.cantidad} onChange={(e) => setItem(i, { cantidad: e.target.value })} />
            <input className="campo w-32" inputMode="decimal" placeholder="$ unit." value={it.precioUnitario} onChange={(e) => setItem(i, { precioUnitario: e.target.value })} />
            <button
              type="button"
              className="px-2 text-slate-400 hover:text-red-600"
              aria-label="Quitar"
              onClick={() => (setCambios(true), setD({ ...d, items: d.items.filter((_, j) => j !== i) }))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-semibold text-slate-600 underline"
          onClick={() => (setCambios(true), setD({ ...d, items: [...d.items, { insumoId: null, descripcion: "", cantidad: "1", precioUnitario: "" }] }))}
        >
          + Renglón
        </button>
      </div>
      <Campo etiqueta="Nota">
        <textarea className="campo" rows={2} value={d.nota} onChange={(e) => (setCambios(true), setD({ ...d, nota: e.target.value }))} />
      </Campo>
      <button
        type="button"
        className="boton-primario w-full"
        disabled={enviando || !cambios}
        onClick={() =>
          void ejecutar(
            () => guardarCompra({ compraId, ...d, items: d.items.map((x) => ({ ...x, descripcion: x.descripcion.trim() })) }),
            () => {
              setCambios(false);
              router.refresh();
            },
          )
        }
      >
        {enviando ? "Guardando…" : cambios ? "Guardar cambios" : "Sin cambios"}
      </button>
    </div>
  );
}

export function AccionesCompra({ compraId, estado }: { compraId: number; estado: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {estado === "borrador" && (
        <BotonAccion accion={() => marcarPedida(compraId)} clase="boton-secundario">
          Marcar como pedida
        </BotonAccion>
      )}
      <BotonAccion accion={() => cancelarCompra(compraId)} clase="boton-secundario" confirmar="¿Cancelar esta compra?">
        Cancelar compra
      </BotonAccion>
    </div>
  );
}

type Renglon = { id: number; descripcion: string; cantidad: number; precio: number | null; esInsumo: boolean; unidad: string | null };

export function Recepcion({ compraId, hoy, renglones }: { compraId: number; hoy: string; renglones: Renglon[] }) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoy);
  const [valores, setValores] = useState(
    renglones.map((r) => ({ itemId: r.id, recibido: String(r.cantidad), precioUnitario: r.precio != null ? String(r.precio) : "" })),
  );

  if (!abierto) {
    return (
      <button type="button" className="boton-primario w-full" onClick={() => setAbierto(true)}>
        📦 Recibir compra
      </button>
    );
  }
  return (
    <div className="tarjeta space-y-3 p-5">
      <p className="font-bold">Recepción</p>
      <p className="text-sm text-slate-600">
        Poné lo que llegó de verdad. Lo que es del pañol entra al stock con su precio; lo demás queda registrado.
      </p>
      {error && <Aviso>{error}</Aviso>}
      <Campo etiqueta="Fecha de recepción">
        <input className="campo w-auto" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Campo>
      <ul className="space-y-2">
        {renglones.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2 text-sm">
            <span className="min-w-40 flex-1">
              {r.descripcion} <span className="text-xs text-slate-500">(pedido {r.cantidad}{r.unidad ? ` ${r.unidad}` : ""})</span>
              {!r.esInsumo && <span className="block text-xs text-slate-500">no suma stock</span>}
            </span>
            <input
              className="campo w-24"
              inputMode="decimal"
              value={valores[i].recibido}
              onChange={(e) => setValores(valores.map((v, j) => (j === i ? { ...v, recibido: e.target.value } : v)))}
            />
            <input
              className="campo w-32"
              inputMode="decimal"
              placeholder="$ unit."
              value={valores[i].precioUnitario}
              onChange={(e) => setValores(valores.map((v, j) => (j === i ? { ...v, precioUnitario: e.target.value } : v)))}
            />
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando}
          onClick={() =>
            void ejecutar(
              () =>
                recibirCompra({
                  compraId,
                  fecha,
                  items: valores.map((v) => ({ itemId: v.itemId, recibido: v.recibido, precioUnitario: v.precioUnitario })),
                }),
              () => router.refresh(),
            )
          }
        >
          {enviando ? "Guardando…" : "Confirmar recepción"}
        </button>
      </div>
    </div>
  );
}
