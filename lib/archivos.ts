/**
 * Links de archivos. Módulo puro: reconoce links de Google Drive para mostrar
 * miniaturas de las fotos sin descargarlas.
 */
import type { Etapa, TipoDocumento } from "./db/schema";

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  plano: "Plano",
  despiece: "Despiece",
  manual: "Manual",
  foto: "Foto",
  certificado: "Certificado",
  otro: "Otro",
};

export const ICONO_TIPO: Record<TipoDocumento, string> = {
  plano: "📐",
  despiece: "🧩",
  manual: "📘",
  foto: "📷",
  certificado: "📄",
  otro: "📎",
};

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  antes: "Antes",
  durante: "Durante",
  despues: "Después",
};

export function esUrl(texto: string): boolean {
  try {
    const u = new URL(texto.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * El id de un archivo de Drive, en cualquiera de las formas en que se copia:
 *   drive.google.com/file/d/<id>/view?usp=sharing
 *   drive.google.com/open?id=<id>
 *   drive.google.com/uc?id=<id>&export=download
 *   docs.google.com/document/d/<id>/edit
 * Las carpetas (drive/folders/<id>) no son archivos: devuelven null.
 */
export function idDeDrive(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)google\.com$/.test(u.hostname)) return null;
  if (u.pathname.includes("/folders/")) return null;
  const porRuta = u.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
  if (porRuta) return porRuta[1];
  const porParametro = u.searchParams.get("id");
  return porParametro && /^[A-Za-z0-9_-]{10,}$/.test(porParametro) ? porParametro : null;
}

export function esCarpetaDrive(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return /(^|\.)google\.com$/.test(u.hostname) && u.pathname.includes("/folders/");
  } catch {
    return false;
  }
}

/**
 * Miniatura para mostrar una foto en la galería. Drive la sirve si el
 * archivo está compartido "cualquiera con el link". Para otras imágenes
 * (terminan en .jpg, .png…) se usa el link tal cual.
 */
export function miniatura(url: string, ancho = 400, mime?: string | null): string | null {
  // Subido desde la app: lo sirve la app misma, con la miniatura de Drive.
  if (url.startsWith("/api/drive/")) return !mime || mime.startsWith("image/") ? `${url}?mini=1` : null;
  // Recién subido, todavía en Vercel Blob: la imagen se sirve tal cual.
  if (mime?.startsWith("image/") && /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) return url;
  const id = idDeDrive(url);
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w${ancho}`;
  return /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(url) ? url : null;
}
