-- Mantenimiento y Taller: actualización de una base que ya está andando.
-- Aplica: 0006_archivos.
-- Pegar TODO en el SQL Editor de Neon y ejecutar UNA vez. Si Neon queda
-- "In transaction", mirá la última pestaña de resultados: si dice
-- 29 tablas y 7 migraciones, apretá COMMIT; si hay un error, ROLLBACK.

begin;

create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

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

commit;

-- Verificación: tiene que decir 29 tablas y 7 migraciones.
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from drizzle.__drizzle_migrations) as migraciones,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias_insumo,
  (select count(*) from categorias_herramienta) as categorias_herramienta,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
