import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { CONFIGURAN } from "@/lib/permisos";
import { ListaActivos } from "@/components/lista-activos";
import { Titulo } from "@/components/ui";

export const metadata = { title: "Máquinas · Taller" };
export const dynamic = "force-dynamic";

export default async function Maquinas({ searchParams }: { searchParams: Promise<{ bajas?: string }> }) {
  const sesion = await requerirSesion();
  const { bajas } = await searchParams;
  return (
    <>
      <Titulo
        detalle="Las máquinas de fábrica, con su ficha, sus planes preventivos y su historial."
        accion={
          CONFIGURAN.includes(sesion.rol) ? (
            <Link href="/activos/nuevo?clase=maquina" className="boton-primario">
              + Máquina
            </Link>
          ) : null
        }
      >
        Máquinas
      </Titulo>
      <ListaActivos clase="maquina" verBajas={bajas === "1"} />
      <p className="mt-4 text-center text-sm">
        <Link className="text-slate-500 underline" href={bajas === "1" ? "/maquinas" : "/maquinas?bajas=1"}>
          {bajas === "1" ? "Ocultar las dadas de baja" : "Ver también las dadas de baja"}
        </Link>
      </p>
    </>
  );
}
