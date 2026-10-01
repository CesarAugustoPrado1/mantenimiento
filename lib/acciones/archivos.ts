"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { activos, documentos, documentoVersiones, obras } from "../db/schema";
import { autorizar } from "../auth";
import { CONFIGURAN, OPERAN } from "../permisos";
import { esUrl } from "../archivos";
import { hoyAR } from "../formato";
import { ejecutar, fallar, type Resultado } from "./comun";
import { after } from "next/server";
import { esUrlDeBlob, pasarADrive } from "../archivos-servidor";
import { fechaOpcional, id, texto } from "./validacion";

const url = z
  .string()
  .trim()
  .min(1, "Pegá el link del archivo.")
  .max(2000)
  .refine(esUrl, "Eso no parece un link. Tiene que empezar con https://");

const tipo = z.enum(["plano", "despiece", "manual", "foto", "certificado", "otro"]);

/** Un archivo que el navegador acaba de subir a Vercel Blob. */
const subido = z
  .object({
    url: z.string().refine(esUrlDeBlob, "El archivo no llegó bien. Volvé a subirlo."),
    nombre: z.string().trim().min(1).max(250),
    mime: z.string().trim().max(150).default("application/octet-stream"),
    tamano: z.number().int().nonnegative().nullable().optional(),
  })
  .nullable()
  .optional();

/**
 * La versión apunta al Blob mientras tanto; apenas se responde, se pasa a
 * Drive en segundo plano. Si eso falla, sigue andando desde el Blob y se
 * reintenta después.
 */
function pasarDespues(versionId: number) {
  after(async () => {
    try {
      await pasarADrive(versionId);
    } catch (e) {
      console.error(`[archivos] versión ${versionId} quedó en Blob:`, e);
    }
  });
}

const esquemaNuevo = z.object({
  titulo: z.string().trim().min(2, "Poné un nombre que se entienda: «Plano eje de la corona».").max(150),
  tipo,
  activoId: id.nullable().optional(),
  obraId: id.nullable().optional(),
  insumoId: id.nullable().optional(),
  productoId: id.nullable().optional(),
  etapa: z.enum(["antes", "durante", "despues"]).nullable().optional(),
  nota: texto(500),
  /** Un link pegado a mano (algo que ya está en otro lado)… */
  url: url.nullable().optional(),
  /** …o un archivo subido desde la app, que termina en Drive. */
  archivo: subido,
  fecha: fechaOpcional,
});

/** Un archivo nuevo con su primera versión. Lo puede cargar el técnico (fotos). */
export async function crearDocumento(entrada: z.input<typeof esquemaNuevo>): Promise<Resultado<{ id: number }>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaNuevo.parse(entrada);
    const duenos = [d.activoId, d.obraId, d.insumoId, d.productoId].filter(Boolean).length;
    if (duenos > 1) fallar("Un archivo es de una sola cosa: una máquina, una obra, un repuesto o un producto.");
    if (d.etapa && !d.obraId) fallar("La etapa (antes, durante, después) es para fotos de obras.");
    if (d.fecha && d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");
    if (!d.archivo && !d.url) fallar("Subí el archivo o pegá un link.");
    let versionId = 0;
    const nuevo = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documentos)
        .values({
          titulo: d.titulo,
          tipo: d.tipo,
          activoId: d.activoId ?? null,
          obraId: d.obraId ?? null,
          insumoId: d.insumoId ?? null,
          productoId: d.productoId ?? null,
          etapa: d.obraId ? (d.etapa ?? null) : null,
          nota: d.nota,
          creadoPorId: yo.uid,
        })
        .returning({ id: documentos.id });
      const [v] = await tx
        .insert(documentoVersiones)
        .values({
          documentoId: doc.id,
          version: 1,
          url: d.archivo?.url ?? d.url!,
          nombreArchivo: d.archivo?.nombre ?? null,
          mime: d.archivo?.mime ?? null,
          tamanoBytes: d.archivo?.tamano ?? null,
          fecha: d.fecha ?? hoyAR(),
          creadoPorId: yo.uid,
        })
        .returning({ id: documentoVersiones.id });
      versionId = v.id;
      return doc.id;
    });
    if (d.archivo) pasarDespues(versionId);
    revalidatePath("/", "layout");
    return { id: nuevo };
  });
}

