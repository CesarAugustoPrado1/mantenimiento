"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarActivo } from "@/lib/acciones/activos";
import { useAccion } from "./usar-accion";
import { Aviso } from "./ui";
import { Campo } from "./admin";
import type { Caracteristica, ClaseActivo, Combustible, EstadoActivo, Medidor, Propiedad } from "@/lib/db/schema";

export type DatosActivo = {
  id?: number;
  clase: ClaseActivo;
  tipo: string;
  nombre: string;
  codigo: string;
  marca: string;
  modelo: string;
  anio: string;
  numeroSerie: string;
  patente: string;
  ubicacion: string;
  propiedad: Propiedad;
  responsableId: number | null;
  medidor: Medidor;
  combustible: Combustible | null;
  estado: EstadoActivo;
  caracteristicas: Caracteristica[];
  nota: string;
};

const TIPOS: Record<ClaseActivo, string[]> = {
  maquina: ["Prensa", "Mezcladora", "Compresor", "Cinta transportadora", "Bomba", "Soldadora", "Generador", "Puente grúa"],
  vehiculo: ["Autoelevador", "Camioneta", "Auto", "Camión", "Utilitario", "Moto"],
};

/** Sugerencias para arrancar la ficha: se pueden borrar o cambiar. */
const SUGERIDAS: Record<ClaseActivo, string[]> = {
  maquina: ["Potencia", "Tensión", "Capacidad", "Aceite / lubricante", "Proveedor / service"],
  vehiculo: ["Motor", "Combustible", "Aceite de motor", "Filtro de aceite", "Filtro de aire", "Medida de cubiertas", "Seguro / póliza", "Vencimiento VTV"],
};

export function FormularioActivo({
  inicial,
  usuarios,
}: {
  inicial: DatosActivo;
  usuarios: Array<{ id: number; nombre: string }>;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState<DatosActivo>(
    inicial.id || inicial.caracteristicas.length
      ? inicial
      : { ...inicial, caracteristicas: SUGERIDAS[inicial.clase].map((clave) => ({ clave, valor: "" })) },
  );
  const set = <K extends keyof DatosActivo>(k: K, v: DatosActivo[K]) => setD({ ...d, [k]: v });
  const esVehiculo = d.clase === "vehiculo";

  function cambiarCaracteristica(i: number, campo: keyof Caracteristica, valor: string) {
    const lista = d.caracteristicas.slice();
    lista[i] = { ...lista[i], [campo]: valor };
    set("caracteristicas", lista);
  }

  return (
    <div className="tarjeta space-y-4 p-5">
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" ayuda={esVehiculo ? "Como lo llaman en la empresa: «Hilux blanca», «Clark 2»." : "Como la llaman en planta."}>
          <input className="campo" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </Campo>
        <Campo etiqueta="Tipo">
          <input className="campo" list="tipos" value={d.tipo} onChange={(e) => set("tipo", e.target.value)} />
          <datalist id="tipos">
            {TIPOS[d.clase].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo etiqueta="Marca">
          <input className="campo" value={d.marca} onChange={(e) => set("marca", e.target.value)} />
        </Campo>
        <Campo etiqueta="Modelo">
          <input className="campo" value={d.modelo} onChange={(e) => set("modelo", e.target.value)} />
        </Campo>
        <Campo etiqueta="Año">
          <input className="campo" inputMode="numeric" value={d.anio} onChange={(e) => set("anio", e.target.value)} />
        </Campo>
        {esVehiculo ? (
          <Campo etiqueta="Patente">
            <input className="campo uppercase" value={d.patente} onChange={(e) => set("patente", e.target.value)} />
          </Campo>
        ) : (
          <Campo etiqueta="Código interno">
            <input className="campo" value={d.codigo} onChange={(e) => set("codigo", e.target.value)} />
          </Campo>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="N° de serie / chasis">
          <input className="campo" value={d.numeroSerie} onChange={(e) => set("numeroSerie", e.target.value)} />
        </Campo>
        <Campo etiqueta={esVehiculo ? "Base / dónde se guarda" : "Ubicación / sector"}>
          <input className="campo" value={d.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} />
        </Campo>
        <Campo etiqueta="Se mide en" ayuda="De esto depende que los planes puedan ir por km u horas.">
          <select className="campo" value={d.medidor} onChange={(e) => set("medidor", e.target.value as Medidor)}>
            <option value="ninguno">No lleva medidor</option>
            <option value="km">Kilómetros</option>
            <option value="horas">Horas (horómetro)</option>
          </select>
        </Campo>
      </div>
      <Campo
        etiqueta="Combustible"
        ayuda="Si carga combustible, cada carga se registra y la app calcula el consumo por hora (o por km)."
      >
        <select
          className="campo"
          value={d.combustible ?? ""}
          onChange={(e) => set("combustible", (e.target.value || null) as Combustible | null)}
        >
          <option value="">No se registra</option>
          <option value="diesel">Diésel / gasoil</option>
          <option value="nafta">Nafta</option>
          <option value="gnc">GNC</option>
          <option value="electrico">Eléctrico</option>
        </select>
      </Campo>
      <div className="grid gap-3 sm:grid-cols-3">
        {esVehiculo && (
          <Campo etiqueta="Es de">
            <select className="campo" value={d.propiedad} onChange={(e) => set("propiedad", e.target.value as Propiedad)}>
              <option value="empresa">La empresa</option>
              <option value="empleado">Un empleado</option>
            </select>
          </Campo>
        )}
        <Campo
          etiqueta={esVehiculo ? (d.propiedad === "empleado" ? "Dueño" : "Conductor habitual") : "Responsable"}
          ayuda={esVehiculo ? "Es quien puede cargar el km desde su celular." : undefined}
        >
          <select
            className="campo"
            value={d.responsableId ?? ""}
            onChange={(e) => set("responsableId", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Nadie</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Estado">
          <select className="campo" value={d.estado} onChange={(e) => set("estado", e.target.value as EstadoActivo)}>
            <option value="operativo">Operativo</option>
            <option value="con_falla">Con falla (funciona)</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
            <option value="baja">Dado de baja</option>
          </select>
        </Campo>
      </div>

      <div>
        <p className="etiqueta">Características</p>
        <div className="space-y-2">
          {d.caracteristicas.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input className="campo w-2/5" value={c.clave} placeholder="Dato" onChange={(e) => cambiarCaracteristica(i, "clave", e.target.value)} />
              <input className="campo flex-1" value={c.valor} placeholder="Valor" onChange={(e) => cambiarCaracteristica(i, "valor", e.target.value)} />
              <button
                type="button"
                className="px-2 text-slate-400 hover:text-red-600"
                aria-label="Quitar"
                onClick={() => set("caracteristicas", d.caracteristicas.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-slate-600 underline"
          onClick={() => set("caracteristicas", [...d.caracteristicas, { clave: "", valor: "" }])}
        >
          + Agregar dato
        </button>
        <p className="mt-1 text-xs text-slate-500">Los renglones sin valor no se guardan.</p>
      </div>

      <Campo etiqueta="Nota">
        <textarea className="campo" rows={3} value={d.nota} onChange={(e) => set("nota", e.target.value)} />
      </Campo>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="boton-secundario" onClick={() => router.back()}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={enviando || !d.nombre.trim() || !d.tipo.trim()}
          onClick={() =>
            void ejecutar(
              () => guardarActivo({ ...d, anio: d.anio }),
              (r) => {
                router.push(`/activos/${r.id}`);
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
