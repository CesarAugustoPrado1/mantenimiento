# Mantenimiento y Taller — diseño

Hermana de `gestion-racks` y `control-estanterias`: mismo stack, mismas
convenciones (login con usuario + PIN, roles, server actions que revalidan
permisos, migraciones versionadas, nada se borra: se da de baja).

La usa **principalmente el jefe de taller**, desde la PC y el celular. **Auditoría**
mira todo y no toca nada. Los **técnicos** registran lo que hacen y los
**conductores** (empleados con vehículo en la app) cargan su kilometraje y
reportan fallas.

---

## 1. Los módulos

Lo que llegó como una lista desordenada queda en diez módulos. Cada uno contesta
una pregunta concreta.

| Módulo | Pregunta que contesta | Pantalla |
| --- | --- | --- |
| **Tablero** | ¿Qué tengo que atender hoy? | `/tablero` |
| **Insumos** | ¿Qué hay en el pañol, qué se consume y qué falta? | `/insumos` |
| **Compras** | ¿Qué pido en la compra mensual/quincenal? | `/compras` |
| **Herramientas** | ¿Tengo las herramientas que el taller necesita? | `/herramientas` |
| **Máquinas** | Ficha, planes y historial de cada máquina de fábrica | `/maquinas` |
| **Vehículos** | Clarks, autos y camionetas: services, km, historial | `/vehiculos` |
| **Agenda** | ¿Qué preventivo vence y cuándo? | `/agenda` |
| **Trabajos** | Preventivos hechos y correctivos (fallas) | `/trabajos` |
| **Obras** | Tareas fuera de fábrica: locales, oficinas | `/obras` |
| **Informes** | Mirada anual y de varios años | `/informes` |

Más **Cargar km** (`/km`, la pantalla del conductor) y **Configuración**
(`/admin`: usuarios, categorías, causas de falla, cotización del dólar).

### 1.1 Insumos: el semáforo

Cada insumo tiene tres números, que se definen al darlo de alta:

```
stock <= crítico            🔴 rojo      caño 40x40x1,6: 5 o menos
crítico < stock <= atento   🟡 amarillo  entre 6 y 10
stock > atento              🟢 verde     más de 10
ideal                       hasta dónde se repone al comprar (ej. 20)
```

