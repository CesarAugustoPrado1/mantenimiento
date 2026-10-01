import { ETIQUETA_PASO, esPaso, textoDesvio, type Desvio } from "@/lib/cumplimiento";
import { Chip } from "./ui";

/** Barra de avance: azul mientras se trabaja, verde cuando está terminada. */
export function BarraAvance({ progreso, chica }: { progreso: number; chica?: boolean }) {
  const lleno = progreso >= 100;
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 rounded-full bg-slate-100 ${chica ? "h-1.5" : "h-2.5"}`}>
        <div
          className={`rounded-full ${chica ? "h-1.5" : "h-2.5"} ${lleno ? "bg-verde" : "bg-blue-600"}`}
          style={{ width: `${Math.max(progreso, 0)}%` }}
        />
      </div>
      <span className={`w-28 shrink-0 text-right text-xs font-semibold tabular-nums ${lleno ? "text-verde" : "text-slate-600"}`}>
        {progreso}% {esPaso(progreso) ? `· ${ETIQUETA_PASO[progreso]}` : ""}
      </span>
    </div>
  );
}

/** "15 días tarde", "a tiempo", "3 días de atraso". */
export function ChipDesvio({ desvio, que }: { desvio: Desvio; que: string }) {
  if (desvio.tipo === "sin_plan") return null;
  const tono =
    desvio.tipo === "pendiente"
      ? "gris"
      : desvio.tipo === "vencido"
        ? "rojo"
        : desvio.dias <= 0
          ? "verde"
          : "amarillo";
  return (
    <Chip tono={tono}>
      {que}: {textoDesvio(desvio)}
    </Chip>
  );
}
