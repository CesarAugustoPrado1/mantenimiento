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
   `SESSION_SECRET` (una clave larga al azar), `DIRECT_URL` (la directa, sin
   `-pooler`) y `CRON_SECRET` (otra clave al azar: habilita el dólar automático). Si las cargás después del primer deploy, volvé a desplegar.
3. Entrar con `admin` / `1234` y **cambiar el PIN** en Configuración → Usuarios.
4. Crear los usuarios (jefe de taller, técnicos, conductores, auditoría) y
   empezar a cargar: insumos, máquinas, vehículos y sus planes.

`neon/instalar.sql` se regenera con `npx tsx scripts/sql-neon.ts [PIN]`. Trae la
fila de control de drizzle, así que después se puede seguir con
`npm run db:migrate` sin que intente recrear las tablas.

## Etapa de prueba

Mientras la instalación está en **modo prueba**, el admin tiene en
Configuración → Etapa de prueba dos botones (con confirmación escribiendo
`BORRAR`):

- **Borrar todo**: deja la app vacía y sigue en prueba.
- **Borrar todo y empezar en serio**: borra y apaga el modo prueba.

Se borran equipos, planes, trabajos, insumos y sus movimientos, lecturas,
combustible, herramientas, obras y compras. **Quedan** los usuarios, las causas,
las categorías y las cotizaciones. La lista está en `lib/datos-prueba.ts`.

No viene prendido: el default cuando no está la fila es "apagado", para que una
base nueva no nazca con el botón de borrar todo. Se prende desde el SQL Editor
de Neon:

```sql
insert into config (clave, valor) values ('modo_prueba', 'si')
  on conflict (clave) do update set valor = 'si';
```

Mientras está prendido, el encabezado muestra un chip "prueba". Desde la app
no se vuelve a prender: hacerlo cuesta esa línea de SQL a propósito.

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
    combustible/  cargas de combustible y consumo L/h por equipo
    obras/        obras y tareas externas con bitácora
    informes/     anual y año contra año, en USD
    admin/        usuarios, categorías, causas, cotizaciones
lib/
  db/schema.ts    tablas y enums
  motor-stock.ts  el ÚNICO lugar que cambia el stock
  vencimientos.ts cálculo de vencimientos (puro, con tests)
  semaforo.ts     semáforo y compra sugerida (puro, con tests)
  planilla.ts     planillas filas × columnas y hallazgos (puro, con tests)
  combustible.ts  rendimiento L/h por período y por mes (puro, con tests)
  cotizacion.ts   trae el dólar de internet (cron diario en vercel.json)
  consultas.ts    agenda y opciones compartidas
  acciones/       server actions, cada una revalida permisos
  permisos.ts     rol → rutas y navegación
neon/instalar.sql SQL para pegar en Neon
```

**Seguridad en dos capas.** `middleware.ts` controla la navegación; cada server
action revalida con `autorizar()`, porque una action se puede invocar
directamente. Auditoría no figura en ninguna lista de escritura.
