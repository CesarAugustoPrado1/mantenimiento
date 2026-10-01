import { test } from "node:test";
import assert from "node:assert/strict";
import { compraSugerida, coberturaDias, nivelDeStock, umbralesRepuesto, validarUmbrales } from "../lib/semaforo";
import { calcularVencimiento, ritmoDeUso, type EntradaVencimiento } from "../lib/vencimientos";

test("semáforo: el ejemplo del caño 40x40", () => {
  assert.equal(nivelDeStock(5, 5, 10), "rojo");
  assert.equal(nivelDeStock(0, 5, 10), "rojo");
  assert.equal(nivelDeStock(6, 5, 10), "amarillo");
  assert.equal(nivelDeStock(10, 5, 10), "amarillo");
  assert.equal(nivelDeStock(11, 5, 10), "verde");
});

test("compra sugerida: hasta el ideal, solo si no está en verde", () => {
  assert.equal(compraSugerida(4, 5, 10, 20), 16);
  assert.equal(compraSugerida(8, 5, 10, 20), 12);
  assert.equal(compraSugerida(15, 5, 10, 20), 0);
});

test("cobertura: sin consumo no se inventa un número", () => {
  assert.equal(coberturaDias(10, 0), null);
  assert.equal(coberturaDias(10, 30), 10);
});

test("umbrales incoherentes se rechazan", () => {
  assert.ok(validarUmbrales(10, 5, 20));
  assert.equal(validarUmbrales(0, 0, 1), null); // sin franja amarilla: válido
  assert.ok(validarUmbrales(5, 10, 8));
  assert.equal(validarUmbrales(5, 10, 20), null);
});

const base: EntradaVencimiento = {
  cadaDias: null,
  cadaUso: null,
  avisoDias: 7,
  avisoUso: null,
  baseFecha: null,
  baseUso: null,
  usoActual: null,
  fechaUsoActual: null,
  ritmo: null,
  hoy: "2026-10-01",
};

test("vence por tiempo", () => {
  const v = calcularVencimiento({ ...base, cadaDias: 30, baseFecha: "2026-09-01" });
  assert.equal(v.venceFecha, "2026-10-01");
  assert.equal(v.estado, "vencido");
  const w = calcularVencimiento({ ...base, cadaDias: 30, baseFecha: "2026-09-05" });
  assert.equal(w.estado, "proximo");
  assert.equal(w.faltanDias, 4);
  const z = calcularVencimiento({ ...base, cadaDias: 90, baseFecha: "2026-09-05" });
  assert.equal(z.estado, "al_dia");
});

test("vence por km, con fecha estimada por el ritmo", () => {
  const v = calcularVencimiento({
    ...base,
    cadaUso: 10000,
    baseUso: 50000,
    usoActual: 58000,
    fechaUsoActual: "2026-10-01",
    ritmo: 100,
  });
  assert.equal(v.faltaUso, 2000);
  assert.equal(v.fechaAgenda, "2026-10-21");
  assert.equal(v.estimada, true);
  assert.equal(v.estado, "al_dia");
});

test("lo que llegue primero: el km gana aunque falte tiempo", () => {
  const v = calcularVencimiento({
    ...base,
    cadaDias: 365,
    baseFecha: "2026-06-01",
    cadaUso: 10000,
    baseUso: 50000,
    usoActual: 60500,
    fechaUsoActual: "2026-09-28",
    ritmo: 100,
  });
  assert.equal(v.estado, "vencido");
});

test("aviso por uso", () => {
  const v = calcularVencimiento({
    ...base,
    cadaUso: 250,
    avisoUso: 25,
    baseUso: 1000,
    usoActual: 1230,
    fechaUsoActual: "2026-10-01",
  });
  assert.equal(v.estado, "proximo");
});

test("sin base no hay vencimiento", () => {
  assert.equal(calcularVencimiento({ ...base, cadaDias: 30 }).estado, "sin_datos");
});

test("ritmo: pide al menos una semana entre lecturas", () => {
  assert.equal(ritmoDeUso({ fecha: "2026-09-01", valor: 1000 }, { fecha: "2026-09-03", valor: 1300 }), null);
  assert.equal(ritmoDeUso({ fecha: "2026-09-01", valor: 1000 }, { fecha: "2026-10-01", valor: 4000 }), 100);
});

