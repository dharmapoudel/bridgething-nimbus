// Weather data for Nimbus. The Car Thing has no network of its own, so every
// request goes through the BridgeThing companion app (client.net.fetch).
// Forecasts come from Open-Meteo (free, no key), air quality from Open-Meteo's
// air-quality API, and place names for GPS fixes from BigDataCloud's free
// client-side reverse geocoder.

export const APP_NAME = 'Nimbus';
export const APP_VERSION = '1.0.2';

export type Units = 'imperial' | 'metric';

export type Place = {
  id: string;
  name: string;
  admin?: string;
  country?: string;
  lat: number;
  lon: number;
  gps?: boolean;
};

export type Kind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export type Hour = {
  t: number; // epoch ms
  temp: number;
  code: number;
  pop: number; // precipitation probability %
  day: boolean;
};

export type Day = {
  date: string; // YYYY-MM-DD (place local)
  t: number; // epoch ms of local midnight
  code: number;
  hi: number;
  lo: number;
  pop: number;
  sunrise: number;
  sunset: number;
  uv: number;
  wind: number;
};

export type Forecast = {
  fetchedAt: number;
  offsetS: number; // place UTC offset in seconds
  units: Units;
  current: {
    t: number;
    temp: number;
    feels: number;
    humidity: number;
    dew: number;
    code: number;
    day: boolean;
    wind: number;
    gust: number;
    windDir: number;
    pressure: number;
    visibility: number; // metres
    uv: number;
    precip: number;
    cloud: number;
  };
  hours: Hour[]; // every hour from the place's local midnight today
  days: Day[]; // today first, 8 entries
  aqi: number | null;
};

export type Fetcher = (url: string) => Promise<unknown>;

export class WeatherError extends Error {}

// ---------------------------------------------------------------------------
// conditions

export function kindOf(code: number): Kind {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

const LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly Clear',
  2: 'Partly Cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Freezing Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  56: 'Freezing Drizzle',
  57: 'Freezing Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  66: 'Freezing Rain',
  67: 'Freezing Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  77: 'Snow Grains',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy Showers',
  85: 'Snow Showers',
  86: 'Snow Showers',
  95: 'Thunderstorms',
  96: 'Thunderstorms',
  99: 'Severe Storms',
};

export function labelOf(code: number, day = true): string {
  if (code <= 1 && day) return code === 0 ? 'Sunny' : 'Mostly Sunny';
  return LABELS[code] ?? 'Cloudy';
}

export function isWet(code: number): boolean {
  const k = kindOf(code);
  return k === 'drizzle' || k === 'rain' || k === 'snow' || k === 'storm';
}

// ---------------------------------------------------------------------------
// time helpers (all formatted in the place's own local time)

/** "2026-10-06T13:00" in the place's local time -> epoch ms */
export function localToEpoch(s: string, offsetS: number): number {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, day, hh, mm) - offsetS * 1000;
}

function local(t: number, offsetS: number): Date {
  return new Date(t + offsetS * 1000);
}

