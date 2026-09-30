"use client";

import type { AccionTarea, ValorCelda } from "@/lib/db/schema";
import { COLUMNA_UNICA } from "@/lib/planilla";

export type FilaPlanilla = {
  seccion: string | null;
  activoId: number | null;
  accion: AccionTarea;
  descripcion: string;
  valores: Record<string, ValorCelda>;
  nota: string;
};

const SIGUIENTE: Record<ValorCelda, ValorCelda> = { na: "ok", ok: "mal", mal: "na" };
const CELDA: Record<ValorCelda, { texto: string; clase: string }> = {
  ok: { texto: "✓", clase: "bg-verde text-white" },
  mal: { texto: "✗", clase: "bg-rojo text-white" },
  na: { texto: "—", clase: "bg-slate-100 text-slate-400" },
};

/**
 * La planilla en pantalla. Arranca vacía (—) a propósito: marcar "todo bien"
 * tiene que ser un acto, no algo que ya venía puesto. Con el botón de cada
 * sección se marca todo ✓ y después se tocan solo las que dan mal.
 */
export function CompletarPlanilla({
  columnas,
  filas,
  cambiar,
}: {
  columnas: string[];
  filas: FilaPlanilla[];
  cambiar: (f: FilaPlanilla[]) => void;
}) {
  const unica = columnas.length === 1 && columnas[0] === COLUMNA_UNICA;
  const secciones = [...new Set(filas.map((f) => f.seccion ?? ""))];

  const setFila = (i: number, f: Partial<FilaPlanilla>) => cambiar(filas.map((x, j) => (j === i ? { ...x, ...f } : x)));
  const todoBien = (seccion: string) =>
    cambiar(
      filas.map((f) =>
        (f.seccion ?? "") === seccion
          ? { ...f, valores: Object.fromEntries(columnas.map((c) => [c, f.valores[c] === "mal" ? "mal" : "ok"])) }
          : f,
      ),
    );

  return (
    <div className="space-y-5">
      {secciones.map((sec) => {
        const indices = filas.map((f, i) => ((f.seccion ?? "") === sec ? i : -1)).filter((i) => i >= 0);
        return (
          <div key={sec}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-bold">{sec || "Checklist"}</p>
              <button type="button" className="rounded-lg bg-verde-suave px-3 py-1.5 text-sm font-semibold text-verde" onClick={() => todoBien(sec)}>
                ✓ Todo bien
              </button>
            </div>
            {unica ? (
              <ul className="space-y-2">
                {indices.map((i) => {
                  const f = filas[i];
                  const v = f.valores[COLUMNA_UNICA] ?? "na";
                  return (
                    <li key={i} className="border-b border-slate-100 pb-2 last:border-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">
                          <span className="font-semibold capitalize">{f.accion}</span> {f.descripcion}
                        </span>
                        <span className="flex gap-1">
                          {(["ok", "mal", "na"] as ValorCelda[]).map((x) => (
                            <button
                              key={x}
                              type="button"
                              onClick={() => setFila(i, { valores: { [COLUMNA_UNICA]: x } })}
                              className={`h-10 w-12 rounded-lg text-base font-bold ${v === x ? CELDA[x].clase : "bg-slate-100 text-slate-500"}`}
                            >
                              {x === "na" ? "N/A" : CELDA[x].texto}
                            </button>
                          ))}
                        </span>
                      </div>
                      {v === "mal" && (
                        <input className="campo mt-2" placeholder="¿Qué se encontró?" value={f.nota} onChange={(e) => setFila(i, { nota: e.target.value })} />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-white" />
                      {columnas.map((c) => (
                        <th key={c} className="px-1 pb-1 text-center text-[11px] font-semibold text-slate-500">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {indices.map((i) => {
                      const f = filas[i];
                      const hayMal = Object.values(f.valores).includes("mal");
                      return (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="sticky left-0 bg-white py-1 pr-2 align-top">
                            <span className={hayMal ? "font-semibold text-rojo" : ""}>{f.descripcion}</span>
                            {hayMal && (
                              <input
                                className="campo mt-1 min-w-40 py-1.5"
                                placeholder="¿Qué se encontró?"
                                value={f.nota}
                                onChange={(e) => setFila(i, { nota: e.target.value })}
                              />
                            )}
                          </td>
                          {columnas.map((c) => {
                            const v = f.valores[c] ?? "na";
                            return (
                              <td key={c} className="px-0.5 py-1 text-center align-top">
                                <button
                                  type="button"
                                  aria-label={`${f.descripcion} ${c}`}
                                  onClick={() => setFila(i, { valores: { ...f.valores, [c]: SIGUIENTE[v] } })}
                                  className={`h-10 w-11 rounded-lg text-base font-bold ${CELDA[v].clase}`}
                                >
                                  {CELDA[v].texto}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {!unica && <p className="text-xs text-slate-500">Tocá una casilla para pasar de — a ✓ a ✗.</p>}
    </div>
  );
}
