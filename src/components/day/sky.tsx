"use client";

import { useEffect, useState } from "react";

// ---- time-of-day palette ---------------------------------------------------

type Phase = { name: string; from: number; top: string; bottom: string; ink: "light" | "dark" };

// `from` is the local hour the phase begins.
const PHASES: Phase[] = [
  { name: "Night", from: 0, top: "#070b1f", bottom: "#1b2552", ink: "light" },
  { name: "Dawn", from: 5, top: "#2c2f63", bottom: "#f3a683", ink: "light" },
  { name: "Morning", from: 7, top: "#6fb7ea", bottom: "#fbe9c9", ink: "dark" },
  { name: "Midday", from: 11, top: "#3f97d8", bottom: "#cfe9f7", ink: "dark" },
  { name: "Afternoon", from: 15, top: "#5a9fd3", bottom: "#f6dcaa", ink: "dark" },
  { name: "Evening", from: 18, top: "#3b3f86", bottom: "#f28a5b", ink: "light" },
  { name: "Dusk", from: 20, top: "#1c1d4d", bottom: "#8a4f7d", ink: "light" },
  { name: "Night", from: 21.5, top: "#070b1f", bottom: "#1b2552", ink: "light" },
];

export function phaseAt(hour: number) {
  return [...PHASES].reverse().find((p) => hour >= p.from) ?? PHASES[0];
}

// ---- weather (Open-Meteo, no key) -----------------------------------------

type Weather = {
  temp: number;
  code: number;
  sunrise: number | null; // minutes of day
  sunset: number | null;
};

const LAT = process.env.NEXT_PUBLIC_WEATHER_LAT || "47.92";
const LON = process.env.NEXT_PUBLIC_WEATHER_LON || "106.92";
const CACHE_KEY = "daylog.weather";
const CACHE_MS = 15 * 60 * 1000;

function weatherLabel(code: number, isNight: boolean) {
  if (code === 0) return isNight ? ["🌙", "Clear"] : ["☀️", "Clear"];
  if (code <= 2) return isNight ? ["☁️", "Partly cloudy"] : ["🌤️", "Partly cloudy"];
  if (code === 3) return ["☁️", "Overcast"];
  if (code <= 48) return ["🌫️", "Fog"];
  if (code <= 57) return ["🌦️", "Drizzle"];
  if (code <= 67) return ["🌧️", "Rain"];
  if (code <= 77) return ["🌨️", "Snow"];
  if (code <= 82) return ["🌧️", "Showers"];
  if (code <= 86) return ["🌨️", "Snow showers"];
  return ["⛈️", "Thunderstorm"];
}

function hhmmToMinutes(iso: string | undefined) {
  const m = iso?.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function useWeather(enabled: boolean) {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
      if (cached && Date.now() - cached.at < CACHE_MS) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from cache
        setWeather(cached.data);
        return;
      }
    } catch {}
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || cancelled) return;
        const data: Weather = {
          temp: Math.round(j.current?.temperature_2m),
          code: j.current?.weather_code ?? 0,
          sunrise: hhmmToMinutes(j.daily?.sunrise?.[0]),
          sunset: hhmmToMinutes(j.daily?.sunset?.[0]),
        };
        setWeather(data);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch {}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return weather;
}

// ---- component -------------------------------------------------------------

export function Sky({
  minuteOfDay,
  clock,
  dateLabel,
  live,
  children,
}: {
  /** Minutes since local midnight to render the sky for. */
  minuteOfDay: number;
  clock: string;
  dateLabel: string;
  live: boolean;
  children?: React.ReactNode;
}) {
  const weather = useWeather(live);
  const hour = minuteOfDay / 60;
  const phase = phaseAt(hour);
  const sunrise = weather?.sunrise ?? 6 * 60;
  const sunset = weather?.sunset ?? 19 * 60;
  const isDay = minuteOfDay >= sunrise && minuteOfDay < sunset;

  // Sun travels sunrise→sunset; moon travels sunset→next sunrise.
  const dayLen = sunset - sunrise;
  const nightLen = 1440 - dayLen;
  const progress = isDay
    ? (minuteOfDay - sunrise) / dayLen
    : ((minuteOfDay - sunset + 1440) % 1440) / nightLen;
  const orbX = 6 + progress * 88;
  const orbY = 78 - Math.sin(progress * Math.PI) * 62;

  const ink = phase.ink === "light" ? "text-white" : "text-[#10233a]";
  const [wIcon, wText] = weather ? weatherLabel(weather.code, !isDay) : ["", ""];

  return (
    <section
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-3xl px-5 py-4 transition-[background] duration-1000 ${ink}`}
      style={{ background: `linear-gradient(180deg, ${phase.top} 0%, ${phase.bottom} 100%)` }}
    >
      {!isDay && <Stars />}
      <div
        aria-hidden
        className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-1000"
        style={{
          left: `${orbX}%`,
          top: `${orbY}%`,
          background: isDay
            ? "radial-gradient(circle, #fff7d1 0%, #ffd66b 45%, rgba(255,200,80,0) 72%)"
            : "radial-gradient(circle, #f4f1e6 0%, #d9d4c4 42%, rgba(220,215,200,0) 70%)",
          boxShadow: isDay ? "0 0 60px 20px rgba(255,210,110,.35)" : "0 0 40px 8px rgba(230,230,255,.15)",
        }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wider uppercase opacity-80">
            {dateLabel} · {phase.name}
          </p>
          <p className="text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">{clock}</p>
        </div>
        {weather && (
          <div className="text-right">
            <p className="text-3xl leading-none">{wIcon}</p>
            <p className="mt-1 text-sm font-medium">
              {weather.temp}° · {wText}
            </p>
          </div>
        )}
      </div>
      {children && <div className="relative mt-2">{children}</div>}
    </section>
  );
}

const STAR_POSITIONS = [
  [8, 20], [15, 55], [23, 12], [31, 40], [38, 70], [46, 18], [53, 50], [61, 30],
  [68, 62], [74, 14], [81, 44], [88, 25], [93, 60], [5, 75], [57, 80], [27, 85],
];

function Stars() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {STAR_POSITIONS.map(([x, y], i) => (
        <span
          key={i}
          className="absolute h-[2px] w-[2px] rounded-full bg-white"
          style={{ left: `${x}%`, top: `${y}%`, opacity: 0.35 + ((i * 37) % 50) / 100 }}
        />
      ))}
    </div>
  );
}
