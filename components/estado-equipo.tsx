"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoEquipo } from "@/lib/acciones/trabajos";
import { useAccion } from "./usar-accion";
import { Aviso } from "./ui";

export type EstadoOperable = "operativo" | "con_falla" | "en_reparacion" | "fuera_de_servicio";

const OPCIONES: Array<{ valor: EstadoOperable; texto: string; ayuda: string; clase: string }> = [
  { valor: "operativo", texto: "Operativo", ayuda: "Funciona normal", clase: "ring-verde/40" },
  { valor: "con_falla", texto: "Con falla", ayuda: "Funciona, con el problema", clase: "ring-amarillo/50" },
  { valor: "en_reparacion", texto: "En reparación", ayuda: "Lo están arreglando", clase: "ring-blue-300" },
  { valor: "fuera_de_servicio", texto: "Fuera de servicio", ayuda: "Parado, esperando", clase: "ring-rojo/40" },
];

/**
 * La pregunta que aparece después de cada avance o cambio de una reparación:
 * ¿cómo queda la máquina? Un toque, sin salir de la pantalla. "Queda igual"
 * es una respuesta válida y no escribe nada.
 */
export function PreguntarEstado({
  activoId,
  nombre,
  actual,
  sugerido,
  trabajoId,
  listo,
}: {
  activoId: number;
  nombre: string;
  actual: string;
  sugerido?: EstadoOperable;
  trabajoId?: number;
  listo: () => void;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const etiquetaActual = OPCIONES.find((o) => o.valor === actual)?.texto ?? actual;

  return (
    <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-lg" role="dialog" aria-label="Estado de la máquina">
      <p className="font-bold">¿Cómo queda {nombre}?</p>
      <p className="text-sm text-slate-300">Ahora figura: {etiquetaActual}</p>
      {error && (
        <div className="mt-2">
          <Aviso>{error}</Aviso>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            disabled={enviando}
            onClick={() =>
              o.valor === actual
                ? listo()
                : void ejecutar(() => cambiarEstadoEquipo({ activoId, estado: o.valor, trabajoId }), () => {
                    listo();
                    router.refresh();
                  })
            }
            className={`rounded-xl bg-white px-3 py-2.5 text-left text-slate-900 ring-2 ${
              o.valor === sugerido ? "ring-amber-400" : o.clase
            } disabled:opacity-50`}
          >
            <span className="block text-sm font-bold">
              {o.texto}
              {o.valor === actual && <span className="ml-1 text-xs font-normal text-slate-500">(ahora)</span>}
            </span>
            <span className="block text-xs text-slate-500">{o.valor === sugerido ? "sugerido · " : ""}{o.ayuda}</span>
          </button>
        ))}
      </div>
      <button type="button" className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-slate-300 ring-1 ring-slate-600" onClick={listo}>
        Queda como estaba ({etiquetaActual})
      </button>
    </div>
  );
}

/** "Cambiar estado" en la ficha: el mismo cuadro, abierto a demanda. */
export function CambiarEstadoRapido({ activoId, nombre, actual }: { activoId: number; nombre: string; actual: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" className="boton-secundario text-sm" onClick={() => setAbierto(true)}>
        Cambiar estado
      </button>
    );
  }
  return (
    <div className="w-full">
      <PreguntarEstado activoId={activoId} nombre={nombre} actual={actual} listo={() => setAbierto(false)} />
    </div>
  );
}
