"use client";
import { useEffect, useState } from "react";

export default function Horloge() {
  const [maintenant, setMaintenant] = useState(null);

  useEffect(() => {
    setMaintenant(new Date());
    const id = setInterval(() => setMaintenant(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!maintenant) return null;

  const date = maintenant.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const heure = maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="text-sm text-ink/50 whitespace-nowrap">
      {date} · {heure}
    </div>
  );
}
