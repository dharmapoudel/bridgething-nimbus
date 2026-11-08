import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Sky } from './theme';

// ---------------------------------------------------------------------------
// Sky: two-stop gradient + drifting glow, cross-faded when the theme changes

type Layer = { key: number; sky: Sky };

export function SkyBackground({ sky }: { sky: Sky }) {
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, sky }]);
  const n = useRef(0);
  useEffect(() => {
    setLayers(ls => {
      if (ls[ls.length - 1].sky.id === sky.id) return ls;
      n.current += 1;
      return [...ls.slice(-1), { key: n.current, sky }];
    });
  }, [sky]);
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers(ls => ls.slice(-1)), 1600);
    return () => clearTimeout(t);
  }, [layers]);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {layers.map((l, i) => (
        <div
          key={l.key}
          className={`sky-layer ${i > 0 ? 'fade-in' : ''}`}
          style={{ background: `linear-gradient(160deg, ${l.sky.top} 0%, ${l.sky.bottom} 100%)`, animationDuration: '1.4s' }}
        >
          <div className="sky-photo" style={{ backgroundImage: `url(${l.sky.photo})` }} />
          <div className="absolute inset-0" style={{ background: l.sky.scrim }} />
          <div
            className="sky-glow"
            style={{
              left: `${l.sky.glowAt[0]}%`,
              top: `${l.sky.glowAt[1]}%`,
              background: `radial-gradient(circle, ${l.sky.glow} 0%, transparent 65%)`,
            }}
          />
        </div>
      ))}
      <div className="legibility" />
      <div className="vignette" />
      <div className="grain" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Particles: rain, drizzle, snow, stars, mist, storm. One canvas, ~30 fps.

type P = { x: number; y: number; v: number; s: number; a: number; p: number };

export function Particles({ kind, reduced }: { kind: Sky['particles']; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || kind === 'none') return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = (cv.width = 800);
    const H = (cv.height = 480);
    const count = { rain: 70, storm: 85, drizzle: 38, snow: 55, stars: 46, mist: 6, none: 0 }[kind];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const ps: P[] = Array.from({ length: count }, () => ({
      x: rnd(0, W),
      y: rnd(0, H),
      v: kind === 'snow' ? rnd(0.35, 1.0) : kind === 'drizzle' ? rnd(5, 7) : kind === 'mist' ? rnd(0.08, 0.22) : rnd(9, 14),
      s: kind === 'snow' ? rnd(1.2, 3.2) : kind === 'stars' ? rnd(0.6, 1.7) : kind === 'mist' ? rnd(120, 220) : rnd(10, 20),
      a: kind === 'stars' ? rnd(0.2, 0.9) : rnd(0.12, 0.34),
      p: rnd(0, Math.PI * 2),
    }));
    if (kind === 'stars') ps.forEach(p => (p.y = rnd(0, H * 0.62)));
    let raf = 0;
    let last = 0;
    let t = 0;
    let nextFlash = performance.now() + rnd(5000, 9000);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return;
      const dt = Math.min(3, (now - last) / 33);
      last = now;
      t += 0.033 * dt;
      ctx.clearRect(0, 0, W, H);
      if (kind === 'rain' || kind === 'storm' || kind === 'drizzle') {
        ctx.lineCap = 'round';
        ctx.lineWidth = kind === 'drizzle' ? 1 : 1.3;
        for (const p of ps) {
          p.y += p.v * dt;
          p.x -= p.v * 0.18 * dt;
          if (p.y > H + 20) {
            p.y = -20;
            p.x = rnd(0, W + 80);
          }
          ctx.strokeStyle = `rgba(220,235,255,${p.a})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.s * 0.18, p.y - p.s * (kind === 'drizzle' ? 0.5 : 1));
          ctx.stroke();
        }
        if (kind === 'storm' && now > nextFlash && flash.current) {
          nextFlash = now + rnd(6000, 12000);
          flash.current.animate([{ opacity: 0 }, { opacity: 0.32 }, { opacity: 0.05 }, { opacity: 0.22 }, { opacity: 0 }], {
            duration: 700,
            easing: 'ease-out',
          });
        }
      } else if (kind === 'snow') {
        ctx.fillStyle = '#fff';
        for (const p of ps) {
          p.y += p.v * dt;
          p.x += Math.sin(t * 1.2 + p.p) * 0.45 * dt;
          if (p.y > H + 6) {
            p.y = -6;
            p.x = rnd(0, W);
          }
          ctx.globalAlpha = p.a + 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (kind === 'stars') {
        ctx.fillStyle = '#fff';
        for (const p of ps) {
          ctx.globalAlpha = p.a * (0.55 + 0.45 * Math.sin(t * 1.4 + p.p));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (kind === 'mist') {
        for (const p of ps) {
          p.x += p.v * dt;
          if (p.x - p.s > W) p.x = -p.s;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);
          g.addColorStop(0, `rgba(255,255,255,${p.a * 0.5})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
        }
      }
    };
    if (reduced) {
      last = -1000;
      frame(0);
      cancelAnimationFrame(raf);
    } else raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [kind, reduced]);
  if (kind === 'none') return null;
  return (
    <>
      <canvas key={kind} ref={ref} className="pointer-events-none absolute inset-0 fade-in" style={{ animationDuration: '1.6s' }} />
      <div ref={flash} className="pointer-events-none absolute inset-0 bg-white opacity-0" />
    </>
  );
}

