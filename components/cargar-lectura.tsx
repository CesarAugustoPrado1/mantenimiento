"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cargarLectura } from "@/lib/acciones/activos";
import { useAccion } from "./usar-accion";
import { Aviso } from "./ui";

/** Cargar km u horas en dos toques: el número y guardar. La fecha viene puesta. */
export function CargarLectura({
  activoId,
  unidad,
  hoy,
  ultima,
}: {
  activoId: number;
  unidad: string;
  hoy: string;
  ultima: number | null;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error, limpiar } = useAccion();
  const [valor, setValor] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [ok, setOk] = useState(false);

  const n = Number(valor.replace(/\./g, "").replace(",", "."));
  const salto = ultima != null && valor !== "" && Number.isFinite(n) ? n - ultima : null;

  return (
    <div className="space-y-2">
      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tono="exito">Guardado.</Aviso>}
      <div className="flex flex-wrap gap-2">
        <input
          className="campo w-40 flex-1"
          inputMode="decimal"
          placeholder={ultima != null ? `más de ${ultima}` : unidad}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setOk(false);
            limpiar();
          }}
        />
        <input className="campo w-auto" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || valor === ""}
          onClick={() =>
            void ejecutar(
              () => cargarLectura({ activoId, fecha, valor: n, nota: null }),
              () => {
                setValor("");
                setOk(true);
                router.refresh();
              },
            )
          }
        >
          {enviando ? "…" : `Guardar ${unidad}`}
        </button>
      </div>
      {salto != null && salto > 0 && (
        <p className="text-xs text-slate-500">
          +{salto.toLocaleString("es-AR")} {unidad} desde la última lectura
        </p>
      )}
    </div>
  );
}
