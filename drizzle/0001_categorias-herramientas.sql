CREATE TABLE "categorias_herramienta" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categorias_herramienta_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "herramienta_tipos" ADD COLUMN "categoria_id" integer;--> statement-breakpoint
ALTER TABLE "herramienta_tipos" ADD CONSTRAINT "herramienta_tipos_categoria_id_categorias_herramienta_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_herramienta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill (a mano): la lista arranca con las categorías habituales más las
-- que ya se hubieran escrito a mano, y cada herramienta queda apuntando a la
-- suya. Sin esto, la columna vieja se borraría con la información adentro.
INSERT INTO "categorias_herramienta" ("nombre") VALUES
  ('Eléctricas'), ('Manuales'), ('Medición'), ('Soldadura'), ('Neumáticas'), ('Corte'), ('Elevación y sujeción'), ('Seguridad')
ON CONFLICT ("nombre") DO NOTHING;--> statement-breakpoint
INSERT INTO "categorias_herramienta" ("nombre")
SELECT DISTINCT trim("categoria") FROM "herramienta_tipos"
 WHERE "categoria" IS NOT NULL AND trim("categoria") <> ''
   AND NOT EXISTS (SELECT 1 FROM "categorias_herramienta" c WHERE lower(c."nombre") = lower(trim("herramienta_tipos"."categoria")))
ON CONFLICT ("nombre") DO NOTHING;--> statement-breakpoint
UPDATE "herramienta_tipos" t SET "categoria_id" = c."id"
  FROM "categorias_herramienta" c
 WHERE lower(c."nombre") = lower(trim(t."categoria"));