// ---------------------------------------------------------------------------
// AnimatedTemp: the digits roll up or down whenever the value changes

export function AnimatedTemp({ value, className = '', style }: { value: number; className?: string; style?: CSSProperties }) {
  const v = Math.round(value);
  const prev = useRef(v);
  const [state, setState] = useState({ v, dir: 'up' as 'up' | 'down', key: 0 });
  useEffect(() => {
    if (v === prev.current) return;
    const dir = v > prev.current ? 'up' : 'down';
    prev.current = v;
    setState(s => ({ v, dir, key: s.key + 1 }));
  }, [v]);
  return (
    <span className={className} style={style}>
      <span key={state.key} className={`digit-roll ${state.dir === 'down' ? 'down' : ''}`}>
        {state.v}
      </span>
      °
    </span>
  );
}

// ---------------------------------------------------------------------------
// RangeBar: lo..hi inside the week's min..max, with an optional "now" dot

export function RangeBar({
  lo,
  hi,
  min,
  max,
  now,
  width = 66,
  delay = 0,
}: {
  lo: number;
  hi: number;
  min: number;
  max: number;
  now?: number;
  width?: number;
  delay?: number;
}) {
  const span = Math.max(1, max - min);
  const l = ((lo - min) / span) * 100;
  const w = Math.max(6, ((hi - lo) / span) * 100);
  const n = now === undefined ? null : Math.min(100, Math.max(0, ((now - min) / span) * 100));
  return (
    <div className="relative h-[5px] rounded-full bg-white/15" style={{ width }}>
      <div
        className="bar-grow absolute top-0 h-full rounded-full"
        style={{
          left: `${l}%`,
          width: `${w}%`,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.72), #ffffff)',
          animationDelay: `${delay}ms`,
        }}
      />
      {n !== null && (
        <div
          className="pop-in absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${n}%`, boxShadow: '0 0 0 2.5px rgba(0,0,0,0.28)', animationDelay: `${delay + 500}ms` }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top tab marks sitting under the four preset buttons

export const BUTTON_X = [100, 300, 500, 700];
export const TAB_LABELS = ['Now', 'Week', 'Details', 'Places'];

export function TabMarks({ active, flashKey, pressed }: { active: number; flashKey: number; pressed: Record<string, boolean> }) {
  // Hidden by default. A preset press slides the strip in, glides the active
  // pill to its button, shows the screen name, then fades it all away.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (flashKey === 0) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1500);
    return () => clearTimeout(t);
  }, [flashKey]);
  const anyHeld = Object.values(pressed).some(Boolean);
  const show = flash || anyHeld;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-10 transition-all duration-500"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'none' : 'translateY(-10px)',
        transitionTimingFunction: show ? 'cubic-bezier(0.34,1.36,0.64,1)' : 'cubic-bezier(0.4,0,0.2,1)',
        transitionDuration: show ? '450ms' : '700ms',
      }}
    >
      {BUTTON_X.map((x, i) => (
        <div
          key={i}
          className="absolute top-[6px] h-[3px] w-[22px] rounded-full bg-white/30 transition-transform duration-300"
          style={{ left: x, transform: `translateX(-50%) ${pressed[String(i + 1)] ? 'scaleX(1.25)' : ''}` }}
        />
      ))}
      <div
        className="absolute top-[6px] h-[3px] w-[46px] rounded-full bg-white transition-all duration-500"
        style={{
          left: BUTTON_X[active] - 23,
          boxShadow: '0 0 10px rgba(255,255,255,0.6)',
          transitionTimingFunction: 'cubic-bezier(0.34,1.36,0.64,1)',
        }}
      />
      <div
        key={`${active}-${flashKey}`}
        className="pop-in absolute top-[15px] -translate-x-1/2 rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white"
        style={{ left: BUTTON_X[active] }}
      >
        {TAB_LABELS[active]}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Toast({ toast }: { toast: { id: number; text: string } | null }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className="pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center">
      <div className="rise rounded-full bg-black/45 px-4 py-2 text-[14px] font-medium text-white shadow-lg">{toast.text}</div>
    </div>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center px-16 text-center">{children}</div>;
}
