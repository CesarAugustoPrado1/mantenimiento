/** El logo como SVG: un glifo depende de la fuente del teléfono. */
export function Marca({ clase = "h-7 w-7" }: { clase?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={clase} aria-hidden>
      <path
        d="M44 8a14 14 0 0 0-13 19L10 48a5 5 0 0 0 7 7l21-21a14 14 0 0 0 19-13l-8 8-7-2-2-7 8-8a14 14 0 0 0-4-4z"
        fill="currentColor"
      />
    </svg>
  );
}
