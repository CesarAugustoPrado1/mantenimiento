-- Mantenimiento y Taller: instalación inicial.
-- Pegar TODO en el SQL Editor de Neon y ejecutar una sola vez.
-- Crea las tablas, las causas y categorías de arranque, y el usuario admin
-- con PIN 1234. Cambiá ese PIN apenas entres (Configuración → Usuarios).

begin;

-- 0000_inicial
CREATE TYPE "public"."accion_tarea" AS ENUM('chequear', 'cambiar', 'ajustar', 'limpiar', 'lubricar', 'otro');
CREATE TYPE "public"."clase_activo" AS ENUM('maquina', 'vehiculo');
CREATE TYPE "public"."estado_activo" AS ENUM('operativo', 'con_falla', 'fuera_de_servicio', 'baja');
CREATE TYPE "public"."estado_compra" AS ENUM('borrador', 'pedida', 'recibida', 'cancelada');
CREATE TYPE "public"."estado_herramienta" AS ENUM('bueno', 'regular', 'en_reparacion', 'baja');
CREATE TYPE "public"."estado_obra" AS ENUM('pendiente', 'en_curso', 'terminada', 'cancelada');
CREATE TYPE "public"."estado_trabajo" AS ENUM('abierto', 'en_curso', 'cerrado');
CREATE TYPE "public"."medidor" AS ENUM('ninguno', 'km', 'horas');
CREATE TYPE "public"."prioridad" AS ENUM('baja', 'media', 'alta', 'urgente');
CREATE TYPE "public"."propiedad" AS ENUM('empresa', 'empleado');
CREATE TYPE "public"."resultado_tarea" AS ENUM('ok', 'corregido', 'no_ok', 'no_aplica');
CREATE TYPE "public"."rol" AS ENUM('admin', 'jefe_taller', 'tecnico', 'conductor', 'auditor');
CREATE TYPE "public"."tipo_mov_insumo" AS ENUM('ingreso', 'consumo', 'ajuste');
CREATE TYPE "public"."tipo_trabajo" AS ENUM('preventivo', 'correctivo');
CREATE TABLE "activos" (
	"id" serial PRIMARY KEY NOT NULL,
	"clase" "clase_activo" NOT NULL,
	"tipo" text NOT NULL,
	"nombre" text NOT NULL,
	"codigo" text,
	"marca" text,
	"modelo" text,
	"anio" integer,
	"numero_serie" text,
	"patente" text,
	"ubicacion" text,
	"propiedad" "propiedad" DEFAULT 'empresa' NOT NULL,
	"responsable_id" integer,
	"medidor" "medidor" DEFAULT 'ninguno' NOT NULL,
	"estado" "estado_activo" DEFAULT 'operativo' NOT NULL,
	"caracteristicas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "categorias_insumo" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categorias_insumo_nombre_unique" UNIQUE("nombre")
);

CREATE TABLE "causas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "causas_nombre_unique" UNIQUE("nombre")
);

CREATE TABLE "compra_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"compra_id" integer NOT NULL,
	"insumo_id" integer,
	"descripcion" text NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"recibido" numeric(12, 2),
	"precio_unitario" numeric(14, 2)
);

CREATE TABLE "compras" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"fecha" date NOT NULL,
	"estado" "estado_compra" DEFAULT 'borrador' NOT NULL,
	"proveedor" text,
	"nota" text,
	"creado_por_id" integer NOT NULL,
	"recibida_en" date,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "config" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL
);

CREATE TABLE "cotizaciones" (
	"fecha" date PRIMARY KEY NOT NULL,
	"ars_por_usd" numeric(12, 2) NOT NULL,
	"nota" text
);

CREATE TABLE "herramienta_tipos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text,
	"requeridas" integer DEFAULT 1 NOT NULL,
	"nota" text,
	"activo" boolean DEFAULT true NOT NULL
);

