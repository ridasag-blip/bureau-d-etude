import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Routes accessibles uniquement à certains rôles
const ROUTES_ADMIN_ONLY = ["/parametres"];
const ROUTES_ADMIN_QUALITE = ["/dashboard", "/statistiques", "/rapport", "/qualite", "/saisie", "/export"];
const ROUTES_INGENIEUR_ONLY = ["/mes-dossiers"];

function accueilPour(role) {
  return role === "ingenieur" ? "/mes-dossiers" : "/dashboard";
}

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

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    if (ROUTES_ADMIN_ONLY.some((r) => path.startsWith(r)) && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = accueilPour(role);
      return NextResponse.redirect(url);
    }

    if (
      ROUTES_ADMIN_QUALITE.some((r) => path.startsWith(r)) &&
      !["admin", "qualite"].includes(role)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = accueilPour(role);
      return NextResponse.redirect(url);
    }

    if (ROUTES_INGENIEUR_ONLY.some((r) => path.startsWith(r)) && role !== "ingenieur" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = accueilPour(role);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
