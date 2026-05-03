"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PermissionStateValue = "granted" | "denied" | "prompt" | "unknown";

type ForecastDay = {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationChance: number;
  weatherCode: number;
};

type LocalForecastResponse = {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weathercode: number[];
  };
};

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather";
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export default function LocalForecast() {
  const [permission, setPermission] = useState<PermissionStateValue>("unknown");
  const [status, setStatus] = useState<
    "idle" | "requesting" | "loading" | "ready" | "denied" | "unsupported" | "error"
  >("idle");
  const [errorText, setErrorText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [days, setDays] = useState<ForecastDay[]>([]);

  const fetchForecast = useCallback(async (lat: number, lon: number) => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: "auto",
      forecast_days: "5",
      daily:
        "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Weather request failed: ${res.status}`);
    }

    const json = (await res.json()) as LocalForecastResponse;
    const daily = json.daily;

    const forecast: ForecastDay[] = daily.time.map((date, index) => ({
      date,
      tempMax: daily.temperature_2m_max[index],
      tempMin: daily.temperature_2m_min[index],
      precipitationChance: daily.precipitation_probability_max[index],
      weatherCode: daily.weathercode[index],
    }));

    setDays(forecast);
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    setErrorText("");
    setStatus("requesting");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(4));
        const lon = Number(position.coords.longitude.toFixed(4));
        setCoords({ lat, lon });
        setStatus("loading");

        try {
          await fetchForecast(lat, lon);
          setStatus("ready");
        } catch (error) {
          console.error(error);
          setErrorText("Could not load local forecast.");
          setStatus("error");
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermission("denied");
          setStatus("denied");
          return;
        }

        setErrorText("Could not get your location.");
        setStatus("error");
      },
      {
        timeout: 10000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  }, [fetchForecast]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    if (!("permissions" in navigator)) {
      return;
    }

    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const bindPermission = async () => {
      try {
        permissionStatus = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });

        if (cancelled) return;

        const state = permissionStatus.state as PermissionStateValue;
        setPermission(state);

        if (state === "granted") {
          requestLocation();
        } else if (state === "denied") {
          setStatus("denied");
        }

        permissionStatus.onchange = () => {
          const nextState = permissionStatus?.state as PermissionStateValue;
          setPermission(nextState);

          if (nextState === "granted") {
            requestLocation();
          } else if (nextState === "denied") {
            setStatus("denied");
          }
        };
      } catch (error) {
        console.error(error);
      }
    };

    void bindPermission();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [requestLocation]);

  const locationText = useMemo(() => {
    if (!coords) return "";
    return `${coords.lat}, ${coords.lon}`;
  }, [coords]);

  return (
    <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Local 5-day forecast</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Uses browser geolocation and Open-Meteo data.
          </p>
        </div>

        {status !== "ready" && status !== "loading" && status !== "requesting" && (
          <button
            type="button"
            onClick={requestLocation}
            className="inline-flex w-fit items-center rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-white/35 hover:text-white"
          >
            Use my location
          </button>
        )}
      </div>

      {(status === "requesting" || status === "loading") && (
        <p className="mt-4 text-sm text-neutral-400">Loading forecast…</p>
      )}

      {status === "denied" && (
        <p className="mt-4 text-sm text-neutral-400">
          Location permission is blocked. Enable it in browser settings and try again.
        </p>
      )}

      {status === "unsupported" && (
        <p className="mt-4 text-sm text-neutral-400">
          Geolocation is not supported by this browser.
        </p>
      )}

      {status === "error" && (
        <p className="mt-4 text-sm text-neutral-400">{errorText || "Could not load forecast."}</p>
      )}

      {status === "ready" && (
        <>
          <p className="mt-4 text-sm text-neutral-500">
            Location: {locationText}
            {permission !== "unknown" ? ` · permission: ${permission}` : ""}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {days.map((day) => (
              <div
                key={day.date}
                className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm"
              >
                <div className="text-neutral-300">{formatDay(day.date)}</div>
                <div className="mt-2 text-neutral-400">{weatherLabel(day.weatherCode)}</div>
                <div className="mt-3 text-lg font-semibold text-neutral-100">
                  {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                </div>
                <div className="mt-1 text-neutral-500">Rain: {day.precipitationChance}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