CREATE TABLE "herramientas" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo_id" integer NOT NULL,
	"codigo" text,
	"marca" text,
	"estado" "estado_herramienta" DEFAULT 'bueno' NOT NULL,
	"ubicacion" text,
	"nota" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "insumos" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text,
	"nombre" text NOT NULL,
	"categoria_id" integer,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"critico" numeric(12, 2) DEFAULT '0' NOT NULL,
	"atento" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ideal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"infaltable" boolean DEFAULT false NOT NULL,
	"ubicacion" text,
	"proveedor" text,
	"nota" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lecturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"valor" numeric(12, 1) NOT NULL,
	"usuario_id" integer NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "movimientos_insumo" (
	"id" serial PRIMARY KEY NOT NULL,
	"insumo_id" integer NOT NULL,
	"tipo" "tipo_mov_insumo" NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"stock_antes" numeric(12, 2) NOT NULL,
	"stock_despues" numeric(12, 2) NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"usuario_id" integer NOT NULL,
	"activo_id" integer,
	"trabajo_id" integer,
	"obra_id" integer,
	"compra_id" integer,
	"precio_unitario" numeric(14, 2),
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "obra_notas" (
	"id" serial PRIMARY KEY NOT NULL,
	"obra_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"texto" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "obras" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"lugar" text NOT NULL,
	"tipo" text,
	"descripcion" text,
	"estado" "estado_obra" DEFAULT 'pendiente' NOT NULL,
	"prioridad" "prioridad" DEFAULT 'media' NOT NULL,
	"fecha_inicio" date,
	"fecha_estimada" date,
	"fecha_fin" date,
	"responsable_id" integer,
	"responsable_externo" text,
	"horas_hombre" numeric(8, 1),
	"costo_mano_obra" numeric(14, 2),
	"costo_materiales" numeric(14, 2),
	"creado_por_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "plan_materiales" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"insumo_id" integer,
	"descripcion" text,
	"cantidad" numeric(12, 2) DEFAULT '1' NOT NULL
);

CREATE TABLE "plan_tareas" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"accion" "accion_tarea" DEFAULT 'chequear' NOT NULL,
	"descripcion" text NOT NULL
);

CREATE TABLE "planes" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"cada_dias" integer,
	"cada_uso" integer,
	"aviso_dias" integer DEFAULT 7 NOT NULL,
	"aviso_uso" integer,
	"responsable_id" integer,
	"responsable_externo" text,
	"herramientas" text,
	"desde_fecha" date,
	"desde_uso" numeric(12, 1),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trabajo_tareas" (
	"id" serial PRIMARY KEY NOT NULL,
	"trabajo_id" integer NOT NULL,
	"accion" "accion_tarea" NOT NULL,
	"descripcion" text NOT NULL,
	"resultado" "resultado_tarea" NOT NULL,
	"nota" text
);

CREATE TABLE "trabajos" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"tipo" "tipo_trabajo" NOT NULL,
	"plan_id" integer,
	"estado" "estado_trabajo" DEFAULT 'abierto' NOT NULL,
	"prioridad" "prioridad" DEFAULT 'media' NOT NULL,
	"titulo" text NOT NULL,
	"fecha" date NOT NULL,
	"fecha_cierre" date,
	"lectura" numeric(12, 1),
	"reportado_por_id" integer NOT NULL,
	"realizado_por_id" integer,
	"realizado_externo" text,
	"falla" text,
	"causa_id" integer,
	"solucion" text,
	"horas_parada" numeric(8, 1),
	"horas_hombre" numeric(8, 1),
	"costo_mano_obra" numeric(14, 2),
	"costo_repuestos" numeric(14, 2),
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario" text NOT NULL,
	"nombre" text NOT NULL,
	"pin_hash" text NOT NULL,
	"rol" "rol" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_usuario_unique" UNIQUE("usuario")
);

