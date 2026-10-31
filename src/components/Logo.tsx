/** Carbonic brand mark, from the supplied logo artwork (public/logo.png: black on transparent). */
export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}logo.png`} width={size} height={size} alt="Carbonic" className={`select-none ${className}`} draggable={false} />;
}
