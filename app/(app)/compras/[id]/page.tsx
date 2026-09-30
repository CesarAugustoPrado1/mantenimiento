import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila, filas } from "@/lib/db/filas";
import { insumosActivos } from "@/lib/consultas";
import { CONFIGURAN } from "@/lib/permisos";
import { ESTADO_COMPRA } from "@/lib/etiquetas";
import { fmtFecha, fmtNum, fmtPesos, hoyAR } from "@/lib/formato";
import { Chip, Titulo, Volver } from "@/components/ui";
import { AccionesCompra, EditorCompra, Recepcion } from "./editor";

export const dynamic = "force-dynamic";

export default async function FichaCompra({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const c = await fila<{
    id: number;
    titulo: string;
    fecha: string;
    estado: keyof typeof ESTADO_COMPRA;
    proveedor: string | null;
    nota: string | null;
    recibida_en: string | null;
    creado_por: string;
  }>(sql`
    select c.id, c.titulo, c.fecha::text as fecha, c.estado, c.proveedor, c.nota,
           c.recibida_en::text as recibida_en, u.nombre as creado_por
      from compras c join usuarios u on u.id = c.creado_por_id where c.id = ${id}
  `);
  if (!c) notFound();

  const [items, insumos] = await Promise.all([
    filas<{
      id: number;
      insumo_id: number | null;
      descripcion: string;
      cantidad: number;
      recibido: number | null;
      precio_unitario: number | null;
      unidad: string | null;
      stock: number | null;
    }>(sql`
      select ci.id, ci.insumo_id, ci.descripcion, ci.cantidad::float8 as cantidad, ci.recibido::float8 as recibido,
             ci.precio_unitario::float8 as precio_unitario, i.unidad, i.stock::float8 as stock
        from compra_items ci left join insumos i on i.id = ci.insumo_id
       where ci.compra_id = ${id} order by ci.descripcion
    `),
    insumosActivos(),
  ]);

  const editable = CONFIGURAN.includes(sesion.rol) && (c.estado === "borrador" || c.estado === "pedida");
  const total = items.reduce((s, i) => s + (i.recibido ?? i.cantidad) * (i.precio_unitario ?? 0), 0);
  const texto = items.map((i) => `• ${fmtNum(i.cantidad)} ${i.unidad ?? ""} ${i.descripcion}`.replace(/\s+/g, " ")).join("\n");

  return (
    <>
      <Volver href="/compras">Compras</Volver>
      <Titulo
        detalle={`${fmtFecha(c.fecha)} · armada por ${c.creado_por}${c.recibida_en ? ` · recibida el ${fmtFecha(c.recibida_en)}` : ""}`}
        accion={<Chip tono={ESTADO_COMPRA[c.estado].tono}>{ESTADO_COMPRA[c.estado].texto}</Chip>}
      >
        {c.titulo}
      </Titulo>

      {editable ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EditorCompra
              compraId={c.id}
              insumos={insumos}
              inicial={{
                titulo: c.titulo,
                proveedor: c.proveedor ?? "",
                nota: c.nota ?? "",
                items: items.map((i) => ({
                  insumoId: i.insumo_id,
                  descripcion: i.descripcion,
                  cantidad: String(i.cantidad),
                  precioUnitario: i.precio_unitario != null ? String(i.precio_unitario) : "",
                })),
              }}
            />
          </div>
          <div className="space-y-3">
            {items.length > 0 && (
              <Recepcion
                compraId={c.id}
                hoy={hoyAR()}
                renglones={items.map((i) => ({
                  id: i.id,
                  descripcion: i.descripcion,
                  cantidad: i.cantidad,
                  precio: i.precio_unitario,
                  esInsumo: i.insumo_id != null,
                  unidad: i.unidad,
                }))}
              />
            )}
            <AccionesCompra compraId={c.id} estado={c.estado} />
            <div className="tarjeta p-4">
              <p className="mb-1 text-sm font-semibold">Para mandar al proveedor</p>
              <textarea readOnly className="campo font-mono text-xs" rows={Math.min(14, items.length + 1)} value={texto} />
              <p className="mt-1 text-xs text-slate-500">Guardá los cambios antes de copiar.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Qué</th>
                <th className="text-right">Pedido</th>
                <th className="text-right">Recibido</th>
                <th className="text-right">$ unit.</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.descripcion} {i.insumo_id == null && <span className="text-xs text-slate-500">(no es del pañol)</span>}
                  </td>
                  <td className="text-right tabular-nums">{fmtNum(i.cantidad)}</td>
                  <td className="text-right tabular-nums">{fmtNum(i.recibido)}</td>
                  <td className="text-right tabular-nums">{fmtPesos(i.precio_unitario)}</td>
                  <td className="text-right tabular-nums">
                    {i.precio_unitario != null ? fmtPesos((i.recibido ?? i.cantidad) * i.precio_unitario) : "—"}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="text-right font-semibold">
                  Total
                </td>
                <td className="text-right cifra">{fmtPesos(total)}</td>
              </tr>
            </tbody>
          </table>
          {c.nota && <p className="p-3 text-sm text-slate-600">{c.nota}</p>}
        </div>
      )}
    </>
  );
}
