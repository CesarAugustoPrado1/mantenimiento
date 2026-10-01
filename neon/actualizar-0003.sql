-- Mantenimiento y Taller: actualización de una base que ya está andando.
-- Aplica: 0003_repuestos.
-- Pegar TODO en el SQL Editor de Neon y ejecutar UNA vez. Si Neon queda
-- "In transaction", mirá la última pestaña de resultados: si dice
-- 23 tablas y 4 migraciones, apretá COMMIT; si hay un error, ROLLBACK.

begin;

create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

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

commit;

-- Verificación: tiene que decir 23 tablas y 4 migraciones.
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from drizzle.__drizzle_migrations) as migraciones,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias_insumo,
  (select count(*) from categorias_herramienta) as categorias_herramienta,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
