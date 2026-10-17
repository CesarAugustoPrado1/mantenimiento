"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { filas } from "../db/filas";
import { autorizar } from "../auth";
import { CLAVE_MODO_PRUEBA, enModoPrueba } from "../configuracion";
import { CONFIRMACION, TABLAS_DE_DATOS } from "../datos-prueba";
import { ejecutar, fallar, type Resultado } from "./comun";

const esquema = z.object({ confirmacion: z.string() });

// Los nombres salen de una constante del código, nunca de la entrada.
const TRUNCATE = sql.raw(`truncate table ${TABLAS_DE_DATOS.map((t) => `"${t}"`).join(", ")} restart identity`);

/**
 * Los archivos viven fuera de la base (Drive y Vercel Blob). Se anotan antes de
 * vaciar las tablas y se borran después de responder. Las carpetas de Drive se
 * olvidan junto con los datos: si no, el equipo nuevo con id 1 caería en la
 * carpeta del equipo viejo con id 1. La carpeta principal queda.
 */
async function copiasDeArchivos() {
  const versiones = await filas<{ url: string; drive_file_id: string | null }>(sql`select url, drive_file_id from documento_versiones`);
  const carpetas = await filas<{ folder_id: string }>(sql`select folder_id from drive_carpetas where clave <> 'raiz'`);
  return { versiones, carpetas: carpetas.map((c) => c.folder_id) };
}

const OLVIDAR_CARPETAS = sql`delete from drive_carpetas where clave <> 'raiz'`;

function borrarCopiasDespues(copias: Awaited<ReturnType<typeof copiasDeArchivos>>) {
  after(async () => {
    const { borrarCopiasDe, borrarCarpetasDeDrive } = await import("../archivos-servidor");
    await borrarCopiasDe(copias.versiones);
    await borrarCarpetasDeDrive(copias.carpetas);
  });
}

async function validar(entrada: z.input<typeof esquema>) {
  await autorizar("admin");
  const d = esquema.parse(entrada);
  if (!(await enModoPrueba())) fallar("La instalación no está en etapa de prueba: el borrado está deshabilitado.");
  if (d.confirmacion.trim().toUpperCase() !== CONFIRMACION) fallar(`Escribí ${CONFIRMACION} para confirmar.`);
}

/** Borra todo lo cargado y sigue en etapa de prueba, para volver a probar. */
export async function borrarDatosDePrueba(entrada: z.input<typeof esquema>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await validar(entrada);
    const copias = await copiasDeArchivos();
    await db.transaction(async (tx) => {
      await tx.execute(TRUNCATE);
      await tx.execute(OLVIDAR_CARPETAS);
    });
    borrarCopiasDespues(copias);
    revalidatePath("/", "layout");
  });
}

/**
 * Borra todo y apaga el modo prueba en una sola operación, porque es una sola
 * decisión: "esto era prueba, ahora empezamos en serio". Separarlas dejaría
 * el estado peligroso de datos reales con el botón de borrar puesto. Desde la
 * app no se vuelve a prender.
 */
export async function terminarEtapaDePrueba(entrada: z.input<typeof esquema>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await validar(entrada);
    const copias = await copiasDeArchivos();
    await db.transaction(async (tx) => {
      await tx.execute(TRUNCATE);
      await tx.execute(OLVIDAR_CARPETAS);
      await tx.execute(
        sql`insert into config (clave, valor) values (${CLAVE_MODO_PRUEBA}, 'no')
            on conflict (clave) do update set valor = 'no'`,
      );
    });
    borrarCopiasDespues(copias);
    revalidatePath("/", "layout");
  });
}
