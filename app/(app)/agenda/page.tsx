import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { agenda, nombreActivo, type ItemAgenda } from "@/lib/consultas";
import { fmtFecha, fmtNum, UNIDAD_MEDIDOR } from "@/lib/formato";
import { Chip, ChipVencimiento, Pestanas, Titulo, Vacio } from "@/components/ui";

export const metadata = { title: "Agenda · Taller" };
export const dynamic = "force-dynamic";

const GRUPOS = [
  { estado: "vencido", titulo: "Vencidos" },
  { estado: "proximo", titulo: "Próximos" },
  { estado: "al_dia", titulo: "Al día" },
  { estado: "sin_datos", titulo: "Sin datos para calcular" },
] as const;

export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{ clase?: string; mios?: string }>;
}) {
  const sesion = await requerirSesion();
  const { clase = "todos", mios } = await searchParams;
  const soloMios = mios === "1" || (mios === undefined && sesion.rol === "tecnico");

  let items = await agenda({ responsableId: soloMios ? sesion.uid : undefined });
  if (clase === "maquina" || clase === "vehiculo") items = items.filter((i) => i.clase === clase);

  const url = (c: string, m: boolean) => `/agenda?clase=${c}&mios=${m ? 1 : 0}`;

  return (
    <>
      <Titulo detalle="Todos los preventivos, ordenados por lo que vence primero. Tocá uno para registrarlo como hecho.">
        Agenda de preventivos
      </Titulo>

      <Pestanas
        actual={clase}
        opciones={[
          { valor: "todos", etiqueta: "Todo", href: url("todos", soloMios) },
          { valor: "maquina", etiqueta: "Máquinas", href: url("maquina", soloMios) },
          { valor: "vehiculo", etiqueta: "Vehículos", href: url("vehiculo", soloMios) },
        ]}
      />
      <Pestanas
        actual={soloMios ? "mios" : "todos"}
        opciones={[
          { valor: "todos", etiqueta: "De todos", href: url(clase, false) },
          { valor: "mios", etiqueta: "Solo los míos", href: url(clase, true) },
        ]}
      />

      {items.length === 0 && (
        <Vacio>
          No hay preventivos {soloMios ? "a tu cargo" : "cargados"}. Los planes se
          crean desde la ficha de cada máquina o vehículo.
        </Vacio>
      )}

      <div className="space-y-6">
        {GRUPOS.map((g) => {
          const lista = items.filter((i) => i.venc.estado === g.estado);
          if (!lista.length) return null;
          return (
            <section key={g.estado}>
              <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
                {g.titulo} · {lista.length}
              </h2>
              <ul className="space-y-2">
                {lista.map((i) => (
                  <Renglon key={i.plan_id} i={i} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Renglon({ i }: { i: ItemAgenda }) {
  const u = UNIDAD_MEDIDOR[i.medidor];
  const periodo = [
    i.cada_dias ? `cada ${fmtNum(i.cada_dias)} días` : null,
    i.cada_uso && i.medidor !== "ninguno" ? `cada ${fmtNum(i.cada_uso)} ${u}` : null,
  ]
    .filter(Boolean)
    .join(" o ");

  return (
    <li>
      <Link
        href={`/trabajos/preventivo/${i.plan_id}`}
        className="tarjeta flex flex-wrap items-start gap-3 p-4 transition hover:ring-slate-300"
      >
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">{i.plan}</p>
          <p className="text-sm text-slate-600">
            {i.clase === "vehiculo" ? "🚚" : "🏭"}{" "}
            {nombreActivo({ nombre: i.activo, patente: i.patente, codigo: i.codigo })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {periodo} · última: {i.ult_fecha ? fmtFecha(i.ult_fecha) : "nunca registrada"}
            {i.ult_lectura != null && ` a ${fmtNum(i.ult_lectura)} ${u}`}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Responsable: {i.responsable ?? i.responsable_externo ?? <em>sin asignar</em>}
          </p>
          {i.materiales_faltantes > 0 && (
            <p className="mt-1">
              <Chip tono="rojo">faltan materiales en el pañol</Chip>
            </p>
          )}
        </div>
        <div className="text-right">
          <ChipVencimiento estado={i.venc.estado} />
          {i.venc.fechaAgenda && (
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {i.venc.estimada ? "≈ " : ""}
              {fmtFecha(i.venc.fechaAgenda)}
            </p>
          )}
          {i.venc.faltaUso != null && (
            <p className="text-xs text-slate-500">
              {i.venc.faltaUso > 0
                ? `faltan ${fmtNum(i.venc.faltaUso)} ${u}`
                : `pasado ${fmtNum(-i.venc.faltaUso)} ${u}`}
            </p>
          )}
          {i.venc.faltanDias != null && (
            <p className="text-xs text-slate-500">
              {i.venc.faltanDias >= 0
                ? `en ${i.venc.faltanDias} días`
                : `hace ${-i.venc.faltanDias} días`}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
