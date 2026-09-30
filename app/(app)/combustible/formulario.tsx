"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarCarga } from "@/lib/acciones/combustible";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";

type Equipo = { id: number; nombre: string; medidor: "km" | "horas" | "ninguno"; combustible: string; ultima: number | null };

export function CargarCombustible({
  equipos,
  insumos,
  hoy,
  inicial,
}: {
  equipos: Equipo[];
  insumos: Array<{ id: number; nombre: string; stock: number; unidad: string }>;
  hoy: string;
  inicial: number | null;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error, limpiar } = useAccion();
  const [activoId, setActivoId] = useState<number | null>(inicial ?? (equipos.length === 1 ? equipos[0].id : null));
  const [litros, setLitros] = useState("");
  const [lectura, setLectura] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [precio, setPrecio] = useState("");
  const [insumoId, setInsumoId] = useState<number | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const eq = equipos.find((e) => e.id === activoId);
  const u = eq?.medidor === "km" ? "km" : "horas";

  return (
    <div className="tarjeta space-y-3 p-5">
      <p className="font-bold">⛽ Registrar carga</p>
      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tono="exito">{ok}</Aviso>}
      <Campo etiqueta="Equipo">
        <select
          className="campo"
          value={activoId ?? ""}
          onChange={(e) => {
            setActivoId(e.target.value ? Number(e.target.value) : null);
            setOk(null);
            limpiar();
          }}
        >
          <option value="">Elegí el equipo</option>
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre} · {e.combustible}
            </option>
          ))}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Litros">
          <input className="campo" inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="20" />
        </Campo>
        {eq && eq.medidor !== "ninguno" && (
          <Campo etiqueta={u === "horas" ? "Horas del horómetro" : "Kilometraje"} ayuda={eq.ultima != null ? `Última: ${eq.ultima.toLocaleString("es-AR")}` : undefined}>
            <input className="campo" inputMode="decimal" value={lectura} onChange={(e) => setLectura(e.target.value)} />
          </Campo>
        )}
        <Campo etiqueta="Fecha">
          <input className="campo" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="$ por litro (opcional)">
          <input className="campo" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </Campo>
      </div>
      {insumos.length > 0 && (
        <Campo etiqueta="¿Sale del pañol?" ayuda="Si el bidón se llenó del tambor de la empresa, se descuenta de ese stock.">
          <select className="campo" value={insumoId ?? ""} onChange={(e) => setInsumoId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">No (estación de servicio u otro)</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} (hay {i.stock} {i.unidad})
              </option>
            ))}
          </select>
        </Campo>
      )}
      <button
        type="button"
        className="boton-primario w-full"
        disabled={enviando || !activoId || !litros}
        onClick={() =>
          void ejecutar(
            () =>
              registrarCarga({
                activoId: activoId!,
                fecha,
                litros,
                lectura: eq?.medidor === "ninguno" ? null : lectura,
                precioLitro: precio,
                insumoId,
                nota: null,
              }),
            () => {
              setOk(`Guardado: ${litros} L en ${eq?.nombre}.`);
              setLitros("");
              setLectura("");
              router.refresh();
            },
          )
        }
      >
        {enviando ? "Guardando…" : "Guardar carga"}
      </button>
    </div>
  );
}