const esquemaVersion = z.object({
  documentoId: id,
  url: url.nullable().optional(),
  archivo: subido,
  nota: texto(500),
  fecha: fechaOpcional,
});

/** Nueva versión: la anterior queda guardada, nunca se pisa. */
export async function nuevaVersion(entrada: z.input<typeof esquemaVersion>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar(...OPERAN);
    const d = esquemaVersion.parse(entrada);
    if (d.fecha && d.fecha > hoyAR()) fallar("La fecha no puede ser futura.");
    if (!d.archivo && !d.url) fallar("Subí el archivo o pegá un link.");
    let versionId = 0;
    await db.transaction(async (tx) => {
      const [doc] = await tx.select({ id: documentos.id }).from(documentos).where(eq(documentos.id, d.documentoId)).for("update");
      if (!doc) fallar("El archivo no existe.");
      const [ultima] = await tx
        .select({ version: documentoVersiones.version, url: documentoVersiones.url })
        .from(documentoVersiones)
        .where(eq(documentoVersiones.documentoId, d.documentoId))
        .orderBy(desc(documentoVersiones.version))
        .limit(1);
      if (d.url && ultima?.url === d.url) fallar("Ese link es el de la versión vigente.");
      const [v] = await tx
        .insert(documentoVersiones)
        .values({
          documentoId: d.documentoId,
          version: (ultima?.version ?? 0) + 1,
          url: d.archivo?.url ?? d.url!,
          nombreArchivo: d.archivo?.nombre ?? null,
          mime: d.archivo?.mime ?? null,
          tamanoBytes: d.archivo?.tamano ?? null,
          nota: d.nota,
          fecha: d.fecha ?? hoyAR(),
          creadoPorId: yo.uid,
        })
        .returning({ id: documentoVersiones.id });
      versionId = v.id;
    });
    if (d.archivo) pasarDespues(versionId);
    revalidatePath("/", "layout");
  });
}

const esquemaEditar = z.object({
  id,
  titulo: z.string().trim().min(2).max(150),
  tipo,
  etapa: z.enum(["antes", "durante", "despues"]).nullable().optional(),
  nota: texto(500),
  archivado: z.boolean(),
});

export async function editarDocumento(entrada: z.input<typeof esquemaEditar>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaEditar.parse(entrada);
    const [doc] = await db.select({ obraId: documentos.obraId }).from(documentos).where(eq(documentos.id, d.id));
    if (!doc) fallar("El archivo no existe.");
    await db
      .update(documentos)
      .set({ titulo: d.titulo, tipo: d.tipo, etapa: doc.obraId ? (d.etapa ?? null) : null, nota: d.nota, archivado: d.archivado })
      .where(eq(documentos.id, d.id));
    revalidatePath("/", "layout");
  });
}

const esquemaCarpeta = z.object({
  activoId: id.nullable().optional(),
  obraId: id.nullable().optional(),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || esUrl(v), "Eso no parece un link.")
    .transform((v) => v || null),
});

/** La carpeta de Drive de una máquina u obra: el botón directo a sus archivos. */
export async function guardarCarpeta(entrada: z.input<typeof esquemaCarpeta>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaCarpeta.parse(entrada);
    if (d.activoId) await db.update(activos).set({ carpetaUrl: d.url }).where(eq(activos.id, d.activoId));
    else if (d.obraId) await db.update(obras).set({ carpetaUrl: d.url }).where(eq(obras.id, d.obraId));
    else fallar("¿De qué es la carpeta?");
    revalidatePath("/", "layout");
  });
}

/** Configuración: reintentar ahora lo que haya quedado sin pasar a Drive. */
export async function reintentarDrive(): Promise<Resultado<{ pasadas: number; fallidas: number }>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const { pasarPendientesADrive } = await import("../archivos-servidor");
    const r = await pasarPendientesADrive();
    revalidatePath("/", "layout");
    return r;
  });
}
