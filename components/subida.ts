"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";

/**
 * Cómo sube el navegador a Vercel Blob. "token": stores con
 * BLOB_READ_WRITE_TOKEN (como entregas-app). "firmada": stores nuevos, que al
 * conectarlos solo crean BLOB_STORE_ID y se autentican por OIDC.
 */
export type ModoSubida = "token" | "firmada";

export type ArchivoSubido = { url: string; nombre: string; mime: string; tamano: number };

/**
 * Sube un archivo directo del navegador a Vercel Blob (como entregas-app).
 * Lo que sigue (guardarlo y pasarlo a Drive) lo hace el servidor.
 */
export async function subirArchivo(archivo: File, modo: ModoSubida, alProgresar?: (pct: number) => void): Promise<ArchivoSubido> {
  const limpio = archivo.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
  const subir = modo === "firmada" ? uploadPresigned : upload;
  const blob = await subir(`archivos/${limpio}`, archivo, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType: archivo.type || undefined,
    onUploadProgress: (e) => alProgresar?.(Math.round(e.percentage)),
  });
  return { url: blob.url, nombre: archivo.name, mime: archivo.type || "application/octet-stream", tamano: archivo.size };
}

/** "Plano eje corona.pdf" -> "Plano eje corona". */
export function tituloDeArchivo(nombre: string): string {
  return nombre.replace(/\.[A-Za-z0-9]{1,6}$/, "").replace(/[_-]+/g, " ").trim();
}
