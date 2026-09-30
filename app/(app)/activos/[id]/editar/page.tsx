import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { activos } from "@/lib/db/schema";
import { usuariosActivos } from "@/lib/consultas";
import { FormularioActivo } from "@/components/formulario-activo";
import { Titulo, Volver } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditarActivo({ params }: { params: Promise<{ id: string }> }) {
  await requerirRol("admin", "jefe_taller");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[a], usuarios] = await Promise.all([
    db.select().from(activos).where(eq(activos.id, id)),
    usuariosActivos(),
  ]);
  if (!a) notFound();
  return (
    <>
      <Volver href={`/activos/${id}`}>{a.nombre}</Volver>
      <Titulo>Editar {a.nombre}</Titulo>
      <FormularioActivo
        usuarios={usuarios}
        inicial={{
          id: a.id,
          clase: a.clase,
          tipo: a.tipo,
          nombre: a.nombre,
          codigo: a.codigo ?? "",
          marca: a.marca ?? "",
          modelo: a.modelo ?? "",
          anio: a.anio ? String(a.anio) : "",
          numeroSerie: a.numeroSerie ?? "",
          patente: a.patente ?? "",
          ubicacion: a.ubicacion ?? "",
          propiedad: a.propiedad,
          responsableId: a.responsableId,
          medidor: a.medidor,
          estado: a.estado,
          caracteristicas: a.caracteristicas,
          nota: a.nota ?? "",
        }}
      />
    </>
  );
}
