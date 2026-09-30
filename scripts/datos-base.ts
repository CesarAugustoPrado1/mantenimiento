/**
 * Datos de arranque: configuración, no datos de prueba. Los usa el seed y el
 * generador del SQL para Neon, así los dos dicen exactamente lo mismo.
 */
export const CAUSAS: Array<{ nombre: string; descripcion: string }> = [
  { nombre: "Desgaste normal", descripcion: "Llegó al fin de su vida útil." },
  { nombre: "Falta de mantenimiento", descripcion: "Un preventivo que no se hizo o se hizo tarde." },
  { nombre: "Mal uso / operación", descripcion: "Se usó fuera de lo previsto o sin cuidado." },
  { nombre: "Accidente / golpe", descripcion: "Choque, caída, golpe." },
  { nombre: "Defecto de fábrica / repuesto", descripcion: "Pieza o repuesto que salió mal." },
  { nombre: "Reparación anterior mal hecha", descripcion: "Vuelve a fallar algo que ya se arregló." },
  { nombre: "Causa externa", descripcion: "Corte de luz, agua, clima, terceros." },
  { nombre: "No determinada", descripcion: "Se arregló pero no se sabe por qué pasó." },
];

export const CATEGORIAS = [
  "Abrasivos y discos",
  "Soldadura",
  "Tornillería y fijaciones",
  "Perfiles y caños",
  "Lubricantes y fluidos",
  "Filtros",
  "Eléctricos",
  "Pintura",
  "Seguridad (EPP)",
  "Limpieza",
];