Y una marca de **infaltable** (discos de corte de 4½", electrodos, guantes): salen
primero en el tablero, en la lista y en la compra.

El stock **no se escribe a mano**: sale de los movimientos (ingreso, consumo,
conteo). Cada movimiento guarda el antes y el después, quién y para qué fue (una
máquina, un vehículo, una obra o un trabajo). De ahí salen solos:

- **consumo mensual** (promedio de los últimos 90 días),
- **cobertura** ("alcanza para ~12 días"),
- **quién lo consume** (qué equipo u obra se lleva cada insumo),
- **compra sugerida** = ideal − stock, para todo lo que está en amarillo o rojo.

Si contás y el número no coincide, se hace un **conteo**: se pone lo que hay y
el sistema guarda la diferencia como ajuste. Un consumo que dejaría el stock
negativo se rechaza: si falta, el error ya estaba antes, y se corrige con un
conteo, no escondiéndolo.

### 1.2 Compras

"Compra nueva" arma un borrador con **todo lo que está en amarillo o rojo**,
con la cantidad para volver al ideal (o solo los infaltables). Se ajusta a mano,
se le agregan cosas que no son del pañol (una herramienta, un repuesto), se
copia el texto para mandar al proveedor, y al **recibirla** se pone lo que llegó
de verdad y su precio: eso entra al stock.

### 1.3 Herramientas

Cada herramienta tiene un **tipo** con la cantidad que el taller necesita
("Amoladora 4½": 4) y sus **unidades**, cada una con estado (bueno, regular, en
reparación, de baja) y dónde está o quién la tiene.

> Faltante = necesarias − unidades en estado bueno o regular.

Una en reparación **no cuenta**: hoy no está. Con 3 amoladoras de las que una
está en el service, faltan 2, no 1.

### 1.4 Máquinas y vehículos: una sola cosa

Las máquinas de fábrica y los vehículos son la **misma tabla** (`activos`), porque
los dos tienen exactamente lo mismo: ficha, planes preventivos, correctivos,
consumo de insumos e historial. Lo que cambia:

- el **medidor**: kilómetros (autos, camionetas), horas (clarks, compresores) o
  ninguno (una prensa que se mantiene por calendario);
- datos de vehículo: patente, si es de la empresa o de un empleado, y el
  conductor (que es quien puede cargarle el km).

La **ficha técnica** son pares dato/valor libres (potencia, aceite que lleva,
medida de cubiertas, póliza…), porque cada máquina tiene los suyos.

### 1.5 Preventivos: planes y agenda

Un **plan** es un mantenimiento que se repite, cargado en la ficha de cada equipo:

- **qué** hay que hacer: un checklist de tareas, cada una con su acción
  (chequear, cambiar, ajustar, limpiar, lubricar);
- **cada cuánto**: cada N días, cada N km/horas, o **lo que llegue primero**;
- **quién**: un usuario (técnico, conductor) o un externo (concesionaria);
- **qué hace falta**: materiales (si son del pañol, se ve si hay stock y se
  descuentan solos al registrarlo) y herramientas.

La **agenda** calcula el vencimiento de cada plan desde la última vez que se hizo.
Para los que van por km no hay fecha: se **estima** con el ritmo de uso de las
lecturas (km por día), y se marca con "≈". Estados: vencido, próximo (dentro del
aviso), al día, sin datos.

Registrar un preventivo es tocar el plan en la agenda y completar el checklist
(OK / corregido / mal / no aplica). Si algo dio "mal", la app propone abrir el
correctivo. El trabajo guarda **su propia copia** del checklist: cambiar el plan
después no reescribe la historia.

VTV, seguro o matafuegos son planes por días, sin checklist.

#### Planillas: filas × columnas

El checklist de un plan es una **planilla**, igual que las de papel que ya se
usan en planta:

- **filas** agrupadas en **secciones**;
- **columnas** configurables por plan. Sin columnas hay una sola casilla por fila;
- cada celda se marca **✓ bien, ✗ mal o — no se revisó**.

Las tres planillas actuales entran tal cual, y están como plantillas en el
editor de planes:

| Planilla en papel | En la app |
| --- | --- |
| **Clark** (nivel aceite motor, hidráulico, refrigerante, filtro de aire, engrase + fecha + hs) | Plan del clark, una casilla por fila; las horas son la lectura del horómetro |
| **Carrusel de mesas** (Mesa 1…108 × Vidrios, Ruedas, Arrastres, Guías, Tramo de cadena) | Columnas + 108 filas generadas solas ("Mesa 1 … N") |
| **Revisión diaria sector Piedra** (Trompo 2, Mesa vibrado, Sistema de agua, Túnel × Limpieza, Rotura, Desgaste, Falla, Cambiar) | Una sección por equipo, cada 1 día. Trompo 2, Mesa vibrado, Sistema de agua y Túnel son **equipos propios** con su historial: el plan cuelga del "Sector Piedra" y cada sección apunta a su equipo |

Una sección puede ser **otro equipo** (el Túnel dentro de la revisión del sector):
así un ✗ ahí abre el correctivo sobre el Túnel y no sobre "el sector".

Un equipo puede tener **todos los planes que haga falta, cada uno con su
periodicidad y su responsable**: el carrusel tiene el control de mesas (semanal)
y la lubricación de cadena (mensual), y cada uno vence por su lado en la agenda.
El "Responsable" de la planilla de papel es el responsable del plan, y quien
la completó queda como "Lo hizo".

La planilla arranca vacía a propósito: marcar "todo bien" tiene que ser un acto
explícito. Por eso cada sección tiene un botón **✓ Todo bien**, y después se tocan
solo las celdas que dan mal. Cada ✗ se lista como **hallazgo**, con un botón que
abre el correctivo con el equipo y el título ya cargados. La pantalla de cada
planilla muestra además **lo que más da mal en los últimos 90 días** (por
ejemplo, la mesa 17 que siempre tiene problemas de ruedas).

### 1.6 Correctivos

Lo que sale de lo esperado. Se **abre** con la falla (lo puede reportar el
conductor desde su celular), la prioridad y cómo queda el equipo (funciona /
con falla / parado). Se **sigue** (en curso) y se **cierra** con:

- la **causa**, obligatoria: es lo que después contesta "¿por qué se rompen las
  cosas?". Es una lista configurable (desgaste normal, falta de mantenimiento,
  mal uso, accidente, defecto de repuesto, reparación anterior mal hecha…);
