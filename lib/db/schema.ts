import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `admin`        todo, incluidos los usuarios.
 * `jefe_taller`  el usuario principal: opera y configura todo menos usuarios.
 * `tecnico`      hace los trabajos: ve la agenda, registra preventivos y
 *                correctivos, consume insumos.
 * `conductor`    empleado con vehículo en la app: carga el km de SU vehículo y
 *                reporta fallas. No ve el resto.
 * `auditor`      ve todo y no escribe nada, en ninguna pantalla.
 *
 * Igual que en las otras apps, la navegación se separa por rol y cada server
 * action revalida por su cuenta con `autorizar()`.
 */
export const rolEnum = pgEnum("rol", [
  "admin",
  "jefe_taller",
  "tecnico",
  "conductor",
  "auditor",
]);
export type Rol = (typeof rolEnum.enumValues)[number];

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  usuario: text("usuario").notNull().unique(),
  nombre: text("nombre").notNull(),
  pinHash: text("pin_hash").notNull(),
  rol: rolEnum("rol").notNull(),
  activo: boolean("activo").notNull().default(true),
  intentosFallidos: integer("intentos_fallidos").notNull().default(0),
  bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});
export type Usuario = typeof usuarios.$inferSelect;

/** Parámetros que se cambian sin desplegar. */
export const config = pgTable("config", {
  clave: text("clave").primaryKey(),
  valor: text("valor").notNull(),
});

/**
 * Cotización del dólar por fecha: la respuesta al problema de la inflación.
 *
 * Los montos se guardan en PESOS, tal cual se pagaron, con su fecha. Nunca se
 * guarda el monto convertido: los informes buscan la cotización vigente a la
 * fecha de cada gasto (la última cargada con fecha <= la del gasto). Así, si
 * una cotización se carga mal, se corrige acá y todos los informes se arreglan
 * solos. Ver DISENO.md §4.
 */
export const cotizaciones = pgTable("cotizaciones", {
  fecha: date("fecha").primaryKey(),
  arsPorUsd: numeric("ars_por_usd", { precision: 12, scale: 2 }).notNull(),
  nota: text("nota"),
  /**
   * "manual" o "auto:<casa>" (auto:oficial, auto:bolsa...). La carga
   * automática nunca pisa una manual: si alguien la corrigió a mano, manda.
   */
  fuente: text("fuente").notNull().default("manual"),
});

/* -------------------------------------------------------------------------- */
/* Insumos de taller                                                          */
/* -------------------------------------------------------------------------- */

export const categoriasInsumo = pgTable("categorias_insumo", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  activa: boolean("activa").notNull().default(true),
});

/**
 * Un insumo con su semáforo.
 *
 *   stock <= critico            rojo
 *   critico < stock <= atento   amarillo
 *   stock > atento              verde
 *
 * `ideal` es hasta dónde se repone: la compra sugerida es `ideal - stock`.
 * `stock` es un cache de la suma de movimientos; lo escribe SOLO el motor de
 * lib/acciones/insumos.ts, en la misma transacción que el movimiento.
 */
export const insumos = pgTable(
  "insumos",
  {
    id: serial("id").primaryKey(),
    codigo: text("codigo"),
    nombre: text("nombre").notNull(),
    categoriaId: integer("categoria_id").references(() => categoriasInsumo.id),
    unidad: text("unidad").notNull().default("unidad"),
    stock: numeric("stock", { precision: 12, scale: 2 }).notNull().default("0"),
    critico: numeric("critico", { precision: 12, scale: 2 }).notNull().default("0"),
    atento: numeric("atento", { precision: 12, scale: 2 }).notNull().default("0"),
    ideal: numeric("ideal", { precision: 12, scale: 2 }).notNull().default("0"),
    /** Lo que no puede faltar nunca en el taller: discos de corte, electrodos. */
    infaltable: boolean("infaltable").notNull().default(false),
    /**
     * Repuesto de máquina (rulemán, eje, correa) y no consumible de taller.
     * Se vincula a las máquinas en `activo_repuestos`.
     */
    esRepuesto: boolean("es_repuesto").notNull().default(false),
    /**
     * Días que tarda en conseguirse o fabricarse si no hay. Es lo que convierte
     * un repuesto en crítico: un eje que hay que mandar a tornear son días de
     * producción parada.
     */
    tiempoReposicionDias: integer("tiempo_reposicion_dias"),
    ubicacion: text("ubicacion"),
    proveedor: text("proveedor"),
    nota: text("nota"),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("insumos_codigo_uq").on(t.codigo)],
);

