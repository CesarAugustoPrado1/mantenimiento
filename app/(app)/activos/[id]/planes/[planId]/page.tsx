import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { activos, planes, planMateriales, planTareas } from "@/lib/db/schema";
import { activosVigentes, insumosActivos, nombreActivo, usuariosActivos } from "@/lib/consultas";
import { Titulo, Volver } from "@/components/ui";
import { FormularioPlan, type DatosPlan, type Seccion } from "./formulario";

export const dynamic = "force-dynamic";

export default async function EditorPlan({ params }: { params: Promise<{ id: string; planId: string }> }) {
  await requerirRol("admin", "jefe_taller");
  const p = await params;
  const activoId = Number(p.id);
  if (!Number.isInteger(activoId)) notFound();

  const [[a], usuarios, insumos, otros] = await Promise.all([
    db.select({ id: activos.id, nombre: activos.nombre, medidor: activos.medidor }).from(activos).where(eq(activos.id, activoId)),
    usuariosActivos(),
    insumosActivos(),
    activosVigentes(),
  ]);
  if (!a) notFound();

  let inicial: DatosPlan = {
    activoId,
    nombre: "",
    descripcion: "",
    cadaDias: "",
    cadaUso: "",
    avisoDias: "7",
    avisoUso: "",
    responsableId: null,
    responsableExterno: "",
    herramientas: "",
    desdeFecha: "",
    desdeUso: "",
    activo: true,
    columnas: [],
    secciones: [{ nombre: "", activoId: null, filas: [] }],
    materiales: [],
  };

  if (p.planId !== "nuevo") {
    const planId = Number(p.planId);
    if (!Number.isInteger(planId)) notFound();
    const [[plan], tareas, materiales] = await Promise.all([
      db.select().from(planes).where(eq(planes.id, planId)),
      db.select().from(planTareas).where(eq(planTareas.planId, planId)).orderBy(asc(planTareas.orden)),
      db.select().from(planMateriales).where(eq(planMateriales.planId, planId)),
    ]);
    if (!plan || plan.activoId !== activoId) notFound();
    inicial = {
      id: plan.id,
      activoId,
      nombre: plan.nombre,
      descripcion: plan.descripcion ?? "",
      cadaDias: plan.cadaDias ? String(plan.cadaDias) : "",
      cadaUso: plan.cadaUso ? String(plan.cadaUso) : "",
      avisoDias: String(plan.avisoDias),
      avisoUso: plan.avisoUso ? String(plan.avisoUso) : "",
      responsableId: plan.responsableId,
      responsableExterno: plan.responsableExterno ?? "",
      herramientas: plan.herramientas ?? "",
      desdeFecha: plan.desdeFecha ?? "",
      desdeUso: plan.desdeUso ?? "",
      activo: plan.activo,
      columnas: plan.columnas,
      secciones: agrupar(tareas),
      materiales: materiales.map((m) => ({
        insumoId: m.insumoId,
        descripcion: m.descripcion ?? "",
        cantidad: String(Number(m.cantidad)),
      })),
    };
  }

  return (
    <>
      <Volver href={`/activos/${activoId}`}>{a.nombre}</Volver>
      <Titulo detalle="Qué se hace, cada cuánto, quién lo hace y qué hace falta tener.">
        {inicial.id ? `Plan: ${inicial.nombre}` : "Plan preventivo nuevo"}
      </Titulo>
      <FormularioPlan
        inicial={inicial}
        medidor={a.medidor}
        usuarios={usuarios.filter((x) => x.rol !== "auditor")}
        insumos={insumos}
        activos={otros.filter((x) => x.id !== activoId).map((x) => ({ id: x.id, nombre: nombreActivo(x) }))}
      />
    </>
  );
}

/** Filas consecutivas con la misma sección y equipo forman una sección. */
function agrupar(tareas: Array<{ seccion: string | null; activoId: number | null; accion: Seccion["filas"][number]["accion"]; descripcion: string }>): Seccion[] {
  const salida: Seccion[] = [];
  for (const t of tareas) {
    const ultima = salida[salida.length - 1];
    if (ultima && ultima.nombre === (t.seccion ?? "") && ultima.activoId === t.activoId) {
      ultima.filas.push({ accion: t.accion, descripcion: t.descripcion });
    } else {
      salida.push({ nombre: t.seccion ?? "", activoId: t.activoId, filas: [{ accion: t.accion, descripcion: t.descripcion }] });
    }
  }
  return salida.length ? salida : [{ nombre: "", activoId: null, filas: [] }];
}
