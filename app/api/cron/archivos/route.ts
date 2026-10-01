import { pasarPendientesADrive } from "@/lib/archivos-servidor";

/** Todos los días: pasa a Drive lo que haya quedado en Blob por un fallo. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    return Response.json(await pasarPendientesADrive());
  } catch (e) {
    console.error("[cron archivos]", e);
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
