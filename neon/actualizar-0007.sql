-- Mantenimiento y Taller: actualización de una base que ya está andando.
-- Aplica: 0007_fabricacion.
-- Pegar TODO en el SQL Editor de Neon y ejecutar UNA vez. Si Neon queda
-- "In transaction", mirá la última pestaña de resultados: si dice
-- 33 tablas y 8 migraciones, apretá COMMIT; si hay un error, ROLLBACK.

begin;

create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

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

commit;

-- Verificación: tiene que decir 33 tablas y 8 migraciones.
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from drizzle.__drizzle_migrations) as migraciones,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias_insumo,
  (select count(*) from categorias_herramienta) as categorias_herramienta,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
