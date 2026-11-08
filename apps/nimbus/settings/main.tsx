/** @jsxImportSource preact */
import { settings, type SettingsContext } from '@bridgething/client/settings';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { APP_VERSION, geocodeUrl, parsePlaces, type GeoResult, type Place } from '../src/weather';
import { ICON_SVG } from './icon';
import './style.css';

// Rendered by the BridgeThing companion app on the phone. It writes the
// webapp's config, which the Car Thing reads with `client.config`.

const MAX_PLACES = 8;

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg">
      {options.map(o => (
        <button key={o.v} class={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Settings() {
  const [ctx, setCtx] = useState<SettingsContext | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    (async () => {
      try {
        setCtx(await settings.context());
        const entries = await settings.config.list();
        setValues(Object.fromEntries(entries.map(e => [e.key, e.value ?? ''])));
      } catch (err) {
        setStatus({ text: err instanceof Error ? err.message : String(err), kind: 'err' });
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const flash = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setStatus({ text, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 2400);
  };

  async function set(key: string, value: string) {
    setValues(v => ({ ...v, [key]: value }));
    try {
      await settings.config.set(key, value);
      flash('Saved. Your Car Thing updates right away.');
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err), 'err');
    }
  }

  const places = parsePlaces(values.places);
  const savePlaces = (list: Place[]) => set('places', JSON.stringify(list));

  // search as you type, debounced
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await settings.fetch(geocodeUrl(term), { timeoutMs: 10_000 });
        const json = (await res.json()) as { results?: GeoResult[] };
        setResults(json.results ?? []);
      } catch {
        setResults([]);
        flash("Couldn't search right now. Check your connection.", 'err');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  function add(r: GeoResult) {
    if (places.length >= MAX_PLACES) return flash(`You can save up to ${MAX_PLACES} places.`, 'err');
    if (places.some(p => p.id === String(r.id))) return flash(`${r.name} is already saved.`, 'err');
    const p: Place = { id: String(r.id), name: r.name, admin: r.admin1, country: r.country_code ?? r.country, lat: r.latitude, lon: r.longitude };
    void savePlaces([...places, p]);
    setQ('');
    setResults(null);
  }

  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= places.length) return;
    const next = [...places];
    [next[i], next[j]] = [next[j], next[i]];
    void savePlaces(next);
  }

  if (!loaded) return <main class="loading">Loading…</main>;

  const units = values.units === 'metric' ? 'metric' : 'imperial';
  const clock = values.clock === '24h' ? '24h' : '12h';
  const gps = values.use_gps === 'off' ? 'off' : 'on';

  return (
    <main>
      <header>
        <div class="logo" dangerouslySetInnerHTML={{ __html: ICON_SVG }} />
        <div>
          <h1>Nimbus</h1>
          <p class="hint">Weather for your Car Thing · v{ctx?.version ?? APP_VERSION}</p>
        </div>
      </header>

      <section>
        <h2>Places</h2>
        <div class="card">
          <label class="toggle">
            <div>
              <div class="t">Current location</div>
              <div class="s">Uses your phone's rough location and names it for you.</div>
            </div>
            <input type="checkbox" checked={gps === 'on'} onChange={e => set('use_gps', (e.target as HTMLInputElement).checked ? 'on' : 'off')} />
          </label>

          {places.map((p, i) => (
            <div class="place" key={p.id}>
              <div class="pname">
                <div class="t">{p.name}</div>
                <div class="s">{[p.admin, p.country].filter(Boolean).join(', ')}</div>
              </div>
              <button class="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button class="icon" aria-label="Move down" disabled={i === places.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
              <button class="icon danger" aria-label="Remove" onClick={() => savePlaces(places.filter(x => x.id !== p.id))}>
                ✕
              </button>
            </div>
          ))}

          <div class="search">
            <input
              type="search"
              placeholder={places.length ? 'Add another city' : 'Add a city, e.g. Portland'}
              value={q}
              onInput={e => setQ((e.target as HTMLInputElement).value)}
            />
            {searching && <span class="spinner" />}
          </div>
          {results && (
            <div class="results">
              {results.length === 0 && !searching && <div class="empty">No matches.</div>}
              {results.map(r => (
                <button key={r.id} class="result" onClick={() => add(r)}>
                  <span class="t">{r.name}</span>
                  <span class="s">{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
                  <span class="plus">＋</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p class="hint">On the Car Thing, press preset 4 for all places, or swipe sideways on the main screen.</p>
      </section>

      <section>
        <h2>Display</h2>
        <div class="card">
          <div class="rowline">
            <span class="t">Temperature</span>
            <Seg value={units} options={[{ v: 'imperial', label: '°F' }, { v: 'metric', label: '°C' }]} onChange={v => set('units', v)} />
          </div>
          <div class="rowline">
            <span class="t">Clock</span>
            <Seg value={clock} options={[{ v: '12h', label: '12-hour' }, { v: '24h', label: '24-hour' }]} onChange={v => set('clock', v)} />
          </div>
        </div>
      </section>

      <section>
        <h2>Controls</h2>
        <div class="card controls">
          <div><b>Preset 1</b> Now (press again for the next place)</div>
          <div><b>Preset 2</b> 8-day forecast</div>
          <div><b>Preset 3</b> Details</div>
          <div><b>Preset 4</b> Places</div>
          <div><b>Knob</b> Scrub hours, pick a day or a place</div>
          <div><b>Top button</b> Refresh, or choose</div>
          <div><b>Back</b> Return to now</div>
        </div>
      </section>

      <p class="credit">Forecasts by Open-Meteo.com (CC BY 4.0). Place names by BigDataCloud.</p>
      {status && <div class={`toast ${status.kind}`}>{status.text}</div>}
    </main>
  );
}

render(<Settings />, document.getElementById('root')!);
