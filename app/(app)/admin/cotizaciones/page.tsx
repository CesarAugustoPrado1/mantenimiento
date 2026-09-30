import { sql } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { hoyAR } from "@/lib/formato";
import { casaCotizacion } from "@/lib/configuracion";
import { Titulo, Volver } from "@/components/ui";
import { Cotizaciones } from "../listas";

export const metadata = { title: "Cotizaciones · Taller" };
export const dynamic = "force-dynamic";

export default async function PantallaCotizaciones() {
  await requerirRol("admin", "jefe_taller");
  const [items, [{ total }], casa] = await Promise.all([
    filas<{ fecha: string; ars_por_usd: number; nota: string | null; fuente: string }>(sql`
      select fecha::text as fecha, ars_por_usd::float8 as ars_por_usd, nota, fuente from cotizaciones order by fecha desc limit 60
    `),
    filas<{ total: number }>(sql`select count(*)::int as total from cotizaciones`),
    casaCotizacion(),
  ]);
  return (
    <>
      <Volver href="/admin">Configuración</Volver>
      <Titulo detalle="Cada gasto se pasa a dólares con la cotización vigente a su fecha, así los informes se pueden comparar entre años aunque haya inflación.">
        Cotización del dólar
      </Titulo>
      <Cotizaciones hoy={hoyAR()} casa={casa} total={total} items={items} />
    </>
  );
}
