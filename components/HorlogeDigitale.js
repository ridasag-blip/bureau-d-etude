"use client";
import { useEffect, useState } from "react";

export default function HorlogeDigitale({ compact, sansLabel }) {
  const [maintenant, setMaintenant] = useState(null);

  useEffect(() => {
    setMaintenant(new Date());
    const id = setInterval(() => setMaintenant(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!maintenant) return null;

  const heures = maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const secondes = maintenant.getSeconds().toString().padStart(2, "0");
  const date = maintenant.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  if (compact) {
    return (
      <div className="text-center leading-tight">
        <p className="font-display font-bold text-sm">
          {heures}<span className="text-ink/30">:{secondes}</span>
        </p>
        <p className="text-[10px] text-ink/40 capitalize whitespace-nowrap">{date}</p>
      </div>
    );
  }

  return (
    <div className="text-right">
      {!sansLabel && (
        <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">
          Hillsolution — Tunis
        </p>
      )}
      <p className="font-display font-bold text-4xl leading-none">
        {heures}
        <span className="text-ink/25 text-2xl">:{secondes}</span>
      </p>
      <p className="text-sm text-ink/50 mt-1 capitalize">{date}</p>
    </div>
  );
}
