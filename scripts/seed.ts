/**
 * Datos iniciales. Es IDEMPOTENTE y no pisa lo que ya existe.
 *
 *   npm run db:seed                    admin + causas + categorías
 *   npm run db:seed -- --con-ejemplos  además, usuarios y datos de ejemplo
 */
import { config as cargarEnv } from "dotenv";
cargarEnv({ path: [".env.local", ".env"], quiet: true });

import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import { normalizarUrl } from "../lib/db";
import * as schema from "../lib/db/schema";
import { CATEGORIAS, CAUSAS } from "./datos-base";
import { filasNumeradas } from "../lib/planilla";

const {
  activos,
  cargasCombustible,
  categoriasInsumo,
  causas,
  cotizaciones,
  herramientas,
  herramientaTipos,
  insumos,
  lecturas,
  movimientosInsumo,
  planes,
  planMateriales,
  planTareas,
  usuarios,
} = schema;

const conEjemplos = process.argv.includes("--con-ejemplos");

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (o DIRECT_URL) en .env.local");
  const cliente = postgres(normalizarUrl(url), { prepare: false, max: 1 });
  const db = drizzle(cliente, { schema });

  const pin = process.env.ADMIN_PIN ?? "1234";
  const [admin] = await db.select().from(usuarios).where(eq(usuarios.usuario, "admin"));
  if (!admin) {
    await db.insert(usuarios).values({
      usuario: "admin",
      nombre: "Administrador",
      rol: "admin",
      pinHash: await bcrypt.hash(pin, 10),
    });
    console.log(`✓ Usuario admin creado (PIN ${pin}). Cambialo desde Configuración → Usuarios.`);
  }

  await db.insert(causas).values(CAUSAS).onConflictDoNothing();
  await db
    .insert(categoriasInsumo)
    .values(CATEGORIAS.map((nombre) => ({ nombre })))
    .onConflictDoNothing();
  console.log("✓ Causas y categorías");

  if (conEjemplos) await ejemplos(db, pin);
  await cliente.end();
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function ejemplos(db: Db, pin: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(activos);
  if (n > 0) {
    console.log("· Ya hay equipos cargados: no se agregan ejemplos.");
    return;
  }
  const hash = await bcrypt.hash(pin, 10);
  const gente = await db
    .insert(usuarios)
    .values([
      { usuario: "jefe", nombre: "Jefe de taller", rol: "jefe_taller" as const, pinHash: hash },
      { usuario: "tecnico1", nombre: "Técnico 1", rol: "tecnico" as const, pinHash: hash },
      { usuario: "chofer1", nombre: "Chofer 1", rol: "conductor" as const, pinHash: hash },
      { usuario: "auditoria", nombre: "Auditoría", rol: "auditor" as const, pinHash: hash },
    ])
    .onConflictDoNothing()
    .returning();
  const id = (u: string) => gente.find((g) => g.usuario === u)?.id ?? null;
  const [adm] = await db.select().from(usuarios).where(eq(usuarios.usuario, "admin"));

  const cats = await db.select().from(categoriasInsumo);
  const cat = (n: string) => cats.find((c) => c.nombre === n)?.id ?? null;

  const hoy = new Date();
  const dia = (d: number) => new Date(hoy.getTime() - d * 86400000).toISOString().slice(0, 10);

  const ins = await db
    .insert(insumos)
    .values([
      { nombre: 'Disco de corte 4½" (115 mm)', categoriaId: cat("Abrasivos y discos"), unidad: "unidad", critico: "10", atento: "25", ideal: "50", infaltable: true },
      { nombre: 'Disco de desbaste 4½"', categoriaId: cat("Abrasivos y discos"), unidad: "unidad", critico: "5", atento: "10", ideal: "20", infaltable: true },
      { nombre: "Electrodo 2,5 mm (6013)", categoriaId: cat("Soldadura"), unidad: "kg", critico: "2", atento: "5", ideal: "10", infaltable: true },
      { nombre: "Caño estructural 40x40x1,6", categoriaId: cat("Perfiles y caños"), unidad: "barra", critico: "5", atento: "10", ideal: "20" },
      { nombre: "Aceite motor 15W40", categoriaId: cat("Lubricantes y fluidos"), unidad: "l", critico: "8", atento: "16", ideal: "40" },
      { nombre: "Grasa multipropósito", categoriaId: cat("Lubricantes y fluidos"), unidad: "kg", critico: "1", atento: "3", ideal: "6" },
      { nombre: "Filtro de aceite Hilux", categoriaId: cat("Filtros"), unidad: "unidad", critico: "0", atento: "1", ideal: "2" },
      { nombre: "Guantes de trabajo", categoriaId: cat("Seguridad (EPP)"), unidad: "par", critico: "5", atento: "10", ideal: "24", infaltable: true },
      { nombre: "Gasoil (tambor)", categoriaId: cat("Combustibles"), unidad: "l", critico: "40", atento: "80", ideal: "200" },
    ])
    .returning();
  const stocks = [30, 4, 6, 8, 40, 2, 1, 12, 150];
  for (let i = 0; i < ins.length; i++) {
    await db.insert(movimientosInsumo).values({
      insumoId: ins[i].id,
      tipo: "ajuste",
      cantidad: String(stocks[i]),
      stockAntes: "0",
      stockDespues: String(stocks[i]),
      fecha: dia(60),
      usuarioId: adm.id,
      nota: "Stock inicial",
    });
    await db.update(insumos).set({ stock: String(stocks[i]) }).where(eq(insumos.id, ins[i].id));
  }

  const eq_ = await db
    .insert(activos)
    .values([
      {
        clase: "maquina" as const, tipo: "Mezcladora", nombre: "Mezcladora planetaria 1", codigo: "MZ-01", marca: "—", ubicacion: "Nave 1",
        caracteristicas: [{ clave: "Potencia", valor: "15 HP" }, { clave: "Capacidad", valor: "750 l" }],
      },
      { clase: "maquina" as const, tipo: "Compresor", nombre: "Compresor a tornillo", codigo: "CP-01", ubicacion: "Sala de compresores", medidor: "horas" as const },
      {
        clase: "vehiculo" as const, tipo: "Camioneta", nombre: "Hilux blanca", patente: "AB123CD", marca: "Toyota", modelo: "Hilux 2.8", anio: 2021,
        medidor: "km" as const, responsableId: id("chofer1"), combustible: "diesel" as const,
        caracteristicas: [{ clave: "Aceite de motor", valor: "15W40 — 7,5 l" }, { clave: "Cubiertas", valor: "265/65 R17" }],
      },
      { clase: "vehiculo" as const, tipo: "Autoelevador", nombre: "Clark 2", codigo: "AE-02", marca: "Clark", anio: 2015, medidor: "horas" as const, ubicacion: "Playa", combustible: "diesel" as const },
      { clase: "vehiculo" as const, tipo: "Autoelevador", nombre: "Clark 1", codigo: "AE-01", marca: "Clark", anio: 2012, medidor: "horas" as const, ubicacion: "Playa", combustible: "nafta" as const },
      { clase: "maquina" as const, tipo: "Carrusel", nombre: "Carrusel de mesas", codigo: "EPACK", ubicacion: "Epack" },
      { clase: "maquina" as const, tipo: "Línea / sector", nombre: "Sector Piedra", codigo: "PIEDRA", ubicacion: "Piedra" },
      { clase: "maquina" as const, tipo: "Trompo", nombre: "Trompo 2", codigo: "TR-02", ubicacion: "Piedra" },
      { clase: "maquina" as const, tipo: "Túnel", nombre: "Túnel", codigo: "TUN-01", ubicacion: "Piedra" },
    ])
    .returning();
  const [, , , clark2, clark1, carrusel, piedra, trompo, tunel] = eq_;

  await db.insert(lecturas).values([
    { activoId: eq_[1].id, fecha: dia(90), valor: "11200", usuarioId: adm.id },
    { activoId: eq_[1].id, fecha: dia(5), valor: "11820", usuarioId: adm.id },
    { activoId: eq_[2].id, fecha: dia(120), valor: "72000", usuarioId: adm.id },
    { activoId: eq_[2].id, fecha: dia(60), valor: "78500", usuarioId: adm.id },
    { activoId: eq_[2].id, fecha: dia(10), valor: "84200", usuarioId: adm.id },
    { activoId: eq_[3].id, fecha: dia(40), valor: "8120", usuarioId: adm.id },
  ]);

  // Combustible: un bidón de 20 L cada ~6 horas de clark, durante 4 meses.
  let horas = 8120;
  for (let d = 38; d >= 1; d -= 3) {
    horas += 6 + (d % 5);
    await db.insert(lecturas).values({ activoId: clark2.id, fecha: dia(d), valor: String(horas), usuarioId: adm.id }).onConflictDoNothing();
    await db.insert(cargasCombustible).values({ activoId: clark2.id, fecha: dia(d), litros: "20", lectura: String(horas), usuarioId: adm.id });
  }
  await db.insert(lecturas).values({ activoId: clark1.id, fecha: dia(20), valor: "15230", usuarioId: adm.id });

  const pls = await db
    .insert(planes)
    .values([
      { activoId: eq_[0].id, nombre: "Engrase general", cadaDias: 30, responsableId: id("tecnico1"), desdeFecha: dia(27) },
      { activoId: eq_[1].id, nombre: "Cambio de aceite y filtros", cadaUso: 2000, cadaDias: 365, avisoUso: 200, responsableId: id("tecnico1"), desdeFecha: dia(200), desdeUso: "10000" },
      { activoId: eq_[2].id, nombre: "Service 10.000 km", cadaUso: 10000, cadaDias: 365, avisoUso: 1000, responsableExterno: "Concesionaria oficial", desdeFecha: dia(150), desdeUso: "75000" },
      { activoId: eq_[2].id, nombre: "VTV", cadaDias: 365, avisoDias: 30, responsableId: id("chofer1"), desdeFecha: dia(350) },
      { activoId: eq_[3].id, nombre: "Service 250 horas", cadaUso: 250, avisoUso: 25, responsableId: id("tecnico1"), desdeFecha: dia(90), desdeUso: "7900" },
    ])
    .returning();
  const [pClark, pCarrusel, pPiedra] = await db
    .insert(planes)
    .values([
      { activoId: clark1.id, nombre: "Control de clark", cadaDias: 7, responsableId: id("tecnico1"), desdeFecha: dia(8) },
      {
        activoId: carrusel.id, nombre: "Control carrusel de mesas", cadaDias: 7, responsableId: id("tecnico1"), desdeFecha: dia(3),
        columnas: ["Vidrios", "Ruedas", "Arrastres", "Guías", "Tramo de cadena"],
      },
      {
        activoId: piedra.id, nombre: "Revisión diaria sector Piedra", cadaDias: 1, avisoDias: 0, responsableId: id("tecnico1"), desdeFecha: dia(1),
        columnas: ["Limpieza", "Rotura", "Desgaste", "Falla", "Cambiar"],
      },
    ])
    .returning();
  const sec = (planId: number, orden0: number, seccion: string | null, activoId: number | null, ...d: string[]) =>
    d.map((descripcion, i) => ({ planId, orden: orden0 + i, seccion, activoId, accion: "chequear" as const, descripcion }));
  await db.insert(planTareas).values([
    ...sec(pClark.id, 0, null, null, "Nivel aceite motor", "Nivel aceite hidráulico", "Nivel líquido refrigerante"),
    { planId: pClark.id, orden: 3, accion: "limpiar" as const, descripcion: "Limpieza filtro de aire" },
    { planId: pClark.id, orden: 4, accion: "lubricar" as const, descripcion: "Engrase" },
    ...sec(pCarrusel.id, 0, null, null, ...filasNumeradas("Mesa", 1, 108)),
    ...sec(pPiedra.id, 0, "Trompo 2", trompo.id, "Motor", "Reductor", "Tablero", "Tambor", "Plataforma"),
    ...sec(pPiedra.id, 10, "Mesa vibrado", null, "Resortes", "Teclas", "Cables", "Tapa de mesa", "Batea", "Cucharas", "Mezclador"),
    ...sec(pPiedra.id, 20, "Sistema de agua", null, "Manguera", "Pico de agua"),
    ...sec(pPiedra.id, 30, "Túnel", tunel.id, "Motores", "Cinta transportadora", "Resistencias", "Sensores", "Cuchilla", "Cinta de cuchilla", "Rodamientos"),
  ]);
  await db.insert(planTareas).values([
    { planId: pls[0].id, orden: 0, accion: "lubricar", descripcion: "Rodamientos del eje principal" },
    { planId: pls[0].id, orden: 1, accion: "chequear", descripcion: "Tensión de correas" },
    { planId: pls[0].id, orden: 2, accion: "limpiar", descripcion: "Paletas y batea" },
    { planId: pls[2].id, orden: 0, accion: "cambiar", descripcion: "Aceite de motor" },
    { planId: pls[2].id, orden: 1, accion: "cambiar", descripcion: "Filtro de aceite" },
    { planId: pls[2].id, orden: 2, accion: "chequear", descripcion: "Correas y cubiertas" },
    { planId: pls[4].id, orden: 0, accion: "cambiar", descripcion: "Aceite de motor" },
    { planId: pls[4].id, orden: 1, accion: "lubricar", descripcion: "Mástil y cadenas" },
    { planId: pls[4].id, orden: 2, accion: "chequear", descripcion: "Frenos y dirección" },
  ]);
  await db.insert(planMateriales).values([
    { planId: pls[0].id, insumoId: ins[5].id, cantidad: "0.5" },
    { planId: pls[2].id, insumoId: ins[4].id, cantidad: "7.5" },
    { planId: pls[2].id, insumoId: ins[6].id, cantidad: "1" },
    { planId: pls[4].id, insumoId: ins[4].id, cantidad: "6" },
  ]);

  const tipos = await db
    .insert(herramientaTipos)
    .values([
      { nombre: 'Amoladora 4½"', categoria: "Eléctricas", requeridas: 4 },
      { nombre: "Soldadora inverter", categoria: "Soldadura", requeridas: 2 },
      { nombre: "Taladro percutor", categoria: "Eléctricas", requeridas: 2 },
    ])
    .returning();
  await db.insert(herramientas).values([
    { tipoId: tipos[0].id, marca: "Bosch", estado: "bueno" as const },
    { tipoId: tipos[0].id, marca: "Bosch", estado: "regular" as const },
    { tipoId: tipos[0].id, marca: "Makita", estado: "en_reparacion" as const, ubicacion: "Service externo" },
    { tipoId: tipos[1].id, marca: "Lusqtoff", estado: "bueno" as const },
    { tipoId: tipos[1].id, marca: "Gamma", estado: "bueno" as const },
    { tipoId: tipos[2].id, marca: "Dewalt", estado: "bueno" as const },
  ]);

  await db
    .insert(cotizaciones)
    .values([{ fecha: dia(90), arsPorUsd: "1250", nota: "Ejemplo" }])
    .onConflictDoNothing();

  console.log(`✓ Ejemplos: usuarios jefe, tecnico1, chofer1, auditoria (PIN ${pin}), 9 equipos (con carrusel, sector Piedra y clarks), 9 insumos.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
