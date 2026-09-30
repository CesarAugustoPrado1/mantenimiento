"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearCompra } from "@/lib/acciones/compras";
import { Campo, Formulario, Interruptor } from "@/components/admin";

export function NuevaCompra({ hoy, sugerido }: { hoy: string; sugerido: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(sugerido);
  const [fecha, setFecha] = useState(hoy);
  const [semaforo, setSemaforo] = useState(true);
  const [infaltables, setInfaltables] = useState(false);

  if (!abierto) {
    return (
      <button type="button" className="boton-primario" onClick={() => setAbierto(true)}>
        + Compra
      </button>
    );
  }
  return (
    <div className="w-full">
      <Formulario
        titulo="Compra nueva"
        textoBoton="Armar compra"
        puedeGuardar={titulo.trim().length >= 3}
        alGuardar={() =>
          crearCompra({ titulo, fecha, desdeSemaforo: semaforo, soloInfaltables: infaltables }).then((r) => {
            if (r.ok) router.push(`/compras/${r.datos.id}`);
            return r;
          })
        }
        cerrar={() => setAbierto(false)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Título">
            <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo etiqueta="Fecha">
            <input className="campo" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
        </div>
        <Interruptor
          valor={semaforo}
          cambiar={setSemaforo}
          etiqueta="Precargar desde el semáforo"
          ayuda="Todo lo que está en rojo o amarillo, con la cantidad para volver al ideal. Después se ajusta a mano."
        />
        {semaforo && <Interruptor valor={infaltables} cambiar={setInfaltables} etiqueta="Solo los infaltables" />}
      </Formulario>
    </div>
  );
}