ALTER TABLE "activos" ADD CONSTRAINT "activos_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "compras" ADD CONSTRAINT "compras_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "herramientas" ADD CONSTRAINT "herramientas_tipo_id_herramienta_tipos_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."herramienta_tipos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_categoria_id_categorias_insumo_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_insumo"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "lecturas" ADD CONSTRAINT "lecturas_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "lecturas" ADD CONSTRAINT "lecturas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_trabajo_id_trabajos_id_fk" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "obra_notas" ADD CONSTRAINT "obra_notas_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "obra_notas" ADD CONSTRAINT "obra_notas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "obras" ADD CONSTRAINT "obras_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "obras" ADD CONSTRAINT "obras_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "plan_materiales" ADD CONSTRAINT "plan_materiales_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "plan_materiales" ADD CONSTRAINT "plan_materiales_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "plan_tareas" ADD CONSTRAINT "plan_tareas_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "planes" ADD CONSTRAINT "planes_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "planes" ADD CONSTRAINT "planes_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajo_tareas" ADD CONSTRAINT "trabajo_tareas_trabajo_id_trabajos_id_fk" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_reportado_por_id_usuarios_id_fk" FOREIGN KEY ("reportado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_realizado_por_id_usuarios_id_fk" FOREIGN KEY ("realizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_causa_id_causas_id_fk" FOREIGN KEY ("causa_id") REFERENCES "public"."causas"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "activos_codigo_uq" ON "activos" USING btree ("codigo");
CREATE UNIQUE INDEX "insumos_codigo_uq" ON "insumos" USING btree ("codigo");
CREATE UNIQUE INDEX "lecturas_activo_fecha_uq" ON "lecturas" USING btree ("activo_id","fecha");
CREATE INDEX "mov_insumo_insumo_idx" ON "movimientos_insumo" USING btree ("insumo_id","fecha");
CREATE INDEX "mov_insumo_activo_idx" ON "movimientos_insumo" USING btree ("activo_id");
CREATE INDEX "trabajos_activo_idx" ON "trabajos" USING btree ("activo_id","fecha");
CREATE INDEX "trabajos_plan_idx" ON "trabajos" USING btree ("plan_id","fecha");
create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
insert into drizzle.__drizzle_migrations (hash, created_at) values ('7aad77c32d7352eac74424b2428c2ef6ab4e120084a2dad10d2979a24bb5e9d5', 1790810312436);

-- Datos de arranque
insert into causas (nombre, descripcion) values
  ('Desgaste normal', 'Llegó al fin de su vida útil.'),
  ('Falta de mantenimiento', 'Un preventivo que no se hizo o se hizo tarde.'),
  ('Mal uso / operación', 'Se usó fuera de lo previsto o sin cuidado.'),
  ('Accidente / golpe', 'Choque, caída, golpe.'),
  ('Defecto de fábrica / repuesto', 'Pieza o repuesto que salió mal.'),
  ('Reparación anterior mal hecha', 'Vuelve a fallar algo que ya se arregló.'),
  ('Causa externa', 'Corte de luz, agua, clima, terceros.'),
  ('No determinada', 'Se arregló pero no se sabe por qué pasó.')
on conflict do nothing;

insert into categorias_insumo (nombre) values
  ('Abrasivos y discos'),
  ('Soldadura'),
  ('Tornillería y fijaciones'),
  ('Perfiles y caños'),
  ('Lubricantes y fluidos'),
  ('Filtros'),
  ('Eléctricos'),
  ('Pintura'),
  ('Seguridad (EPP)'),
  ('Limpieza')
on conflict do nothing;

insert into usuarios (usuario, nombre, rol, pin_hash)
values ('admin', 'Administrador', 'admin', '$2a$10$CKIIAYVTOMKv7hf2Z/nydeyN0Hqz7Nt3tSUBq/x3osatrhhBMnkWu')
on conflict (usuario) do nothing;

commit;
