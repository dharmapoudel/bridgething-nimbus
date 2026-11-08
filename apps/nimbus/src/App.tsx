import { BridgethingClient, type ConnectionState } from '@bridgething/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Centered, Particles, SkyBackground, TabMarks, Toast } from './components';
import { DEMO_PLACES, demoForecast } from './demo';
import { NavIcon, WxIcon } from './icons';
import { skyFor, skyForForecast } from './theme';
import { DetailsView, NowView, PlacesView, SkeletonView, WeekView, type Clock } from './views';
import { fetchForecast, next24, parsePlaces, reverseGeocode, type Fetcher, type Forecast, type Place, type Units } from './weather';

// ---------------------------------------------------------------------------
// constants

const QS = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const DEMO = QS.has('demo');
const DEMO_VIEW = QS.get('view');
const DEMO_HOUR = QS.has('hour') ? Number(QS.get('hour')) : DEMO ? 13 : null;
const DEMO_PLACE = QS.has('place') ? Number(QS.get('place')) : 0;
const DEMO_SCRUB = QS.has('scrub') ? Number(QS.get('scrub')) : 0;

const wsUrl =
  import.meta.env.VITE_BRIDGETHING_URL ??
  (typeof window !== 'undefined' ? `ws://${window.location.host}/` : 'ws://127.0.0.1:8891/');

const REFRESH_MS = 15 * 60_000;
const STALE_MS = 10 * 60_000;
const SCRUB_IDLE_MS = 12_000;
const VIEWS = ['now', 'week', 'details', 'places'] as const;
type View = (typeof VIEWS)[number];

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------

