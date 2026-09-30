import { test } from "node:test";
import assert from "node:assert/strict";
import { compraSugerida, coberturaDias, nivelDeStock, validarUmbrales } from "../lib/semaforo";
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
