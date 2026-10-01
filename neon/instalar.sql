-- Mantenimiento y Taller: instalación inicial, en una base VACÍA.
-- Pegar TODO en el SQL Editor de Neon y ejecutar una sola vez.
-- Crea las tablas, las causas y categorías de arranque, y el usuario admin
-- con PIN 1234. Cambiá ese PIN apenas entres (Configuración → Usuarios).

begin;

create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

-- 0000_inicial
CREATE TYPE "public"."accion_tarea" AS ENUM('chequear', 'cambiar', 'ajustar', 'limpiar', 'lubricar', 'otro');
CREATE TYPE "public"."clase_activo" AS ENUM('maquina', 'vehiculo');
CREATE TYPE "public"."combustible" AS ENUM('diesel', 'nafta', 'gnc', 'electrico');
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
	"combustible" "combustible",
	"estado" "estado_activo" DEFAULT 'operativo' NOT NULL,
	"caracteristicas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "cargas_combustible" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"litros" numeric(10, 2) NOT NULL,
	"lectura" numeric(12, 1),
	"precio_litro" numeric(12, 2),
	"insumo_id" integer,
	"usuario_id" integer NOT NULL,
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
	"nota" text,
	"fuente" text DEFAULT 'manual' NOT NULL
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
	"seccion" text,
	"activo_id" integer,
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
	"columnas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trabajo_tareas" (
	"id" serial PRIMARY KEY NOT NULL,
	"trabajo_id" integer NOT NULL,
	"seccion" text,
	"activo_id" integer,
	"accion" "accion_tarea" NOT NULL,
	"descripcion" text NOT NULL,
	"valores" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
ALTER TABLE "cargas_combustible" ADD CONSTRAINT "cargas_combustible_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cargas_combustible" ADD CONSTRAINT "cargas_combustible_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cargas_combustible" ADD CONSTRAINT "cargas_combustible_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
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
ALTER TABLE "plan_tareas" ADD CONSTRAINT "plan_tareas_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "planes" ADD CONSTRAINT "planes_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "planes" ADD CONSTRAINT "planes_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajo_tareas" ADD CONSTRAINT "trabajo_tareas_trabajo_id_trabajos_id_fk" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trabajo_tareas" ADD CONSTRAINT "trabajo_tareas_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_reportado_por_id_usuarios_id_fk" FOREIGN KEY ("reportado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_realizado_por_id_usuarios_id_fk" FOREIGN KEY ("realizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajos" ADD CONSTRAINT "trabajos_causa_id_causas_id_fk" FOREIGN KEY ("causa_id") REFERENCES "public"."causas"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "activos_codigo_uq" ON "activos" USING btree ("codigo");
CREATE INDEX "cargas_activo_idx" ON "cargas_combustible" USING btree ("activo_id","fecha");
CREATE UNIQUE INDEX "insumos_codigo_uq" ON "insumos" USING btree ("codigo");
CREATE UNIQUE INDEX "lecturas_activo_fecha_uq" ON "lecturas" USING btree ("activo_id","fecha");
CREATE INDEX "mov_insumo_insumo_idx" ON "movimientos_insumo" USING btree ("insumo_id","fecha");
CREATE INDEX "mov_insumo_activo_idx" ON "movimientos_insumo" USING btree ("activo_id");
CREATE INDEX "trabajos_activo_idx" ON "trabajos" USING btree ("activo_id","fecha");
CREATE INDEX "trabajos_plan_idx" ON "trabajos" USING btree ("plan_id","fecha");
insert into drizzle.__drizzle_migrations (hash, created_at) values ('72ff5b411b69b9b0e2e4a7fcadc556b13f413f5495ba5214f1466c993b1d9f76', 1790812473256);

-- 0001_categorias-herramientas
CREATE TABLE "categorias_herramienta" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categorias_herramienta_nombre_unique" UNIQUE("nombre")
);

ALTER TABLE "herramienta_tipos" ADD COLUMN "categoria_id" integer;
ALTER TABLE "herramienta_tipos" ADD CONSTRAINT "herramienta_tipos_categoria_id_categorias_herramienta_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_herramienta"("id") ON DELETE no action ON UPDATE no action;
-- Backfill (a mano): la lista arranca con las categorías habituales más las
-- que ya se hubieran escrito a mano, y cada herramienta queda apuntando a la
-- suya. Sin esto, la columna vieja se borraría con la información adentro.
INSERT INTO "categorias_herramienta" ("nombre") VALUES
  ('Eléctricas'), ('Manuales'), ('Medición'), ('Soldadura'), ('Neumáticas'), ('Corte'), ('Elevación y sujeción'), ('Seguridad')
ON CONFLICT ("nombre") DO NOTHING;
INSERT INTO "categorias_herramienta" ("nombre")
SELECT DISTINCT trim("categoria") FROM "herramienta_tipos"
 WHERE "categoria" IS NOT NULL AND trim("categoria") <> ''
   AND NOT EXISTS (SELECT 1 FROM "categorias_herramienta" c WHERE lower(c."nombre") = lower(trim("herramienta_tipos"."categoria")))
