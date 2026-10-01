-- Mantenimiento y Taller: actualización de una base que ya está andando.
-- Aplica: 0008_subida-a-drive.
-- Pegar TODO en el SQL Editor de Neon y ejecutar UNA vez. Si Neon queda
-- "In transaction", mirá la última pestaña de resultados: si dice
-- 34 tablas y 9 migraciones, apretá COMMIT; si hay un error, ROLLBACK.

begin;

create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

-- 0008_subida-a-drive
CREATE TABLE "drive_carpetas" (
	"clave" text PRIMARY KEY NOT NULL,
	"folder_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "documento_versiones" ADD COLUMN "drive_file_id" text;
ALTER TABLE "documento_versiones" ADD COLUMN "nombre_archivo" text;
ALTER TABLE "documento_versiones" ADD COLUMN "mime" text;
ALTER TABLE "documento_versiones" ADD COLUMN "tamano_bytes" integer;
insert into drizzle.__drizzle_migrations (hash, created_at) values ('5d6daa5b7d85badff53891d9f3aedcb47d704df95c2a908306d587db4578c210', 1790892883794);

commit;

-- Verificación: tiene que decir 34 tablas y 9 migraciones.
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from drizzle.__drizzle_migrations) as migraciones,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias_insumo,
  (select count(*) from categorias_herramienta) as categorias_herramienta,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
