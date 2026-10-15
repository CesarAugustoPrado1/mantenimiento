import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad · Mantenimiento y Taller" };

/**
 * Pública: Google la pide (URL de política de privacidad) para dejar en
 * producción el acceso a Drive con el que la app guarda los archivos.
 */
export default function Privacidad() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-10 text-sm text-slate-700">
      <h1 className="text-xl font-bold text-slate-900">Política de privacidad</h1>
      <p>
        <strong>Mantenimiento y Taller</strong> es una aplicación interna de Pirka Stone para registrar el mantenimiento de
        máquinas y vehículos, el stock del taller, las obras y la fabricación propia. Solo la usan personas de la empresa, con
        usuario y PIN asignados por el administrador.
      </p>
      <h2 className="font-semibold text-slate-900">Acceso a Google Drive</h2>
      <p>
        La aplicación usa una única cuenta de Google Drive de la empresa para guardar los archivos que se suben desde la app
        (planos, manuales, fotos). Solo crea, lee y borra los archivos y carpetas de la aplicación. No accede a otros datos
        de la cuenta, no los comparte con terceros y no los usa con ningún otro fin.
      </p>
      <h2 className="font-semibold text-slate-900">Datos guardados</h2>
      <p>
        Se guardan los registros de trabajo que carga el personal (nombres de usuario, fechas, tareas, consumos) en una base
        de datos de la empresa. No se venden ni se ceden a terceros.
      </p>
      <h2 className="font-semibold text-slate-900">Contacto</h2>
      <p>Por cualquier consulta, escribir al administrador de la aplicación en Pirka Stone.</p>
    </main>
  );
}
