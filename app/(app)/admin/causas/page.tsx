import { sql } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { Titulo, Volver } from "@/components/ui";
import { ListaSimple } from "../listas";

export const metadata = { title: "Causas de falla · Taller" };
export const dynamic = "force-dynamic";

export default async function Causas() {
  await requerirRol("admin", "jefe_taller");
  const items = await filas<{ id: number; nombre: string; descripcion: string; activa: boolean; usos: number }>(sql`
    select c.id, c.nombre, coalesce(c.descripcion, '') as descripcion, c.activa, count(t.id)::int as usos
      from causas c left join trabajos t on t.causa_id = c.id
     group by c.id order by c.nombre
  `);
  return (
    <>
      <Volver href="/admin">Configuración</Volver>
      <Titulo detalle="Con qué se cierra cada correctivo. Es lo que después responde «por qué se rompen las cosas». Pocas y claras sirven más que muchas.">
        Causas de falla
      </Titulo>
      <ListaSimple tipo="causa" items={items} />
    </>
  );
}
