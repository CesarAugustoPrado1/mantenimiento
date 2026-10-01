/**
 * Genera neon/instalar.sql: todo lo necesario para arrancar pegándolo en el
 * SQL Editor de Neon, sin instalar nada.
 *
 *   npx tsx scripts/sql-neon.ts [PIN]
 *
 * Incluye la fila de control de drizzle con el MISMO hash que calcula
 * drizzle-kit, así un `npm run db:migrate` posterior no intenta volver a crear
 * las tablas.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { CATEGORIAS, CAUSAS } from "./datos-base";

const pin = process.argv[2] ?? "1234";
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
  entries: Array<{ tag: string; when: number }>;
};
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

let salida = `-- Mantenimiento y Taller: instalación inicial.
-- Pegar TODO en el SQL Editor de Neon y ejecutar una sola vez.
-- Crea las tablas, las causas y categorías de arranque, y el usuario admin
-- con PIN ${pin}. Cambiá ese PIN apenas entres (Configuración → Usuarios).

begin;

`;

for (const e of journal.entries) {
  const sql = readFileSync(`drizzle/${e.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");
  salida += `-- ${e.tag}\n${sql.replace(/--> statement-breakpoint\n?/g, "\n")}\n`;
  salida += `create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
insert into drizzle.__drizzle_migrations (hash, created_at) values (${q(hash)}, ${e.when});

`;
}

salida += `-- Datos de arranque
insert into causas (nombre, descripcion) values
${CAUSAS.map((c) => `  (${q(c.nombre)}, ${q(c.descripcion)})`).join(",\n")}
on conflict do nothing;

insert into categorias_insumo (nombre) values
${CATEGORIAS.map((c) => `  (${q(c)})`).join(",\n")}
on conflict do nothing;

insert into usuarios (usuario, nombre, rol, pin_hash)
values ('admin', 'Administrador', 'admin', ${q(bcrypt.hashSync(pin, 10))})
on conflict (usuario) do nothing;

commit;

-- Verificación: Neon muestra el resultado de esta última consulta.
-- Tiene que decir 21 tablas, 8 causas, 11 categorías y admin (admin).
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
`;

writeFileSync("neon/instalar.sql", salida);
console.log("✓ neon/instalar.sql");
