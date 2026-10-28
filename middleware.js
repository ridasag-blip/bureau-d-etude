import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Routes accessibles uniquement à certains rôles
const ROUTES_ADMIN_ONLY = ["/beneficiaires", "/rapport", "/export", "/facturation"];
// Réservées à l'administrateur principal (pas aux comptes Admin « Responsable »)
const ROUTES_SUPERVISEUR = ["/export", "/facturation"];
const ROUTES_ADMIN_QUALITE = ["/dashboard", "/statistiques", "/qualite", "/saisie", "/parametres"];
const ROUTES_INGENIEUR_ONLY = ["/mes-dossiers"];

function accueilPour(role) {
  return role === "ingenieur" ? "/mes-dossiers" : role === "lecteur" ? "/dashboard" : "/saisie";
}
// Compte « Visualisation » (lecteur) : tout en consultation, sauf les Paramètres
const ROUTES_INTERDITES_LECTEUR = ["/parametres", "/mes-dossiers"];

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && path !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Compte désactivé par l'admin : déconnexion immédiate
  if (user?.banned_until && new Date(user.banned_until) > new Date() && path !== "/login") {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("desactive", "1");
    return NextResponse.redirect(url);
  }

  if (user) {
    // « fonction » n'existe qu'après la migration V18 : on se replie sur « role » seul si besoin
    let { data: profile, error: errProfil } = await supabase.from("profiles").select("role, fonction, traite_dossiers").eq("id", user.id).single();
    if (errProfil) ({ data: profile, error: errProfil } = await supabase.from("profiles").select("role, fonction").eq("id", user.id).single());
    if (errProfil) ({ data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single());

    const role = profile?.role;
    const lecteur = role === "lecteur";

    if (lecteur && ROUTES_INTERDITES_LECTEUR.some((r) => path.startsWith(r))) {
      const url = request.nextUrl.clone();
      url.pathname = accueilPour(role);
      return NextResponse.redirect(url);
    }


    if (
      (ROUTES_ADMIN_ONLY.some((r) => path.startsWith(r)) && role !== "admin" && !lecteur) ||
      (ROUTES_SUPERVISEUR.some((r) => path.startsWith(r)) && profile?.fonction === "Responsable")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = accueilPour(role);
      return NextResponse.redirect(url);
    }

    if (
      ROUTES_ADMIN_QUALITE.some((r) => path.startsWith(r)) &&
      !["admin", "qualite", "lecteur"].includes(role)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = accueilPour(role);
      return NextResponse.redirect(url);
    }

    // « Mes dossiers » : ingénieurs, admin, et comptes Qualité qui traitent aussi des dossiers
    if (ROUTES_INGENIEUR_ONLY.some((r) => path.startsWith(r)) && role !== "ingenieur" && role !== "admin" && !(role === "qualite" && profile?.traite_dossiers)) {
      const url = request.nextUrl.clone();
      url.pathname = accueilPour(role);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Exclut aussi les fichiers statiques (logo, icône…) : sinon, avant connexion,
    // ils étaient redirigés vers /login et le logo apparaissait cassé.
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
