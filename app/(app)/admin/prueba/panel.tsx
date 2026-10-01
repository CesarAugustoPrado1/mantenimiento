"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { borrarDatosDePrueba, terminarEtapaDePrueba } from "@/lib/acciones/prueba";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { CONFIRMACION } from "@/lib/datos-prueba";

export function PanelPrueba() {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [texto, setTexto] = useState("");
  const [listo, setListo] = useState<string | null>(null);
  const confirmado = texto.trim().toUpperCase() === CONFIRMACION;

  return (
    <div className="tarjeta space-y-4 p-5">
      {error && <Aviso>{error}</Aviso>}
      {listo && <Aviso tono="exito">{listo}</Aviso>}
      <label className="block">
        <span className="etiqueta">Para habilitar los botones, escribí {CONFIRMACION}</span>
        <input className="campo max-w-xs uppercase" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl p-4 ring-1 ring-slate-200">
          <p className="font-bold">Borrar los datos y seguir probando</p>
          <p className="mt-1 mb-3 text-sm text-slate-600">Deja la app vacía, igual que recién instalada, y sigue en etapa de prueba.</p>
          <button
            type="button"
            className="boton-peligro w-full"
            disabled={!confirmado || enviando}
            onClick={() =>
              void ejecutar(() => borrarDatosDePrueba({ confirmacion: texto }), () => {
                setTexto("");
                setListo("Listo: se borró todo. Podés volver a cargar.");
                router.refresh();
              })
            }
          >
            {enviando ? "Borrando…" : "Borrar todo"}
          </button>
        </div>
        <div className="rounded-xl p-4 ring-1 ring-slate-200">
          <p className="font-bold">Terminar la etapa de prueba</p>
          <p className="mt-1 mb-3 text-sm text-slate-600">
            Borra todo y apaga el modo prueba. A partir de ahí lo que se cargue es real y este borrado deja de existir.
          </p>
          <button
            type="button"
            className="boton-peligro w-full"
            disabled={!confirmado || enviando}
            onClick={() =>
              void ejecutar(() => terminarEtapaDePrueba({ confirmacion: texto }), () => {
                router.push("/admin");
                router.refresh();
              })
            }
          >
            {enviando ? "Borrando…" : "Borrar todo y empezar en serio"}
          </button>
        </div>
      </div>
    </div>
  );
}
