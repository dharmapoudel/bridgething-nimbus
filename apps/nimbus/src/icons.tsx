import { useId, type ReactNode } from 'react';
import { kindOf } from './weather';

// Animated weather glyphs. Everything is SVG plus CSS keyframes (index.css,
// `wx-*`), transform/opacity only, so they stay cheap on the Car Thing's GPU.
// Sub-glyphs are nested <svg> viewports so each one can spin or drift around
// its own centre.

// Layered, softly shaded glyphs in the spirit of iOS weather symbols: a sun
// with a halo and tapered rays, a crescent moon with craters and twinkling
// stars, volumetric clouds with a rim light and a cast shadow, teardrop rain,
// six-armed snowflakes, a bolt that lights the cloud from inside.
// Each moving part is wrapped in a positioning <g> so the CSS animation on
// the inner element never fights the SVG transform.

type Sub = { x?: number; y?: number; s?: number; children: ReactNode };

function Box({ x = 0, y = 0, s = 64, children }: Sub) {
  return (
    <svg x={x} y={y} width={s} height={s} viewBox="0 0 64 64" overflow="visible">
      {children}
    </svg>
  );
}

const pt = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

function SunGlyph({ id }: { id: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const long = i % 2 === 0;
    const d = i * 30;
    const [tx, ty] = pt(32, 32, long ? 25 : 21.5, d);
    const [ax, ay] = pt(32, 32, 16.5, d - (long ? 7 : 6));
    const [bx, by] = pt(32, 32, 16.5, d + (long ? 7 : 6));
    return `M${ax.toFixed(2)} ${ay.toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}Z`;
  });
  return (
    <>
      <defs>
        <radialGradient id={`${id}halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd86b" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#ffc24a" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffb02e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}core`} cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fffbe3" />
          <stop offset="38%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#ffa62b" />
        </radialGradient>
        <linearGradient id={`${id}ray`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe27a" />
          <stop offset="100%" stopColor="#ffb733" />
        </linearGradient>
      </defs>
      <circle className="wx-glow" cx="32" cy="32" r="31" fill={`url(#${id}halo)`} />
      <g className="wx-rays">
        {rays.map((d, i) => (
          <path key={i} d={d} fill={`url(#${id}ray)`} strokeLinejoin="round" stroke={`url(#${id}ray)`} strokeWidth="1.6" />
        ))}
      </g>
      <circle cx="32" cy="32" r="13.5" fill={`url(#${id}core)`} />
      <ellipse cx="27.5" cy="26.5" rx="5" ry="3.2" fill="#fff" opacity="0.45" transform="rotate(-30 27.5 26.5)" />
    </>
  );
}

function Star({ x, y, r, delay }: { x: number; y: number; r: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="wx-twinkle"
        style={{ animationDelay: `${delay}s` }}
        d={`M0 ${-r}Q${r * 0.18} ${-r * 0.18} ${r} 0Q${r * 0.18} ${r * 0.18} 0 ${r}Q${-r * 0.18} ${r * 0.18} ${-r} 0Q${-r * 0.18} ${-r * 0.18} 0 ${-r}Z`}
        fill="#fff"
      />
    </g>
  );
}

function MoonGlyph({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}mhalo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#dfe6ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#dfe6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}moon`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#fffdf2" />
          <stop offset="60%" stopColor="#f1ead2" />
          <stop offset="100%" stopColor="#cfc6aa" />
        </linearGradient>
        <clipPath id={`${id}mclip`}>
          <path d="M36 9.5a22 22 0 1 0 17.5 34A18 18 0 0 1 36 9.5z" />
        </clipPath>
      </defs>
      <circle className="wx-glow" cx="30" cy="33" r="30" fill={`url(#${id}mhalo)`} />
      <path d="M36 9.5a22 22 0 1 0 17.5 34A18 18 0 0 1 36 9.5z" fill={`url(#${id}moon)`} />
      <g clipPath={`url(#${id}mclip)`} fill="#b9ae8c" opacity="0.32">
        <circle cx="21" cy="37" r="3.6" />
        <circle cx="26" cy="47" r="2.2" />
        <circle cx="19.5" cy="25" r="1.8" />
        <circle cx="30" cy="40" r="1.4" />
      </g>
      <path d="M36 9.5a22 22 0 1 0 17.5 34" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      <Star x={50} y={14} r={4.2} delay={0} />
      <Star x={57} y={27} r={2.6} delay={1.3} />
      <Star x={44} y={25} r={1.8} delay={0.7} />
    </>
  );
}