- qué se hizo, quién lo hizo, horas parado, horas hombre, costos externos e
  insumos del pañol usados.

### 1.7 Kilometraje

Una lectura por equipo y día. El conductor ve **solo sus vehículos** y los carga
en dos toques. El tablero cuenta cuántos equipos no tienen lectura en el mes. La
ficha muestra la lectura de fin de cada mes y lo recorrido. Una lectura menor a
la anterior se rechaza: el odómetro no va para atrás, y un número al revés
rompería las estimaciones de la agenda.

### 1.8 Combustible

Por protocolo, **cada bidón que se carga se registra**: equipo, litros y las horas
del horómetro (o el km) en ese momento. La lectura es obligatoria para los
equipos con medidor, porque sin ella no hay consumo. Esa lectura también cuenta
como lectura del día, así que cargar combustible mantiene al día la agenda de
los services por horas.

Con bidones no hay "tanque lleno", así que el consumo se calcula **por período**:
se suman los litros cargados entre dos lecturas y se dividen por las horas
trabajadas entre esas dos lecturas. En períodos largos los bidones sueltos se
compensan.

- **L/h** (o L/100 km) y su inversa, **horas por litro** (o km por litro), de los
  últimos 90 días;
- una **tabla por mes**: litros, horas y L/h;
- una alerta de **consumo alto** cuando el último mes supera en más de 25% el
  promedio de los anteriores. Eso puede ser una pérdida, un motor que anda mal
  o combustible que no va adonde se anota.

Cada equipo dice qué combustible usa (diésel, nafta, GNC). Si el bidón sale del
tambor de la empresa, se descuenta del stock de ese insumo (categoría
*Combustibles*). El conductor puede registrar cargas en cualquier vehículo de la
empresa (los clarks los maneja quien esté) y en el suyo.

### 1.9 Obras

Armado de locales, arreglos en oficinas propias, obras edilicias: título, lugar,
tipo, estado, prioridad, responsable o contratista, costos, una **bitácora**, y
los materiales del pañol que se le imputaron.

**Subtareas.** Una obra se divide en partes (Local Catamarca: pintura, piso,
instalación eléctrica, muestrarios, cartel). Cada una tiene responsable y su
**avance en cinco escalones**: 0 sin empezar, 25 empezado, 50 por la mitad,
75 avanzado, 100 finalizado (en verde). Escalones fijos y no un porcentaje
libre, porque "por la mitad" se dice igual en todas las obras y se compara;
un 37% no lo mide nadie. Cada cambio queda registrado **con su fecha**, que
puede ser de días atrás (se anota cuando se puede).

**Comprometido contra real.** Obra y subtareas tienen fechas **comprometidas**
de inicio y fin. Las **reales** se completan solas: el primer avance marca el
inicio y el 100% el fin. La obra sigue a sus subtareas: arranca con la primera
y termina con la última. El **desvío** son los días entre una y otra (se
prometió empezar el 10/10 y se arrancó el 15: 5 días tarde).

**Cumplimiento** (`/obras/cumplimiento`, por año): porcentaje de obras y
subtareas empezadas y terminadas en fecha, atraso promedio, obra por obra y por
responsable. Cuenta solo lo que ya se puede medir: lo terminado y lo que se pasó
de fecha sin terminar. Lo que todavía está en fecha no suma ni resta.

### 1.10 Estado de los equipos

Operativo, con falla (funciona con el problema), **en reparación** (alguien lo
está arreglando), **fuera de servicio** (parado, esperando un repuesto, un técnico
o una decisión) y de baja. En reparación y fuera de servicio se separan porque
los dos están parados, pero solo uno es tiempo muerto: mezclarlos esconde cuánto
se espera.

Cada cambio de estado queda en un historial (desde, hasta, quién, por qué
trabajo), que es de donde va a salir el tiempo parado de cada máquina. Para que
cambiarlo no exija dar vueltas, **después de cada avance de una reparación la app
pregunta cómo queda la máquina**: un toque, o "queda como estaba". La ficha de
cada equipo tiene además un botón "Cambiar estado".

---

## 2. Roles