ON CONFLICT ("nombre") DO NOTHING;
UPDATE "herramienta_tipos" t SET "categoria_id" = c."id"
  FROM "categorias_herramienta" c
 WHERE lower(c."nombre") = lower(trim(t."categoria"));

insert into drizzle.__drizzle_migrations (hash, created_at) values ('0b592abb00f43b538d01714fcd09645711ace60e3c8521301d89e6b36525a9c9', 1790820457255);

-- 0002_sacar-categoria-texto
ALTER TABLE "herramienta_tipos" DROP COLUMN "categoria";
insert into drizzle.__drizzle_migrations (hash, created_at) values ('723936ac694f5e32a5cd16964afd9e963b25228e1703e80fa81906185c83eddf', 1790820465323);

-- 0003_repuestos
CREATE TYPE "public"."criticidad" AS ENUM('alta', 'media', 'baja');
CREATE TABLE "activo_repuestos" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"insumo_id" integer NOT NULL,
	"donde_va" text,
	"criticidad" "criticidad" DEFAULT 'alta' NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "insumos" ADD COLUMN "es_repuesto" boolean DEFAULT false NOT NULL;
ALTER TABLE "insumos" ADD COLUMN "tiempo_reposicion_dias" integer;
ALTER TABLE "activo_repuestos" ADD CONSTRAINT "activo_repuestos_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "activo_repuestos" ADD CONSTRAINT "activo_repuestos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "activo_repuestos_uq" ON "activo_repuestos" USING btree ("activo_id","insumo_id");
insert into drizzle.__drizzle_migrations (hash, created_at) values ('88123fe210679223a9f53c063a37e8c6ff9a311110c12ecd2ffa4d93ae7e036f', 1790821080756);

