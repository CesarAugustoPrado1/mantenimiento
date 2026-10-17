import { sql } from "drizzle-orm";
import { sesionActual } from "@/lib/auth";
import { fila } from "@/lib/db/filas";
import { esUrlDeBlob, leerBlob } from "@/lib/archivos-servidor";

/**
 * Sirve un archivo recién subido, mientras todavía está en Vercel Blob (hasta
 * que pasa a Drive). El store puede ser privado, así que lo lee el servidor.
 * Pide sesión y solo sirve archivos que la app conoce.
 */
export async function GET(request: Request) {
  const sesion = await sesionActual();
  if (!sesion) return new Response("Necesitás entrar a la app", { status: 401 });
  const u = new URL(request.url).searchParams.get("u") ?? "";
  if (!esUrlDeBlob(u)) return new Response("No encontrado", { status: 404 });
  const v = await fila<{ nombre_archivo: string | null; mime: string | null; drive_file_id: string | null }>(sql`
    select nombre_archivo, mime, drive_file_id from documento_versiones where url = ${u} limit 1
  `);
  if (!v) {
    // Ya pasó a Drive y la url cambió.
    return new Response("Este archivo ya se guardó en Drive. Volvé a la lista y abrilo de nuevo.", { status: 404 });
  }
  try {
    const r = await leerBlob(u);
    const nombre = encodeURIComponent(v.nombre_archivo ?? "archivo");
    return new Response(r.stream, {
      headers: {
        "Content-Type": v.mime ?? r.blob.contentType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${nombre}`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[blob]", e);
    return new Response("No se pudo abrir el archivo", { status: 502 });
  }
}
