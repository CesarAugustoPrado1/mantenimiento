import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth";
import { activosVigentes, nombreActivo } from "@/lib/consultas";
import { hoyAR } from "@/lib/formato";
import { Titulo } from "@/components/ui";
import { AbrirCorrectivo } from "./formulario";

export const metadata = { title: "Reportar falla · Taller" };
export const dynamic = "force-dynamic";

export default async function NuevoCorrectivo({
  searchParams,
}: {
  searchParams: Promise<{ activo?: string; titulo?: string; falla?: string }>;
}) {
  const sesion = await requerirSesion();
  if (sesion.rol === "auditor") redirect("/sin-permiso");
  const { activo, titulo, falla } = await searchParams;
  const activos = await activosVigentes(sesion.rol === "conductor" ? sesion.uid : undefined);
  const inicial = activo && activos.some((a) => a.id === Number(activo)) ? Number(activo) : null;

  return (
    <>
      <Titulo detalle="Lo que sale de lo esperado: una rotura, un ruido, una pérdida. Se abre ahora y se cierra cuando esté resuelto, con la causa.">
        Reportar falla
      </Titulo>
      <AbrirCorrectivo
        hoy={hoyAR()}
        activoInicial={inicial}
        tituloInicial={titulo?.slice(0, 150) ?? ""}
        fallaInicial={falla?.slice(0, 1000) ?? ""}
        irAlEquipo={sesion.rol === "conductor"}
        activos={activos.map((a) => ({ id: a.id, nombre: `${a.clase === "vehiculo" ? "🚚" : "🏭"} ${nombreActivo(a)}`, medidor: a.medidor }))}
      />
    </>
  );
}
