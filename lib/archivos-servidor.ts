import "server-only";
import { del } from "@vercel/blob";
import { eq, isNull, like, sql } from "drizzle-orm";
import { db } from "./db";
import { documentos, documentoVersiones } from "./db/schema";
import { fila } from "./db/filas";
import { borrarDeDrive, carpetaDe, driveConfigurado, subirADrive } from "./drive";
import { ETIQUETA_ETAPA, ETIQUETA_TIPO } from "./archivos";
import type { Etapa, TipoDocumento } from "./db/schema";

/** Las URLs que entrega Vercel Blob a una subida desde el navegador. */
export function esUrlDeBlob(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function subidaHabilitada(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

const PLURAL: Record<TipoDocumento, string> = {
  plano: "Planos",
  despiece: "Despieces",
  manual: "Manuales",
  foto: "Fotos",
  certificado: "Certificados",
  otro: "Otros",
};

/**
 * Dónde va cada archivo en Drive. Ejemplos:
 *   Máquinas / Carrusel de mesas (CAR-01) / Planos
 *   Vehículos / Hilux blanca (AB123CD) / Manuales
 *   Obras / Local Catamarca / Fotos - Antes
 *   Repuestos / Eje de la corona del carrusel
 *   Fabricación / Esqueleto para molde / Planos
 */
async function rutaDe(documentoId: number) {
  const d = await fila<{
    tipo: TipoDocumento;
    etapa: Etapa | null;
    activo_id: number | null;
    activo: string | null;
    clase: string | null;
    codigo: string | null;
    obra_id: number | null;
    obra: string | null;
    insumo_id: number | null;
    insumo: string | null;
    producto_id: number | null;
    producto: string | null;
  }>(sql`
    select d.tipo, d.etapa, d.activo_id, a.nombre as activo, a.clase, coalesce(a.patente, a.codigo) as codigo,
           d.obra_id, o.titulo as obra, d.insumo_id, i.nombre as insumo, d.producto_id, p.nombre as producto
      from documentos d
      left join activos a on a.id = d.activo_id
      left join obras o on o.id = d.obra_id
      left join insumos i on i.id = d.insumo_id
      left join productos p on p.id = d.producto_id
     where d.id = ${documentoId}
  `);
  if (!d) throw new Error(`El documento ${documentoId} no existe`);
  const sub = (base: string) => ({
    clave: `${base}/${d.tipo}${d.etapa ? `-${d.etapa}` : ""}`,
    nombre: d.etapa ? `${PLURAL[d.tipo]} - ${ETIQUETA_ETAPA[d.etapa]}` : PLURAL[d.tipo],
  });
  if (d.activo_id) {
    const grupo = d.clase === "vehiculo" ? { clave: "vehiculos", nombre: "Vehículos" } : { clave: "maquinas", nombre: "Máquinas" };
    const base = `activo/${d.activo_id}`;
    return [grupo, { clave: base, nombre: d.codigo ? `${d.activo} (${d.codigo})` : d.activo! }, sub(base)];
  }
  if (d.obra_id) {
    const base = `obra/${d.obra_id}`;
    return [{ clave: "obras", nombre: "Obras" }, { clave: base, nombre: d.obra! }, sub(base)];
  }
  if (d.insumo_id) {
    return [{ clave: "repuestos", nombre: "Repuestos" }, { clave: `insumo/${d.insumo_id}`, nombre: d.insumo! }];
  }
  if (d.producto_id) {
    const base = `producto/${d.producto_id}`;
    return [{ clave: "fabricacion", nombre: "Fabricación" }, { clave: base, nombre: d.producto! }, sub(base)];
  }
  return [{ clave: "general", nombre: "General" }, { clave: `general/${d.tipo}`, nombre: PLURAL[d.tipo] }];
}

/**
 * Pasa una versión de Vercel Blob a Drive. Corre después de responder (con
 * `after`), así la subida no hace esperar al usuario. Si falla, la versión
 * queda en Blob y se sigue viendo igual: se reintenta con el cron diario o
 * con el botón de Configuración.
 */
export async function pasarADrive(versionId: number): Promise<boolean> {
  if (!driveConfigurado()) return false;
  const [v] = await db.select().from(documentoVersiones).where(eq(documentoVersiones.id, versionId));
  if (!v || v.driveFileId || !esUrlDeBlob(v.url)) return false;
  const [doc] = await db.select({ titulo: documentos.titulo, tipo: documentos.tipo }).from(documentos).where(eq(documentos.id, v.documentoId));
  const carpeta = await carpetaDe(await rutaDe(v.documentoId));
  const extension = (v.nombreArchivo ?? "").match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? "";
  const nombre = `${doc?.titulo ?? ETIQUETA_TIPO.otro} - v${v.version}${extension}`;
  const subido = await subirADrive(v.url, nombre, v.mime ?? "application/octet-stream", carpeta);
  await db
    .update(documentoVersiones)
    .set({
      url: `/api/drive/${subido.id}`,
      driveFileId: subido.id,
      tamanoBytes: subido.size ? Number(subido.size) : v.tamanoBytes,
    })
    .where(eq(documentoVersiones.id, versionId));
  try {
    await del(v.url);
  } catch (e) {
    console.error(`[archivos] versión ${versionId} en Drive, pero no se pudo borrar de Blob:`, e);
  }
  return true;
}

/** Reintenta todo lo que quedó en Blob. */
export async function pasarPendientesADrive(): Promise<{ pasadas: number; fallidas: number }> {
  const pendientes = await db
    .select({ id: documentoVersiones.id })
    .from(documentoVersiones)
    .where(sql`${isNull(documentoVersiones.driveFileId)} and ${like(documentoVersiones.url, "https://%.blob.vercel-storage.com/%")}`);
  let pasadas = 0;
  let fallidas = 0;
  for (const p of pendientes) {
    try {
      if (await pasarADrive(p.id)) pasadas++;
    } catch (e) {
      fallidas++;
      console.error(`[archivos] no se pudo pasar a Drive la versión ${p.id}:`, e);
    }
  }
  return { pasadas, fallidas };
}

export async function estadoArchivos() {
  return fila<{ en_drive: number; pendientes: number; links: number; bytes: number }>(sql`
    select count(*) filter (where drive_file_id is not null)::int as en_drive,
           count(*) filter (where drive_file_id is null and url like 'https://%.blob.vercel-storage.com/%')::int as pendientes,
           count(*) filter (where drive_file_id is null and url not like 'https://%.blob.vercel-storage.com/%')::int as links,
           coalesce(sum(tamano_bytes), 0)::float8 as bytes
      from documento_versiones
  `);
}

/** Al borrar un archivo cargado por error, se van también sus copias. */
export async function borrarCopiasDe(vs: Array<{ url: string; drive_file_id: string | null }>) {
  for (const v of vs) {
    try {
      if (v.drive_file_id) await borrarDeDrive(v.drive_file_id);
      else if (esUrlDeBlob(v.url)) await del(v.url);
    } catch (e) {
      console.error("[archivos] no se pudo borrar una copia:", e);
    }
  }
}
