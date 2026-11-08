import { useEffect, useMemo, useState } from 'react';
import { AnimatedTemp, RangeBar } from './components';
import { ArrowIcon, NavIcon, RefreshIcon, WxIcon } from './icons';
import { skyForForecast, type Sky } from './theme';
import {
  aqiLabel,
  compass,
  dayDate,
  dayName,
  deg,
  fmtHour,
  fmtTime,
  isWet,
  labelOf,
  next24,
  placeSubtitle,
  pressureText,
  uvLabel,
  visibilityText,
  windUnit,
  type Day,
  type Forecast,
  type Place,
} from './weather';

export type Clock = '12h' | '24h';

const COL_W = 101;

function usePulse(ms = 60_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set(x => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function Pop({ pop, ink, show }: { pop: number; ink: string; show: boolean }) {
  return (
    <span className="tnum text-[15px] font-semibold" style={{ color: ink, opacity: show ? 1 : 0 }}>
      {Math.round(pop)}%
    </span>
  );
}

// ===========================================================================
// NOW: the reference layout. Knob scrubs the next 24 hours.

export function NowView({
  place,
  f,
  sky,
  clock,
  scrub,
  onScrub,
  onDay,
  onRefresh,
  refreshing,
  offline,
  deviceOffsetS,
  placeIdx,
  placeCount,
  placeAnim,
}: {
  place: Place;
  f: Forecast;
  sky: Sky;
  clock: Clock;
  scrub: number;
  onScrub: (i: number) => void;
  onDay: (i: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
  offline: boolean;
  deviceOffsetS: number;
  placeIdx: number;
  placeCount: number;
  placeAnim: string;
}) {
  usePulse();
  const hours = useMemo(() => next24(f), [f]);
  const sel = Math.min(scrub, hours.length - 1);
  const h = hours[sel] ?? hours[0];
  const scrubbing = sel > 0;
  const rows = f.days.slice(0, 4);
  const min = Math.min(...rows.map(d => d.lo));
  const max = Math.max(...rows.map(d => d.hi));
  const shift = Math.max(0, Math.min(sel - 2, hours.length - 5)) * COL_W;
  const ago = Math.round((Date.now() - f.fetchedAt) / 60_000);

  return (
    <div className={`absolute inset-0 ${placeAnim}`}>
      {/* left: place, temperature, condition */}
      <div className="absolute top-[34px] bottom-[26px] left-[30px] flex w-[240px] flex-col">
        <div className="flex items-center gap-1.5 text-[18px] font-semibold tracking-[-0.01em]">
          {place.gps && <NavIcon size={13} className="opacity-80" />}
          <span className="truncate">{place.name}</span>
          <span
            className="ml-1 rounded-full bg-white/18 px-2 py-[1px] text-[12px] font-semibold transition-all duration-300"
            style={{ opacity: scrubbing ? 1 : 0, transform: scrubbing ? 'none' : 'translateX(-6px)' }}
          >
            {scrubbing ? fmtHour(h.t, f.offsetS, clock) : ''}
          </span>
        </div>
        <AnimatedTemp value={h.temp} className="serif-temp mt-5 block text-[138px]" />
        <div key={`${h.code}-${h.day}`} className="rise mt-2 flex items-center gap-2.5">
          <WxIcon code={h.code} day={h.day} size={34} />
          <span className="text-[25px] font-medium tracking-[-0.015em]">{labelOf(h.code, h.day)}</span>
        </div>
        <div className="mt-2 text-[15px] font-medium text-white/65 tnum">
          H:{deg(f.days[0].hi)}&nbsp;&nbsp;L:{deg(f.days[0].lo)}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <button onClick={onRefresh} className="flex items-center gap-1.5 text-[15px] text-white/55 active:text-white">
            {refreshing ? (
              <>
                <RefreshIcon size={14} className="spin" />
                Updating…
              </>
            ) : offline ? (
              <>Offline · {fmtTime(f.fetchedAt, deviceOffsetS, clock)}</>
            ) : (
              <>Updated {ago < 1 ? 'just now' : fmtTime(f.fetchedAt, deviceOffsetS, clock)}</>
            )}
          </button>
          {placeCount > 1 && (
            <div className="flex gap-[5px]">
              {Array.from({ length: placeCount }, (_, i) => (
                <span
                  key={i}
                  className="h-[5px] rounded-full bg-white transition-all duration-500"
                  style={{ width: i === placeIdx ? 14 : 5, opacity: i === placeIdx ? 0.9 : 0.35 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* right top: hourly strip */}
      <div className="absolute top-[36px] right-[22px] h-[112px] w-[505px] overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-[18px] bg-white/14 transition-all duration-500"
          style={{
            width: COL_W - 8,
            transform: `translateX(${sel * COL_W - shift + 4}px)`,
            opacity: scrubbing ? 1 : 0,
            transitionTimingFunction: 'cubic-bezier(0.34,1.3,0.64,1)',
          }}
        />
        <div
          className="absolute top-0 left-0 flex h-full transition-transform duration-500"
          style={{ transform: `translateX(${-shift}px)`, transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
        >
          {hours.map((x, i) => (
            <button
              key={x.t}
              onClick={() => onScrub(i)}
              className="rise flex h-full flex-col items-center justify-center gap-[7px]"
              style={{ width: COL_W, animationDelay: `${Math.min(i, 6) * 55}ms` }}
            >
              <span className={`text-[17px] font-semibold ${i === 0 || i === sel ? 'text-white' : 'text-white/80'}`}>
                {i === 0 ? 'Now' : fmtHour(x.t, f.offsetS, clock)}
              </span>
              <span className="relative flex h-[40px] items-center">
                <WxIcon code={x.code} day={x.day} size={38} still={Math.abs(i - sel) > 4} />
              </span>
              <span className="tnum text-[17px] font-medium">
                {deg(x.temp)}
                {isWet(x.code) && x.pop >= 20 && i > 0 && (
                  <span className="ml-1 text-[12px] font-semibold" style={{ color: sky.ink }}>
                    {Math.round(x.pop)}%
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* right bottom: daily */}
      <div className="absolute right-[34px] bottom-[26px] w-[480px]">
        {rows.map((d, i) => (
          <button
            key={d.date}
            onClick={() => onDay(i)}
            className="rise flex h-[46px] w-full items-center rounded-xl text-left active:bg-white/10"
            style={{ animationDelay: `${180 + i * 70}ms` }}
          >
            <span className="w-[92px] pl-1 text-[17px] font-semibold">{dayName(d.date, i)}</span>
            <span className="flex w-[100px] items-center gap-2">
              <WxIcon code={d.code} size={26} still />
              <Pop pop={d.pop} ink={sky.ink} show={isWet(d.code) && d.pop >= 20} />
            </span>
            <span className="tnum w-[64px] pr-3 text-right text-[17px] font-medium text-white/55">{deg(d.lo)}</span>
            <RangeBar lo={d.lo} hi={d.hi} min={min} max={max} now={i === 0 ? f.current.temp : undefined} width={150} delay={260 + i * 80} />
            <span className="tnum w-[64px] text-right text-[17px] font-semibold">{deg(d.hi)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// WEEK: eight days, knob selects, the right panel shows that day's curve

export function WeekView({ f, sky, clock, sel, onSel, placeName }: { f: Forecast; sky: Sky; clock: Clock; sel: number; onSel: (i: number) => void; placeName: string }) {
  const days = f.days;
  const min = Math.min(...days.map(d => d.lo));
  const max = Math.max(...days.map(d => d.hi));
  const d = days[Math.min(sel, days.length - 1)];
  const ROW = 51;
  const listShift = Math.max(0, Math.min(sel - 3, days.length - 8)) * ROW;
  return (
    <div className="absolute inset-0">
      <div className="absolute top-[36px] bottom-[18px] left-[22px] w-[360px] overflow-hidden">
        <div
          className="absolute left-0 h-[47px] w-full rounded-[14px] bg-white/16 transition-transform duration-500"
          style={{ transform: `translateY(${sel * ROW - listShift + 2}px)`, transitionTimingFunction: 'cubic-bezier(0.34,1.3,0.64,1)' }}
        />
        <div className="relative transition-transform duration-500" style={{ transform: `translateY(${-listShift}px)` }}>
          {days.map((x, i) => (
            <button
              key={x.date}
              onClick={() => onSel(i)}
              className="rise flex w-full items-center px-3 text-left"
              style={{ height: ROW, animationDelay: `${i * 45}ms` }}
            >
              <span className={`w-[64px] text-[16px] font-semibold ${i === sel ? 'text-white' : 'text-white/85'}`}>{dayName(x.date, i)}</span>
              <span className="flex w-[78px] items-center gap-1.5">
                <WxIcon code={x.code} size={24} still />
                <span className="tnum text-[13px] font-semibold" style={{ color: sky.ink, opacity: isWet(x.code) && x.pop >= 20 ? 1 : 0 }}>
                  {Math.round(x.pop)}%
                </span>
              </span>
              <span className="tnum w-[42px] pr-2 text-right text-[15px] text-white/55">{deg(x.lo)}</span>
              <RangeBar lo={x.lo} hi={x.hi} min={min} max={max} width={110} delay={120 + i * 50} />
              <span className="tnum w-[42px] text-right text-[15px] font-semibold">{deg(x.hi)}</span>
            </button>
          ))}
        </div>
      </div>
      <DayDetail key={d.date} f={f} d={d} index={sel} clock={clock} sky={sky} placeName={placeName} />
    </div>
  );
}

function DayDetail({ f, d, index, clock, sky, placeName }: { f: Forecast; d: Day; index: number; clock: Clock; sky: Sky; placeName: string }) {
  const hours = f.hours.filter(h => h.t >= d.t && h.t < d.t + 86_400_000);
  const W = 360;
  const H = 96;
  const temps = hours.map(h => h.temp);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const span = Math.max(1, tMax - tMin);
  const pts = hours.map((h, i) => [(i / Math.max(1, hours.length - 1)) * W, H - 10 - ((h.temp - tMin) / span) * (H - 30)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const peak = hours.reduce((a, h, i) => (h.temp > hours[a].temp ? i : a), 0);
  const nowFrac = index === 0 ? (f.current.t - d.t) / 86_400_000 : -1;
  return (
    <div className="view-enter-right absolute top-[40px] right-[26px] bottom-[20px] w-[370px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold tracking-[0.08em] text-white/60 uppercase">
            {dayDate(d.date)} · {placeName}
          </div>
          <div className="mt-0.5 text-[26px] font-semibold tracking-[-0.02em]">{dayName(d.date, index, true)}</div>
          <div className="mt-0.5 text-[16px] text-white/80">{labelOf(d.code)}</div>
        </div>
        <div className="flex items-center gap-3">
          <WxIcon code={d.code} size={58} />
          <div className="serif-temp text-right">
            <div className="text-[46px]">{deg(d.hi)}</div>
            <div className="mt-1 text-[24px] text-white/60">{deg(d.lo)}</div>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <svg width={W} height={H} className="overflow-visible">
          <defs>
            <linearGradient id="dayArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {hours.length > 1 && (
            <>
              <path d={area} fill="url(#dayArea)" className="fade-in" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
              <path d={line} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="draw-line" />
              <g className="pop-in" style={{ animationDelay: '900ms' }}>
                <circle cx={pts[peak][0]} cy={pts[peak][1]} r="4.5" fill="#fff" />
                <text x={pts[peak][0]} y={pts[peak][1] - 10} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600">
                  {deg(hours[peak].temp)}
                </text>
              </g>
              {nowFrac >= 0 && nowFrac <= 1 && (
                <line x1={nowFrac * W} x2={nowFrac * W} y1={6} y2={H} stroke="#fff" strokeOpacity="0.5" strokeDasharray="3 4" />
              )}
            </>
          )}
        </svg>
        <div className="mt-1.5 flex justify-between text-[12px] font-medium text-white/55">
          {[0, 6, 12, 18, 23].map(i => (
            <span key={i}>{hours[i] ? fmtHour(hours[i].t, f.offsetS, clock) : ''}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { k: 'Rain', v: `${Math.round(d.pop)}%`, c: sky.ink },
          { k: 'Wind', v: `${Math.round(d.wind)}`, u: windUnit(f.units) },
          { k: 'UV', v: `${Math.round(d.uv)}`, u: uvLabel(d.uv) },
          { k: 'Sunset', v: fmtTime(d.sunset, f.offsetS, clock).replace(/ (AM|PM)$/, ''), u: fmtTime(d.sunset, f.offsetS, clock).match(/(AM|PM)$/)?.[0] ?? '' },
        ].map((s, i) => (
          <div key={s.k} className="rise rounded-[14px] bg-white/10 px-3 py-2.5" style={{ animationDelay: `${200 + i * 60}ms` }}>
            <div className="text-[11px] font-semibold tracking-[0.06em] text-white/55 uppercase">{s.k}</div>
            <div className="tnum mt-0.5 text-[19px] font-semibold" style={{ color: s.c }}>
              {s.v}
              {s.u && <span className="ml-1 text-[11px] font-medium text-white/60">{s.u}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// DETAILS: eight tiles

function Tile({ title, i, children }: { title: string; i: number; children: React.ReactNode }) {
  return (
    <div className="rise relative h-[206px] overflow-hidden rounded-[20px] bg-white/[0.11] px-4 pt-3.5 pb-3" style={{ animationDelay: `${i * 55}ms` }}>
      <div className="text-[11px] font-semibold tracking-[0.08em] text-white/60 uppercase">{title}</div>
      {children}
    </div>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return <div className="serif-temp tnum mt-2 text-[44px]">{children}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="absolute right-4 bottom-3 left-4 text-[13px] leading-snug text-white/75">{children}</div>;
}

function Meter({ frac, gradient, delay }: { frac: number; gradient: string; delay: number }) {
  return (
    <div className="relative mt-3 h-[6px] rounded-full" style={{ background: gradient }}>
      <div
        className="absolute top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full bg-white transition-all duration-1000"
        style={{ left: `calc(${Math.max(0, Math.min(1, frac)) * 100}% - 6px)`, boxShadow: '0 0 0 3px rgba(0,0,0,0.25)', transitionDelay: `${delay}ms` }}
      />
    </div>
  );
}

export function DetailsView({ f, clock, sky }: { f: Forecast; clock: Clock; sky: Sky }) {
  const c = f.current;
  const today = f.days[0];
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const feelsDiff = Math.round(c.feels - c.temp);
  const sunFrac = (c.t - today.sunrise) / (today.sunset - today.sunrise);
  const sunUp = sunFrac >= 0 && sunFrac <= 1;
  const ang = Math.PI * (1 - Math.max(0, Math.min(1, ready ? sunFrac : 0)));
  const sx = 68 + 58 * Math.cos(ang);
  const sy = 64 - 52 * Math.sin(ang);
  const tomorrow = f.days[1];
  return (
    <div className="absolute inset-x-[18px] top-[40px] bottom-[16px] grid grid-cols-4 gap-2.5">
      <Tile title="Feels like" i={0}>
        <Big>{deg(c.feels)}</Big>
        <Note>
          {Math.abs(feelsDiff) < 2 ? 'Similar to the actual temperature.' : feelsDiff < 0 ? 'Wind makes it feel cooler.' : 'Humidity makes it feel warmer.'}
        </Note>
      </Tile>

      <Tile title="Wind" i={1}>
        <div className="mt-2 flex items-center gap-3">
          <div className="relative h-[86px] w-[86px] shrink-0 rounded-full border border-white/25">
            {['N', 'E', 'S', 'W'].map((p, k) => (
              <span
                key={p}
                className="absolute text-[10px] font-bold text-white/60"
                style={{ left: [40, 76, 40, 4][k], top: [3, 37, 71, 37][k], transform: 'translateX(-30%)' }}
              >
                {p}
              </span>
            ))}
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-[1400ms]"
              style={{ transform: `rotate(${ready ? c.windDir + 180 : 0}deg)`, transitionTimingFunction: 'cubic-bezier(0.34,1.4,0.64,1)' }}
            >
              <ArrowIcon size={40} className="text-white" />
            </div>
          </div>
          <div>
            <div className="serif-temp tnum text-[38px]">{Math.round(c.wind)}</div>
            <div className="text-[12px] text-white/65">{windUnit(f.units)}</div>
          </div>
        </div>
        <Note>
          From the {compass(c.windDir)}, gusts to {Math.round(c.gust)} {windUnit(f.units)}.
        </Note>
      </Tile>

      <Tile title="Humidity" i={2}>
        <Big>{Math.round(c.humidity)}%</Big>
        <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: ready ? `${c.humidity}%` : '0%', background: sky.ink }} />
        </div>
        <Note>The dew point is {deg(c.dew)} right now.</Note>
      </Tile>

      <Tile title="UV index" i={3}>
        <Big>{Math.round(c.uv)}</Big>
        <div className="-mt-1 text-[15px] font-semibold">{uvLabel(c.uv)}</div>
        <Meter frac={ready ? c.uv / 11 : 0} gradient="linear-gradient(90deg,#5ad17a,#f2d94e,#f59a3b,#e5484d,#a14bd8)" delay={200} />
        <Note>Peaks at {Math.round(today.uv)} today.</Note>
      </Tile>

      <Tile title={sunUp ? 'Sunset' : 'Sunrise'} i={4}>
        <div className="tnum mt-1.5 text-[22px] font-semibold">
          {fmtTime(sunUp ? today.sunset : c.t < today.sunrise ? today.sunrise : (tomorrow ?? today).sunrise, f.offsetS, clock)}
        </div>
        <svg width="136" height="72" className="mt-1 overflow-visible">
          <path d="M10 64 A58 52 0 0 1 126 64" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeDasharray="3 5" />
          <line x1="0" x2="136" y1="64" y2="64" stroke="rgba(255,255,255,0.35)" />
          {sunUp && (
            <circle cx={sx} cy={sy} r="7" fill="#ffd36b" style={{ transition: 'cx 1.4s cubic-bezier(0.22,1,0.36,1), cy 1.4s cubic-bezier(0.22,1,0.36,1)', filter: 'drop-shadow(0 0 6px #ffd36b)' }} />
          )}
        </svg>
        <Note>
          {sunUp ? 'Sunrise' : 'Sunset'} {fmtTime(sunUp ? today.sunrise : today.sunset, f.offsetS, clock)}
        </Note>
      </Tile>

      <Tile title="Pressure" i={5}>
        <div className="serif-temp tnum mt-2 text-[34px]">{pressureText(c.pressure, f.units).split(' ')[0]}</div>
        <div className="text-[13px] text-white/65">{pressureText(c.pressure, f.units).split(' ')[1]}</div>
        <Note>{c.pressure > 1018 ? 'High pressure, usually settled weather.' : c.pressure < 1005 ? 'Low pressure, unsettled weather likely.' : 'Near normal pressure.'}</Note>
      </Tile>

      <Tile title="Visibility" i={6}>
        <Big>{visibilityText(c.visibility, f.units)}</Big>
        <Note>{c.visibility > 16000 ? 'Perfectly clear view.' : c.visibility > 5000 ? 'Light haze or precipitation.' : 'Reduced visibility, drive carefully.'}</Note>
      </Tile>

      <Tile title="Air quality" i={7}>
        {f.aqi === null ? (
          <>
            <Big>–</Big>
            <Note>Air quality isn't available here.</Note>
          </>
        ) : (
          <>
            <Big>{Math.round(f.aqi)}</Big>
            <div className="-mt-1 text-[15px] font-semibold">{aqiLabel(f.aqi)}</div>
            <Meter frac={ready ? f.aqi / 300 : 0} gradient="linear-gradient(90deg,#5ad17a,#f2d94e,#f59a3b,#e5484d,#a14bd8,#7a2337)" delay={300} />
            <Note>US AQI</Note>
          </>
        )}
      </Tile>
    </div>
  );
}

// ===========================================================================
// PLACES: every place with its own little sky

export function PlacesView({
  places,
  forecasts,
  current,
  sel,
  onPick,
  clock,
}: {
  places: Place[];
  forecasts: Record<string, Forecast | undefined>;
  current: number;
  sel: number;
  onPick: (i: number) => void;
  clock: Clock;
}) {
  usePulse();
  const ROW = 84;
  const shift = Math.max(0, Math.min(sel - 2, places.length - 5)) * ROW;
  return (
    <div className="absolute inset-x-[22px] top-[34px] bottom-[14px] overflow-hidden">
      <div className="transition-transform duration-500" style={{ transform: `translateY(${-shift}px)`, transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}>
        {places.map((p, i) => {
          const f = forecasts[p.id];
          const s = skyForForecast(f ?? null);
          const on = i === sel;
          return (
            <button
              key={p.id}
              onClick={() => onPick(i)}
              className="rise relative mb-2 flex h-[76px] w-full items-center overflow-hidden rounded-[20px] px-5 text-left transition-transform duration-300"
              style={{
                background: `linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.04)), linear-gradient(0deg, ${s.scrim}, ${s.scrim}), url(${s.photo}) center / cover, linear-gradient(110deg, ${s.top}, ${s.bottom})`,
                animationDelay: `${i * 60}ms`,
                transform: on ? 'scale(1)' : 'scale(0.965)',
                boxShadow: on ? '0 0 0 2.5px rgba(255,255,255,0.9), 0 10px 26px rgba(0,0,0,0.25)' : '0 4px 14px rgba(0,0,0,0.15)',
              }}
            >
              <div className="relative flex-1">
                <div className="flex items-center gap-1.5 text-[20px] font-semibold tracking-[-0.015em]">
                  {p.gps && <NavIcon size={13} />}
                  {p.name}
                  {i === current && <span className="ml-1 rounded-full bg-white/22 px-2 py-[1px] text-[11px] font-semibold">Showing</span>}
                </div>
                <div className="text-[13px] text-white/75">
                  {f ? `${fmtTime(Date.now(), f.offsetS, clock)} · ${labelOf(f.current.code, f.current.day)}` : placeSubtitle(p) || 'Loading…'}
                </div>
              </div>
              {f ? (
                <div className="relative flex items-center gap-4">
                  <WxIcon code={f.current.code} day={f.current.day} size={42} still={!on} />
                  <div className="text-right">
                    <div className="serif-temp tnum text-[44px]">{deg(f.current.temp)}</div>
                    <div className="tnum mt-1 text-[12px] text-white/75">
                      H:{deg(f.days[0].hi)} L:{deg(f.days[0].lo)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="shimmer relative h-9 w-24 rounded-xl" />
              )}
            </button>
          );
        })}
      </div>
      {places.length > 0 && (
        <div className="pointer-events-none absolute right-2 bottom-1 text-[11px] font-medium text-white/45">
          Add or reorder places in Nimbus settings on your phone
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// skeleton while the first forecast loads

export function SkeletonView() {
  return (
    <div className="absolute inset-0">
      <div className="absolute top-[36px] left-[30px] flex flex-col gap-4">
        <div className="shimmer h-5 w-28 rounded-md" />
        <div className="shimmer h-[110px] w-[190px] rounded-2xl" />
        <div className="shimmer h-7 w-36 rounded-md" />
      </div>
      <div className="absolute top-[34px] right-[26px] flex gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="shimmer h-[100px] w-[84px] rounded-2xl" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <div className="absolute right-[34px] bottom-[30px] flex w-[470px] flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="shimmer h-[32px] rounded-xl" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}
