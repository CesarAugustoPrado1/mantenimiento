import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { sesionActual } from "@/lib/auth";
import { OPERAN } from "@/lib/permisos";

/**
 * Token para que el navegador suba el archivo directo a Vercel Blob, sin pasar
 * por el servidor (así no hay límite de 4,5 MB por pedido). Igual que en
 * entregas-app. Después, la action guarda el registro y lo pasa a Drive.
 */
const TIPOS = [
  "image/*",
  "video/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.*",
  "application/vnd.ms-excel",
  "application/zip",
  "application/octet-stream",
  "application/acad",
  "image/vnd.dwg",
  "text/plain",
];

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const respuesta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const sesion = await sesionActual();
        if (!sesion || !OPERAN.includes(sesion.rol)) throw new Error("No autorizado");
        return { allowedContentTypes: TIPOS, addRandomSuffix: true, maximumSizeInBytes: 200 * 1024 * 1024 };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(respuesta);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
