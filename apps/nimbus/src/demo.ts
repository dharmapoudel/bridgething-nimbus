// Synthetic forecasts for `?demo` (browser development and screenshots, no
// device or network). Built in Open-Meteo's own response shape and run through
// the real parser, so the demo exercises the same code as the device.
import { parseForecast, type Forecast, type Place, type Units } from './weather';

export const DEMO_PLACES: Place[] = [
  { id: 'gps', name: 'Portland', admin: 'Oregon', country: 'US', lat: 45.52, lon: -122.68, gps: true },
  { id: 'sea', name: 'Seattle', admin: 'Washington', country: 'US', lat: 47.61, lon: -122.33 },
  { id: 'den', name: 'Denver', admin: 'Colorado', country: 'US', lat: 39.74, lon: -104.99 },
  { id: 'mia', name: 'Miami', admin: 'Florida', country: 'US', lat: 25.77, lon: -80.19 },
  { id: 'tyo', name: 'Tokyo', admin: 'Tokyo', country: 'JP', lat: 35.68, lon: 139.69 },
];

type Scenario = { mid: number; amp: number; offsetH: number; code: (day: number, hour: number) => number; aqi: number; hum: number };

const SCEN: Record<string, Scenario> = {
  gps: {
    mid: 66,
    amp: 10,
    offsetH: -7,
    aqi: 34,
    hum: 41,
    code: (d, h) => {
      if (d === 0) return h < 14 ? 0 : h < 18 ? 2 : 1;
      return [0, 61, 3, 63, 2, 3, 0, 1, 2][d] ?? 2;
    },
  },
  sea: { mid: 57, amp: 5, offsetH: -7, aqi: 22, hum: 88, code: (d, h) => (d === 0 ? (h % 5 === 0 ? 3 : 63) : [63, 61, 3, 80, 3, 2, 61, 3, 3][d] ?? 3) },
  den: { mid: 31, amp: 8, offsetH: -6, aqi: 41, hum: 76, code: (d, h) => (d === 0 ? (h < 16 ? 73 : 71) : [73, 3, 2, 0, 0, 1, 2, 71, 3][d] ?? 2) },
  mia: { mid: 84, amp: 5, offsetH: -4, aqi: 58, hum: 79, code: (d, h) => (d === 0 ? (h > 11 && h < 20 ? 95 : 80) : [95, 80, 2, 2, 95, 1, 2, 80, 2][d] ?? 2) },
  tyo: { mid: 70, amp: 6, offsetH: 9, aqi: 47, hum: 58, code: (d) => [0, 1, 2, 3, 61, 2, 0, 0, 1][d] ?? 1 },
};

const pad = (n: number) => String(n).padStart(2, '0');

export function demoForecast(place: Place, units: Units, demoHour: number | null): Forecast {
  const s = SCEN[place.id] ?? SCEN.gps;
  const offsetS = s.offsetH * 3600;
  const now = Date.now();
  const localNow = new Date(now + offsetS * 1000);
  const y = localNow.getUTCFullYear();
  const mo = localNow.getUTCMonth();
  const da = localNow.getUTCDate();
  let hr = localNow.getUTCHours();
  let mi = localNow.getUTCMinutes();
  if (demoHour !== null && place.id !== 'tyo') {
    hr = demoHour;
    mi = 14;
  } else if (demoHour !== null && place.id === 'tyo') {
    hr = 22;
    mi = 5;
  }
  const conv = (f: number) => (units === 'metric' ? ((f - 32) * 5) / 9 : f);
  const iso = (dd: Date, h: number, m = 0) => `${dd.getUTCFullYear()}-${pad(dd.getUTCMonth() + 1)}-${pad(dd.getUTCDate())}T${pad(h)}:${pad(m)}`;
  const day0 = new Date(Date.UTC(y, mo, da));
  const hourly = { time: [] as string[], temperature_2m: [] as number[], weather_code: [] as number[], precipitation_probability: [] as number[], is_day: [] as number[] };
  const daily = {
    time: [] as string[],
    weather_code: [] as number[],
    temperature_2m_max: [] as number[],
    temperature_2m_min: [] as number[],
    precipitation_probability_max: [] as number[],
    sunrise: [] as string[],
    sunset: [] as string[],
    uv_index_max: [] as number[],
    wind_speed_10m_max: [] as number[],
  };
  const wet = (c: number) => c >= 51;
  for (let d = 0; d < 9; d++) {
    const dd = new Date(day0.getTime() + d * 86_400_000);
    const drift = Math.sin(d * 1.3) * 5 - (s.code(d, 13) >= 61 ? 6 : 0);
    let hi = -999;
    let lo = 999;
    let pmax = 0;
    for (let h = 0; h < 24; h++) {
      const f = s.mid + drift + s.amp * Math.sin(((h - 9) / 24) * Math.PI * 2) + Math.sin(h * 0.9 + d) * 0.6;
      const code = d === 0 ? s.code(0, h) : h > 6 && h < 20 ? s.code(d, h) : s.code(d, h) >= 61 ? 3 : Math.min(s.code(d, h), 2);
      const pop = wet(code) ? 45 + ((h * 7 + d * 11) % 40) : (h * 3 + d * 5) % 12;
      hourly.time.push(iso(dd, h));
      hourly.temperature_2m.push(conv(f));
      hourly.weather_code.push(code);
      hourly.precipitation_probability.push(pop);
      hourly.is_day.push(h >= 7 && h < 19 ? 1 : 0);
      hi = Math.max(hi, f);
      lo = Math.min(lo, f);
      pmax = Math.max(pmax, pop);
    }
    daily.time.push(iso(dd, 0).slice(0, 10));
    daily.weather_code.push(s.code(d, 13));
    daily.temperature_2m_max.push(conv(hi));
    daily.temperature_2m_min.push(conv(lo));
    daily.precipitation_probability_max.push(wet(s.code(d, 13)) ? 55 : Math.min(10, Math.round(pmax / 3)));
    daily.sunrise.push(iso(dd, 7, 12));
    daily.sunset.push(iso(dd, 18, 41));
    daily.uv_index_max.push(wet(s.code(d, 13)) ? 2 : 5 + (d % 3));
    daily.wind_speed_10m_max.push(units === 'metric' ? 18 + d * 2 : 11 + d);
  }
  const idx = hr;
  const temp = hourly.temperature_2m[idx];
  const code = hourly.weather_code[idx];
  const om = {
    utc_offset_seconds: offsetS,
    current: {
      time: iso(day0, hr, mi),
      temperature_2m: temp,
      apparent_temperature: temp + (units === 'metric' ? -1 : -2),
      relative_humidity_2m: s.hum,
      dew_point_2m: conv(s.mid - 18),
      weather_code: code,
      is_day: hr >= 7 && hr < 19 ? 1 : 0,
      wind_speed_10m: units === 'metric' ? 13 : 8,
      wind_direction_10m: 292,
      wind_gusts_10m: units === 'metric' ? 26 : 16,
      pressure_msl: 1016.4,
      visibility: wet(code) ? 6400 : 24140,
      uv_index: hr >= 7 && hr < 19 ? (wet(code) ? 1 : 5) : 0,
      precipitation: wet(code) ? 0.4 : 0,
      cloud_cover: code >= 2 ? 70 : 8,
    },
    hourly,
    daily,
  };
  return parseForecast(om, units, s.aqi);
}
