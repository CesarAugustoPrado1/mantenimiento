"use client";

import { upload } from "@vercel/blob/client";

export type ArchivoSubido = { url: string; nombre: string; mime: string; tamano: number };

/**
 * Sube un archivo directo del navegador a Vercel Blob (como entregas-app).
 * Lo que sigue (guardarlo y pasarlo a Drive) lo hace el servidor.
 */
export async function subirArchivo(archivo: File, alProgresar?: (pct: number) => void): Promise<ArchivoSubido> {
  const limpio = archivo.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
  const blob = await upload(`archivos/${limpio}`, archivo, {
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
