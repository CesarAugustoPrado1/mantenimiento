import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { driveCarpetas } from "./db/schema";

/**
 * Google Drive como depósito de archivos, invisible para el usuario: la app
 * sube, ordena en carpetas y sirve los archivos con sus propias credenciales.
 * Es el mismo esquema que entregas-app (OAuth con refresh token de la cuenta
 * dueña de los archivos).
 *
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   DRIVE_CARPETA_ID   (opcional) carpeta raíz; si no está, se crea
 *                      "Mantenimiento y Taller" en la raíz del Drive.
 */
export function driveConfigurado(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

let tokenCache: { token: string; vence: number } | null = null;

export async function tokenDrive(): Promise<string> {
  if (tokenCache && tokenCache.vence > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Drive no dio token: " + JSON.stringify(data));
  tokenCache = { token: data.access_token, vence: Date.now() + (data.expires_in ?? 3000) * 1000 };
  return data.access_token;
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenDrive();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(55000),
  });
  if (!res.ok) throw new Error(`Drive ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

async function crearCarpeta(nombre: string, padre: string | null): Promise<string> {
  const c = await api<{ id: string }>("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      ...(padre ? { parents: [padre] } : {}),
    }),
  });
  return c.id;
}

/**
 * La carpeta de una ruta lógica, creándola si hace falta. Cada tramo tiene una
 * clave estable ("maquinas/12") y un nombre visible ("Carrusel de mesas"): la
 * clave es la que se recuerda, así un cambio de nombre no duplica carpetas.
 */
export async function carpetaDe(ruta: Array<{ clave: string; nombre: string }>): Promise<string> {
  let padre: string;
  const [raiz] = await db.select().from(driveCarpetas).where(eq(driveCarpetas.clave, "raiz"));
  if (raiz) padre = raiz.folderId;
  else {
    padre = process.env.DRIVE_CARPETA_ID || (await crearCarpeta("Mantenimiento y Taller", null));
    await db.insert(driveCarpetas).values({ clave: "raiz", folderId: padre }).onConflictDoNothing();
    const [ganadora] = await db.select().from(driveCarpetas).where(eq(driveCarpetas.clave, "raiz"));
    padre = ganadora.folderId;
  }
  for (const tramo of ruta) {
    const [hay] = await db.select().from(driveCarpetas).where(eq(driveCarpetas.clave, tramo.clave));
    if (hay) {
      padre = hay.folderId;
      continue;
    }
    const id = await crearCarpeta(tramo.nombre, padre);
    await db.insert(driveCarpetas).values({ clave: tramo.clave, folderId: id }).onConflictDoNothing();
    // Si otro pedido la creó al mismo tiempo, gana la que quedó en la tabla.
    const [ganadora] = await db.select().from(driveCarpetas).where(eq(driveCarpetas.clave, tramo.clave));
    padre = ganadora.folderId;
  }
  return padre;
}

/** Sube a Drive el archivo que está en `origen` (una URL de Vercel Blob). */
export async function subirADrive(origen: string, nombre: string, mime: string, carpetaId: string) {
  const archivo = await fetch(origen, { signal: AbortSignal.timeout(55000) });
  if (!archivo.ok) throw new Error(`No se pudo bajar el archivo original (${archivo.status})`);
  const datos = Buffer.from(await archivo.arrayBuffer());
  const limite = "limite_" + Date.now();
  const cuerpo = Buffer.concat([
    Buffer.from(
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, parents: [carpetaId] })}\r\n`,
    ),
    Buffer.from(`--${limite}\r\nContent-Type: ${mime}\r\n\r\n`),
    datos,
    Buffer.from(`\r\n--${limite}--`),
  ]);
  return api<{ id: string; size?: string }>(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size",
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${limite}` }, body: cuerpo },
  );
}

/** Borra definitivamente (no a la papelera, que sigue ocupando cupo). 404 = ya no está. */
export async function borrarDeDrive(fileId: string) {
  const token = await tokenDrive();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`No se pudo borrar ${fileId} de Drive (${res.status})`);
}
