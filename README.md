# Mantenimiento y Taller

Gestión del taller: insumos con semáforo, compras, herramientas, máquinas y
vehículos con sus planes preventivos, correctivos, kilometraje, obras e
informes anuales.

Hermana de [gestion-racks](https://github.com/CesarAugustoPrado1/gestion-racks) y
[control-estanterias](https://github.com/CesarAugustoPrado1/control-estanterias):
mismo stack y mismas convenciones. **El diseño por módulos, los roles y la
decisión sobre montos e inflación están en [DISENO.md](DISENO.md).**

## Stack

Next.js 15 (App Router, Server Components + Server Actions) · React 19 ·
Tailwind v4 · Drizzle ORM · PostgreSQL en Neon · Vercel (región `gru1`).

## Puesta en marcha sin terminal

1. **Base**: en Neon, crear el proyecto (región São Paulo, `sa-east-1`), abrir el
   *SQL Editor*, pegar **todo** `neon/instalar.sql` y ejecutar. Crea las tablas,
   las causas de falla y categorías de arranque, y el usuario `admin` con PIN
   `1234`.
2. **Vercel**: importar el repo y cargar en Settings → Environment Variables
   (Production): `DATABASE_URL` (la URL *pooled*, con `-pooler`),
   `SESSION_SECRET` (una clave larga al azar) y `DIRECT_URL` (la directa, sin
   `-pooler`). Si las cargás después del primer deploy, volvé a desplegar.
3. Entrar con `admin` / `1234` y **cambiar el PIN** en Configuración → Usuarios.
4. Crear los usuarios (jefe de taller, técnicos, conductores, auditoría) y
   empezar a cargar: insumos, máquinas, vehículos y sus planes.

`neon/instalar.sql` se regenera con `npx tsx scripts/sql-neon.ts [PIN]`. Trae la
fila de control de drizzle, así que después se puede seguir con
`npm run db:migrate` sin que intente recrear las tablas.

## Puesta en marcha con terminal

```bash
npm install
cp .env.example .env.local     # completar DATABASE_URL, DIRECT_URL, SESSION_SECRET
npm run db:migrate             # aplica drizzle/*.sql
npm run db:seed                # admin + causas + categorías
npm run db:seed -- --con-ejemplos   # además: usuarios jefe, tecnico1, chofer1,
                                    # auditoria y equipos/insumos de ejemplo
npm run dev
```

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Tests del semáforo y del cálculo de vencimientos |
| `npm run db:generate` | Genera la migración desde `lib/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Datos iniciales (idempotente, no pisa nada) |

**Migraciones versionadas, no `db:push`.** Después de toda migración,
preguntarse: *¿qué filas ya existentes quedan con el valor equivocado?* Si la
respuesta no es "ninguna", el backfill va aparte. Para cambios aditivos, primero
la base y después el código.

Para saber qué commit está desplegado: `https://<la-app>/api/version`.

## Mapa del código

```
app/
  (app)/
    tablero/      lo que hay que atender hoy
    agenda/       vencimientos de todos los preventivos
    insumos/      pañol con semáforo; [id] = ficha y movimientos
    compras/      compra desde el semáforo, recepción
    herramientas/ inventario contra lo necesario
    maquinas/ vehiculos/   listas; la ficha es activos/[id]
    activos/      ficha, alta/edición, planes/[planId]
    trabajos/     historial; nuevo = reportar falla; preventivo/[planId]
    km/           carga de km/horas (pantalla del conductor)
    obras/        obras y tareas externas con bitácora
    informes/     anual y año contra año, en USD
    admin/        usuarios, categorías, causas, cotizaciones
lib/
  db/schema.ts    tablas y enums
  motor-stock.ts  el ÚNICO lugar que cambia el stock
  vencimientos.ts cálculo de vencimientos (puro, con tests)
  semaforo.ts     semáforo y compra sugerida (puro, con tests)
  consultas.ts    agenda y opciones compartidas
  acciones/       server actions, cada una revalida permisos
  permisos.ts     rol → rutas y navegación
neon/instalar.sql SQL para pegar en Neon
```

**Seguridad en dos capas.** `middleware.ts` controla la navegación; cada server
action revalida con `autorizar()`, porque una action se puede invocar
directamente. Auditoría no figura en ninguna lista de escritura.
