ALTER TYPE "public"."estado_activo" ADD VALUE 'en_reparacion' BEFORE 'fuera_de_servicio';--> statement-breakpoint
CREATE TABLE "activo_cambios_estado" (
	"id" serial PRIMARY KEY NOT NULL,
	"activo_id" integer NOT NULL,
	"desde" "estado_activo" NOT NULL,
	"hasta" "estado_activo" NOT NULL,
	"trabajo_id" integer,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "trabajo_avances" (
	"id" serial PRIMARY KEY NOT NULL,
	"trabajo_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"texto" text NOT NULL,
	"usuario_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "obras" ADD COLUMN "inicio_plan" date;--> statement-breakpoint
ALTER TABLE "obras" ADD COLUMN "fin_plan" date;--> statement-breakpoint
ALTER TABLE "activo_cambios_estado" ADD CONSTRAINT "activo_cambios_estado_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activo_cambios_estado" ADD CONSTRAINT "activo_cambios_estado_trabajo_id_trabajos_id_fk" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activo_cambios_estado" ADD CONSTRAINT "activo_cambios_estado_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra_subtarea_avances" ADD CONSTRAINT "obra_subtarea_avances_subtarea_id_obra_subtareas_id_fk" FOREIGN KEY ("subtarea_id") REFERENCES "public"."obra_subtareas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra_subtarea_avances" ADD CONSTRAINT "obra_subtarea_avances_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra_subtareas" ADD CONSTRAINT "obra_subtareas_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra_subtareas" ADD CONSTRAINT "obra_subtareas_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajo_avances" ADD CONSTRAINT "trabajo_avances_trabajo_id_trabajos_id_fk" FOREIGN KEY ("trabajo_id") REFERENCES "public"."trabajos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabajo_avances" ADD CONSTRAINT "trabajo_avances_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activo_cambios_estado_idx" ON "activo_cambios_estado" USING btree ("activo_id","creado_en");--> statement-breakpoint
CREATE INDEX "obra_subtareas_obra_idx" ON "obra_subtareas" USING btree ("obra_id","orden");--> statement-breakpoint
-- Backfill (a mano): la "fecha estimada" de fin que ya tuviera una obra pasa a
-- ser su fin planificado. La columna vieja se saca en la migración siguiente.
UPDATE "obras" SET "fin_plan" = "fecha_estimada" WHERE "fin_plan" IS NULL AND "fecha_estimada" IS NOT NULL;