-- 0004_obras-subtareas-y-estados
ALTER TYPE "public"."estado_activo" ADD VALUE 'en_reparacion' BEFORE 'fuera_de_servicio';
CREATE TABLE "activo_cambios_estado" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"desde" "estado_activo" NOT NULL,
	"hasta" "estado_activo" NOT NULL,
	"trabajo_id" integer,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "obra_subtarea_avances" (
	"id" serial PRIMARY KEY NOT NULL,
	"subtarea_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"progreso_antes" integer NOT NULL,
	"progreso" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "obra_subtareas" (
	"id" serial PRIMARY KEY NOT NULL,
	"obra_id" integer NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"titulo" text NOT NULL,
	"responsable_id" integer,
	"responsable_externo" text,
	"inicio_plan" date,
	"fin_plan" date,
	"inicio_real" date,
	"fin_real" date,
	"progreso" integer DEFAULT 0 NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "trabajo_avances" (
	"id" serial PRIMARY KEY NOT NULL,
	"trabajo_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"texto" text NOT NULL,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "obras" ADD COLUMN "inicio_plan" date;
ALTER TABLE "obras" ADD COLUMN "fin_plan" date;
ALTER TABLE "activo_cambios_estado" ADD CONSTRAINT "activo_cambios_estado_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "activo_cambios_estado" ADD CONSTRAINT "activo_cambios_estado_trabajo_id_trabajos_id_fk" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "activo_cambios_estado" ADD CONSTRAINT "activo_cambios_estado_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "obra_subtarea_avances" ADD CONSTRAINT "obra_subtarea_avances_subtarea_id_obra_subtareas_id_fk" FOREIGN KEY ("subtarea_id") REFERENCES "public"."obra_subtareas"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "obra_subtarea_avances" ADD CONSTRAINT "obra_subtarea_avances_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "obra_subtareas" ADD CONSTRAINT "obra_subtareas_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "obra_subtareas" ADD CONSTRAINT "obra_subtareas_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "trabajo_avances" ADD CONSTRAINT "trabajo_avances_trabajo_id_trabajos_id_fk" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trabajo_avances" ADD CONSTRAINT "trabajo_avances_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "activo_cambios_estado_idx" ON "activo_cambios_estado" USING btree ("activo_id","creado_en");
CREATE INDEX "obra_subtareas_obra_idx" ON "obra_subtareas" USING btree ("obra_id","orden");
-- Backfill (a mano): la "fecha estimada" de fin que ya tuviera una obra pasa a
-- ser su fin planificado. La columna vieja se saca en la migración siguiente.
UPDATE "obras" SET "fin_plan" = "fecha_estimada" WHERE "fin_plan" IS NULL AND "fecha_estimada" IS NOT NULL;

insert into drizzle.__drizzle_migrations (hash, created_at) values ('2b489bfb58de30f0ab01f48f4bda1dc36b11ec34fe4d943711177e3cf5a01ae2', 1790878907827);

-- 0005_sacar-fecha-estimada
ALTER TABLE "obras" DROP COLUMN "fecha_estimada";
insert into drizzle.__drizzle_migrations (hash, created_at) values ('026f06def8e0af669e0fd52b703aabc1b0285ba3d52f22f1283a6d9c122c9e71', 1790878915826);

-- 0006_archivos
CREATE TYPE "public"."etapa" AS ENUM('antes', 'durante', 'despues');
CREATE TYPE "public"."tipo_documento" AS ENUM('plano', 'despiece', 'manual', 'foto', 'certificado', 'otro');
CREATE TABLE "documento_versiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"documento_id" integer NOT NULL,
	"version" integer NOT NULL,
	"url" text NOT NULL,
	"fecha" date NOT NULL,
	"nota" text,
	"creado_por_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"tipo" "tipo_documento" NOT NULL,
	"activo_id" integer,
	"obra_id" integer,
	"insumo_id" integer,
	"etapa" "etapa",
	"nota" text,
	"archivado" boolean DEFAULT false NOT NULL,
	"creado_por_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "activos" ADD COLUMN "carpeta_url" text;
ALTER TABLE "obras" ADD COLUMN "carpeta_url" text;
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "documento_versiones_uq" ON "documento_versiones" USING btree ("documento_id","version");
CREATE INDEX "documentos_activo_idx" ON "documentos" USING btree ("activo_id");
CREATE INDEX "documentos_obra_idx" ON "documentos" USING btree ("obra_id");
CREATE INDEX "documentos_insumo_idx" ON "documentos" USING btree ("insumo_id");
insert into drizzle.__drizzle_migrations (hash, created_at) values ('415dcf03f85c350161b0330089ca21a52ca41ac474934e35b9f63485fd1a2b6a', 1790881126570);

-- 0007_fabricacion
CREATE TABLE "ordenes_fabricacion" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"destino" text,
	"estado" "estado_obra" DEFAULT 'pendiente' NOT NULL,
	"prioridad" "prioridad" DEFAULT 'media' NOT NULL,
	"inicio_plan" date,
	"fin_plan" date,
	"fecha_inicio" date,
	"fecha_fin" date,
	"responsable_id" integer,
	"responsable_externo" text,
	"nota" text,
	"creado_por_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "partes_fabricacion" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"unidades" integer DEFAULT 0 NOT NULL,
	"horas_hombre" numeric(8, 2),
	"realizado_por_id" integer,
	"nota" text,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "producto_materiales" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"insumo_id" integer,
	"descripcion" text,
	"cantidad" numeric(12, 3) NOT NULL
);

CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"modelo" text,
	"descripcion" text,
	"horas_estandar" numeric(8, 2),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "documentos" ADD COLUMN "producto_id" integer;
ALTER TABLE "movimientos_insumo" ADD COLUMN "orden_fabricacion_id" integer;
ALTER TABLE "ordenes_fabricacion" ADD CONSTRAINT "ordenes_fabricacion_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ordenes_fabricacion" ADD CONSTRAINT "ordenes_fabricacion_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ordenes_fabricacion" ADD CONSTRAINT "ordenes_fabricacion_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "partes_fabricacion" ADD CONSTRAINT "partes_fabricacion_orden_id_ordenes_fabricacion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_fabricacion"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "partes_fabricacion" ADD CONSTRAINT "partes_fabricacion_realizado_por_id_usuarios_id_fk" FOREIGN KEY ("realizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "partes_fabricacion" ADD CONSTRAINT "partes_fabricacion_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "producto_materiales" ADD CONSTRAINT "producto_materiales_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "producto_materiales" ADD CONSTRAINT "producto_materiales_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "ordenes_fabricacion_producto_idx" ON "ordenes_fabricacion" USING btree ("producto_id");
CREATE INDEX "partes_fabricacion_orden_idx" ON "partes_fabricacion" USING btree ("orden_id","fecha");
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_orden_fabricacion_id_ordenes_fabricacion_id_fk" FOREIGN KEY ("orden_fabricacion_id") REFERENCES "public"."ordenes_fabricacion"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "documentos_producto_idx" ON "documentos" USING btree ("producto_id");
insert into drizzle.__drizzle_migrations (hash, created_at) values ('8b0859e374a8b44fbd70ba16aed7c437ab44e94b4a8eb2813e8fb85348153da3', 1790881938253);

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
  ('Combustibles'),
  ('Filtros'),
  ('Eléctricos'),
  ('Pintura'),
  ('Seguridad (EPP)'),
  ('Limpieza')
on conflict do nothing;

insert into usuarios (usuario, nombre, rol, pin_hash)
values ('admin', 'Administrador', 'admin', '$2a$10$qkJGfbqyaL6q4es.fqUhdOszIiuboMF7GGyY9O0S84/SD3w/zrs0e')
on conflict (usuario) do nothing;

commit;

-- Verificación: Neon muestra el resultado de esta última consulta.
-- Tiene que decir 33 tablas, 8 migraciones, 8 causas, 11 categorías y admin (admin).
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from drizzle.__drizzle_migrations) as migraciones,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias_insumo,
  (select count(*) from categorias_herramienta) as categorias_herramienta,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
