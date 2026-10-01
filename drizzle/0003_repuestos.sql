CREATE TYPE "public"."criticidad" AS ENUM('alta', 'media', 'baja');--> statement-breakpoint
CREATE TABLE "activo_repuestos" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"insumo_id" integer NOT NULL,
	"donde_va" text,
	"criticidad" "criticidad" DEFAULT 'alta' NOT NULL,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insumos" ADD COLUMN "es_repuesto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "insumos" ADD COLUMN "tiempo_reposicion_dias" integer;--> statement-breakpoint
ALTER TABLE "activo_repuestos" ADD CONSTRAINT "activo_repuestos_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activo_repuestos" ADD CONSTRAINT "activo_repuestos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activo_repuestos_uq" ON "activo_repuestos" USING btree ("activo_id","insumo_id");