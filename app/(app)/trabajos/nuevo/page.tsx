import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth";
import { activosVigentes, nombreActivo } from "@/lib/consultas";
import { hoyAR } from "@/lib/formato";
import { Aviso, Titulo } from "@/components/ui";
import { AbrirCorrectivo } from "./formulario";

export const metadata = { title: "Reportar falla · Taller" };
export const dynamic = "force-dynamic";

export default async function NuevoCorrectivo({
  searchParams,
}: {
  searchParams: Promise<{ activo?: string; desde?: string }>;
}) {
  const sesion = await requerirSesion();
  if (sesion.rol === "auditor") redirect("/sin-permiso");
  const { activo, desde } = await searchParams;
  const activos = await activosVigentes(sesion.rol === "conductor" ? sesion.uid : undefined);
  const inicial = activo && activos.some((a) => a.id === Number(activo)) ? Number(activo) : null;

  return (
    <>
      <Titulo detalle="Lo que sale de lo esperado: una rotura, un ruido, una pérdida. Se abre ahora y se cierra cuando esté resuelto, con la causa.">
        Reportar falla
      </Titulo>
      {desde && (
        <div className="mb-4">
          <Aviso tono="exito">
            Preventivo guardado. Encontraste puntos mal: si hay que repararlos, abrí el correctivo acá.
          </Aviso>
        </div>
      )}
      <AbrirCorrectivo
        hoy={hoyAR()}
        activoInicial={inicial}
        tituloInicial=""
        irAlEquipo={sesion.rol === "conductor"}
        activos={activos.map((a) => ({ id: a.id, nombre: `${a.clase === "vehiculo" ? "🚚" : "🏭"} ${nombreActivo(a)}`, medidor: a.medidor }))}
      />
    </>
  );
}
