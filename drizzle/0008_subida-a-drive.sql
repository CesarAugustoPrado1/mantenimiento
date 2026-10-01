CREATE TABLE "drive_carpetas" (
	"clave" text PRIMARY KEY NOT NULL,
	"folder_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD COLUMN "drive_file_id" text;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD COLUMN "nombre_archivo" text;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD COLUMN "mime" text;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD COLUMN "tamano_bytes" integer;