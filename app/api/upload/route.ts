import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { sesionActual } from "@/lib/auth";
import { modoSubida } from "@/lib/archivos-servidor";
import { OPERAN } from "@/lib/permisos";

/**
 * Permiso para que el navegador suba el archivo directo a Vercel Blob, sin
 * pasar por el servidor (así no hay límite de 4,5 MB por pedido). Igual que en
 * entregas-app. Después, la action guarda el registro y lo pasa a Drive.
 *
 * Sirve para los dos tipos de store: con BLOB_READ_WRITE_TOKEN (token de
 * cliente) o con BLOB_STORE_ID + OIDC (URL firmada), que es lo que crea
 * Vercel hoy al conectar un Blob store nuevo.
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
const MAXIMO = 200 * 1024 * 1024;

async function autorizado() {
  const sesion = await sesionActual();
  if (!sesion || !OPERAN.includes(sesion.rol)) throw new Error("No autorizado");
}

export async function POST(request: Request) {
  const body = await request.json();
  try {
    if (modoSubida() === "firmada") {
      const respuesta = await handleUploadPresigned({
        body: body as HandleUploadPresignedBody,
        request,
        getSignedToken: async (pathname) => {
          await autorizado();
          const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: TIPOS,
            maximumSizeInBytes: MAXIMO,
            validUntil: Date.now() + 60 * 60 * 1000,
          });
          return { token, urlOptions: { allowedContentTypes: TIPOS, maximumSizeInBytes: MAXIMO, addRandomSuffix: true } };
        },
      });
      return Response.json(respuesta);
    }
    const respuesta = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async () => {
        await autorizado();
        return { allowedContentTypes: TIPOS, addRandomSuffix: true, maximumSizeInBytes: MAXIMO };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(respuesta);
  } catch (e) {
    console.error("[upload]", e);
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
