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
