-- Mantenimiento y Taller: actualización de una base que ya está andando.
-- Aplica: 0001_categorias-herramientas, 0002_sacar-categoria-texto.
-- Pegar TODO en el SQL Editor de Neon y ejecutar UNA vez. Si Neon queda
-- "In transaction", mirá la última pestaña de resultados: si dice
-- 22 tablas y 3 migraciones, apretá COMMIT; si hay un error, ROLLBACK.

begin;

create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

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

commit;

-- Verificación: tiene que decir 22 tablas y 3 migraciones.
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from drizzle.__drizzle_migrations) as migraciones,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias_insumo,
  (select count(*) from categorias_herramienta) as categorias_herramienta,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
