"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarMovimiento } from "@/lib/acciones/insumos";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo } from "@/components/admin";
import { FormularioInsumo, type DatosInsumo } from "../formulario";

type Tipo = "consumo" | "ingreso" | "conteo";

const TEXTOS: Record<Tipo, { boton: string; campo: string; ayuda: string }> = {
  consumo: { boton: "− Consumo", campo: "Cantidad usada", ayuda: "Lo que se sacó del pañol." },
  ingreso: { boton: "+ Ingreso", campo: "Cantidad que entró", ayuda: "Compra o devolución." },
  conteo: {
    boton: "Conteo",
    campo: "Lo que hay físicamente",
    ayuda: "Contaste y el número no coincide: se guarda la diferencia como ajuste.",
  },
};

export function PanelMovimiento({
  insumoId,
  unidad,
  activos,
  obras,
  hoy,
}: {
  insumoId: number;
  unidad: string;
  activos: Array<{ id: number; nombre: string }>;
  obras: Array<{ id: number; titulo: string }>;
  hoy: string;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error, limpiar } = useAccion();
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [destino, setDestino] = useState("");
  const [precio, setPrecio] = useState("");
  const [nota, setNota] = useState("");
  const [listo, setListo] = useState<string | null>(null);

  function reiniciar() {
    setTipo(null);
    setCantidad("");
    setDestino("");
    setPrecio("");
    setNota("");
    limpiar();
  }

  if (!tipo) {
    return (
      <div className="space-y-2">
        {listo && <Aviso tono="exito">{listo}</Aviso>}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TEXTOS) as Tipo[]).map((t) => (
            <button
              key={t}
              type="button"
              className={t === "consumo" ? "boton-primario" : "boton-secundario"}
              onClick={() => {
                setListo(null);
                setTipo(t);
              }}
            >
              {TEXTOS[t].boton}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const [clase, idDestino] = destino.split(":");
  return (
    <div className="tarjeta space-y-3 p-4">
      <p className="font-bold">{TEXTOS[tipo].boton.replace(/^[+−] /, "")}</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={`${TEXTOS[tipo].campo} (${unidad})`} ayuda={TEXTOS[tipo].ayuda}>
          <input className="campo" inputMode="decimal" autoFocus value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input className="campo" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
      </div>
      {tipo === "consumo" && (
        <Campo etiqueta="¿Para qué fue? (opcional)" ayuda="Así después se sabe cuánto consume cada equipo u obra.">
          <select className="campo" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Uso general del taller</option>
            <optgroup label="Máquinas y vehículos">
              {activos.map((a) => (
                <option key={a.id} value={`a:${a.id}`}>
                  {a.nombre}
                </option>
              ))}
            </optgroup>
            {obras.length > 0 && (
              <optgroup label="Obras">
                {obras.map((o) => (
                  <option key={o.id} value={`o:${o.id}`}>
                    {o.titulo}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Campo>
      )}
      {tipo === "ingreso" && (
        <Campo etiqueta="Precio unitario en $ (opcional)" ayuda="Con la fecha alcanza: los informes lo pasan a dólares.">
          <input className="campo" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </Campo>
      )}
      <Campo etiqueta="Nota (opcional)">
        <input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-secundario" onClick={reiniciar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || cantidad === ""}
          onClick={() =>
            void ejecutar(
              () =>
                registrarMovimiento({
                  insumoId,
                  tipo,
                  cantidad,
                  fecha,
                  activoId: clase === "a" ? Number(idDestino) : null,
                  obraId: clase === "o" ? Number(idDestino) : null,
                  precioUnitario: precio,
                  nota,
                }),
              () => {
                setListo("Guardado.");
                reiniciar();
                router.refresh();
              },
            )
          }
        >
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export function EditarInsumo({
  datos,
  categorias,
}: {
  datos: DatosInsumo;
  categorias: Array<{ id: number; nombre: string }>;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" className="boton-secundario text-sm" onClick={() => setAbierto(true)}>
        Editar
      </button>
    );
  }
  return (
    <div className="w-full">
      <FormularioInsumo inicial={datos} categorias={categorias} cerrar={() => setAbierto(false)} />
    </div>
  );
}
