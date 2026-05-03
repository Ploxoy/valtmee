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
  const [isOpen, setIsOpen] = useState(false);

  const receipt = buildReceipt(props);

  const resetStatus = () => {
    window.setTimeout(() => setStatus("idle"), 1800);
  };

  const shareNative = async () => {
    const shareData = {
      title: "Valt mee",
      text: receipt,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyReceipt();
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
      resetStatus();
    }

    setIsOpen(false);
  };

  const toggleShare = async () => {
    if (navigator.share) {
      await shareNative();
      return;
    }

    setIsOpen((value) => !value);
  };

  const shareTelegram = () => {
    const url = `https://t.me/share/url?text=${encodeURIComponent(receipt)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(receipt);
      setStatus("copied");
      resetStatus();
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      setStatus("error");
      resetStatus();
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggleShare}
        aria-expanded={isOpen}
        className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-white/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        {status === "copied" ? "Gekopieerd" : status === "error" ? "Delen mislukt" : "Delen"}
      </button>

      {isOpen && (
        <div className="absolute left-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 p-1 text-sm shadow-2xl shadow-black/40 backdrop-blur">
          <button
            type="button"
            onClick={shareTelegram}
            className="block w-full rounded-xl px-3 py-2 text-left text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Telegram
          </button>
          <button
            type="button"
            onClick={copyReceipt}
            className="block w-full rounded-xl px-3 py-2 text-left text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Kopiëren
          </button>
        </div>
      )}
    </div>
  );
}