type Tone = 'light' | 'grey' | 'dark' | 'night';
const TONES: Record<Tone, [string, string, string]> = {
  light: ['#ffffff', '#f3f6fa', '#cfd8e4'],
  grey: ['#eef1f5', '#d3d9e1', '#9ea8b6'],
  dark: ['#a8afc2', '#7c849c', '#4b5168'],
  night: ['#c9d0e0', '#9aa3b9', '#646d86'],
};

/** A puffy cumulus built from overlapping shapes sharing one gradient. */
function CloudShape({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <circle cx="21" cy="38" r="10" />
      <circle cx="32.5" cy="30" r="14" />
      <circle cx="45" cy="37" r="11" />
      <rect x="21" y="36" width="24" height="12" />
    </g>
  );
}

function CloudGlyph({ id, tone = 'light', drift = true, lit = false }: { id: string; tone?: Tone; drift?: boolean; lit?: boolean }) {
  const [a, b, c] = TONES[tone];
  const g = `${id}cl${tone}`;
  return (
    <g className={drift ? 'wx-drift' : undefined}>
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="0" y1="16" x2="0" y2="48">
          <stop offset="0%" stopColor={a} />
          <stop offset="55%" stopColor={b} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
      </defs>
      <g transform="translate(1.6 2.6)" opacity="0.2">
        <CloudShape fill="#0b1830" />
      </g>
      <CloudShape fill={`url(#${g})`} />
      {/* rim light along the top of the big puff */}
      <path d="M21.5 23.5A14 14 0 0 1 41 19.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity={tone === 'light' ? 0.9 : 0.55} />
      {lit && (
        <g className="wx-flash-cloud">
          <CloudShape fill="#fff6c8" />
        </g>
      )}
    </g>
  );
}

function Drops({ id, n, small }: { id: string; n: number; small?: boolean }) {
  const xs = n === 3 ? [24, 33.5, 43] : [20, 28.5, 37, 45.5];
  const sc = small ? 0.8 : 1.15;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}drop`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c7e6ff" />
          <stop offset="100%" stopColor="#3d93ff" />
        </linearGradient>
      </defs>
      {xs.map((x, i) => (
        <g key={i} transform={`translate(${x} ${i % 2 ? 54 : 52.5}) rotate(14) scale(${sc})`}>
          <path
            className="wx-drop"
            style={{ animationDelay: `${((i * 0.41) % 1).toFixed(2)}s`, animationDuration: small ? '1.5s' : '0.95s' }}
            d="M0 -5C1.6 -2.4 3.1 -0.3 3.1 1.6A3.1 3.1 0 0 1 -3.1 1.6C-3.1 -0.3 -1.6 -2.4 0 -5Z"
            fill={`url(#${id}drop)`}
          />
        </g>
      ))}
    </g>
  );
}

function Flake({ r = 4 }: { r?: number }) {
  const arms = [0, 60, 120];
  const b = r * 0.45;
  return (
    <g stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none">
      {arms.map(a => (
        <g key={a} transform={`rotate(${a})`}>
          <line x1="0" y1={-r} x2="0" y2={r} />
          <path d={`M${-b * 0.6} ${-r + b * 0.2}L0 ${-r + b}L${b * 0.6} ${-r + b * 0.2}M${-b * 0.6} ${r - b * 0.2}L0 ${r - b}L${b * 0.6} ${r - b * 0.2}`} />
        </g>
      ))}
    </g>
  );
}

function Flakes() {
  const spots: [number, number, number][] = [
    [20, 55, 4.4],
    [33, 59, 5],
    [46, 54.5, 4.2],
  ];
  return (
    <g>
      {spots.map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g className="wx-flake" style={{ animationDelay: `${(i * 0.8).toFixed(1)}s` }}>
            <Flake r={r} />
          </g>
        </g>
      ))}
    </g>
  );
}

