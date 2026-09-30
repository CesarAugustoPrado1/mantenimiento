import { sql } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { Titulo, Volver } from "@/components/ui";
import { ListaSimple } from "../listas";

export const metadata = { title: "Categorías · Taller" };
export const dynamic = "force-dynamic";

export default async function Categorias() {
  await requerirRol("admin", "jefe_taller");
  const items = await filas<{ id: number; nombre: string; activa: boolean; usos: number }>(sql`
    select c.id, c.nombre, c.activa, count(i.id)::int as usos
      from categorias_insumo c left join insumos i on i.categoria_id = c.id
     group by c.id order by c.nombre
  `);
  return (
    <>
      <Volver href="/admin">Configuración</Volver>
      <Titulo detalle="Para agrupar y filtrar los insumos del pañol.">Categorías de insumos</Titulo>
      <ListaSimple tipo="categoria" items={items} />
    </>
  );
}
