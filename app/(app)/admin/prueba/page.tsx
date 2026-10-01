import { sql } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { fila } from "@/lib/db/filas";
import { enModoPrueba } from "@/lib/configuracion";
import { Aviso, Titulo, Volver } from "@/components/ui";
import { PanelPrueba } from "./panel";

export const metadata = { title: "Etapa de prueba · Taller" };
export const dynamic = "force-dynamic";

export default async function EtapaDePrueba() {
  await requerirRol("admin");
  const [prueba, n] = await Promise.all([
    enModoPrueba(),
    fila<Record<string, number>>(sql`
      select
        (select count(*) from activos)::int as equipos,
        (select count(*) from planes)::int as planes,
        (select count(*) from trabajos)::int as trabajos,
        (select count(*) from insumos)::int as insumos,
        (select count(*) from movimientos_insumo)::int as movimientos,
        (select count(*) from lecturas)::int as lecturas,
        (select count(*) from cargas_combustible)::int as cargas,
        (select count(*) from herramienta_tipos)::int as herramientas,
        (select count(*) from obras)::int as obras,
        (select count(*) from compras)::int as compras
    `),
  ]);

  return (
    <>
      <Volver href="/admin">Configuración</Volver>
      <Titulo detalle="Para cargar datos de prueba y después borrarlos y arrancar de cero.">Etapa de prueba</Titulo>

      {!prueba ? (
        <Aviso tono="info">
          La instalación no está en etapa de prueba, así que el borrado está deshabilitado. Es a propósito: con datos reales,
          borrar todo no puede estar a un botón de distancia.
        </Aviso>
      ) : (
        <div className="space-y-4">
          <div className="tarjeta p-5">
            <p className="mb-2 font-bold">Lo que se borra</p>
            <p className="text-sm text-slate-700">
              {n?.equipos} equipos, {n?.planes} planes, {n?.trabajos} trabajos (preventivos y correctivos), {n?.insumos} insumos con{" "}
              {n?.movimientos} movimientos, {n?.lecturas} lecturas de km/horas, {n?.cargas} cargas de combustible, {n?.herramientas}{" "}
              herramientas, {n?.obras} obras y {n?.compras} compras.
            </p>
            <p className="mt-3 mb-1 font-bold">Lo que queda</p>
            <p className="text-sm text-slate-700">
              Los usuarios (si no, quedarías afuera de la app), las causas de falla, las categorías de insumos y las cotizaciones del
              dólar. Los usuarios de prueba se pueden dar de baja desde Usuarios.
            </p>
          </div>
          <PanelPrueba />
        </div>
      )}
    </>
  );
}
