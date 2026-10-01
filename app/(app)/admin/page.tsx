import Link from "next/link";
import { sql } from "drizzle-orm";
import { requerirSesion } from "@/lib/auth";
import { fila } from "@/lib/db/filas";
import { Titulo } from "@/components/ui";
import { enModoPrueba } from "@/lib/configuracion";

export const metadata = { title: "Configuración · Taller" };
export const dynamic = "force-dynamic";

export default async function Admin() {
  const sesion = await requerirSesion();
  const prueba = await enModoPrueba();
  const n = await fila<Record<string, number | string | null>>(sql`
    select
      (select count(*) from usuarios where activo)::int as usuarios,
      (select count(*) from categorias_insumo where activa)::int as categorias,
      (select count(*) from categorias_herramienta where activa)::int as categorias_herramienta,
      (select count(*) from causas where activa)::int as causas,
      (select count(*) from cotizaciones)::int as cotizaciones,
      (select max(fecha)::text from cotizaciones) as ultima_cotizacion,
      (select count(*) from activos where clase = 'maquina' and estado <> 'baja')::int as maquinas,
      (select count(*) from activos where clase = 'vehiculo' and estado <> 'baja')::int as vehiculos,
      (select count(*) from insumos where activo)::int as insumos
  `);

  const secciones = [
    { href: "/maquinas", titulo: "Máquinas", ayuda: "Alta de máquinas con su ficha y sus planes preventivos.", detalle: `${n?.maquinas ?? 0}` },
    { href: "/vehiculos", titulo: "Vehículos", ayuda: "Clarks, autos y camionetas, con su conductor y sus services.", detalle: `${n?.vehiculos ?? 0}` },
    { href: "/insumos", titulo: "Insumos", ayuda: "Alta de insumos con su semáforo y si son infaltables.", detalle: `${n?.insumos ?? 0}` },
    { href: "/admin/categorias", titulo: "Categorías de insumos", ayuda: "Para agrupar el pañol.", detalle: `${n?.categorias ?? 0}` },
    {
      href: "/admin/categorias-herramientas",
      titulo: "Categorías de herramientas",
      ayuda: "La lista para clasificar las herramientas.",
      detalle: `${n?.categorias_herramienta ?? 0}`,
    },
    { href: "/admin/causas", titulo: "Causas de falla", ayuda: "Con qué se cierra un correctivo.", detalle: `${n?.causas ?? 0}` },
    {
      href: "/admin/cotizaciones",
      titulo: "Cotización del dólar",
      ayuda: "Para comparar gastos entre años a pesar de la inflación.",
      detalle: n?.ultima_cotizacion ? `última ${String(n.ultima_cotizacion).split("-").reverse().join("/")}` : "sin cargar",
    },
    ...(sesion.rol === "admin"
      ? [
          { href: "/admin/usuarios", titulo: "Usuarios", ayuda: "Quién entra y con qué rol.", detalle: `${n?.usuarios ?? 0}` },
          {
            href: "/admin/prueba",
            titulo: "Etapa de prueba",
            ayuda: "Borrar todos los datos cargados y arrancar de cero.",
            detalle: prueba ? "activa" : "apagada",
          },
        ]
      : []),
  ];

  return (
    <>
      <Titulo detalle="Lo que define cómo trabaja la app.">Configuración</Titulo>
      <ul className="space-y-2">
        {secciones.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="tarjeta flex items-center gap-3 p-4 transition hover:ring-slate-300">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{s.titulo}</p>
                <p className="text-xs text-slate-500">{s.ayuda}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{s.detalle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
