"use client";

import { useState } from "react";
import { guardarHerramienta, guardarTipoHerramienta } from "@/lib/acciones/herramientas";
import { Campo, Formulario, Interruptor } from "@/components/admin";
import type { EstadoHerramienta } from "@/lib/db/schema";

type Tipo = { id?: number; nombre: string; categoriaId: number | null; requeridas: string; nota: string; activo: boolean };

export function EditarTipo({
  inicial,
  texto,
  clase,
  categorias,
}: {
  inicial: Tipo;
  texto: string;
  clase: string;
  categorias: Array<{ id: number; nombre: string }>;
}) {
  const [d, setD] = useState<Tipo | null>(null);
  if (!d) {
    return (
      <button type="button" className={clase} onClick={() => setD(inicial)}>
        {texto}
      </button>
    );
  }
  return (
    <div className="w-full">
      <Formulario
        titulo={d.id ? `Editar ${inicial.nombre}` : "Tipo de herramienta nuevo"}
        puedeGuardar={d.nombre.trim().length > 0 && d.requeridas !== ""}
        alGuardar={() => guardarTipoHerramienta(d)}
        cerrar={() => setD(null)}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo etiqueta="Herramienta">
              <input className="campo" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder='Amoladora 4½"' />
            </Campo>
          </div>
          <Campo etiqueta="Cuántas hacen falta" ayuda="Para que el taller cumpla con todas sus tareas.">
            <input className="campo" inputMode="numeric" value={d.requeridas} onChange={(e) => setD({ ...d, requeridas: e.target.value })} />
          </Campo>
        </div>
        <Campo etiqueta="Categoría" ayuda="La lista se edita en Configuración → Categorías de herramientas.">
          <select
            className="campo"
            value={d.categoriaId ?? ""}
            onChange={(e) => setD({ ...d, categoriaId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Nota">
          <input className="campo" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} />
        </Campo>
        {d.id && <Interruptor valor={d.activo} cambiar={(v) => setD({ ...d, activo: v })} etiqueta="Activo" />}
      </Formulario>
    </div>
  );
}

type Unidad = {
  id?: number;
  tipoId: number;
  codigo: string;
  marca: string;
  estado: EstadoHerramienta;
  ubicacion: string;
  nota: string;
};

export function EditarUnidad({
  inicial,
  texto,
  clase,
  titulo,
}: {
  inicial: Unidad;
  texto: string;
  clase: string;
  titulo: string;
}) {
  const [d, setD] = useState<Unidad | null>(null);
  if (!d) {
    return (
      <button type="button" className={clase} onClick={() => setD(inicial)}>
        {texto}
      </button>
    );
  }
  return (
    <div className="mt-2 w-full">
      <Formulario titulo={titulo} puedeGuardar alGuardar={() => guardarHerramienta(d)} cerrar={() => setD(null)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Marca / modelo">
            <input className="campo" value={d.marca} onChange={(e) => setD({ ...d, marca: e.target.value })} />
          </Campo>
          <Campo etiqueta="Código / N° interno">
            <input className="campo" value={d.codigo} onChange={(e) => setD({ ...d, codigo: e.target.value })} />
          </Campo>
          <Campo etiqueta="Estado">
            <select className="campo" value={d.estado} onChange={(e) => setD({ ...d, estado: e.target.value as EstadoHerramienta })}>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular (funciona)</option>
              <option value="en_reparacion">En reparación</option>
              <option value="baja">De baja / perdida</option>
            </select>
          </Campo>
          <Campo etiqueta="Dónde está / quién la tiene">
            <input className="campo" value={d.ubicacion} onChange={(e) => setD({ ...d, ubicacion: e.target.value })} />
          </Campo>
        </div>
        <Campo etiqueta="Nota">
          <input className="campo" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} />
        </Campo>
      </Formulario>
    </div>
  );
}
