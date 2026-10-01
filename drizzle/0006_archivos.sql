CREATE TYPE "public"."etapa" AS ENUM('antes', 'durante', 'despues');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('plano', 'despiece', 'manual', 'foto', 'certificado', 'otro');--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "activos" ADD COLUMN "carpeta_url" text;--> statement-breakpoint
ALTER TABLE "obras" ADD COLUMN "carpeta_url" text;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documento_versiones_uq" ON "documento_versiones" USING btree ("documento_id","version");--> statement-breakpoint
CREATE INDEX "documentos_activo_idx" ON "documentos" USING btree ("activo_id");--> statement-breakpoint
CREATE INDEX "documentos_obra_idx" ON "documentos" USING btree ("obra_id");--> statement-breakpoint
CREATE INDEX "documentos_insumo_idx" ON "documentos" USING btree ("insumo_id");