| | Tablero, agenda, insumos, equipos, trabajos, obras, herramientas | Compras, informes | Configurar (equipos, planes, insumos) | Usuarios | Cargar km | Reportar falla |
| --- | --- | --- | --- | --- | --- | --- |
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Jefe de taller** | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Técnico** | ✓ (registra) | — | — | — | ✓ | ✓ |
| **Conductor** | solo sus vehículos | — | — | — | los suyos | los suyos |
| **Auditoría** | ✓ solo lectura | ✓ solo lectura | — | — | — | — |

---

## 3. ¿Conviene registrar los montos? Sí, pero no como número suelto

La preocupación es correcta: con la inflación argentina, "$ 180.000 en 2024" y
"$ 540.000 en 2026" no se pueden comparar, y un informe anual en pesos nominales
**engaña**: todo parece subir aunque se gaste lo mismo. Pero no registrar los
montos es peor, porque se pierde la pregunta más importante que va a hacer la
auditora: *¿esta máquina ya cuesta más de lo que vale mantenerla?*

La decisión tomada tiene tres partes:

**1. Se guarda el monto en pesos, con su fecha, tal cual se pagó.** Nunca se
guarda un monto "convertido". El dato original no se toca.

**2. La cotización del dólar se carga sola.** Todos los días hábiles, un cron de
Vercel trae el historial de *argentinadatos.com* (con *dolarapi.com* de respaldo)
y completa los días que falten. En Configuración → Cotización se elige **qué
dólar** usar: oficial BNA (por defecto), MEP, CCL, blue o mayorista. Al
cambiarlo se reemplaza el historial automático entero, para no mezclar dos
dólares distintos. Una cotización cargada a mano nunca se pisa. Los informes
pasan **cada gasto a dólares con la cotización vigente a su fecha**. Como la conversión se hace al leer y no al guardar, si una
cotización estaba mal se corrige y todos los informes se arreglan solos. Así se
puede comparar 2025 contra 2027.

**3. Los indicadores más importantes no son plata.** No dependen de la inflación
y son los que de verdad dicen si el mantenimiento funciona:

- **cantidad de correctivos** por equipo y por causa,
- **horas de equipo parado**,
- **horas hombre**,
- **consumo físico** de insumos (litros, discos, kilos),
- preventivos hechos.

Los montos son **opcionales** en todos los formularios. Si un día no se sabe el
precio, se registra el trabajo igual: el trabajo sin monto vale más que ningún
trabajo.

> Alternativa descartada: ajustar por IPC. Es más "correcta" en teoría, pero
> requiere cargar el índice cada mes (sale con un mes y medio de atraso) y el
> resultado es un número que nadie en la planta sabe interpretar. El dólar lo
> entiende todo el mundo y se consigue el mismo día.

---

## 4. Decisiones de modelo

- **El stock es un cache de los movimientos**, escrito solo por `lib/motor-stock.ts`
  en la misma transacción que el movimiento, con la fila del insumo bloqueada
  (`FOR UPDATE`). Dos consumos simultáneos no se pisan.
- **La última vez que se hizo un plan no se guarda en el plan**: sale del último
  trabajo preventivo cerrado. Un solo lugar donde vive el dato.
- **Nada se borra.** Equipos, insumos, planes y usuarios se desactivan o se dan de
  baja; el historial los sigue nombrando.
- **Los montos van como `numeric` en pesos**, las cantidades como `numeric` (hay
  insumos que se cuentan en metros, litros o kilos).
- **Las lecturas de un trabajo alimentan el km**: si al cambiar el aceite se anota
  85.100 km, esa es la lectura de ese día (si no contradice las cargadas).

---

## 5. Lo que viene (a decidir)

- [ ] **Fotos** en correctivos y obras (Vercel Blob).
- [ ] **Avisos** de vencimientos por mail o WhatsApp al responsable.
- [ ] **Exportar a Excel** trabajos, movimientos e informes.
- [ ] **Carga masiva** del pañol desde una planilla (el primer inventario).
- [ ] **QR en cada máquina** que abra su ficha y "Reportar falla".
- [ ] **Costo valorizado** de los insumos consumidos por cada equipo (con el
      último precio de compra).
- [ ] **Cumplimiento de preventivos**: % hecho a tiempo, por equipo y responsable.
- [ ] **Backup** diario de la base a GitHub (como en control-estanterias).
