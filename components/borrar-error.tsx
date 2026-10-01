"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { borrarCargadoPorError } from "@/lib/acciones/borrado";
import type { TipoBorrable } from "@/lib/borrado";
import { useAccion } from "./usar-accion";
import { Aviso } from "./ui";

/**
 * "Lo cargué mal": aparece solo dentro de las 24 horas del alta. Pide
 * confirmación y, si se pudo, lleva a la lista (la ficha ya no existe).
 */
export function BorrarPorError({ tipo, id, que, destino }: { tipo: TipoBorrable; id: number; que: string; destino?: string }) {
  const router = useRouter();
  const { ejecutar, enviando, error, limpiar } = useAccion();
  const [preguntando, setPreguntando] = useState(false);

  if (error) {
    return (
      <div className="w-full space-y-2">
        <Aviso>{error}</Aviso>
        <button type="button" className="text-xs font-semibold text-slate-500 underline" onClick={limpiar}>
          Entendido
        </button>
      </div>
    );
  }
  if (preguntando) {
    return (
      <div className="w-full rounded-xl bg-red-50 p-3 text-sm ring-1 ring-red-200">
        <p className="font-semibold text-red-900">¿Borrar {que}?</p>
        <p className="mt-0.5 text-red-800">
          Es para lo cargado por error: se puede porque se cargó hace menos de 24 horas. No se puede deshacer.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="boton-secundario min-h-10 text-sm" onClick={() => setPreguntando(false)}>
            No
          </button>
          <button
            type="button"
            className="boton-peligro min-h-10 text-sm"
            disabled={enviando}
            onClick={() =>
              void ejecutar(() => borrarCargadoPorError({ tipo, id }), () => {
                if (destino) router.push(destino);
                router.refresh();
              })
            }
          >
            {enviando ? "Borrando…" : "Sí, borrar"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="text-xs font-semibold text-red-600 underline" onClick={() => setPreguntando(true)}>
      🗑 Borrar (cargado por error)
    </button>
  );
}