export function fmtHour(t: number, offsetS: number, clock: '12h' | '24h'): string {
  const d = local(t, offsetS);
  const h = d.getUTCHours();
  if (clock === '24h') return `${String(h).padStart(2, '0')}:00`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtTime(t: number, offsetS: number, clock: '12h' | '24h'): string {
  const d = local(t, offsetS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  if (clock === '24h') return `${String(h).padStart(2, '0')}:${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateParts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, wd };
}

export function dayName(date: string, index: number, long = false): string {
  if (index === 0) return 'Today';
  const { wd } = dateParts(date);
  return long ? WD_LONG[wd] : WD[wd];
}

export function dayDate(date: string): string {
  const { m, d } = dateParts(date);
  return `${MON[m - 1]} ${d}`;
}

// ---------------------------------------------------------------------------
// formatting

export function deg(v: number): string {
  return `${Math.round(v)}°`;
}

export function windUnit(units: Units): string {
  return units === 'imperial' ? 'mph' : 'km/h';
}

export function compass(dir: number): string {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return pts[Math.round((((dir % 360) + 360) % 360) / 22.5) % 16];
}

export function visibilityText(m: number, units: Units): string {
  if (units === 'imperial') {
    const mi = m / 1609.34;
    return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
  }
  const km = m / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

export function pressureText(hpa: number, units: Units): string {
  return units === 'imperial' ? `${(hpa * 0.02953).toFixed(2)} inHg` : `${Math.round(hpa)} hPa`;
}

export function uvLabel(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for some';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function placeSubtitle(p: Place): string {
  if (p.gps) return 'Current location';
  return [p.admin, p.country].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------------------
// fetching

type OM = {
  utc_offset_seconds: number;
  current: Record<string, number | string>;
  hourly: Record<string, (number | string)[]>;
  daily: Record<string, (number | string)[]>;
};

export async function fetchForecast(get: Fetcher, place: Place, units: Units): Promise<Forecast> {
  const imperial = units === 'imperial';
  const params = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility,uv_index,precipitation,cloud_cover',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max',
    timezone: 'auto',
    forecast_days: '9',
    temperature_unit: imperial ? 'fahrenheit' : 'celsius',
    wind_speed_unit: imperial ? 'mph' : 'kmh',
  });
  const om = (await get(`https://api.open-meteo.com/v1/forecast?${params}`)) as OM & { error?: boolean; reason?: string };
  if (om.error) throw new WeatherError(om.reason ?? 'weather service error');
  const aqi = await fetchAqi(get, place).catch(() => null);
  return parseForecast(om, units, aqi);
}

async function fetchAqi(get: Fetcher, place: Place): Promise<number | null> {
  const r = (await get(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.lat.toFixed(4)}&longitude=${place.lon.toFixed(4)}&current=us_aqi`,
  )) as { current?: { us_aqi?: number } };
  const v = r?.current?.us_aqi;
  return typeof v === 'number' ? v : null;
}

export function parseForecast(om: OM, units: Units, aqi: number | null): Forecast {
  const off = om.utc_offset_seconds ?? 0;
  const c = om.current;
  const n = (k: string) => Number(c[k] ?? 0);
  const nowT = localToEpoch(String(c.time), off);
  const h = om.hourly;
  const allHours: Hour[] = (h.time as string[]).map((s, i) => ({
    t: localToEpoch(s, off),
    temp: Number(h.temperature_2m[i]),
    code: Number(h.weather_code[i]),
    pop: Number(h.precipitation_probability?.[i] ?? 0),
    day: Number(h.is_day[i]) === 1,
  }));
  const hours = allHours;
  const d = om.daily;
  const days: Day[] = (d.time as string[]).map((s, i) => ({
    date: s,
    t: localToEpoch(s, off),
    code: Number(d.weather_code[i]),
    hi: Number(d.temperature_2m_max[i]),
    lo: Number(d.temperature_2m_min[i]),
    pop: Number(d.precipitation_probability_max?.[i] ?? 0),
    sunrise: localToEpoch(String(d.sunrise[i]), off),
    sunset: localToEpoch(String(d.sunset[i]), off),
    uv: Number(d.uv_index_max?.[i] ?? 0),
    wind: Number(d.wind_speed_10m_max?.[i] ?? 0),
  }));
  // drop days that already ended (timezone=auto starts at the place's today)
  return {
    fetchedAt: Date.now(),
    offsetS: off,
    units,
    current: {
      t: nowT,
      temp: n('temperature_2m'),
      feels: n('apparent_temperature'),
      humidity: n('relative_humidity_2m'),
      dew: n('dew_point_2m'),
      code: n('weather_code'),
      day: n('is_day') === 1,
      wind: n('wind_speed_10m'),
      gust: n('wind_gusts_10m'),
      windDir: n('wind_direction_10m'),
      pressure: n('pressure_msl'),
      visibility: n('visibility'),
      uv: n('uv_index'),
      precip: n('precipitation'),
      cloud: n('cloud_cover'),
    },
    hours,
    days: days.slice(0, 8),
    aqi,
  };
}

/** Index into forecast.hours of the hour that contains "now". */
export function nowHourIndex(f: Forecast): number {
  let i = 0;
  for (let k = 0; k < f.hours.length; k++) if (f.hours[k].t <= f.current.t) i = k;
  return i;
}

/** The 24 hours starting now; entry 0 carries the live current conditions. */
export function next24(f: Forecast): Hour[] {
  const i = nowHourIndex(f);
  const list = f.hours.slice(i, i + 24);
  if (list.length) list[0] = { ...list[0], t: f.current.t, temp: f.current.temp, code: f.current.code, day: f.current.day };
  return list;
}

export async function reverseGeocode(get: Fetcher, lat: number, lon: number): Promise<{ name: string; admin?: string; country?: string } | null> {
  const r = (await get(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`,
  )) as { city?: string; locality?: string; principalSubdivision?: string; countryCode?: string };
  const name = r?.city || r?.locality;
  if (!name) return null;
  return { name, admin: r.principalSubdivision || undefined, country: r.countryCode || undefined };
}

export type GeoResult = { id: number; name: string; admin1?: string; country?: string; country_code?: string; latitude: number; longitude: number };

export function geocodeUrl(q: string): string {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
}

export function parsePlaces(raw: string | null | undefined): Place[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(p => p && typeof p.lat === 'number' && typeof p.lon === 'number' && typeof p.name === 'string')
      .map(p => ({ id: String(p.id ?? `${p.lat},${p.lon}`), name: p.name, admin: p.admin, country: p.country, lat: p.lat, lon: p.lon }));
  } catch {
    return [];
  }
}
