import { sql } from "drizzle-orm";
import { sesionActual } from "@/lib/auth";
import { fila } from "@/lib/db/filas";
import { tokenDrive } from "@/lib/drive";

/**
 * Sirve un archivo de Drive con las credenciales del servidor: el usuario abre
 * el plano desde la app y nunca ve Drive. Pide sesión, y solo sirve archivos
 * que la app conoce (no se puede usar para leer cualquier cosa del Drive).
 *
 * ?mini=1 devuelve la miniatura que genera Drive (para la galería de fotos).
 */
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) return new Response("Necesitás entrar a la app", { status: 401 });
  const { fileId } = await params;
  const v = await fila<{ nombre_archivo: string | null; mime: string | null }>(sql`
    select nombre_archivo, mime from documento_versiones where drive_file_id = ${fileId} limit 1
  `);
  if (!v) return new Response("No encontrado", { status: 404 });

  try {
    const token = await tokenDrive();
    const auth = { Authorization: `Bearer ${token}` };
    const url = new URL(request.url);

    if (url.searchParams.get("mini")) {
      const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink`, { headers: auth });
      const { thumbnailLink } = (await meta.json()) as { thumbnailLink?: string };
      if (thumbnailLink) {
        const mini = await fetch(thumbnailLink.replace(/=s\d+$/, "=s400"), { headers: auth });
        if (mini.ok) {
          return new Response(mini.body, {
            headers: { "Content-Type": mini.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" },
          });
        }
      }
      // Sin miniatura (Drive todavía la está generando): va el archivo entero.
    }

    const headers: Record<string, string> = { ...auth };
    const rango = request.headers.get("range");
    if (rango) headers.Range = rango;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
    if (!res.ok && res.status !== 206) return new Response("No se pudo obtener el archivo", { status: res.status });

    const salida = new Headers();
    salida.set("Content-Type", v.mime ?? res.headers.get("content-type") ?? "application/octet-stream");
    salida.set("Cache-Control", "private, max-age=31536000, immutable");
    salida.set("Accept-Ranges", "bytes");
    for (const h of ["content-range", "content-length"]) {
      const valor = res.headers.get(h);
      if (valor) salida.set(h, valor);
    }
    if (v.nombre_archivo) {
      // inline: el PDF o la foto se abren en el navegador; con el nombre real si se descarga.
      salida.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(v.nombre_archivo)}`);
    }
    return new Response(res.body, { status: res.status, headers: salida });
  } catch (e) {
    console.error(`[drive] ${fileId}:`, e);
    return new Response("Error al obtener el archivo", { status: 500 });
  }
}