/** `?icons`: every glyph, day and night, large and small (for design review). */
function IconSheet() {
  const codes: [number, string][] = [[0, 'Clear'], [2, 'Partly cloudy'], [3, 'Cloudy'], [45, 'Fog'], [53, 'Drizzle'], [63, 'Rain'], [73, 'Snow'], [95, 'Storm']];
  return (
    <div className="relative h-full w-full overflow-hidden">
      <SkyBackground sky={skyFor(QS.get('icons') === 'night' ? 'clear' : 'partly', QS.get('icons') !== 'night')} />
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-2 p-6">
        {codes.map(([c, n]) => (
          <div key={c} className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/10">
            <div className="flex items-end gap-4">
              <WxIcon code={c} day={QS.get('icons') !== 'night'} size={96} />
              <WxIcon code={c} day={QS.get('icons') !== 'night'} size={34} />
            </div>
            <span className="text-[15px] font-semibold">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  if (QS.has('icons')) return <IconSheet />;
  return <Main />;
}

function Main() {
  const client = useMemo(() => (DEMO ? null : new BridgethingClient({ url: wsUrl })), []);
  const [conn, setConn] = useState<ConnectionState>(DEMO ? 'open' : (client?.connectionState ?? 'connecting'));
  const [config, setConfig] = useState<Record<string, string> | null>(DEMO ? {} : null);
  const [gpsPlace, setGpsPlace] = useState<Place | null>(DEMO ? DEMO_PLACES[0] : null);
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'denied' | 'failed' | 'ok'>(DEMO ? 'ok' : 'idle');
  const [forecasts, setForecasts] = useState<Record<string, Forecast | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [placeIdx, setPlaceIdx] = useState(DEMO_PLACE);
  const [placeAnim, setPlaceAnim] = useState('');
  const [view, setView] = useState<View>((VIEWS as readonly string[]).includes(DEMO_VIEW ?? '') ? (DEMO_VIEW as View) : 'now');
  const [viewDir, setViewDir] = useState<'left' | 'right'>('right');
  const [viewKey, setViewKey] = useState(0);
  const [tabFlash, setTabFlash] = useState(0);
  const [scrub, setScrub] = useState(DEMO_SCRUB);
  const [daySel, setDaySel] = useState(0);
  const [placeSel, setPlaceSel] = useState(DEMO_PLACE);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [deviceOffsetS, setDeviceOffsetS] = useState(() => -new Date().getTimezoneOffset() * 60);
  const reduced = QS.has('still');

  const units: Units = config?.units === 'metric' ? 'metric' : 'imperial';
  const clock: Clock = config?.clock === '24h' ? '24h' : '12h';
  const useGps = config?.use_gps !== 'off';

  const places: Place[] = useMemo(() => {
    if (DEMO) return DEMO_PLACES;
    const saved = parsePlaces(config?.places);
    return useGps && gpsPlace ? [gpsPlace, ...saved] : saved;
  }, [config?.places, useGps, gpsPlace]);

  const idx = Math.min(placeIdx, Math.max(0, places.length - 1));
  const place = places[idx] ?? null;
  const f = place ? forecasts[place.id] : undefined;

  const showToast = useCallback((text: string) => setToast(t => ({ id: (t?.id ?? 0) + 1, text })), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // --- daemon connection
  useEffect(() => {
    if (!client) return;
    return client.on(e => {
      if (e.type === 'open' || e.type === 'close' || e.type === 'connecting') setConn(client.connectionState);
    });
  }, [client]);

  // --- config written by the settings page
  useEffect(() => {
    if (!client || conn !== 'open') return;
    let live = true;
    void client.config.list().then(r => {
      if (live) setConfig(r.ok ? Object.fromEntries(r.response.entries.map(e => [e.key, e.value ?? ''])) : {});
    });
    const off = client.config.onChanged(c =>
      setConfig(prev => {
        const next = { ...(prev ?? {}) };
        if (c.value === null) delete next[c.key];
        else next[c.key] = c.value;
        return next;
      }),
    );
    return () => {
      live = false;
      off();
    };
  }, [client, conn]);

  // --- phone clock (the Car Thing's own zone may be UTC)
  useEffect(() => {
    if (!client || conn !== 'open') return;
    const apply = (m: { time: { utcOffsetMinutes: number | null } }) => {
      if (typeof m.time.utcOffsetMinutes === 'number') setDeviceOffsetS(m.time.utcOffsetMinutes * 60);
    };
    void client.time.get().then(r => r.ok && apply(r.response)).catch(() => {});
    return client.time.onChanged(apply);
  }, [client, conn]);

  // --- network through the phone
  const get: Fetcher = useCallback(
    async (url: string) => {
      if (!client) {
        const r = await fetch(url);
        return r.json();
      }
      const res = await client.net.fetch({
        request: { url, method: 'GET', headers: [{ name: 'Accept', value: 'application/json' }], body: null, timeoutMs: 12_000, redirect: 'follow' },
      });
      if (!res.ok) {
        const e = res.kind === 'domain' ? res.error.error : null;
        throw new Error(e?.type === 'noGateway' ? 'Phone not connected' : 'No connection');
      }
      const { status, body } = res.response.response;
      if (status === 429) throw new Error('Weather service is busy');
      if (status >= 400) throw new Error(`Weather service error ${status}`);
      return JSON.parse(new TextDecoder().decode(new Uint8Array(body as ArrayLike<number>)));
    },
    [client],
  );

  // --- cached forecasts and the last place, so the screen fills instantly
  const cacheLoaded = useRef(false);
  useEffect(() => {
    if (!client || conn !== 'open' || cacheLoaded.current) return;
    cacheLoaded.current = true;
    void (async () => {
      const [c, g, p] = await Promise.all([
        client.store.get({ key: 'forecasts' }),
        client.store.get({ key: 'gps_place' }),
        client.store.get({ key: 'place_idx' }),
      ]);
      try {
        if (c.ok && c.response.value) setForecasts(prev => ({ ...JSON.parse(c.response.value!), ...prev }));
        if (g.ok && g.response.value) setGpsPlace(prev => prev ?? JSON.parse(g.response.value!));
        if (p.ok && p.response.value) {
          setPlaceIdx(Number(p.response.value) || 0);
          setPlaceSel(Number(p.response.value) || 0);
        }
      } catch {
        /* ignore a corrupt cache */
      }
    })();
  }, [client, conn]);

  const saveCache = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!client || conn !== 'open') return;
    clearTimeout(saveCache.current);
    saveCache.current = setTimeout(() => {
      const keep = Object.fromEntries(places.map(p => [p.id, forecasts[p.id]]).filter(([, v]) => v));
      void client.store.put({ key: 'forecasts', value: JSON.stringify(keep) });
    }, 1500);
  }, [client, conn, forecasts, places]);

  // --- GPS: one coarse fix from the phone, named by reverse geocoding
  const locate = useCallback(async () => {
    if (!client || !useGps) return;
    setGpsState('locating');
    try {
      const r = await client.geo.getOnce({ accuracy: 'coarse', maxAgeS: 600 }, { timeoutMs: 20_000 });
      if (!r.ok) {
        const e = r.kind === 'domain' ? r.error.error : null;
        setGpsState(e === 'permissionDenied' || e === 'notDeclared' ? 'denied' : 'failed');
        return;
      }
      const { lat, lon } = r.response.position;
      const named = await reverseGeocode(get, lat, lon).catch(() => null);
      const p: Place = { id: 'gps', gps: true, lat, lon, name: named?.name ?? 'My Location', admin: named?.admin, country: named?.country };
      setGpsPlace(p);
      setGpsState('ok');
      void client.store.put({ key: 'gps_place', value: JSON.stringify(p) });
    } catch {
      setGpsState('failed');
    }
  }, [client, useGps, get]);

  useEffect(() => {
    if (conn === 'open' && config && useGps && !DEMO) void locate();
  }, [conn, config !== null, useGps, locate]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- forecasts
  const inflight = useRef<Record<string, boolean>>({});
  const load = useCallback(
    async (p: Place, force = false) => {
      if (inflight.current[p.id]) return;
      const have = forecastsRef.current[p.id];
      if (!force && have && have.units === units && Date.now() - have.fetchedAt < STALE_MS) return;
      inflight.current[p.id] = true;
      setLoading(s => ({ ...s, [p.id]: true }));
      try {
        const fc = DEMO
          ? await new Promise<Forecast>(res => setTimeout(() => res(demoForecast(p, units, DEMO_HOUR)), force ? 900 : 250))
          : await fetchForecast(get, p, units);
        setForecasts(s => ({ ...s, [p.id]: fc }));
        setErrors(s => ({ ...s, [p.id]: undefined }));
      } catch (e) {
        setErrors(s => ({ ...s, [p.id]: errText(e) }));
        if (force && have) showToast(`Couldn't update: ${errText(e)}`);
      } finally {
        inflight.current[p.id] = false;
        setLoading(s => ({ ...s, [p.id]: false }));
      }
    },
    [get, units, showToast],
  );
  const forecastsRef = useRef(forecasts);
  forecastsRef.current = forecasts;

  // current place: on change, on units change, and every 15 minutes
  useEffect(() => {
    if (!place || conn !== 'open' || !config) return;
    void load(place);
    const t = setInterval(() => void load(place, true), REFRESH_MS);
    return () => clearInterval(t);
  }, [place?.id, place?.lat, place?.lon, units, conn, config !== null, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // the other places, quietly, once the one on screen has loaded (so a swipe
  // never lands on a skeleton), and again whenever the Places screen opens
  const haveCurrent = !!f;
  useEffect(() => {
    if (conn !== 'open' || !config || !haveCurrent) return;
    const timers = places.map((p, i) => setTimeout(() => void load(p), 800 + i * 400));
    return () => timers.forEach(clearTimeout);
  }, [view === 'places', places, conn, config !== null, haveCurrent, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    if (!place) return;
    if (place.gps) void locate();
    void load(place, true);
  }, [place, load, locate]);

  // --- navigation
  const goView = useCallback(
    (v: View) => {
      setView(cur => {
        if (cur !== v) {
          setViewDir(VIEWS.indexOf(v) > VIEWS.indexOf(cur) ? 'right' : 'left');
          setViewKey(k => k + 1);
        }
        return v;
      });
      if (v === 'places') setPlaceSel(idx);
      if (v === 'now') setScrub(0);
    },
    [idx],
  );

  const switchPlace = useCallback(
    (to: number, dir?: 'next' | 'prev') => {
      if (places.length === 0) return;
      const n = ((to % places.length) + places.length) % places.length;
      if (n === idx) return;
      setPlaceAnim(dir === 'prev' || (!dir && n < idx) ? 'place-enter-prev' : 'place-enter-next');
      setPlaceIdx(n);
      setScrub(0);
      setDaySel(0);
      void client?.store.put({ key: 'place_idx', value: String(n) });
    },
    [places.length, idx, client],
  );

  // scrub snaps back to "now" after a while
  useEffect(() => {
    if (scrub === 0 || DEMO_SCRUB) return;
    const t = setTimeout(() => setScrub(0), SCRUB_IDLE_MS);
    return () => clearTimeout(t);
  }, [scrub]);

  // --- physical controls (latest closure via ref)
  const hourCount = f ? Math.min(24, next24(f).length) : 1;
  const controls = useRef<{ key: (k: string) => void; wheel: (n: number) => void }>({ key: () => {}, wheel: () => {} });
  controls.current = {
    key: k => {
      if (k === '1') {
        if (view === 'now' && scrub === 0 && places.length > 1) switchPlace(idx + 1, 'next');
        else goView('now');
      } else if (k === '2') goView('week');
      else if (k === '3') goView('details');
      else if (k === '4') {
        if (view === 'places') setPlaceSel(s => (s + 1) % Math.max(1, places.length));
        else goView('places');
      } else if (k === 'Escape' || k === 'Backspace') {
        if (view === 'now' && scrub > 0) setScrub(0);
        else if (view !== 'now') goView('now');
      } else if (k === 'm' || k === 'M' || k === 'Enter' || k === ' ') {
        if (view === 'places') {
          switchPlace(placeSel);
          goView('now');
        } else if (view === 'now' && scrub > 0) setScrub(0);
        else if (view === 'week') goView('now');
        else refresh();
      } else if (k === 'ArrowRight' || k === 'ArrowDown') controls.current.wheel(1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp') controls.current.wheel(-1);
    },
    wheel: n => {
      if (view === 'now') setScrub(s => Math.max(0, Math.min(hourCount - 1, s + n)));
      else if (view === 'week') setDaySel(s => Math.max(0, Math.min((f?.days.length ?? 1) - 1, s + n)));
      else if (view === 'places') setPlaceSel(s => Math.max(0, Math.min(places.length - 1, s + n)));
      else if (view === 'details') switchPlace(idx + Math.sign(n), n > 0 ? 'next' : 'prev');
    },
  };

  useEffect(() => {
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (d === 0) return;
      e.preventDefault();
      const now = performance.now();
      // rotary detents arrive as one event each; trackpads flood small deltas
      if (Math.abs(d) < 40 && now - last < 90) return;
      last = now;
      controls.current.wheel(Math.sign(d) * Math.max(1, Math.min(3, Math.round(Math.abs(d) / 120))));
    };
    const preset = (e: KeyboardEvent) => {
      const m = /^Digit([1-4])$/.exec(e.code);
      return m ? m[1] : ['1', '2', '3', '4'].includes(e.key) ? e.key : null;
    };
    const onKey = (e: KeyboardEvent) => {
      const p = preset(e);
      if (p) {
        setPressed(s => (s[p] ? s : { ...s, [p]: true }));
        if (!e.repeat) {
          setTabFlash(n => n + 1);
          controls.current.key(p);
        }
        return;
      }
      if (!e.repeat) controls.current.key(e.key);
    };
    const onUp = (e: KeyboardEvent) => {
      const p = preset(e);
      if (p) setPressed(s => ({ ...s, [p]: false }));
    };
    const clear = () => setPressed({});
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
    };
  }, []);

  // --- swipe left/right between places on Now and Details
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => (touch.current = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onPointerUp = (e: React.PointerEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || (view !== 'now' && view !== 'details')) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - s.t < 700) {
      switchPlace(idx + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
    }
  };

  // ---------------------------------------------------------------------------
  // render

  const hourOverride = f && view === 'now' && scrub > 0 ? next24(f)[scrub] : undefined;
  const sky = f ? skyForForecast(f, hourOverride ? { code: hourOverride.code, day: hourOverride.day, t: hourOverride.t } : undefined) : skyFor('partly', true);
  const err = place ? errors[place.id] : undefined;
  const busy = place ? !!loading[place.id] : false;

  let body: React.ReactNode;
  if (!DEMO && conn !== 'open' && !f) {
    body = (
      <Centered>
        <div className="pop-in">
          <WxIcon code={2} size={84} />
        </div>
        <div className="rise mt-5 text-[22px] font-semibold">Connecting to your phone…</div>
        <div className="rise mt-1.5 text-[15px] text-white/70" style={{ animationDelay: '120ms' }}>
          Nimbus gets the forecast through the BridgeThing app.
        </div>
      </Centered>
    );
  } else if (places.length === 0) {
    const waiting = useGps && (gpsState === 'idle' || gpsState === 'locating') && config !== null;
    body = (
      <Centered>
        <div className="pop-in">
          {waiting ? <NavIcon size={54} className="animate-pulse" /> : <WxIcon code={1} size={84} />}
        </div>
        <div className="rise mt-5 text-[24px] font-semibold">{waiting || !config ? 'Finding you…' : 'Where should Nimbus look?'}</div>
        <div className="rise mt-2 max-w-[520px] text-[15px] leading-relaxed text-white/75" style={{ animationDelay: '120ms' }}>
          {waiting || !config
            ? 'Asking your phone for a rough location.'
            : gpsState === 'denied'
              ? 'Location access is off for BridgeThing. Allow it on your phone, or open Nimbus settings in the BridgeThing app and add a city.'
              : 'Open Nimbus settings in the BridgeThing app on your phone and add a city, or turn on your current location.'}
        </div>
      </Centered>
    );
  } else if (!f) {
    body = err ? (
      <Centered>
        <WxIcon code={3} size={80} />
        <div className="rise mt-5 text-[22px] font-semibold">Couldn't get the forecast</div>
        <div className="rise mt-1.5 text-[15px] text-white/70">{err}. Press the top button to try again.</div>
      </Centered>
    ) : (
      <SkeletonView />
    );
  } else if (view === 'now') {
    body = (
      <NowView
        key={`now-${place!.id}`}
        place={place!}
        f={f}
        sky={sky}
        clock={clock}
        scrub={scrub}
        onScrub={i => setScrub(s => (s === i ? 0 : i))}
        onDay={i => {
          setDaySel(i);
          goView('week');
        }}
        onRefresh={refresh}
        refreshing={busy}
        offline={!!err}
        deviceOffsetS={deviceOffsetS}
        placeIdx={idx}
        placeCount={places.length}
        placeAnim={placeAnim}
      />
    );
  } else if (view === 'week') {
    body = <WeekView key={`week-${place!.id}`} f={f} sky={sky} clock={clock} sel={daySel} onSel={setDaySel} placeName={place!.name} />;
  } else if (view === 'details') {
    body = (
      <div key={`det-${place!.id}`} className={placeAnim}>
        <DetailsView f={f} clock={clock} sky={sky} />
      </div>
    );
  } else {
    body = (
      <PlacesView
        places={places}
        forecasts={forecasts}
        current={idx}
        sel={Math.min(placeSel, places.length - 1)}
        clock={clock}
        onPick={i => {
          setPlaceSel(i);
          switchPlace(i);
          goView('now');
        }}
      />
    );
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden select-none ${reduced ? 'reduced' : ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <SkyBackground sky={view === 'places' ? skyFor('cloudy', false) : sky} />
      {view !== 'places' && f && <Particles kind={sky.particles} reduced={reduced} />}
      <TabMarks active={VIEWS.indexOf(view)} flashKey={tabFlash} pressed={pressed} />
      {view === 'details' && place && f && (
        <div key={`hdr-${view}-${place.id}`} className="fade-in absolute top-[14px] left-[26px] z-20 flex items-center gap-1 text-[12px] font-semibold text-white/70">
          {place.gps && <NavIcon size={10} />}
          {place.name}
        </div>
      )}
      <div key={viewKey} className={`absolute inset-0 ${viewKey ? (viewDir === 'right' ? 'view-enter-right' : 'view-enter-left') : ''}`}>
        {body}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
