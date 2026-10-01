import { sql } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { Titulo, Volver } from "@/components/ui";
import { ListaSimple } from "../listas";

export const metadata = { title: "Categorías de herramientas · Taller" };
export const dynamic = "force-dynamic";

export default async function CategoriasHerramientas() {
  await requerirRol("admin", "jefe_taller");
  const items = await filas<{ id: number; nombre: string; activa: boolean; usos: number }>(sql`
    select c.id, c.nombre, c.activa, count(t.id)::int as usos
      from categorias_herramienta c left join herramienta_tipos t on t.categoria_id = c.id
     group by c.id order by c.nombre
  `);
  return (
    <>
      <Volver href="/admin">Configuración</Volver>
      <Titulo detalle="La lista de la que se elige al cargar una herramienta. Una categoría que ya no se usa se desactiva: deja de ofrecerse, pero las herramientas que la tienen la conservan.">
        Categorías de herramientas
      </Titulo>
      <ListaSimple tipo="categoria_herramienta" items={items} />
    </>
  );
}
