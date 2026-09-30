"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarInsumo } from "@/lib/acciones/insumos";
import { Campo, Formulario, Interruptor } from "@/components/admin";
import { Semaforo } from "@/components/ui";
import { nivelDeStock, validarUmbrales } from "@/lib/semaforo";

export type DatosInsumo = {
  id?: number;
  codigo: string;
  nombre: string;
  categoriaId: number | null;
  unidad: string;
  critico: string;
  atento: string;
  ideal: string;
  infaltable: boolean;
  ubicacion: string;
  proveedor: string;
  nota: string;
  activo: boolean;
  stockInicial?: string;
};

export const INSUMO_VACIO: DatosInsumo = {
  codigo: "",
  nombre: "",
  categoriaId: null,
  unidad: "unidad",
  critico: "",
  atento: "",
  ideal: "",
  infaltable: false,
  ubicacion: "",
  proveedor: "",
  nota: "",
  activo: true,
  stockInicial: "",
};

const UNIDADES = ["unidad", "m", "kg", "l", "caja", "rollo", "par", "juego", "barra", "hoja"];

export function FormularioInsumo({
  inicial,
  categorias,
  cerrar,
}: {
  inicial: DatosInsumo;
  categorias: Array<{ id: number; nombre: string }>;
  cerrar: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState(inicial);
  const set = <K extends keyof DatosInsumo>(k: K, v: DatosInsumo[K]) => setD({ ...d, [k]: v });

  const c = Number(d.critico);
  const a = Number(d.atento);
  const i = Number(d.ideal);
  const completos = d.critico !== "" && d.atento !== "" && d.ideal !== "";
  const errorUmbral = completos ? validarUmbrales(c, a, i) : null;

  return (
    <Formulario
      titulo={d.id ? `Editar ${inicial.nombre}` : "Insumo nuevo"}
      puedeGuardar={d.nombre.trim().length > 0 && completos && !errorUmbral}
      alGuardar={() =>
        guardarInsumo({ ...d, stockInicial: d.stockInicial ?? null }).then((r) => {
          if (r.ok && !d.id) router.push(`/insumos/${r.datos.id}`);
          return r;
        })
      }
      cerrar={cerrar}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Campo etiqueta="Nombre">
            <input className="campo" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Caño estructural 40x40x1,6" />
          </Campo>
        </div>
        <Campo etiqueta="Código (opcional)">
          <input className="campo" value={d.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="CE-4040" />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Categoría">
          <select
            className="campo"
            value={d.categoriaId ?? ""}
            onChange={(e) => set("categoriaId", e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Se cuenta en">
          <input className="campo" list="unidades" value={d.unidad} onChange={(e) => set("unidad", e.target.value)} />
          <datalist id="unidades">
            {UNIDADES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Ubicación en el pañol">
          <input className="campo" value={d.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} placeholder="Estante 3" />
        </Campo>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="mb-2 text-sm font-semibold text-slate-700">Semáforo</p>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="🔴 Crítico hasta">
            <input className="campo" inputMode="decimal" value={d.critico} onChange={(e) => set("critico", e.target.value)} placeholder="5" />
          </Campo>
          <Campo etiqueta="🟡 Atento hasta">
            <input className="campo" inputMode="decimal" value={d.atento} onChange={(e) => set("atento", e.target.value)} placeholder="10" />
          </Campo>
          <Campo etiqueta="Ideal (reponer hasta)">
            <input className="campo" inputMode="decimal" value={d.ideal} onChange={(e) => set("ideal", e.target.value)} placeholder="20" />
          </Campo>
        </div>
        {completos && !errorUmbral && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Semaforo nivel={nivelDeStock(c, c, a)} /> hasta {c} ·
            <Semaforo nivel={nivelDeStock(c + 0.01, c, a)} /> de {c} a {a} ·
            <Semaforo nivel="verde" /> más de {a}. Al comprar se repone hasta {i}.
          </p>
        )}
        {errorUmbral && <p className="mt-2 text-xs font-semibold text-red-700">{errorUmbral}</p>}
      </div>

      {!d.id && (
        <Campo etiqueta="Stock actual" ayuda="Lo que hay hoy en el pañol. Entra como un conteo inicial.">
          <input className="campo" inputMode="decimal" value={d.stockInicial ?? ""} onChange={(e) => set("stockInicial", e.target.value)} placeholder="0" />
        </Campo>
      )}

      <Campo etiqueta="Proveedor habitual">
        <input className="campo" value={d.proveedor} onChange={(e) => set("proveedor", e.target.value)} />
      </Campo>
      <Campo etiqueta="Nota">
        <textarea className="campo" rows={2} value={d.nota} onChange={(e) => set("nota", e.target.value)} />
      </Campo>

      <Interruptor
        valor={d.infaltable}
        cambiar={(v) => set("infaltable", v)}
        etiqueta="Infaltable de taller"
        ayuda="Lo que no puede faltar nunca (discos de corte de 4½, electrodos…). Sale primero en el tablero y en la compra."
      />
      {d.id && (
        <Interruptor
          valor={d.activo}
          cambiar={(v) => set("activo", v)}
          etiqueta="Activo"
          ayuda="Un insumo que ya no se usa se desactiva: deja de aparecer, pero su historial queda."
        />
      )}
    </Formulario>
  );
}

export function BotonNuevoInsumo({ categorias }: { categorias: Array<{ id: number; nombre: string }> }) {
  const [abierto, setAbierto] = useState(false);
  if (abierto) {
    return (
      <div className="mb-4 w-full">
        <FormularioInsumo inicial={INSUMO_VACIO} categorias={categorias} cerrar={() => setAbierto(false)} />
      </div>
    );
  }
  return (
    <button type="button" className="boton-primario" onClick={() => setAbierto(true)}>
      + Insumo
    </button>
  );
}
