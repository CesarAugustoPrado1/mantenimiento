"use client";

export type LineaConsumo = { insumoId: number | null; cantidad: string };

/** Qué insumos del pañol se usaron. Se descuentan del stock al guardar. */
export function EditorConsumos({
  lineas,
  cambiar,
  insumos,
}: {
  lineas: LineaConsumo[];
  cambiar: (l: LineaConsumo[]) => void;
  insumos: Array<{ id: number; nombre: string; unidad: string; stock: number }>;
}) {
  const set = (i: number, l: Partial<LineaConsumo>) => cambiar(lineas.map((x, j) => (j === i ? { ...x, ...l } : x)));
  return (
    <div className="space-y-2">
      {lineas.map((l, i) => {
        const ins = insumos.find((x) => x.id === l.insumoId);
        const falta = ins && Number(l.cantidad) > ins.stock;
        return (
          <div key={i}>
            <div className="flex gap-2">
              <select
                className="campo flex-1"
                value={l.insumoId ?? ""}
                onChange={(e) => set(i, { insumoId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Elegí un insumo</option>
                {insumos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre} (hay {x.stock} {x.unidad})
                  </option>
                ))}
              </select>
              <input className="campo w-24" inputMode="decimal" value={l.cantidad} onChange={(e) => set(i, { cantidad: e.target.value })} />
              <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label="Quitar" onClick={() => cambiar(lineas.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
            {falta && <p className="mt-1 text-xs font-semibold text-red-700">El sistema dice que hay {ins.stock}: no alcanza.</p>}
          </div>
        );
      })}
      <button type="button" className="text-sm font-semibold text-slate-600 underline" onClick={() => cambiar([...lineas, { insumoId: null, cantidad: "1" }])}>
        + Insumo usado
      </button>
    </div>
  );
}

export function consumosValidos(lineas: LineaConsumo[]) {
  return lineas
    .filter((l) => l.insumoId && Number(l.cantidad.replace(",", ".")) > 0)
    .map((l) => ({ insumoId: l.insumoId!, cantidad: Number(l.cantidad.replace(",", ".")) }));
}
