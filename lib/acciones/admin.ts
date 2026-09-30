"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { cotizaciones, usuarios } from "../db/schema";
import { autorizar, hashPin } from "../auth";
import { CONFIGURAN, ROLES } from "../permisos";
import { ejecutar, fallar, type Resultado } from "./comun";
import { fecha, id, num, texto } from "./validacion";

const esquemaUsuario = z.object({
  id: id.optional(),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "El usuario va en minúsculas, sin espacios, de 3 a 30 letras."),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(80),
  rol: z.enum(ROLES as [string, ...string[]]),
  activo: z.boolean(),
  pin: z.string().optional(),
});

export async function guardarUsuario(entrada: z.input<typeof esquemaUsuario>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    const yo = await autorizar("admin");
    const d = esquemaUsuario.parse(entrada);
    const pin = d.pin?.trim() ?? "";
    if (pin && !/^\d{4,8}$/.test(pin)) fallar("El PIN son entre 4 y 8 números.");
    if (!d.id && !pin) fallar("Un usuario nuevo necesita PIN.");
    if (d.id === yo.uid && (!d.activo || d.rol !== "admin")) {
      fallar("No podés quitarte a vos mismo el rol de administrador ni darte de baja.");
    }

    const [otro] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.usuario, d.usuario));
    if (otro && otro.id !== d.id) fallar("Ya existe ese usuario.");

    const rol = d.rol as (typeof ROLES)[number];
    if (d.id) {
      await db
        .update(usuarios)
        .set({
          usuario: d.usuario,
          nombre: d.nombre,
          rol,
          activo: d.activo,
          ...(pin ? { pinHash: await hashPin(pin), intentosFallidos: 0, bloqueadoHasta: null } : {}),
        })
        .where(eq(usuarios.id, d.id));
    } else {
      await db.insert(usuarios).values({
        usuario: d.usuario,
        nombre: d.nombre,
        rol,
        activo: d.activo,
        pinHash: await hashPin(pin),
      });
    }
    revalidatePath("/admin/usuarios");
  });
}

export async function destrabarUsuario(usuarioId: number): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar("admin");
    await db
      .update(usuarios)
      .set({ intentosFallidos: 0, bloqueadoHasta: null })
      .where(eq(usuarios.id, usuarioId));
    revalidatePath("/admin/usuarios");
  });
}

const esquemaCotizacion = z.object({
  fecha,
  arsPorUsd: num("Poné la cotización."),
  nota: texto(120),
});

export async function guardarCotizacion(entrada: z.input<typeof esquemaCotizacion>): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    const d = esquemaCotizacion.parse(entrada);
    if (d.arsPorUsd <= 0) fallar("La cotización tiene que ser mayor que cero.");
    await db
      .insert(cotizaciones)
      .values({ fecha: d.fecha, arsPorUsd: String(d.arsPorUsd), nota: d.nota })
      .onConflictDoUpdate({
        target: cotizaciones.fecha,
        set: { arsPorUsd: String(d.arsPorUsd), nota: d.nota },
      });
    revalidatePath("/admin/cotizaciones");
    revalidatePath("/informes");
  });
}

export async function borrarCotizacion(dia: string): Promise<Resultado<void>> {
  return ejecutar(async () => {
    await autorizar(...CONFIGURAN);
    await db.delete(cotizaciones).where(eq(cotizaciones.fecha, fecha.parse(dia)));
    revalidatePath("/admin/cotizaciones");
  });
}
