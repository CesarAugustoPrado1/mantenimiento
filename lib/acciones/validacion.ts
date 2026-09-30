import { z } from "zod";

/** Piezas de validación compartidas por las actions. */

export const id = z.number().int().positive();

export const texto = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const nombre = z.string().trim().min(1, "El nombre no puede estar vacío.").max(120);

/** Número que llega de un input: "" o null = sin dato. */
export const numOpcional = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hay un número mal escrito." });
      return z.NEVER;
    }
    return n;
  });

export const num = (mensaje = "Falta un número.") =>
  numOpcional.refine((v): v is number => v != null, mensaje).transform((v) => v as number);

export const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.");
export const fechaOpcional = z
  .union([fecha, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/** numeric de Postgres: se escribe como string. */
export const aNumeric = (n: number | null) => (n == null ? null : String(n));