test("una estimación por km que ya pasó se muestra como hoy", () => {
  const v = calcularVencimiento({
    ...base,
    cadaUso: 10000,
    baseUso: 75000,
    usoActual: 84200,
    fechaUsoActual: "2026-09-01",
    ritmo: 114,
  });
  assert.equal(v.fechaAgenda, base.hoy);
  assert.equal(v.estado, "proximo");
});

import { columnasDe, filasNumeradas, hallazgos, resumenFila, tituloHallazgo } from "../lib/planilla";
import { consumoAlto, rendimientoMensual, rendimientoPeriodo } from "../lib/combustible";
import { leerHistorial, leerHoy } from "../lib/cotizacion-api";

test("planilla: columnas por defecto y resumen de fila", () => {
  assert.deepEqual(columnasDe([]), ["Estado"]);
  assert.deepEqual(columnasDe([" Vidrios ", ""]), ["Vidrios"]);
  assert.equal(resumenFila({ Vidrios: "ok", Ruedas: "mal" }), "no_ok");
  assert.equal(resumenFila({ Vidrios: "ok", Ruedas: "na" }), "ok");
  assert.equal(resumenFila({ Vidrios: "na" }), "no_aplica");
});

test("planilla: las 108 mesas del carrusel", () => {
  const f = filasNumeradas("Mesa", 1, 108);
  assert.equal(f.length, 108);
  assert.equal(f[107], "Mesa 108");
  assert.deepEqual(filasNumeradas("x", 5, 1), []);
});

test("planilla: cada ✗ es un hallazgo con su título", () => {
  const h = hallazgos([
    { seccion: "Túnel", descripcion: "Cuchilla", activoId: 7, valores: { Falla: "mal", Limpieza: "ok" } },
    { seccion: null, descripcion: "Mesa 17", activoId: null, valores: { Ruedas: "mal" } },
  ]);
  assert.equal(h.length, 2);
  assert.equal(tituloHallazgo(h[0]), "Túnel · Cuchilla: Falla");
  assert.equal(h[0].activoId, 7);
  assert.equal(tituloHallazgo({ seccion: null, fila: "Engrase", columna: "Estado", activoId: null }), "Engrase");
});

test("combustible: litros entre lecturas / horas entre lecturas", () => {
  const lecturas = [
    { fecha: "2026-09-01", valor: 1000 },
    { fecha: "2026-09-15", valor: 1040 },
    { fecha: "2026-09-30", valor: 1080 },
  ];
  const cargas = [
    { fecha: "2026-09-01", litros: 20 }, // antes de medir: no cuenta
    { fecha: "2026-09-10", litros: 20 },
    { fecha: "2026-09-15", litros: 20 },
    { fecha: "2026-09-25", litros: 20 },
  ];
  const r = rendimientoPeriodo(lecturas, cargas, "2026-09-01", "2026-09-30")!;
  assert.equal(r.litros, 60);
  assert.equal(r.uso, 80);
  assert.equal(r.porUnidad, 0.75);
  assert.equal(r.unidadesPorLitro!.toFixed(3), "1.333");
  assert.equal(rendimientoPeriodo(lecturas.slice(0, 1), cargas, "2026-09-01", "2026-09-30"), null);
});

test("combustible: por mes y alerta de consumo alto", () => {
  const lecturas = ["05", "06", "07", "08", "09", "10"].map((m, i) => ({ fecha: `2026-${m}-28`, valor: 1000 + i * 100 }));
  const normal = ["06", "07", "08", "09"].map((m) => ({ fecha: `2026-${m}-10`, litros: 50 }));
  const meses = rendimientoMensual(lecturas, [...normal, { fecha: "2026-10-10", litros: 50 }]);
  assert.equal(meses[0].mes, "2026-10");
  assert.equal(meses[0].porUnidad, 0.5);
  assert.equal(consumoAlto(meses), false);
  const alto = rendimientoMensual(lecturas, [...normal, { fecha: "2026-10-10", litros: 80 }]);
  assert.equal(consumoAlto(alto), true);
});

