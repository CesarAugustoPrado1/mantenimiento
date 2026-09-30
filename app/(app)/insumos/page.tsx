import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { categorias as leerCategorias } from "@/lib/consultas";
import { CONFIGURAN } from "@/lib/permisos";
import { fmtNum } from "@/lib/formato";
import { coberturaDias, nivelDeStock, type Nivel } from "@/lib/semaforo";
import { Chip, Pestanas, Semaforo, Titulo, Vacio } from "@/components/ui";
import { BotonNuevoInsumo } from "./formulario";

export const metadata = { title: "Insumos · Taller" };
export const dynamic = "force-dynamic";

type Fila = {
  id: number;
  codigo: string | null;
  nombre: string;
  categoria: string | null;
  unidad: string;
  stock: number;
  critico: number;
  atento: number;
  ideal: number;
  infaltable: boolean;
  ubicacion: string | null;
  consumo_90: number;
};

export default async function Insumos({
  searchParams,
}: {
  searchParams: Promise<{ nivel?: string; cat?: string; q?: string; inf?: string }>;
}) {
  const sesion = await requerirSesion();
  const { nivel = "todos", cat, q, inf } = await searchParams;

  const [lista, cats] = await Promise.all([
    filas<Fila>(sql`
      select i.id, i.codigo, i.nombre, c.nombre as categoria, i.unidad, i.stock::float8 as stock,
             i.critico::float8 as critico, i.atento::float8 as atento, i.ideal::float8 as ideal,
             i.infaltable, i.ubicacion,
             coalesce((select -sum(m.cantidad) from movimientos_insumo m
                        where m.insumo_id = i.id and m.tipo = 'consumo'
                          and m.fecha >= current_date - 90), 0)::float8 as consumo_90
        from insumos i left join categorias_insumo c on c.id = i.categoria_id
       where i.activo
         ${cat ? sql`and i.categoria_id = ${Number(cat)}` : sql``}
         ${inf === "1" ? sql`and i.infaltable` : sql``}
         ${q ? sql`and (i.nombre ilike ${"%" + q + "%"} or i.codigo ilike ${"%" + q + "%"})` : sql``}
       order by i.nombre
    `),
    leerCategorias(),
  ]);

  const conNivel = lista.map((i) => ({ ...i, nivel: nivelDeStock(i.stock, i.critico, i.atento) }));
  const cuenta = (n: Nivel) => conNivel.filter((i) => i.nivel === n).length;
  const visibles = nivel === "todos" ? conNivel : conNivel.filter((i) => i.nivel === nivel);
  // Rojo primero, después amarillo; dentro de cada uno, los infaltables arriba.
  const orden = { rojo: 0, amarillo: 1, verde: 2 };
  visibles.sort((a, b) => orden[a.nivel] - orden[b.nivel] || Number(b.infaltable) - Number(a.infaltable));

  const qs = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const todo = { nivel, cat, q, inf, ...cambios };
    for (const [k, v] of Object.entries(todo)) if (v && v !== "todos") p.set(k, v);
    return `/insumos?${p}`;
  };

  return (
    <>
      <Titulo
        detalle="Stock del pañol con su semáforo. El consumo es el promedio mensual de los últimos 90 días."
        accion={CONFIGURAN.includes(sesion.rol) ? <BotonNuevoInsumo categorias={cats.filter((c) => c.activa)} /> : null}
      >
        Insumos de taller
      </Titulo>

      <Pestanas
        actual={nivel}
        opciones={[
          { valor: "todos", etiqueta: `Todos · ${conNivel.length}`, href: qs({ nivel: "todos" }) },
          { valor: "rojo", etiqueta: `🔴 Crítico · ${cuenta("rojo")}`, href: qs({ nivel: "rojo" }) },
          { valor: "amarillo", etiqueta: `🟡 Atento · ${cuenta("amarillo")}`, href: qs({ nivel: "amarillo" }) },
          { valor: "verde", etiqueta: `🟢 OK · ${cuenta("verde")}`, href: qs({ nivel: "verde" }) },
        ]}
      />

      <form className="mb-4 flex flex-wrap gap-2" action="/insumos">
        {nivel !== "todos" && <input type="hidden" name="nivel" value={nivel} />}
        <input name="q" defaultValue={q} className="campo max-w-xs flex-1" placeholder="Buscar por nombre o código" />
        <select name="cat" defaultValue={cat ?? ""} className="campo w-auto">
          <option value="">Todas las categorías</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" name="inf" value="1" defaultChecked={inf === "1"} className="h-5 w-5" />
          Solo infaltables
        </label>
        <button className="boton-secundario">Filtrar</button>
      </form>

      {visibles.length === 0 ? (
        <Vacio>No hay insumos con ese filtro.</Vacio>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="text-right">Stock</th>
                <th>Semáforo</th>
                <th className="hidden text-right sm:table-cell">Crít. / Atento / Ideal</th>
                <th className="hidden text-right md:table-cell">Consumo/mes</th>
                <th className="hidden text-right md:table-cell">Alcanza</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((i) => {
                const mensual = i.consumo_90 / 3;
                const dias = coberturaDias(i.stock, mensual);
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/insumos/${i.id}`} className="font-semibold text-slate-900 hover:underline">
                        {i.nombre}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-slate-500">
                        {i.infaltable && <Chip tono="oscuro">infaltable</Chip>}
                        {i.codigo && <span className="codigo">{i.codigo}</span>}
                        {i.categoria && <span>{i.categoria}</span>}
                        {i.ubicacion && <span>· {i.ubicacion}</span>}
                      </div>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <span className="cifra text-base">{fmtNum(i.stock)}</span>{" "}
                      <span className="text-xs text-slate-500">{i.unidad}</span>
                    </td>
                    <td>
                      <Semaforo nivel={i.nivel} />
                    </td>
                    <td className="hidden text-right text-slate-500 tabular-nums sm:table-cell">
                      {fmtNum(i.critico)} / {fmtNum(i.atento)} / {fmtNum(i.ideal)}
                    </td>
                    <td className="hidden text-right tabular-nums md:table-cell">
                      {mensual > 0 ? fmtNum(Math.round(mensual * 10) / 10) : "—"}
                    </td>
                    <td className="hidden text-right tabular-nums md:table-cell">
                      {dias == null ? "—" : `${dias} días`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
