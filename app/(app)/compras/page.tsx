import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { CONFIGURAN } from "@/lib/permisos";
import { ESTADO_COMPRA } from "@/lib/etiquetas";
import { fmtFecha, fmtPesos, hoyAR } from "@/lib/formato";
import { Chip, Titulo, Vacio } from "@/components/ui";
import { NuevaCompra } from "./nueva";

export const metadata = { title: "Compras · Taller" };
export const dynamic = "force-dynamic";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default async function Compras() {
  const sesion = await requerirSesion();
  const hoy = hoyAR();
  const lista = await filas<{
    id: number;
    titulo: string;
    fecha: string;
    estado: keyof typeof ESTADO_COMPRA;
    proveedor: string | null;
    renglones: number;
    total: number | null;
  }>(sql`
    select c.id, c.titulo, c.fecha::text as fecha, c.estado, c.proveedor,
           count(i.id)::int as renglones,
           sum(coalesce(i.recibido, i.cantidad) * i.precio_unitario)::float8 as total
      from compras c left join compra_items i on i.compra_id = c.id
     group by c.id order by c.fecha desc, c.id desc limit 100
  `);
  const dia = Number(hoy.slice(8, 10));
  const sugerido = `Compra ${dia <= 15 ? "1ª" : "2ª"} quincena ${MESES[Number(hoy.slice(5, 7)) - 1]}`;

  return (
    <>
      <Titulo
        detalle="La compra mensual o quincenal. Se arma sola desde el semáforo de insumos y al recibirla suma el stock."
        accion={CONFIGURAN.includes(sesion.rol) ? <NuevaCompra hoy={hoy} sugerido={sugerido} /> : null}
      >
        Compras
      </Titulo>
      {lista.length === 0 ? (
        <Vacio>Todavía no hay compras.</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-slate-100">
          {lista.map((c) => (
            <li key={c.id}>
              <Link href={`/compras/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
                <span className="w-20 shrink-0 text-xs text-slate-500">{fmtFecha(c.fecha)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {c.renglones} renglón(es){c.proveedor && ` · ${c.proveedor}`}
                    {c.total ? ` · ${fmtPesos(c.total)}` : ""}
                  </p>
                </div>
                <Chip tono={ESTADO_COMPRA[c.estado].tono}>{ESTADO_COMPRA[c.estado].texto}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