test("cotización: historial y respaldo del día", () => {
  const h = leerHistorial(
    [
      { casa: "oficial", compra: 900, venta: 950, fecha: "2023-12-29" },
      { casa: "oficial", compra: 1400, venta: 1450, fecha: "2026-09-29" },
      { casa: "oficial", venta: null, fecha: "2026-09-30" },
    ],
    "2024-01-01",
  );
  assert.deepEqual(h, [{ fecha: "2026-09-29", arsPorUsd: 1450 }]);
  assert.deepEqual(leerHoy({ venta: 1460 }, "2026-09-30"), { fecha: "2026-09-30", arsPorUsd: 1460 });
  assert.equal(leerHoy({}, "2026-09-30"), null);
  assert.deepEqual(leerHistorial({ error: "x" }, "2024-01-01"), []);
});

test("repuestos: semáforo desde el mínimo a tener", () => {
  const eje = umbralesRepuesto(1);
  assert.deepEqual(eje, { critico: 0, atento: 0, ideal: 1 });
  assert.equal(nivelDeStock(0, eje.critico, eje.atento), "rojo");
  assert.equal(nivelDeStock(1, eje.critico, eje.atento), "verde");
  const rulemanes = umbralesRepuesto(10);
  assert.equal(nivelDeStock(6, rulemanes.critico, rulemanes.atento), "amarillo");
  assert.equal(nivelDeStock(10, rulemanes.critico, rulemanes.atento), "verde");
  assert.equal(compraSugerida(6, rulemanes.critico, rulemanes.atento, rulemanes.ideal), 4);
});

import { avanceObra, desvio, fechasTrasAvance, resumir, textoDesvio } from "../lib/cumplimiento";

test("obras: el ejemplo del local de Catamarca", () => {
  const fin = desvio("2026-11-05", "2026-11-20", "2026-12-01");
  assert.deepEqual(fin, { tipo: "cumplido", dias: 15 });
  assert.equal(textoDesvio(fin), "15 días tarde");
  const inicio = desvio("2026-10-10", "2026-10-15", "2026-12-01");
  assert.equal(textoDesvio(inicio), "5 días tarde");
  assert.equal(textoDesvio(desvio("2026-11-05", null, "2026-11-08")), "3 días de atraso");
  assert.equal(textoDesvio(desvio("2026-11-05", null, "2026-11-01")), "faltan 4 días");
  assert.equal(textoDesvio(desvio("2026-11-05", "2026-11-03", "2026-11-08")), "2 días antes");
  assert.equal(desvio(null, "2026-11-03", "2026-11-08").tipo, "sin_plan");
});

test("obras: resumen de cumplimiento", () => {
  const r = resumir([
    desvio("2026-11-05", "2026-11-20", "2026-12-01"), // tarde 15
    desvio("2026-11-05", "2026-11-05", "2026-12-01"), // a tiempo
    desvio("2026-11-25", null, "2026-12-01"), // vencida 6
    desvio("2026-12-20", null, "2026-12-01"), // pendiente: no cuenta
    desvio(null, null, "2026-12-01"), // sin plan: no cuenta
  ]);
  assert.equal(r.medidos, 3);
  assert.equal(r.aTiempo, 1);
  assert.equal(r.porcentaje, 33);
  assert.equal(r.atrasoPromedio, 10.5);
});

test("obras: avance promedio y fechas reales automáticas", () => {
  assert.equal(avanceObra([{ progreso: 100 }, { progreso: 50 }, { progreso: 0 }, { progreso: 25 }]), 44);
  assert.equal(avanceObra([]), null);
  const base = { progreso: 0, inicioReal: null, finReal: null };
  assert.deepEqual(fechasTrasAvance(base, 25, "2026-10-15"), { inicioReal: "2026-10-15", finReal: null });
  const empezada = { progreso: 75, inicioReal: "2026-10-15", finReal: null };
  assert.deepEqual(fechasTrasAvance(empezada, 100, "2026-11-20"), { inicioReal: "2026-10-15", finReal: "2026-11-20" });
  const terminada = { progreso: 100, inicioReal: "2026-10-15", finReal: "2026-11-20" };
  assert.deepEqual(fechasTrasAvance(terminada, 75, "2026-11-22"), { inicioReal: "2026-10-15", finReal: null });
  assert.deepEqual(fechasTrasAvance(empezada, 0, "2026-11-22"), { inicioReal: null, finReal: null });
});

