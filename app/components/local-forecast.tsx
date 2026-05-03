"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

type AirQualityResponse = {
  current?: {
    european_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
  };
};

type AirQuality = {
  aqi: number;
  label: string;
  pm25?: number;
  pm10?: number;
};

type ReverseGeocodeResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    state?: string;
    country?: string;
  };
  display_name?: string;
};

function weatherLabel(code: number) {
  if (code === 0) return "Helder";
  if ([1, 2].includes(code)) return "Half bewolkt";
  if (code === 3) return "Bewolkt";
  if ([45, 48].includes(code)) return "Mist";
  if ([51, 53, 55, 56, 57].includes(code)) return "Motregen";
  if ([61, 63, 65, 66, 67].includes(code)) return "Regen";
  if ([71, 73, 75, 77].includes(code)) return "Sneeuw";
  if ([80, 81, 82].includes(code)) return "Buien";
  if ([85, 86].includes(code)) return "Sneeuwbuien";
  if ([95, 96, 99].includes(code)) return "Onweer";
  return "Weer";
}

function airQualityLabel(aqi: number) {
  if (aqi <= 20) return "Goed";
  if (aqi <= 40) return "Redelijk";
  if (aqi <= 60) return "Matig";
  if (aqi <= 80) return "Slecht";
  if (aqi <= 100) return "Zeer slecht";
  return "Extreem slecht";
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export default function LocalForecast() {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "loading" | "ready" | "denied" | "unsupported" | "error"
  >("idle");
  const [errorText, setErrorText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [days, setDays] = useState<ForecastDay[]>([]);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);

  const fetchPlaceName = useCallback(async (lat: number, lon: number) => {
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lon),
        zoom: "10",
        addressdetails: "1",
        "accept-language": "nl,en",
      });

      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        return "";
      }

      const json = (await res.json()) as ReverseGeocodeResponse;
      const address = json.address;

      return (
        address?.city ??
        address?.town ??
        address?.village ??
        address?.municipality ??
        address?.suburb ??
        address?.state ??
        address?.country ??
        ""
      );
    } catch (error) {
      console.error(error);
      return "";
    }
  }, []);

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

  const fetchAirQuality = useCallback(async (lat: number, lon: number) => {
    try {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        timezone: "auto",
        current: "european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
      });

      const res = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        setAirQuality(null);
        return;
      }

      const json = (await res.json()) as AirQualityResponse;
      const aqi = json.current?.european_aqi;

      if (typeof aqi !== "number") {
        setAirQuality(null);
        return;
      }

      setAirQuality({
        aqi,
        label: airQualityLabel(aqi),
        pm25: json.current?.pm2_5,
        pm10: json.current?.pm10,
      });
    } catch (error) {
      console.error(error);
      setAirQuality(null);
    }
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
          const [nextPlaceName] = await Promise.all([
            fetchPlaceName(lat, lon),
            fetchForecast(lat, lon),
            fetchAirQuality(lat, lon),
          ]);

          setPlaceName(nextPlaceName);
          setStatus("ready");
        } catch (error) {
          console.error(error);
          setErrorText("Lokale verwachting niet beschikbaar.");
          setStatus("error");
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("denied");
          return;
        }

        setErrorText("Locatie niet beschikbaar.");
        setStatus("error");
      },
      {
        timeout: 10000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  }, [fetchAirQuality, fetchForecast, fetchPlaceName]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => setStatus("unsupported"));
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

        const state = permissionStatus.state;

        if (state === "denied") {
          setStatus("denied");
        }

        if (state === "granted") {
          requestLocation();
        }

        permissionStatus.onchange = () => {
          const nextState = permissionStatus?.state;

          if (nextState === "denied") {
            setStatus("denied");
          }

          if (nextState === "granted") {
            requestLocation();
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
    if (placeName) return placeName;
    if (!coords) return "";
    return `${coords.lat}, ${coords.lon}`;
  }, [coords, placeName]);

  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-neutral-300">5-daagse verwachting</div>
          <div className="mt-1 text-xs text-neutral-500">
            {status === "ready" && locationText ? locationText : "op basis van je locatie"}
          </div>
        </div>

        {status !== "loading" && status !== "requesting" && (
          <button
            type="button"
            onClick={requestLocation}
            className="shrink-0 rounded-full border border-white/20 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:border-white/35 hover:text-white"
          >
            {status === "ready" ? "Vernieuwen" : "Gebruik locatie"}
          </button>
        )}
      </div>

      {(status === "requesting" || status === "loading") && (
        <p className="mt-4 text-sm text-neutral-400">Verwachting laden...</p>
      )}

      {status === "denied" && (
        <p className="mt-4 text-sm text-neutral-400">
          Locatietoegang is geblokkeerd. Zet dit aan in je browserinstellingen en probeer opnieuw.
        </p>
      )}

      {status === "unsupported" && (
        <p className="mt-4 text-sm text-neutral-400">
          Locatiebepaling wordt niet ondersteund door deze browser.
        </p>
      )}

      {status === "error" && (
        <p className="mt-4 text-sm text-neutral-400">
          {errorText || "Verwachting niet beschikbaar."}
        </p>
      )}

      {status === "ready" && (
        <>
          {airQuality && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                    Luchtkwaliteit
                  </div>
                  <div className="mt-2 text-lg font-semibold text-neutral-100">
                    {airQuality.label}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-neutral-100">{airQuality.aqi}</div>
                  <div className="text-xs text-neutral-500">EU LKI</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                PM2.5 {airQuality.pm25?.toFixed(1) ?? "—"} · PM10{" "}
                {airQuality.pm10?.toFixed(1) ?? "—"} µg/m³
              </div>
            </div>
          )}

          <div className="mt-4 divide-y divide-white/10">
            {days.map((day) => (
              <div key={day.date} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="text-neutral-300">{formatDay(day.date)}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {weatherLabel(day.weatherCode)} · regen {day.precipitationChance}%
                  </div>
                </div>
                <div className="text-right font-semibold text-neutral-100">
                  {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                </div>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[0.7rem] text-neutral-600">
            Verwachting: Open-Meteo · Lucht: Open-Meteo/CAMS · Plaats: OpenStreetMap
          </p>
        </>
      )}
    </div>
  );
}
