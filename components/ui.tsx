import Link from "next/link";
import type { ReactNode } from "react";
import type { Nivel } from "@/lib/semaforo";
import { ETIQUETA_NIVEL } from "@/lib/semaforo";
import type { EstadoVencimiento } from "@/lib/vencimientos";

export function Aviso({
  tono = "error",
  children,
}: {
  tono?: "error" | "info" | "exito" | "alerta";
  children: ReactNode;
}) {
  const estilos = {
    error: "bg-red-50 text-red-800 ring-red-200",
    info: "bg-blue-50 text-blue-800 ring-blue-200",
    exito: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    alerta: "bg-amber-50 text-amber-900 ring-amber-200",
  }[tono];

  return (
    <p
      className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 ${estilos}`}
      role={tono === "error" ? "alert" : undefined}
    >
      {children}
    </p>
  );
}

export function Titulo({
  children,
  detalle,
  accion,
}: {
  children: ReactNode;
  detalle?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900">{children}</h1>
        {detalle && <p className="mt-1 text-sm text-slate-500">{detalle}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Volver({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-2 inline-block text-sm font-medium text-slate-500">
      ← {children}
    </Link>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="tarjeta p-6 text-center text-sm text-slate-500">{children}</div>
  );
}

/**
 * El semáforo lleva color Y texto: el color ordena de un vistazo, la palabra
 * es la que se lee con daltonismo o con la pantalla al sol.
 */
export function Semaforo({ nivel, compacto }: { nivel: Nivel; compacto?: boolean }) {
  const estilos = {
    rojo: "bg-rojo-suave text-rojo ring-rojo/30",
    amarillo: "bg-amarillo-suave text-amarillo-texto ring-amarillo/40",
    verde: "bg-verde-suave text-verde ring-verde/30",
  }[nivel];
  const punto = { rojo: "bg-rojo", amarillo: "bg-amarillo", verde: "bg-verde" }[nivel];
  return (
    <span className={`chip gap-1.5 ring-1 ${estilos}`}>
      <span className={`h-2 w-2 rounded-full ${punto}`} />
      {!compacto && ETIQUETA_NIVEL[nivel]}
    </span>
  );
}

const ETIQUETA_VENC: Record<EstadoVencimiento, string> = {
  vencido: "Vencido",
  proximo: "Próximo",
  al_dia: "Al día",
  sin_datos: "Sin datos",
};

export function ChipVencimiento({ estado }: { estado: EstadoVencimiento }) {
  const estilos = {
    vencido: "bg-rojo-suave text-rojo",
    proximo: "bg-amarillo-suave text-amarillo-texto",
    al_dia: "bg-verde-suave text-verde",
    sin_datos: "bg-slate-100 text-slate-500",
  }[estado];
  return <span className={`chip ${estilos}`}>{ETIQUETA_VENC[estado]}</span>;
}

export function Chip({
  children,
  tono = "gris",
}: {
  children: ReactNode;
  tono?: "gris" | "rojo" | "amarillo" | "verde" | "azul" | "oscuro";
}) {
  const estilos = {
    gris: "bg-slate-100 text-slate-600",
    rojo: "bg-rojo-suave text-rojo",
    amarillo: "bg-amarillo-suave text-amarillo-texto",
    verde: "bg-verde-suave text-verde",
    azul: "bg-blue-50 text-blue-700",
    oscuro: "bg-slate-900 text-white",
  }[tono];
  return <span className={`chip ${estilos}`}>{children}</span>;
}

/** Cifra grande del tablero, con enlace a la pantalla que la explica. */
export function Indicador({
  href,
  valor,
  etiqueta,
  tono = "gris",
  detalle,
}: {
  href: string;
  valor: ReactNode;
  etiqueta: string;
  tono?: "gris" | "rojo" | "amarillo" | "verde";
  detalle?: ReactNode;
}) {
  const borde = {
    gris: "",
    rojo: "border-l-4 border-l-rojo",
    amarillo: "border-l-4 border-l-amarillo",
    verde: "border-l-4 border-l-verde",
  }[tono];
  return (
    <Link href={href} className={`tarjeta block p-4 transition hover:ring-slate-300 ${borde}`}>
      <p className="cifra text-3xl text-slate-900">{valor}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-700">{etiqueta}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </Link>
  );
}

/** Pestañas por URL (?param=valor): se pueden compartir y sobreviven al refresco. */
export function Pestanas({
  opciones,
  actual,
}: {
  opciones: Array<{ href: string; etiqueta: string; valor: string }>;
  actual: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={o.href}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
            o.valor === actual
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
          }`}
        >
          {o.etiqueta}
        </Link>
      ))}
    </div>
  );
}

export function ChipPrioridad({ prioridad }: { prioridad: string }) {
  const tono = ({ urgente: "rojo", alta: "amarillo", media: "azul", baja: "gris" } as const)[
    prioridad as "urgente" | "alta" | "media" | "baja"
  ];
  return <Chip tono={tono ?? "gris"}>{prioridad}</Chip>;
}

const ESTADO_ACTIVO = {
  operativo: { texto: "Operativo", tono: "verde" },
  con_falla: { texto: "Con falla", tono: "amarillo" },
  fuera_de_servicio: { texto: "Fuera de servicio", tono: "rojo" },
  baja: { texto: "De baja", tono: "gris" },
} as const;

export function ChipEstadoActivo({ estado }: { estado: keyof typeof ESTADO_ACTIVO }) {
  const e = ESTADO_ACTIVO[estado];
  return <Chip tono={e.tono}>{e.texto}</Chip>;
}

export function ChipCriticidad({ criticidad }: { criticidad: "alta" | "media" | "baja" }) {
  const tono = ({ alta: "rojo", media: "amarillo", baja: "gris" } as const)[criticidad];
  return <Chip tono={tono}>criticidad {criticidad}</Chip>;
}
