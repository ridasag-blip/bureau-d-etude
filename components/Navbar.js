"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { ROLE_LABELS } from "@/lib/constants";
import RechercheGlobale from "@/components/RechercheGlobale";
import HorlogeDigitale from "@/components/HorlogeDigitale";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "qualite"] },
  { href: "/mes-dossiers", label: "Mes dossiers", roles: ["ingenieur"] },
  { href: "/saisie", label: "Saisie", roles: ["admin", "qualite"] },
  { href: "/qualite", label: "Qualité", roles: ["admin", "qualite"] },
  { href: "/statistiques", label: "Statistiques", roles: ["admin", "qualite"] },
  { href: "/export", label: "Export", roles: ["admin", "qualite"] },
  { href: "/rapport", label: "Rapport", roles: ["admin", "qualite"] },
  { href: "/parametres", label: "Paramètres", roles: ["admin"] },
];

export default function Navbar({ role, nom, onChangerPersonne, masquerHorloge }) {
  const pathname = usePathname();
  const router = useRouter();
  const [enAttente, setEnAttente] = useState(null);

  useEffect(() => {
    if (!["admin", "qualite"].includes(role)) return;
    (async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from("dossiers")
        .select("*", { count: "exact", head: true })
        .eq("etat", "En attente de vérification");
      setEnAttente(count ?? null);
    })();
  }, [role]);

  async function seDeconnecter() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {["admin", "qualite"].includes(role) && (
        <img
          src="/logo-hillsolution.png"
          alt="Hill Solution"
          className="hidden xl:block fixed top-[104px] left-6 w-44 z-0"
        />
      )}
      <header className="border-b border-black/5 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 flex items-center h-24 gap-8">
          <div className="flex items-center gap-1 font-display font-bold text-lg shrink-0">
            <img src="/logo-hillsolution.png" alt="Hill Solution" className="h-20 w-auto shrink-0" />
            <span className="whitespace-nowrap -ml-1">Hill Solution</span>
          </div>
          <nav className="flex items-center gap-1 flex-1">
            {LINKS.filter((l) => l.roles.includes(role)).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  pathname?.startsWith(l.href)
                    ? "bg-isoGreen-light text-isoGreen-dark"
                    : "text-ink/70 hover:bg-black/5"
                }`}
              >
                {l.label}
                {l.href === "/qualite" && !!enAttente && (
                  <span className="bg-isoRed text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                    {enAttente}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          {["admin", "qualite"].includes(role) && <RechercheGlobale />}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink/60">{nom}</span>
            <span className="badge bg-isoNavy/10 text-isoNavy">{ROLE_LABELS[role]}</span>
            {onChangerPersonne && (
              <button onClick={onChangerPersonne} className="btn-secondary text-xs !py-1.5 !px-3">
                Changer de personne
              </button>
            )}
            <button onClick={seDeconnecter} className="btn-secondary text-xs !py-1.5 !px-3">
              Déconnexion
            </button>
            {!masquerHorloge && <HorlogeDigitale compact />}
          </div>
        </div>
      </header>
    </>
  );
}
