"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { ROLE_LABELS } from "@/lib/constants";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "ingenieur", "qualite"] },
  { href: "/saisie", label: "Saisie", roles: ["admin", "ingenieur", "qualite"] },
  { href: "/statistiques", label: "Statistiques", roles: ["admin", "qualite"] },
  { href: "/export", label: "Export", roles: ["admin", "qualite"] },
  { href: "/rapport", label: "Rapport", roles: ["admin", "qualite"] },
  { href: "/parametres", label: "Paramètres", roles: ["admin"] },
];

export default function Navbar({ role, nom }) {
  const pathname = usePathname();
  const router = useRouter();

  async function seDeconnecter() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="border-b border-black/5 bg-white sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 flex items-center h-16 gap-8">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="w-2.5 h-6 bg-isoGreen rounded-sm" />
          <span className="w-2.5 h-6 bg-isoRed rounded-sm -ml-1" />
          <span className="ml-2">ISO BAT <span className="text-isoGreen">Qualité</span></span>
        </div>
        <nav className="flex items-center gap-1 flex-1">
          {LINKS.filter((l) => l.roles.includes(role)).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname?.startsWith(l.href)
                  ? "bg-isoGreen-light text-isoGreen-dark"
                  : "text-ink/70 hover:bg-black/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink/60">{nom}</span>
          <span className="badge bg-isoNavy/10 text-isoNavy">{ROLE_LABELS[role]}</span>
          <button onClick={seDeconnecter} className="btn-secondary text-xs !py-1.5 !px-3">
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