import { esCarpetaDrive, esUrl, idDeDrive, miniatura } from "../lib/archivos";

test("archivos: reconoce los links de Drive como se copian", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  assert.equal(idDeDrive(`https://drive.google.com/file/d/${id}/view?usp=sharing`), id);
  assert.equal(idDeDrive(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(idDeDrive(`https://drive.google.com/uc?id=${id}&export=download`), id);
  assert.equal(idDeDrive(`https://docs.google.com/document/d/${id}/edit`), id);
  assert.equal(idDeDrive(`https://drive.google.com/drive/folders/${id}`), null);
  assert.equal(idDeDrive("https://ejemplo.com/file/d/xxxxxxxxxxxx"), null);
  assert.equal(esCarpetaDrive(`https://drive.google.com/drive/folders/${id}?usp=sharing`), true);
  assert.equal(miniatura(`https://drive.google.com/file/d/${id}/view`), `https://drive.google.com/thumbnail?id=${id}&sz=w400`);
  assert.equal(miniatura("https://x.com/plano.pdf"), null);
  assert.equal(miniatura("https://x.com/foto.JPG"), "https://x.com/foto.JPG");
  assert.equal(miniatura("/api/drive/abc123", 400, "image/jpeg"), "/api/drive/abc123?mini=1");
  assert.equal(miniatura("/api/drive/abc123", 400, "application/pdf"), null);
  assert.equal(miniatura("https://x1.public.blob.vercel-storage.com/archivos/a-1.jpg", 400, "image/jpeg"), "https://x1.public.blob.vercel-storage.com/archivos/a-1.jpg");
  assert.equal(esUrl("drive.google.com/x"), false);
  assert.equal(esUrl("javascript:alert(1)"), false);
});

import { avanceOrden, eficiencia, horasPorUnidad, materialesPara } from "../lib/fabricacion";

test("fabricación: avance, horas por unidad y eficiencia", () => {
  assert.equal(avanceOrden(12, 7), 58);
  assert.equal(avanceOrden(12, 15), 100);
  assert.equal(avanceOrden(0, 3), 0);
  assert.equal(horasPorUnidad(30, 4), 7.5);
  assert.equal(horasPorUnidad(10, 0), null);
  assert.equal(eficiencia(6, 7.5), 80); // tardó más que el estándar
  assert.equal(eficiencia(6, 4.8), 125); // tardó menos
  assert.equal(eficiencia(null, 5), null);
});

test("fabricación: materiales según la receta", () => {
  const receta = [
    { insumoId: 4, cantidad: 2.5 }, // caño 40x40, barras por esqueleto
    { insumoId: 3, cantidad: 0.3 }, // electrodos kg
    { insumoId: 3, cantidad: 0.1 }, // otra línea del mismo insumo: se suma
    { insumoId: null, cantidad: 1 }, // algo que no es del pañol: no se descuenta
  ];
  assert.deepEqual(materialesPara(receta, 4), [
    { insumoId: 4, cantidad: 10 },
    { insumoId: 3, cantidad: 1.6 },
  ]);
  assert.deepEqual(materialesPara(receta, 0), []);
});

import { dentroDeVentana, esViolacionFK } from "../lib/borrado";

test("borrado por error: solo dentro de las 24 horas", () => {
  const ahora = new Date("2026-10-02T12:00:00Z");
  assert.equal(dentroDeVentana("2026-10-02 09:00:00+00", ahora), true);
  assert.equal(dentroDeVentana("2026-10-01T12:30:00Z", ahora), true);
  assert.equal(dentroDeVentana("2026-10-01T11:00:00Z", ahora), false);
  assert.equal(dentroDeVentana("cualquier cosa", ahora), false);
  assert.equal(esViolacionFK({ code: "23503" }), true);
  assert.equal(esViolacionFK({ cause: { code: "23503" } }), true);
  assert.equal(esViolacionFK(new Error("x")), false);
});
