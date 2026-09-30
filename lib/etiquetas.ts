/**
 * Constantes que usan tanto las páginas (servidor) como los formularios
 * (cliente). Viven acá y no en un archivo "use client": lo que exporta un
 * módulo de cliente, visto desde el servidor, es una referencia y no el valor.
 */

export const ESTADO_OBRA = {
  pendiente: { texto: "Pendiente", tono: "gris" },
  en_curso: { texto: "En curso", tono: "azul" },
  terminada: { texto: "Terminada", tono: "verde" },
  cancelada: { texto: "Cancelada", tono: "gris" },
} as const;

export type DatosObra = {
  id?: number;
  titulo: string;
  lugar: string;
  tipo: string;
  descripcion: string;
  estado: "pendiente" | "en_curso" | "terminada" | "cancelada";
  prioridad: "baja" | "media" | "alta" | "urgente";
  fechaInicio: string;
  fechaEstimada: string;
  fechaFin: string;
  responsableId: number | null;
  responsableExterno: string;
  horasHombre: string;
  costoManoObra: string;
  costoMateriales: string;
};

export const OBRA_VACIA: DatosObra = {
  titulo: "",
  lugar: "",
  tipo: "",
  descripcion: "",
  estado: "pendiente",
  prioridad: "media",
  fechaInicio: "",
  fechaEstimada: "",
  fechaFin: "",
  responsableId: null,
  responsableExterno: "",
  horasHombre: "",
  costoManoObra: "",
  costoMateriales: "",
};

export const ESTADO_COMPRA = {
  borrador: { texto: "Borrador", tono: "gris" },
  pedida: { texto: "Pedida", tono: "azul" },
  recibida: { texto: "Recibida", tono: "verde" },
  cancelada: { texto: "Cancelada", tono: "gris" },
} as const;

export const ESTADO_HERRAMIENTA = {
  bueno: { texto: "Bueno", tono: "verde" },
  regular: { texto: "Regular", tono: "amarillo" },
  en_reparacion: { texto: "En reparación", tono: "rojo" },
  baja: { texto: "De baja", tono: "gris" },
} as const;