export const tipoMovInsumoEnum = pgEnum("tipo_mov_insumo", [
  "ingreso",
  "consumo",
  "ajuste",
]);
export type TipoMovInsumo = (typeof tipoMovInsumoEnum.enumValues)[number];

/**
 * Historial de stock. `cantidad` va con signo (+ entra, − sale) y cada fila
 * guarda el antes y el después, así el historial se puede auditar solo.
 * Un consumo puede decir para qué fue: una máquina/vehículo, un trabajo o una
 * obra. De ahí sale el consumo por equipo.
 */
export const movimientosInsumo = pgTable(
  "movimientos_insumo",
  {
    id: serial("id").primaryKey(),
    insumoId: integer("insumo_id").notNull().references(() => insumos.id),
    tipo: tipoMovInsumoEnum("tipo").notNull(),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    stockAntes: numeric("stock_antes", { precision: 12, scale: 2 }).notNull(),
    stockDespues: numeric("stock_despues", { precision: 12, scale: 2 }).notNull(),
    fecha: date("fecha").notNull().defaultNow(),
    usuarioId: integer("usuario_id").notNull().references(() => usuarios.id),
    activoId: integer("activo_id").references(() => activos.id),
    trabajoId: integer("trabajo_id").references(() => trabajos.id),
    obraId: integer("obra_id").references(() => obras.id),
    compraId: integer("compra_id").references(() => compras.id),
    /** Solo en ingresos: precio unitario en pesos a la fecha. */
    precioUnitario: numeric("precio_unitario", { precision: 14, scale: 2 }),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mov_insumo_insumo_idx").on(t.insumoId, t.fecha),
    index("mov_insumo_activo_idx").on(t.activoId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Herramientas del taller                                                    */
/* -------------------------------------------------------------------------- */

/**
 * El TIPO dice cuántas hacen falta ("amoladora 4½": 4). Las UNIDADES son las
 * que existen, cada una con su estado. Faltante = requeridas − unidades
 * utilizables (bueno o regular). Una en reparación no cuenta: hoy no está.
 */
/** Eléctricas, Manuales, Medición… Una lista: no se escribe cualquier cosa. */
export const categoriasHerramienta = pgTable("categorias_herramienta", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  activa: boolean("activa").notNull().default(true),
});

export const herramientaTipos = pgTable("herramienta_tipos", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  categoriaId: integer("categoria_id").references(() => categoriasHerramienta.id),
  requeridas: integer("requeridas").notNull().default(1),
  nota: text("nota"),
  activo: boolean("activo").notNull().default(true),
});

export const estadoHerramientaEnum = pgEnum("estado_herramienta", [
  "bueno",
  "regular",
  "en_reparacion",
  "baja",
]);
export type EstadoHerramienta = (typeof estadoHerramientaEnum.enumValues)[number];

export const herramientas = pgTable("herramientas", {
  id: serial("id").primaryKey(),
  tipoId: integer("tipo_id").notNull().references(() => herramientaTipos.id),
  codigo: text("codigo"),
  marca: text("marca"),
  estado: estadoHerramientaEnum("estado").notNull().default("bueno"),
  /** Dónde está o quién la tiene. */
  ubicacion: text("ubicacion"),
  nota: text("nota"),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Activos: máquinas de fábrica y vehículos                                    */
/* -------------------------------------------------------------------------- */

/**
 * Máquinas y vehículos son la MISMA tabla a propósito: los dos tienen plan
 * preventivo, correctivos, consumo de insumos e historial. Lo que cambia es el
 * medidor (km, horas de motor o ninguno) y unos pocos datos de vehículo.
 * Un clark es un vehículo que se mide en horas.
 */
export const claseActivoEnum = pgEnum("clase_activo", ["maquina", "vehiculo"]);
export type ClaseActivo = (typeof claseActivoEnum.enumValues)[number];

export const medidorEnum = pgEnum("medidor", ["ninguno", "km", "horas"]);
export type Medidor = (typeof medidorEnum.enumValues)[number];

/**
 * `en_reparacion` y `fuera_de_servicio` son distintos a propósito: los dos
 * están parados, pero en reparación alguien está trabajando en la máquina;
 * fuera de servicio está esperando (un repuesto, un técnico, una decisión).
 * Mezclarlos esconde el tiempo muerto de verdad.
 */
export const estadoActivoEnum = pgEnum("estado_activo", [
  "operativo",
  "con_falla",
  "en_reparacion",
  "fuera_de_servicio",
  "baja",
]);
export type EstadoActivo = (typeof estadoActivoEnum.enumValues)[number];

export const propiedadEnum = pgEnum("propiedad", ["empresa", "empleado"]);
export type Propiedad = (typeof propiedadEnum.enumValues)[number];

export const combustibleEnum = pgEnum("combustible", ["diesel", "nafta", "gnc", "electrico"]);
export type Combustible = (typeof combustibleEnum.enumValues)[number];

export type Caracteristica = { clave: string; valor: string };

export const activos = pgTable(
  "activos",
  {
    id: serial("id").primaryKey(),
    clase: claseActivoEnum("clase").notNull(),
    /** Prensa, Mezcladora, Autoelevador, Camioneta, Auto... texto libre. */
    tipo: text("tipo").notNull(),
    nombre: text("nombre").notNull(),
    codigo: text("codigo"),
    marca: text("marca"),
    modelo: text("modelo"),
    anio: integer("anio"),
    numeroSerie: text("numero_serie"),
    patente: text("patente"),
    ubicacion: text("ubicacion"),
    propiedad: propiedadEnum("propiedad").notNull().default("empresa"),
    /** Vehículo de un empleado, o el conductor habitual de uno de la empresa. */
    responsableId: integer("responsable_id").references(() => usuarios.id),
    medidor: medidorEnum("medidor").notNull().default("ninguno"),
    /** Null = no carga combustible (o no nos interesa medirlo). */
    combustible: combustibleEnum("combustible"),
    estado: estadoActivoEnum("estado").notNull().default("operativo"),
    /** Ficha técnica libre: potencia, capacidad, aceite que lleva, etc. */
    caracteristicas: jsonb("caracteristicas").$type<Caracteristica[]>().notNull().default([]),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("activos_codigo_uq").on(t.codigo)],
);

/** Kilometraje u horómetro. Una lectura por activo y día. */
export const lecturas = pgTable(
  "lecturas",
  {
    id: serial("id").primaryKey(),
    activoId: integer("activo_id").notNull().references(() => activos.id),
    fecha: date("fecha").notNull(),
    valor: numeric("valor", { precision: 12, scale: 1 }).notNull(),
    usuarioId: integer("usuario_id").notNull().references(() => usuarios.id),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lecturas_activo_fecha_uq").on(t.activoId, t.fecha)],
);

/* -------------------------------------------------------------------------- */
/* Repuestos críticos                                                         */
/* -------------------------------------------------------------------------- */

export const criticidadEnum = pgEnum("criticidad", ["alta", "media", "baja"]);
export type Criticidad = (typeof criticidadEnum.enumValues)[number];

/**
 * Qué repuestos conviene tener para cada máquina. El mismo repuesto puede
 * servir a varias (el rulemán del carrusel y del trompo), y en cada una con su
 * criticidad: `alta` = si se rompe y no está, para la producción.
 */
export const activoRepuestos = pgTable(
  "activo_repuestos",
  {
    id: serial("id").primaryKey(),
    activoId: integer("activo_id").notNull().references(() => activos.id),
    insumoId: integer("insumo_id").notNull().references(() => insumos.id),
    /** Dónde va: "eje de la corona", "ruedas de las mesas". */
    dondeVa: text("donde_va"),
    criticidad: criticidadEnum("criticidad").notNull().default("alta"),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("activo_repuestos_uq").on(t.activoId, t.insumoId)],
);

/* -------------------------------------------------------------------------- */
/* Planes preventivos                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Un mantenimiento que se repite: "Cambio de aceite y filtro", "Engrase
 * general", "VTV". Vence por TIEMPO (`cadaDias`), por USO (`cadaUso`, en la
 * unidad del medidor del activo) o por lo que ocurra primero.
 *
 * La última vez que se hizo no se guarda acá: sale del último trabajo
 * preventivo cerrado de este plan. Si nunca se hizo, se cuenta desde
 * `desdeFecha` / `desdeUso`.
 */
export const planes = pgTable("planes", {
  id: serial("id").primaryKey(),
  activoId: integer("activo_id").notNull().references(() => activos.id),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  cadaDias: integer("cada_dias"),
  cadaUso: integer("cada_uso"),
  avisoDias: integer("aviso_dias").notNull().default(7),
  avisoUso: integer("aviso_uso"),
  responsableId: integer("responsable_id").references(() => usuarios.id),
  /** Concesionaria, service oficial, tornería... cuando no lo hace nadie de adentro. */
  responsableExterno: text("responsable_externo"),
  /** Herramientas que hacen falta, en texto: "llave de filtro, bandeja". */
  herramientas: text("herramientas"),
  desdeFecha: date("desde_fecha"),
  desdeUso: numeric("desde_uso", { precision: 12, scale: 1 }),
  /**
   * Las columnas de la planilla. Vacío = una sola columna ("Estado").
   * Ej. carrusel: Vidrios, Ruedas, Arrastres, Guías, Tramo de cadena.
   * Ej. revisión de sector: Limpieza, Rotura, Desgaste, Falla, Cambiar.
   * Cada celda se marca ✓ (bien), ✗ (mal) o — (no se revisó).
   */
  columnas: jsonb("columnas").$type<string[]>().notNull().default([]),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const accionTareaEnum = pgEnum("accion_tarea", [
  "chequear",
  "cambiar",
  "ajustar",
  "limpiar",
  "lubricar",
  "otro",
]);
export type AccionTarea = (typeof accionTareaEnum.enumValues)[number];

/**
 * Una fila de la planilla. `seccion` agrupa ("Trompo 2", "Túnel") y
 * `activoId` dice a qué equipo pertenece esa sección cuando la planilla
 * recorre varios (la revisión diaria de un sector): un ✗ ahí abre el
 * correctivo sobre ESE equipo, no sobre el sector.
 */
export const planTareas = pgTable("plan_tareas", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => planes.id, { onDelete: "cascade" }),
  orden: integer("orden").notNull().default(0),
  seccion: text("seccion"),
  activoId: integer("activo_id").references(() => activos.id),
  accion: accionTareaEnum("accion").notNull().default("chequear"),
  descripcion: text("descripcion").notNull(),
});

/** Lo que hace falta tener a mano. Si apunta a un insumo, se ve si hay stock. */
export const planMateriales = pgTable("plan_materiales", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => planes.id, { onDelete: "cascade" }),
  insumoId: integer("insumo_id").references(() => insumos.id),
  descripcion: text("descripcion"),
  cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull().default("1"),
});

/* -------------------------------------------------------------------------- */
/* Trabajos: preventivos hechos y correctivos                                 */
/* -------------------------------------------------------------------------- */

export const tipoTrabajoEnum = pgEnum("tipo_trabajo", ["preventivo", "correctivo"]);
export type TipoTrabajo = (typeof tipoTrabajoEnum.enumValues)[number];

export const estadoTrabajoEnum = pgEnum("estado_trabajo", ["abierto", "en_curso", "cerrado"]);
export type EstadoTrabajo = (typeof estadoTrabajoEnum.enumValues)[number];

export const prioridadEnum = pgEnum("prioridad", ["baja", "media", "alta", "urgente"]);
export type Prioridad = (typeof prioridadEnum.enumValues)[number];

export const resultadoTareaEnum = pgEnum("resultado_tarea", [
  "ok",
  "corregido",
  "no_ok",
  "no_aplica",
]);
export type ResultadoTarea = (typeof resultadoTareaEnum.enumValues)[number];

/** Por qué se rompió. Se van agregando desde configuración. */
export const causas = pgTable("causas", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  descripcion: text("descripcion"),
  activa: boolean("activa").notNull().default(true),
});

/**
 * Un trabajo sobre un activo.
 *
 * Preventivo: sale de un plan, se registra ya hecho (estado cerrado) con su
 *   checklist. Es lo que reinicia el contador del plan.
 * Correctivo: lo que sale de lo esperado. Se abre con la falla, puede quedar
 *   en curso, y se cierra con la causa y la solución.
 *
 * Los montos van en pesos a la fecha del trabajo (ver `cotizaciones`).
 */
export const trabajos = pgTable(
  "trabajos",
  {
    id: serial("id").primaryKey(),
    activoId: integer("activo_id").notNull().references(() => activos.id),
    tipo: tipoTrabajoEnum("tipo").notNull(),
    planId: integer("plan_id").references(() => planes.id),
    estado: estadoTrabajoEnum("estado").notNull().default("abierto"),
    prioridad: prioridadEnum("prioridad").notNull().default("media"),
    titulo: text("titulo").notNull(),
    fecha: date("fecha").notNull(),
    fechaCierre: date("fecha_cierre"),
    /** Km u horas al momento del trabajo. */
    lectura: numeric("lectura", { precision: 12, scale: 1 }),
    reportadoPorId: integer("reportado_por_id").notNull().references(() => usuarios.id),
    realizadoPorId: integer("realizado_por_id").references(() => usuarios.id),
    realizadoExterno: text("realizado_externo"),
    /** Correctivo: qué se vio. */
    falla: text("falla"),
    causaId: integer("causa_id").references(() => causas.id),
    solucion: text("solucion"),
    /** Horas que el equipo estuvo parado por esto. */
    horasParada: numeric("horas_parada", { precision: 8, scale: 1 }),
    horasHombre: numeric("horas_hombre", { precision: 8, scale: 1 }),
    costoManoObra: numeric("costo_mano_obra", { precision: 14, scale: 2 }),
    /** Repuestos comprados afuera para este trabajo (no salen del pañol). */
    costoRepuestos: numeric("costo_repuestos", { precision: 14, scale: 2 }),
    observaciones: text("observaciones"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trabajos_activo_idx").on(t.activoId, t.fecha),
    index("trabajos_plan_idx").on(t.planId, t.fecha),
  ],
);

export type ValorCelda = "ok" | "mal" | "na";

/**
 * Copia de la fila de la planilla tal como se completó. `valores` guarda cada
 * celda por nombre de columna; `resultado` es el resumen de la fila (no_ok si
 * alguna celda dio mal) para poder consultarlo sin abrir el json.
 */
export const trabajoTareas = pgTable("trabajo_tareas", {
  id: serial("id").primaryKey(),
  trabajoId: integer("trabajo_id").notNull().references(() => trabajos.id, { onDelete: "cascade" }),
  seccion: text("seccion"),
  activoId: integer("activo_id").references(() => activos.id),
  accion: accionTareaEnum("accion").notNull(),
  descripcion: text("descripcion").notNull(),
  valores: jsonb("valores").$type<Record<string, ValorCelda>>().notNull().default({}),
  resultado: resultadoTareaEnum("resultado").notNull(),
  nota: text("nota"),
});

/* -------------------------------------------------------------------------- */
/* Obras y tareas externas                                                    */
/* -------------------------------------------------------------------------- */

export const estadoObraEnum = pgEnum("estado_obra", [
  "pendiente",
  "en_curso",
  "terminada",
  "cancelada",
]);
export type EstadoObra = (typeof estadoObraEnum.enumValues)[number];

/** Armado de locales, arreglos en oficinas, todo lo que no es una máquina. */
export const obras = pgTable("obras", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  lugar: text("lugar").notNull(),
  tipo: text("tipo"),
  descripcion: text("descripcion"),
  estado: estadoObraEnum("estado").notNull().default("pendiente"),
  prioridad: prioridadEnum("prioridad").notNull().default("media"),
  /** Lo comprometido: "empieza el 10/10, está el 5/11". */
  inicioPlan: date("inicio_plan"),
  finPlan: date("fin_plan"),
  /** Lo que pasó. Si la obra tiene subtareas, se completan solas con ellas. */
  fechaInicio: date("fecha_inicio"),
  fechaFin: date("fecha_fin"),
  responsableId: integer("responsable_id").references(() => usuarios.id),
  responsableExterno: text("responsable_externo"),
  horasHombre: numeric("horas_hombre", { precision: 8, scale: 1 }),
  costoManoObra: numeric("costo_mano_obra", { precision: 14, scale: 2 }),
  costoMateriales: numeric("costo_materiales", { precision: 14, scale: 2 }),
  creadoPorId: integer("creado_por_id").notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const obraNotas = pgTable("obra_notas", {
  id: serial("id").primaryKey(),
  obraId: integer("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id),
  texto: text("texto").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Las partes de una obra: pintura, piso, instalación eléctrica, muestrarios.
 * El avance va por escalones fijos (0, 25, 50, 75, 100): "empezado, por la
 * mitad, avanzado, terminado" se dice igual en todas las obras y se puede
 * comparar; un 37% no lo mide nadie.
 */
export const obraSubtareas = pgTable(
  "obra_subtareas",
  {
    id: serial("id").primaryKey(),
    obraId: integer("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull().default(0),
    titulo: text("titulo").notNull(),
    responsableId: integer("responsable_id").references(() => usuarios.id),
    responsableExterno: text("responsable_externo"),
    inicioPlan: date("inicio_plan"),
    finPlan: date("fin_plan"),
    /** Se completan solas al registrar el avance (primer paso > 0 y el 100). */
    inicioReal: date("inicio_real"),
    finReal: date("fin_real"),
    progreso: integer("progreso").notNull().default(0),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("obra_subtareas_obra_idx").on(t.obraId, t.orden)],
);

/** Cada cambio de avance, con su fecha: es la historia de la obra. */
export const obraSubtareaAvances = pgTable("obra_subtarea_avances", {
  id: serial("id").primaryKey(),
  subtareaId: integer("subtarea_id").notNull().references(() => obraSubtareas.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull(),
  progresoAntes: integer("progreso_antes").notNull(),
  progreso: integer("progreso").notNull(),
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id),
  nota: text("nota"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Historial de estado de los equipos y avances de las reparaciones           */
/* -------------------------------------------------------------------------- */

/**
 * Cada cambio de estado de un equipo, con cuándo y quién. Con esto se puede
 * calcular cuánto tiempo estuvo en reparación o fuera de servicio.
 */
export const activoCambiosEstado = pgTable(
  "activo_cambios_estado",
  {
    id: serial("id").primaryKey(),
    activoId: integer("activo_id").notNull().references(() => activos.id),
    desde: estadoActivoEnum("desde").notNull(),
    hasta: estadoActivoEnum("hasta").notNull(),
    trabajoId: integer("trabajo_id").references(() => trabajos.id),
    usuarioId: integer("usuario_id").notNull().references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activo_cambios_estado_idx").on(t.activoId, t.creadoEn)],
);

/** La bitácora de una reparación: qué se hizo cada día. */
export const trabajoAvances = pgTable("trabajo_avances", {
  id: serial("id").primaryKey(),
  trabajoId: integer("trabajo_id").notNull().references(() => trabajos.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull(),
  texto: text("texto").notNull(),
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Compras                                                                    */
/* -------------------------------------------------------------------------- */

export const estadoCompraEnum = pgEnum("estado_compra", [
  "borrador",
  "pedida",
  "recibida",
  "cancelada",
]);
export type EstadoCompra = (typeof estadoCompraEnum.enumValues)[number];

/**
 * La compra mensual o quincenal. Se arma sola desde el semáforo (todo lo que
 * está en amarillo o rojo, hasta el ideal), se ajusta a mano, y al recibirla
 * genera los ingresos de stock.
 */
export const compras = pgTable("compras", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  fecha: date("fecha").notNull(),
  estado: estadoCompraEnum("estado").notNull().default("borrador"),
  proveedor: text("proveedor"),
  nota: text("nota"),
  creadoPorId: integer("creado_por_id").notNull().references(() => usuarios.id),
  recibidaEn: date("recibida_en"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const compraItems = pgTable("compra_items", {
  id: serial("id").primaryKey(),
  compraId: integer("compra_id").notNull().references(() => compras.id, { onDelete: "cascade" }),
  /** Null = algo que no es insumo de pañol (una herramienta, un repuesto puntual). */
  insumoId: integer("insumo_id").references(() => insumos.id),
  descripcion: text("descripcion").notNull(),
  cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
  recibido: numeric("recibido", { precision: 12, scale: 2 }),
  precioUnitario: numeric("precio_unitario", { precision: 14, scale: 2 }),
});

/* -------------------------------------------------------------------------- */
/* Combustible                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Cada bidón (o carga) que se le pone a un equipo. Con la lectura del
 * horómetro/odómetro al cargar, el consumo sale exacto: litros cargados entre
 * dos lecturas / horas (o km) entre esas lecturas. Si viene de un insumo del
 * pañol (tambor de gasoil), también se descuenta de ahí.
 */
export const cargasCombustible = pgTable(
  "cargas_combustible",
  {
    id: serial("id").primaryKey(),
    activoId: integer("activo_id").notNull().references(() => activos.id),
    fecha: date("fecha").notNull(),
    litros: numeric("litros", { precision: 10, scale: 2 }).notNull(),
    /** Horas o km al momento de cargar. */
    lectura: numeric("lectura", { precision: 12, scale: 1 }),
    /** Pesos por litro, a la fecha. Opcional. */
    precioLitro: numeric("precio_litro", { precision: 12, scale: 2 }),
    insumoId: integer("insumo_id").references(() => insumos.id),
    usuarioId: integer("usuario_id").notNull().references(() => usuarios.id),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cargas_activo_idx").on(t.activoId, t.fecha)],
);
