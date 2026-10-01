/**
 * Genera los SQL para pegar en el SQL Editor de Neon, sin instalar nada.
 *
 *   npx tsx scripts/sql-neon.ts                  neon/instalar.sql (base vacía, todo)
 *   npx tsx scripts/sql-neon.ts --pin 5678       idem, con otro PIN de admin
 *   npx tsx scripts/sql-neon.ts --actualizar 1   neon/actualizar-0001.sql: solo las
 *                                                migraciones desde la 0001, para una
 *                                                base que ya está andando
 *
 * Cada migración lleva su fila de control de drizzle con el MISMO hash que
 * calcula drizzle-kit, así un `npm run db:migrate` posterior no la repite.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { CATEGORIAS, CAUSAS } from "./datos-base";

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const pin = arg("--pin") ?? "1234";
const desde = arg("--actualizar");

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
  entries: Array<{ idx: number; tag: string; when: number }>;
};
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

function migraciones(desdeIdx: number) {
  let salida = `create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);

`;
  for (const e of journal.entries.filter((x) => x.idx >= desdeIdx)) {
    const sql = readFileSync(`drizzle/${e.tag}.sql`, "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    salida += `-- ${e.tag}\n${sql.replace(/--> statement-breakpoint\n?/g, "\n")}\n`;
    salida += `insert into drizzle.__drizzle_migrations (hash, created_at) values (${q(hash)}, ${e.when});\n\n`;
  }
  return salida;
}

const VERIFICAR = `select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,
  (select count(*) from drizzle.__drizzle_migrations) as migraciones,
  (select count(*) from causas) as causas,
  (select count(*) from categorias_insumo) as categorias_insumo,
  (select count(*) from categorias_herramienta) as categorias_herramienta,
  (select string_agg(usuario || ' (' || rol || ')', ', ') from usuarios) as usuarios;
`;
const tablas = (readFileSync("lib/db/schema.ts", "utf8").match(/pgTable\(/g) ?? []).length;

if (desde != null) {
  const idx = Number(desde);
  const tags = journal.entries.filter((x) => x.idx >= idx).map((x) => x.tag);
  const archivo = `neon/actualizar-${String(idx).padStart(4, "0")}.sql`;
  writeFileSync(
    archivo,
    `-- Mantenimiento y Taller: actualización de una base que ya está andando.
-- Aplica: ${tags.join(", ")}.
-- Pegar TODO en el SQL Editor de Neon y ejecutar UNA vez. Si Neon queda
-- "In transaction", mirá la última pestaña de resultados: si dice
-- ${tablas} tablas y ${journal.entries.length} migraciones, apretá COMMIT; si hay un error, ROLLBACK.

begin;

${migraciones(idx)}commit;

-- Verificación: tiene que decir ${tablas} tablas y ${journal.entries.length} migraciones.
${VERIFICAR}`,
  );
  console.log(`✓ ${archivo}`);
} else {
  writeFileSync(
    "neon/instalar.sql",
    `-- Mantenimiento y Taller: instalación inicial, en una base VACÍA.
-- Pegar TODO en el SQL Editor de Neon y ejecutar una sola vez.
-- Crea las tablas, las causas y categorías de arranque, y el usuario admin
-- con PIN ${pin}. Cambiá ese PIN apenas entres (Configuración → Usuarios).

begin;

${migraciones(0)}-- Datos de arranque
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
-- Tiene que decir ${tablas} tablas, ${journal.entries.length} migraciones, ${CAUSAS.length} causas, ${CATEGORIAS.length} categorías y admin (admin).
${VERIFICAR}`,
  );
  console.log("✓ neon/instalar.sql");
}
