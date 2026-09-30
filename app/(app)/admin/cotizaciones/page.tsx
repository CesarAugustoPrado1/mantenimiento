import { sql } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { filas } from "@/lib/db/filas";
import { hoyAR } from "@/lib/formato";
import { Titulo, Volver } from "@/components/ui";
import { Cotizaciones } from "../listas";

export const metadata = { title: "Cotizaciones · Taller" };
export const dynamic = "force-dynamic";

export default async function PantallaCotizaciones() {
  await requerirRol("admin", "jefe_taller");
  const items = await filas<{ fecha: string; ars_por_usd: number; nota: string | null }>(sql`
    select fecha::text as fecha, ars_por_usd::float8 as ars_por_usd, nota from cotizaciones order by fecha desc
  `);
  return (
    <>
      <Volver href="/admin">Configuración</Volver>
      <Titulo detalle="Con una por mes alcanza. Cada gasto se pasa a dólares con la cotización vigente a su fecha, así los informes se pueden comparar entre años aunque haya inflación.">
        Cotización del dólar
      </Titulo>
      <Cotizaciones hoy={hoyAR()} items={items} />
    </>
  );
}