function Bolt({ id }: { id: string }) {
  return (
    <g className="wx-bolt">
      <defs>
        <linearGradient id={`${id}bolt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6b8" />
          <stop offset="100%" stopColor="#ffb300" />
        </linearGradient>
      </defs>
      <path d="M35.5 41.5L26 54.5h6.8L29 64.5l12.5-15h-7.2l5-8z" fill={`url(#${id}bolt)`} stroke="#fff3c4" strokeWidth="0.8" strokeLinejoin="round" />
    </g>
  );
}

function FogBands() {
  return (
    <g strokeLinecap="round" stroke="#f4f6f9">
      <line className="wx-fog" x1="12" y1="50" x2="40" y2="50" strokeWidth="3.4" opacity="0.95" />
      <line className="wx-fog wx-d2" x1="20" y1="56.5" x2="54" y2="56.5" strokeWidth="3.4" opacity="0.8" />
      <line className="wx-fog" x1="14" y1="63" x2="44" y2="63" strokeWidth="3.4" opacity="0.6" style={{ animationDelay: '-2.6s' }} />
    </g>
  );
}

export function WxIcon({ code, day = true, size = 40, still = false, className = '' }: { code: number; day?: boolean; size?: number; still?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const k = kindOf(code);
  const light = day ? <SunGlyph id={id} /> : <MoonGlyph id={id} />;
  const soft: Tone = day ? 'light' : 'night';
  let body: ReactNode;
  switch (k) {
    case 'clear':
      body = light;
      break;
    case 'partly':
      body = (
        <>
          <Box x={-5} y={-9} s={52}>
            {light}
          </Box>
          <Box x={5} y={5} s={58}>
            <CloudGlyph id={id} tone={soft} />
          </Box>
        </>
      );
      break;
    case 'cloudy':
      body = (
        <>
          <Box x={13} y={-7} s={46}>
            <g className="wx-drift-rev">
              <CloudGlyph id={`${id}b`} tone={day ? 'grey' : 'dark'} drift={false} />
            </g>
          </Box>
          <Box x={-3} y={3}>
            <CloudGlyph id={id} tone={soft} />
          </Box>
        </>
      );
      break;
    case 'fog':
      body = (
        <>
          <Box y={-9}>
            <CloudGlyph id={id} tone={day ? 'grey' : 'night'} />
          </Box>
          <FogBands />
        </>
      );
      break;
    case 'drizzle':
      body = (
        <>
          <Box y={-9}>
            <CloudGlyph id={id} tone={soft} />
          </Box>
          <Drops id={id} n={3} small />
        </>
      );
      break;
    case 'rain':
      body = (
        <>
          <Box y={-9}>
            <CloudGlyph id={id} tone={day ? 'grey' : 'night'} />
          </Box>
          <Drops id={id} n={4} />
        </>
      );
      break;
    case 'snow':
      body = (
        <>
          <Box y={-10}>
            <CloudGlyph id={id} tone={soft} />
          </Box>
          <Flakes />
        </>
      );
      break;
    case 'storm':
      body = (
        <>
          <Box y={-11}>
            <CloudGlyph id={id} tone="dark" lit />
          </Box>
          <Bolt id={id} />
        </>
      );
      break;
  }
  return (
    <svg
      className={`wx ${still ? 'wx-still' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      overflow="visible"
      aria-hidden
    >
      {body}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// UI glyphs

type P = { size?: number; className?: string };

export const RefreshIcon = ({ size = 18, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
);

export const PinIcon = ({ size = 14, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.5c-4 0-7 3-7 7 0 5.2 6.1 11.4 6.4 11.7.3.3.9.3 1.2 0 .3-.3 6.4-6.5 6.4-11.7 0-4-3-7-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" />
  </svg>
);

export const NavIcon = ({ size = 14, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.6 3.4c.4.4.5.9.3 1.4l-7 15.4c-.4.9-1.7.8-2-.1l-1.6-5-5-1.6c-.9-.3-1-1.6-.1-2l15.4-7c.5-.2 1-.1 1.4.3z" />
  </svg>
);

export const DropIcon = ({ size = 12, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.7c-.3 0-.6.2-.8.4C9.6 5.2 5 11.4 5 15a7 7 0 0 0 14 0c0-3.6-4.6-9.8-6.2-11.9-.2-.2-.5-.4-.8-.4z" />
  </svg>
);

export const ArrowIcon = ({ size = 14, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);
