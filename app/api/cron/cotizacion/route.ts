import { actualizarCotizaciones } from "@/lib/cotizacion";

/**
 * La llama Vercel Cron todos los días hábiles (ver vercel.json). Vercel manda
 * `Authorization: Bearer <CRON_SECRET>`; sin esa variable configurada la ruta
 * no hace nada, así nadie de afuera puede dispararla.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    return Response.json(await actualizarCotizaciones());
  } catch (e) {
    console.error("[cron cotizacion]", e);
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
