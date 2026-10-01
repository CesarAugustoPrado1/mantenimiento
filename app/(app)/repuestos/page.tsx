import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { nombreActivo, repuestos as leerRepuestos, type FilaRepuesto } from "@/lib/consultas";
import { fmtNum } from "@/lib/formato";
import { nivelDeStock, type Nivel } from "@/lib/semaforo";
import { Chip, ChipCriticidad, Pestanas, Semaforo, Titulo, Vacio } from "@/components/ui";

export const metadata = { title: "Repuestos · Taller" };
export const dynamic = "force-dynamic";

const PESO_CRITICIDAD = { alta: 0, media: 1, baja: 2 } as const;
const PESO_NIVEL: Record<Nivel, number> = { rojo: 0, amarillo: 1, verde: 2 };

type Repuesto = {
  insumo_id: number;
  nombre: string;
  codigo: string | null;
  unidad: string;
  stock: number;
  ideal: number;
  nivel: Nivel;
  tiempo: number | null;
  proveedor: string | null;
  criticidad: FilaRepuesto["criticidad"];
  usos: FilaRepuesto[];
};

/**
 * Los repuestos de todas las máquinas, ordenados por riesgo: primero los que
 * no hay, que paran la producción y tardan más en conseguirse.
 */
export default async function Repuestos({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  await requerirSesion();
  const { ver = "riesgo" } = await searchParams;
  const filas = await leerRepuestos();

  const porInsumo = new Map<number, Repuesto>();
  for (const f of filas) {
    const r = porInsumo.get(f.insumo_id);
    if (r) {
      r.usos.push(f);
      if (PESO_CRITICIDAD[f.criticidad] < PESO_CRITICIDAD[r.criticidad]) r.criticidad = f.criticidad;
    } else {
      porInsumo.set(f.insumo_id, {
        insumo_id: f.insumo_id,
        nombre: f.nombre,
        codigo: f.codigo,
        unidad: f.unidad,
        stock: f.stock,
        ideal: f.ideal,
        nivel: nivelDeStock(f.stock, f.critico, f.atento),
        tiempo: f.tiempo_reposicion_dias,
        proveedor: f.proveedor,
        criticidad: f.criticidad,
        usos: [f],
      });
    }
  }
  const todos = [...porInsumo.values()].sort(
    (a, b) =>
      PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel] ||
      PESO_CRITICIDAD[a.criticidad] - PESO_CRITICIDAD[b.criticidad] ||
      (b.tiempo ?? 0) - (a.tiempo ?? 0),
  );
  const enRiesgo = todos.filter((r) => r.nivel !== "verde");
  const lista = ver === "todos" ? todos : enRiesgo;
  const criticosSinStock = todos.filter((r) => r.nivel === "rojo" && r.criticidad === "alta");

  return (
    <>
      <Titulo detalle="Lo que conviene tener para que una rotura no pare la producción días enteros. Se cargan desde la ficha de cada máquina.">
        Repuestos críticos
      </Titulo>

      {criticosSinStock.length > 0 && (
        <div className="mb-4 rounded-xl bg-rojo-suave p-4 text-sm ring-1 ring-rojo/30">
          <p className="font-bold text-rojo">
            {criticosSinStock.length} repuesto{criticosSinStock.length === 1 ? "" : "s"} de criticidad alta sin stock
          </p>
          <p className="mt-0.5 text-slate-700">
            Si se rompen hoy, la máquina queda parada{" "}
            {Math.max(...criticosSinStock.map((r) => r.tiempo ?? 0)) > 0
              ? `hasta ${Math.max(...criticosSinStock.map((r) => r.tiempo ?? 0))} días`
              : "hasta conseguirlos"}
            . Entran solos en la próxima compra armada desde el semáforo.
          </p>
        </div>
      )}

      <Pestanas
        actual={ver}
        opciones={[
          { valor: "riesgo", etiqueta: `Faltan · ${enRiesgo.length}`, href: "/repuestos" },
          { valor: "todos", etiqueta: `Todos · ${todos.length}`, href: "/repuestos?ver=todos" },
        ]}
      />

      {lista.length === 0 ? (
        <Vacio>
          {todos.length === 0
            ? "Todavía no hay repuestos cargados. Entrá a la ficha de una máquina y usá «+ Repuesto»."
            : "No falta ninguno: todos los repuestos están en el mínimo o por encima. 👌"}
        </Vacio>
      ) : (
        <ul className="space-y-2">
          {lista.map((r) => (
            <li key={r.insumo_id} className={`tarjeta p-4 ${r.nivel === "rojo" && r.criticidad === "alta" ? "ring-2 ring-rojo" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/insumos/${r.insumo_id}`} className="font-bold hover:underline">
                    {r.nombre}
                  </Link>
                  {r.codigo && <span className="codigo ml-1.5 text-xs text-slate-500">{r.codigo}</span>}
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                    {r.usos.map((u) => (
                      <li key={u.vinculo_id}>
                        <Link href={`/activos/${u.activo_id}`} className="hover:underline">
                          {nombreActivo({ nombre: u.activo, codigo: u.activo_codigo, patente: u.activo_patente })}
                        </Link>
                        {u.donde_va && <span className="text-slate-500"> · {u.donde_va}</span>}
                        {r.usos.length > 1 && <span className="text-xs text-slate-400"> ({u.criticidad})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-sm">
                    hay <span className="cifra text-base">{fmtNum(r.stock)}</span> de {fmtNum(r.ideal)} {r.unidad}
                  </span>
                  <Semaforo nivel={r.nivel} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ChipCriticidad criticidad={r.criticidad} />
                {r.tiempo != null && <Chip tono={r.nivel === "rojo" ? "rojo" : "gris"}>reposición {r.tiempo} días</Chip>}
                {r.proveedor && <Chip>{r.proveedor}</Chip>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
