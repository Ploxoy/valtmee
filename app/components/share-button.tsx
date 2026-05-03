"use client";

import { useState } from "react";

type ShareButtonProps = {
  summary: string;
  weather: string;
  fuel: string;
  traffic: string;
  trains: string;
};

function receiptLine(label: string, value: string) {
  const width = 30;
  const prefix = `- ${label} `;
  const dots = ".".repeat(Math.max(3, width - prefix.length - value.length));

  return `${prefix}${dots} ${value}`;
}

function buildReceipt({
  summary,
  weather,
  fuel,
  traffic,
  trains,
}: ShareButtonProps) {
  return [
    "************************",
    "        valtmee.nl",
    "           BON",
    "************************",
    receiptLine("WEER", weather),
    receiptLine("BENZINE", fuel),
    receiptLine("FILE", traffic),
    receiptLine("SPOOR", trains),
    "------------------------",
    " TOTAAL: HET VALT WEL MEE",
    "************************",
    "",
    summary,
    "",
    "BEDANKT!",
    "Morgen wordt het erger",
  ].join("\n");
}

export default function ShareButton(props: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const share = async () => {
    const receipt = buildReceipt(props);
    const shareData = {
      title: "Valt mee",
      text: receipt,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(receipt);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch (error) {
      console.error(error);
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-white/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
    >
      {status === "copied" ? "Gekopieerd" : status === "error" ? "Delen mislukt" : "Delen"}
    </button>
  );
}
