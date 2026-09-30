import { requerirRol } from "@/lib/auth";
import { usuariosActivos } from "@/lib/consultas";
import { FormularioActivo } from "@/components/formulario-activo";
import { Titulo, Volver } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NuevoActivo({ searchParams }: { searchParams: Promise<{ clase?: string }> }) {
  await requerirRol("admin", "jefe_taller");
  const clase = (await searchParams).clase === "vehiculo" ? "vehiculo" : "maquina";
  const usuarios = await usuariosActivos();
  return (
    <>
      <Volver href={clase === "vehiculo" ? "/vehiculos" : "/maquinas"}>
        {clase === "vehiculo" ? "Vehículos" : "Máquinas"}
      </Volver>
      <Titulo detalle="Después de guardarlo, desde su ficha se le cargan los planes preventivos.">
        {clase === "vehiculo" ? "Vehículo nuevo" : "Máquina nueva"}
      </Titulo>
      <FormularioActivo
        usuarios={usuarios}
        inicial={{
          clase,
          tipo: clase === "vehiculo" ? "Camioneta" : "",
          nombre: "",
          codigo: "",
          marca: "",
          modelo: "",
          anio: "",
          numeroSerie: "",
          patente: "",
          ubicacion: "",
          propiedad: "empresa",
          responsableId: null,
          medidor: clase === "vehiculo" ? "km" : "ninguno",
          estado: "operativo",
          caracteristicas: [],
          nota: "",
        }}
      />
    </>
  );
}
