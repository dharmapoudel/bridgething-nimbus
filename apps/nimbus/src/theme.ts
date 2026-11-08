import { kindOf, type Forecast, type Kind } from './weather';
import clearDay from './skies/clear-day.jpg';
import partlyDay from './skies/partly-day.jpg';
import cloudy from './skies/cloudy.jpg';
import rain from './skies/rain.jpg';
import storm from './skies/storm.jpg';
import snow from './skies/snow.jpg';
import fog from './skies/fog.jpg';
import clearNight from './skies/clear-night.jpg';
import cloudyNight from './skies/cloudy-night.jpg';
import golden from './skies/golden.jpg';

// Skies. Each theme is a pre-blurred photo of that kind of sky (src/skies,
// ~5 KB each, originals in art/), a scrim that keeps white type readable on
// it, a fallback gradient, and the accent used for precipitation numbers.

export type Sky = {
  id: string;
  photo: string;
  scrim: string; // overlay colour laid over the photo
  top: string;
  bottom: string;
  glow: string;
  glowAt: [number, number]; // % position of the drifting light
  particles: 'none' | 'rain' | 'drizzle' | 'snow' | 'stars' | 'mist' | 'storm';
  ink: string;
};

const SKIES: Record<string, Omit<Sky, 'id'>> = {
  'clear-day': { photo: clearDay, scrim: 'rgba(10,40,90,0.10)', top: '#1f6fc4', bottom: '#86b9e8', glow: '#fff4d6', glowAt: [80, 4], particles: 'none', ink: '#d6ecff' },
  'partly-day': { photo: partlyDay, scrim: 'rgba(18,48,88,0.34)', top: '#3d84c4', bottom: '#9bbad6', glow: '#fff6e0', glowAt: [74, 6], particles: 'none', ink: '#d6ecff' },
  'cloudy-day': { photo: cloudy, scrim: 'rgba(24,32,44,0.30)', top: '#7e8793', bottom: '#58616d', glow: '#e6ebf0', glowAt: [55, 30], particles: 'none', ink: '#cfe2ff' },
  'fog-day': { photo: fog, scrim: 'rgba(48,52,60,0.46)', top: '#a7a7a3', bottom: '#7d7f80', glow: '#fff1dc', glowAt: [62, 50], particles: 'mist', ink: '#e3eeff' },
  'drizzle-day': { photo: rain, scrim: 'rgba(20,40,52,0.12)', top: '#4f7384', bottom: '#2f4a58', glow: '#a7c4d2', glowAt: [65, 0], particles: 'drizzle', ink: '#bfe0ff' },
  'rain-day': { photo: rain, scrim: 'rgba(12,26,38,0.26)', top: '#3f6273', bottom: '#223843', glow: '#8fb0c2', glowAt: [65, 0], particles: 'rain', ink: '#b6d8ff' },
  'snow-day': { photo: snow, scrim: 'rgba(30,48,78,0.40)', top: '#a6b4c8', bottom: '#7d8ea6', glow: '#ffffff', glowAt: [45, 40], particles: 'snow', ink: '#e9f2ff' },
  'storm-day': { photo: storm, scrim: 'rgba(10,10,24,0.18)', top: '#2c3556', bottom: '#141a2e', glow: '#b7a6ff', glowAt: [55, 40], particles: 'storm', ink: '#c8c0ff' },
  'golden': { photo: golden, scrim: 'rgba(54,20,44,0.22)', top: '#8a7aa6', bottom: '#e0895a', glow: '#ffd59a', glowAt: [85, 80], particles: 'none', ink: '#ffe3bd' },
  'clear-night': { photo: clearNight, scrim: 'rgba(4,8,24,0.10)', top: '#1a2347', bottom: '#0b1029', glow: '#8ea2e6', glowAt: [8, 6], particles: 'stars', ink: '#a9c1ff' },
  'partly-night': { photo: cloudyNight, scrim: 'rgba(6,12,26,0.05)', top: '#1d2b3e', bottom: '#0b121c', glow: '#7f93c4', glowAt: [55, 30], particles: 'stars', ink: '#a9c1ff' },
  'cloudy-night': { photo: cloudyNight, scrim: 'rgba(8,10,16,0.22)', top: '#1b2532', bottom: '#0a0f16', glow: '#5d6d86', glowAt: [55, 30], particles: 'none', ink: '#aec4f0' },
  'fog-night': { photo: fog, scrim: 'rgba(14,16,24,0.78)', top: '#3a3d43', bottom: '#1b1d21', glow: '#6c7078', glowAt: [62, 50], particles: 'mist', ink: '#b2c6f0' },
  'drizzle-night': { photo: rain, scrim: 'rgba(4,10,18,0.55)', top: '#20323d', bottom: '#0d171d', glow: '#456477', glowAt: [65, 0], particles: 'drizzle', ink: '#a5c8ff' },
  'rain-night': { photo: rain, scrim: 'rgba(2,8,16,0.62)', top: '#1a2a34', bottom: '#0a1217', glow: '#3d5a6c', glowAt: [65, 0], particles: 'rain', ink: '#a5c8ff' },
  'snow-night': { photo: snow, scrim: 'rgba(12,20,44,0.72)', top: '#36445c', bottom: '#18202e', glow: '#8a9cc0', glowAt: [45, 40], particles: 'snow', ink: '#dbe7ff' },
  'storm-night': { photo: storm, scrim: 'rgba(4,4,12,0.42)', top: '#1d2238', bottom: '#0a0c16', glow: '#9a8ae6', glowAt: [55, 40], particles: 'storm', ink: '#c0b8ff' },
};

export function skyFor(kind: Kind, day: boolean, golden = false): Sky {
  if (golden && (kind === 'clear' || kind === 'partly')) return { id: 'golden', ...SKIES.golden };
  const id = `${kind}-${day ? 'day' : 'night'}`;
  return { id, ...(SKIES[id] ?? SKIES['cloudy-day']) };
}

/** The sky for a forecast right now (golden hour within 40 min of sunrise/sunset). */
export function skyForForecast(f: Forecast | null, override?: { code: number; day: boolean; t: number }): Sky {
  if (!f) return skyFor('partly', true);
  const code = override?.code ?? f.current.code;
  const day = override?.day ?? f.current.day;
  const t = override?.t ?? f.current.t;
  const today = f.days.find(d => t >= d.t && t < d.t + 86_400_000) ?? f.days[0];
  const near = (x: number) => Math.abs(t - x) < 40 * 60_000;
  const golden = !!today && (near(today.sunrise) || near(today.sunset));
  return skyFor(kindOf(code), day, golden);
}
