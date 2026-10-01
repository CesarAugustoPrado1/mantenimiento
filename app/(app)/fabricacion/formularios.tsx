"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarOrden, guardarProducto, registrarParte } from "@/lib/acciones/fabricacion";
import { useAccion } from "@/components/usar-accion";
import { Aviso } from "@/components/ui";
import { Campo, Formulario, Interruptor } from "@/components/admin";

/* -------------------------------------------------------------------------- */
/* Producto                                                                   */
/* -------------------------------------------------------------------------- */

export type DatosProducto = {
  id?: number;
  nombre: string;
  modelo: string;
  descripcion: string;
  horasEstandar: string;
  activo: boolean;
  materiales: Array<{ insumoId: number | null; descripcion: string; cantidad: string }>;
};

export function BotonProducto({
  inicial,
  insumos,
  texto,
  clase = "boton-primario",
}: {
  inicial: DatosProducto;
  insumos: Array<{ id: number; nombre: string; unidad: string }>;
  texto: string;
  clase?: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<DatosProducto | null>(null);
  if (!d) {
    return (
      <button type="button" className={clase} onClick={() => setD(structuredClone(inicial))}>
        {texto}
      </button>
    );
  }
  const set = <K extends keyof DatosProducto>(k: K, v: DatosProducto[K]) => setD({ ...d, [k]: v });
  const setMat = (i: number, m: Partial<DatosProducto["materiales"][number]>) =>
    set("materiales", d.materiales.map((x, j) => (j === i ? { ...x, ...m } : x)));
  return (
    <div className="mt-2 w-full">
      <Formulario
        titulo={d.id ? `Editar: ${inicial.nombre}` : "Producto nuevo"}
        puedeGuardar={d.nombre.trim().length > 0}
        alGuardar={() =>
          guardarProducto({
            ...d,
            materiales: d.materiales.map((m) => ({ insumoId: m.insumoId, descripcion: m.descripcion || null, cantidad: m.cantidad })),
          }).then((r) => {
            if (r.ok && !d.id) router.push(`/fabricacion/productos/${r.datos.id}`);
            return r;
          })
        }
        cerrar={() => setD(null)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Producto">
            <input className="campo" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Esqueleto para molde" />
          </Campo>
          <Campo etiqueta="Para qué modelo o uso">
            <input className="campo" value={d.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Laja 40x40" />
          </Campo>
        </div>
        <Campo etiqueta="Descripción">
          <textarea className="campo" rows={2} value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
        </Campo>
        <Campo etiqueta="Horas hombre por unidad (estándar)" ayuda="Lo que debería llevar hacer una. Contra esto se mide lo que tarda de verdad.">
          <input className="campo max-w-40" inputMode="decimal" value={d.horasEstandar} onChange={(e) => set("horasEstandar", e.target.value)} />
        </Campo>
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-700">Receta: qué lleva cada unidad</p>
          <p className="text-xs text-slate-500">Si es del pañol, al registrar la producción se puede descontar solo.</p>
          {d.materiales.map((m, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <select className="campo min-w-48 flex-1" value={m.insumoId ?? ""} onChange={(e) => setMat(i, { insumoId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Otra cosa (escribila)</option>
                {insumos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre} ({x.unidad})
                  </option>
                ))}
              </select>
              {m.insumoId == null && (
                <input className="campo min-w-40 flex-1" value={m.descripcion} onChange={(e) => setMat(i, { descripcion: e.target.value })} placeholder="Chapa 2 mm cortada" />
              )}
              <input className="campo w-24" inputMode="decimal" value={m.cantidad} onChange={(e) => setMat(i, { cantidad: e.target.value })} />
              <button type="button" className="px-2 text-slate-400 hover:text-red-600" aria-label="Quitar" onClick={() => set("materiales", d.materiales.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-sm font-semibold text-slate-600 underline"
            onClick={() => set("materiales", [...d.materiales, { insumoId: null, descripcion: "", cantidad: "1" }])}
          >
            + Material
          </button>
        </div>
        {d.id && <Interruptor valor={d.activo} cambiar={(v) => set("activo", v)} etiqueta="Activo" ayuda="Un producto que ya no se hace se desactiva: su historial queda." />}
      </Formulario>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Orden                                                                      */
/* -------------------------------------------------------------------------- */

export type DatosOrden = {
  id?: number;
  productoId: number | null;
  cantidad: string;
  destino: string;
  prioridad: "baja" | "media" | "alta" | "urgente";
  inicioPlan: string;
  finPlan: string;
  responsableId: number | null;
  responsableExterno: string;
  nota: string;
  cancelada: boolean;
};

export function BotonOrden({
  inicial,
  productos,
  usuarios,
  texto,
  clase = "boton-primario",
}: {
  inicial: DatosOrden;
  productos: Array<{ id: number; nombre: string; modelo: string | null }>;
  usuarios: Array<{ id: number; nombre: string }>;
  texto: string;
  clase?: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<DatosOrden | null>(null);
  if (!d) {
    return (
      <button type="button" className={clase} onClick={() => setD(inicial)}>
        {texto}
      </button>
    );
  }
  const set = <K extends keyof DatosOrden>(k: K, v: DatosOrden[K]) => setD({ ...d, [k]: v });
  return (
    <div className="mt-2 w-full">
      <Formulario
        titulo={d.id ? "Editar orden" : "Orden de fabricación"}
        puedeGuardar={!!d.productoId && Number(d.cantidad) >= 1}
        alGuardar={() =>
          guardarOrden({ ...d, productoId: d.productoId! }).then((r) => {
            if (r.ok && !d.id) router.push(`/fabricacion/ordenes/${r.datos.id}`);
            return r;
          })
        }
        cerrar={() => setD(null)}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Campo etiqueta="Qué hay que hacer">
              <select className="campo" value={d.productoId ?? ""} onChange={(e) => set("productoId", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Elegí el producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.modelo ? ` — ${p.modelo}` : ""}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Cantidad">
            <input className="campo" inputMode="numeric" value={d.cantidad} onChange={(e) => set("cantidad", e.target.value)} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Para quién / para qué">
            <input className="campo" value={d.destino} onChange={(e) => set("destino", e.target.value)} placeholder="Línea Piedra, reposición de rotos" />
          </Campo>
          <Campo etiqueta="Prioridad">
            <select className="campo" value={d.prioridad} onChange={(e) => set("prioridad", e.target.value as DatosOrden["prioridad"])}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </Campo>
        </div>
        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-2">
          <Campo etiqueta="Comprometido: empieza">
            <input className="campo" type="date" value={d.inicioPlan} onChange={(e) => set("inicioPlan", e.target.value)} />
          </Campo>
          <Campo etiqueta="Comprometido: tiene que estar">
            <input className="campo" type="date" value={d.finPlan} onChange={(e) => set("finPlan", e.target.value)} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Responsable">
            <select className="campo" value={d.responsableId ?? ""} onChange={(e) => set("responsableId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="…o externo">
            <input className="campo" value={d.responsableExterno} onChange={(e) => set("responsableExterno", e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Nota">
          <input className="campo" value={d.nota} onChange={(e) => set("nota", e.target.value)} />
        </Campo>
        {d.id && <Interruptor valor={d.cancelada} cambiar={(v) => set("cancelada", v)} etiqueta="Cancelada" ayuda="Se deja de hacer. Lo producido queda registrado." />}
      </Formulario>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Parte de producción                                                        */
/* -------------------------------------------------------------------------- */

export function NuevoParte({
  ordenId,
  hoy,
  yo,
  usuarios,
  faltan,
  hayReceta,
}: {
  ordenId: number;
  hoy: string;
  yo: number;
  usuarios: Array<{ id: number; nombre: string }>;
  faltan: number;
  hayReceta: boolean;
}) {
  const router = useRouter();
  const { ejecutar, enviando, error } = useAccion();
  const [d, setD] = useState({ fecha: hoy, unidades: "", horas: "", quien: yo, nota: "", descontar: hayReceta });
  const [listo, setListo] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {error && <Aviso>{error}</Aviso>}
      {listo && <Aviso tono="exito">{listo}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo etiqueta="Fecha">
          <input className="campo" type="date" max={hoy} value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} />
        </Campo>
        <Campo etiqueta={`Unidades terminadas`} ayuda={`Faltan ${faltan}. 0 si se avanzó sin terminar ninguna.`}>
          <input className="campo" inputMode="numeric" value={d.unidades} onChange={(e) => setD({ ...d, unidades: e.target.value })} />
        </Campo>
        <Campo etiqueta="Horas hombre">
          <input className="campo" inputMode="decimal" value={d.horas} onChange={(e) => setD({ ...d, horas: e.target.value })} />
        </Campo>
        <Campo etiqueta="Lo hizo">
          <select className="campo" value={d.quien} onChange={(e) => setD({ ...d, quien: Number(e.target.value) })}>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Nota (opcional)">
        <input className="campo" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} />
      </Campo>
      {hayReceta && (
        <Interruptor
          valor={d.descontar}
          cambiar={(v) => setD({ ...d, descontar: v })}
          etiqueta="Descontar los materiales del pañol según la receta"
          ayuda="Por las unidades terminadas. Si se usaron otras cantidades, sacalo y cargá el consumo desde cada insumo."
        />
      )}
      <button
        type="button"
        className="boton-primario w-full"
        disabled={enviando || (d.unidades === "" && d.horas === "")}
        onClick={() =>
          void ejecutar(
            () =>
              registrarParte({
                ordenId,
                fecha: d.fecha,
                unidades: d.unidades === "" ? 0 : d.unidades,
                horasHombre: d.horas,
                realizadoPorId: d.quien,
                nota: d.nota,
                descontarMateriales: d.descontar,
              }),
            () => {
              setListo(`Parte guardado: ${d.unidades || 0} unidad(es).`);
              setD({ ...d, unidades: "", horas: "", nota: "" });
              router.refresh();
            },
          )
        }
      >
        {enviando ? "Guardando…" : "Registrar producción"}
      </button>
    </div>
  );
}
