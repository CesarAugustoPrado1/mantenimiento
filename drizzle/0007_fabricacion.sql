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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "producto_materiales" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"insumo_id" integer,
	"descripcion" text,
	"cantidad" numeric(12, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"modelo" text,
	"descripcion" text,
	"horas_estandar" numeric(8, 2),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "producto_id" integer;--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ADD COLUMN "orden_fabricacion_id" integer;--> statement-breakpoint
ALTER TABLE "ordenes_fabricacion" ADD CONSTRAINT "ordenes_fabricacion_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_fabricacion" ADD CONSTRAINT "ordenes_fabricacion_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_fabricacion" ADD CONSTRAINT "ordenes_fabricacion_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes_fabricacion" ADD CONSTRAINT "partes_fabricacion_orden_id_ordenes_fabricacion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_fabricacion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes_fabricacion" ADD CONSTRAINT "partes_fabricacion_realizado_por_id_usuarios_id_fk" FOREIGN KEY ("realizado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes_fabricacion" ADD CONSTRAINT "partes_fabricacion_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_materiales" ADD CONSTRAINT "producto_materiales_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_materiales" ADD CONSTRAINT "producto_materiales_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ordenes_fabricacion_producto_idx" ON "ordenes_fabricacion" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX "partes_fabricacion_orden_idx" ON "partes_fabricacion" USING btree ("orden_id","fecha");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_orden_fabricacion_id_ordenes_fabricacion_id_fk" FOREIGN KEY ("orden_fabricacion_id") REFERENCES "public"."ordenes_fabricacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_producto_idx" ON "documentos" USING btree ("producto_id");