import type { Rol } from "./db/schema";

/**
 * Prefijo de ruta -> roles habilitados. Gana el prefijo más largo.
 *
 * Esto controla la NAVEGACIÓN. Cada server action revalida por su cuenta con
 * `autorizar()`, porque una action se puede invocar directamente.
 */
const TODOS: Rol[] = ["admin", "jefe_taller", "tecnico", "conductor", "auditor"];
const TALLER: Rol[] = ["admin", "jefe_taller", "tecnico", "auditor"];

const REGLAS: Array<{ prefijo: string; roles: Rol[] }> = [
  { prefijo: "/tablero", roles: TALLER },
  { prefijo: "/agenda", roles: TALLER },
  { prefijo: "/insumos", roles: TALLER },
  { prefijo: "/compras", roles: ["admin", "jefe_taller", "auditor"] },
  { prefijo: "/herramientas", roles: TALLER },
  { prefijo: "/maquinas", roles: TALLER },
  // El conductor ve solo sus vehículos: lo filtra la consulta, no la ruta.
  { prefijo: "/vehiculos", roles: TODOS },
  { prefijo: "/activos", roles: TODOS },
  { prefijo: "/trabajos", roles: TALLER },
  // El conductor puede reportar una falla de su vehículo.
  { prefijo: "/trabajos/nuevo", roles: TODOS },
  { prefijo: "/km", roles: ["admin", "jefe_taller", "tecnico", "conductor"] },
  { prefijo: "/combustible", roles: TODOS },
  { prefijo: "/obras", roles: TALLER },
  { prefijo: "/informes", roles: ["admin", "jefe_taller", "auditor"] },
  { prefijo: "/admin", roles: ["admin", "jefe_taller"] },
  { prefijo: "/admin/usuarios", roles: ["admin"] },
  { prefijo: "/admin/prueba", roles: ["admin"] },
];

export function puedeVer(rol: Rol, ruta: string): boolean {
  const regla = REGLAS.filter((r) => ruta === r.prefijo || ruta.startsWith(`${r.prefijo}/`)).sort(
    (a, b) => b.prefijo.length - a.prefijo.length,
  )[0];
  if (!regla) return true;
  return regla.roles.includes(rol);
}

export function rutaInicial(rol: Rol): string {
  switch (rol) {
    case "tecnico":
      return "/agenda";
    case "conductor":
      return "/km";
    default:
      return "/tablero";
  }
}

/** Quién escribe. El auditor no aparece en ninguna lista de escritura. */
export const OPERAN: Rol[] = ["admin", "jefe_taller", "tecnico"];
export const CONFIGURAN: Rol[] = ["admin", "jefe_taller"];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  jefe_taller: "Jefe de taller",
  tecnico: "Técnico",
  conductor: "Conductor",
  auditor: "Auditoría",
};

export const ROLES: Rol[] = ["admin", "jefe_taller", "tecnico", "conductor", "auditor"];

export type ItemNav = { href: string; etiqueta: string; icono: string };

const NAV: ItemNav[] = [
  { href: "/tablero", etiqueta: "Tablero", icono: "tablero" },
  { href: "/agenda", etiqueta: "Agenda", icono: "agenda" },
  { href: "/km", etiqueta: "Cargar km", icono: "km" },
  { href: "/combustible", etiqueta: "Combustible", icono: "combustible" },
  { href: "/insumos", etiqueta: "Insumos", icono: "insumos" },
  { href: "/maquinas", etiqueta: "Máquinas", icono: "maquina" },
  { href: "/vehiculos", etiqueta: "Vehículos", icono: "vehiculo" },
  { href: "/trabajos", etiqueta: "Trabajos", icono: "trabajos" },
  { href: "/obras", etiqueta: "Obras", icono: "obras" },
  { href: "/herramientas", etiqueta: "Herramientas", icono: "herramientas" },
  { href: "/compras", etiqueta: "Compras", icono: "compras" },
  { href: "/informes", etiqueta: "Informes", icono: "informes" },
  { href: "/admin", etiqueta: "Configuración", icono: "config" },
];

export function navParaRol(rol: Rol): ItemNav[] {
  return NAV.filter((item) => puedeVer(rol, item.href));
}
