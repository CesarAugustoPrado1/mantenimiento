import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { CONFIGURAN } from "@/lib/permisos";
import { ListaActivos } from "@/components/lista-activos";
import { Titulo } from "@/components/ui";

export const metadata = { title: "Vehículos · Taller" };
export const dynamic = "force-dynamic";

export default async function Vehiculos({ searchParams }: { searchParams: Promise<{ bajas?: string }> }) {
  const sesion = await requerirSesion();
  const { bajas } = await searchParams;
  const esConductor = sesion.rol === "conductor";
  return (
    <>
      <Titulo
        detalle={
          esConductor
            ? "Tus vehículos: services, kilometraje y fallas."
            : "Clarks, autos y camionetas de la empresa, y los de empleados que participan."
        }
        accion={
          CONFIGURAN.includes(sesion.rol) ? (
            <Link href="/activos/nuevo?clase=vehiculo" className="boton-primario">
              + Vehículo
            </Link>
          ) : null
        }
      >
        {esConductor ? "Mis vehículos" : "Vehículos"}
      </Titulo>
      <ListaActivos clase="vehiculo" soloDe={esConductor ? sesion.uid : undefined} verBajas={bajas === "1"} />
      {!esConductor && (
        <p className="mt-4 text-center text-sm">
          <Link className="text-slate-500 underline" href={bajas === "1" ? "/vehiculos" : "/vehiculos?bajas=1"}>
            {bajas === "1" ? "Ocultar los dados de baja" : "Ver también los dados de baja"}
          </Link>
        </p>
      )}
    </>
  );
}
