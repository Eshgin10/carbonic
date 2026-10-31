/**
 * Illustrated material icons for the first question of the flow. Each is a layered, outlined
 * drawing with its own shading, recoloured for the selected (dark card) and default (light card) state.
 */
export type Tone = 'light' | 'dark' | 'muted';

export const PALETTES: Record<Tone, { line: string; base: string; shade: string; deep: string; accent: string; glint: string }> = {
  light: { line: '#131313', base: '#FFFFFF', shade: '#DCE1DE', deep: '#AFB8B4', accent: '#DCFF00', glint: '#FFFFFF' },
  dark: { line: '#131313', base: '#DCFF00', shade: '#B8D600', deep: '#8FA600', accent: '#FFFFFF', glint: '#F4FFC2' },
  muted: { line: '#5E6662', base: '#F3F5F4', shade: '#E2E6E4', deep: '#C5CCC8', accent: '#E9F2B8', glint: '#FFFFFF' },
};

export const stroke = { strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function FilmRoll({ c }: { c: (typeof PALETTES)[Tone] }) {
  return (
    <>
      {/* Unrolled sheet */}
      <path d="M17 38C29 42 39 36 51 40L57 58C45 54 35 60 23 56Z" fill={c.base} stroke={c.line} {...stroke} />
      <path d="M22 45.5C32 48.5 41 43.5 51.5 46.5" fill="none" stroke={c.shade} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M24.5 51C33 53.5 40 49.5 49 52" fill="none" stroke={c.shade} strokeWidth={1.6} strokeLinecap="round" />
      {/* Resin identification code 4 (LDPE) */}
      <path d="M41.5 49.2l3.2-5.5 3.2 5.5z" fill="none" stroke={c.line} strokeWidth={1.2} strokeLinejoin="round" />
      <text x={44.7} y={48.6} textAnchor="middle" fontSize={4.2} fontWeight={800} fill={c.line} fontFamily="'Plus Jakarta Sans', sans-serif">4</text>
      {/* Roll body */}
      <path d="M13 9H45A9 15 0 0 1 45 39H13A9 15 0 0 1 13 9Z" fill={c.base} stroke={c.line} {...stroke} />
      <path d="M6.5 30A9 15 0 0 0 13 39H45" fill="none" stroke={c.shade} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
      <path d="M12 14.5H38" stroke={c.glint} strokeWidth={3} strokeLinecap="round" />
      <path d="M12 14.5H30" stroke={c.accent} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      <path d="M13 9H45A9 15 0 0 1 45 39H13A9 15 0 0 1 13 9Z" fill="none" stroke={c.line} {...stroke} />
      {/* End face with wound layers and the core */}
      <ellipse cx={45} cy={24} rx={9} ry={15} fill={c.shade} stroke={c.line} {...stroke} />
      <ellipse cx={45} cy={24} rx={6.6} ry={11} fill="none" stroke={c.deep} strokeWidth={1.2} />
      <ellipse cx={45} cy={24} rx={4.6} ry={7.6} fill={c.base} stroke={c.line} strokeWidth={1.6} />
      <ellipse cx={45} cy={24} rx={2.4} ry={4} fill={c.line} />
    </>
  );
}

function Box({ c }: { c: (typeof PALETTES)[Tone] }) {
  return (
    <>
      {/* Interior and back flaps */}
      <path d="M10 26L32 16L54 26L32 36Z" fill={c.deep} stroke={c.line} {...stroke} />
      <path d="M10 26L32 16L25 6L3 16Z" fill={c.base} stroke={c.line} {...stroke} />
      <path d="M32 16L54 26L61 16L39 6Z" fill={c.shade} stroke={c.line} {...stroke} />
      {/* Body */}
      <path d="M10 26L32 36V59L10 49Z" fill={c.shade} stroke={c.line} {...stroke} />
      <path d="M32 36L54 26V49L32 59Z" fill={c.base} stroke={c.line} {...stroke} />
      {/* Tape across the right face */}
      <path d="M40.5 32.3L45.5 30V51.4L40.5 53.7Z" fill={c.accent} stroke={c.line} strokeWidth={1.4} strokeLinejoin="round" />
      {/* Handling marks */}
      <path d="M14.5 37.5l10 4.6M14.5 42l6 2.8" stroke={c.line} strokeWidth={1.4} strokeLinecap="round" opacity={0.55} />
      <path d="M18 49.5v-3.4l2 .9v3.4" fill="none" stroke={c.line} strokeWidth={1.3} strokeLinejoin="round" opacity={0.55} />
      {/* Front flaps folded out */}
      <path d="M10 26L32 36L23 43.5L1 33.5Z" fill={c.base} stroke={c.line} {...stroke} />
      <path d="M32 36L54 26L63 33L41 43Z" fill={c.shade} stroke={c.line} {...stroke} />
      <path d="M8 31.5l14 6.3" stroke={c.glint} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function Glass({ c }: { c: (typeof PALETTES)[Tone] }) {
  return (
    <>
      {/* Jar behind */}
      <rect x={42} y={33} width={15} height={5.5} rx={1.6} fill={c.deep} stroke={c.line} {...stroke} />
      <path d="M42.5 38.5H56.5V56A4 4 0 0 1 52.5 60H46.5A4 4 0 0 1 42.5 56Z" fill={c.shade} stroke={c.line} {...stroke} />
      <path d="M46 42.5V55" stroke={c.glint} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M42.5 46H56.5" stroke={c.line} strokeWidth={1.2} opacity={0.4} />
      {/* Bottle */}
      <path d="M25.5 10H33.5V18.5C33.5 22.5 42 24.5 42 32.5V56A4 4 0 0 1 38 60H21A4 4 0 0 1 17 56V32.5C17 24.5 25.5 22.5 25.5 18.5Z" fill={c.base} stroke={c.line} {...stroke} />
      <path d="M17.5 50H41.5V56A3.6 3.6 0 0 1 37.9 59.6H21.1A3.6 3.6 0 0 1 17.5 56Z" fill={c.shade} opacity={0.9} />
      <rect x={21} y={35} width={17} height={12} rx={2} fill={c.accent} stroke={c.line} strokeWidth={1.5} />
      <path d="M24.5 39.5H34.5M24.5 43H31" stroke={c.line} strokeWidth={1.3} strokeLinecap="round" opacity={0.7} />
      <path d="M21.5 30.5V33M21.5 49.5V54.5" stroke={c.glint} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M25.5 10H33.5V18.5C33.5 22.5 42 24.5 42 32.5V56A4 4 0 0 1 38 60H21A4 4 0 0 1 17 56V32.5C17 24.5 25.5 22.5 25.5 18.5Z" fill="none" stroke={c.line} {...stroke} />
      {/* Cap */}
      <rect x={24.5} y={4} width={10} height={7} rx={1.8} fill={c.deep} stroke={c.line} {...stroke} />
      <path d="M27.5 4.5V10.5M31.5 4.5V10.5" stroke={c.line} strokeWidth={1} opacity={0.5} />
    </>
  );
}

const DRAW: Record<string, typeof FilmRoll> = { LDPE: FilmRoll, Cardboard: Box, Glass };

export function MaterialIcon({ material, tone = 'light', size = 72 }: { material: string; tone?: Tone; size?: number }) {
  const Draw = DRAW[material] ?? FilmRoll;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <Draw c={PALETTES[tone]} />
    </svg>
  );
}
