/**
 * Qué borra el borrado de la etapa de prueba: todo lo cargado en la operación.
 *
 * Lo que NO se borra, a propósito:
 * - usuarios: un borrado que se los lleva te deja afuera de tu propia app;
 * - causas de falla, categorías (de insumos y de herramientas) y cotizaciones: son configuración
 *   (y las cotizaciones son datos reales que vienen de internet);
 * - config.
 *
 * La lista va entera en un solo TRUNCATE y SIN cascade: si mañana se agrega una
 * tabla que apunta a alguna de estas y nadie la suma acá, el borrado falla en
 * vez de llevarse algo que no estaba en la lista.
 */
export const TABLAS_DE_DATOS = [
  "cargas_combustible",
  "compra_items",
  "compras",
  "obra_subtarea_avances",
  "obra_subtareas",
  "obra_notas",
  "obras",
  "trabajo_avances",
  "activo_cambios_estado",
  "trabajo_tareas",
  "trabajos",
  "plan_materiales",
  "plan_tareas",
  "planes",
  "lecturas",
  "activo_repuestos",
  "movimientos_insumo",
  "insumos",
  "herramientas",
  "herramienta_tipos",
  "activos",
] as const;

export const CONFIRMACION = "BORRAR";
