import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "dossiers-fichiers";
const LOT = 500;

async function verifierAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const {
    data: { user },
  } = await client.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await client.from("profiles").select("role, nom_complet").eq("id", user.id).single();
  return profile?.role === "admin" ? { user, profile } : null;
}

/**
 * Suppression des dossiers (réservée à l'admin) :
 *   mode « tout »  → tous les dossiers
 *   mode « avant » → les dossiers dont la date est strictement antérieure à `date`
 * Les paramètres (ingénieurs, fiches, clients, comptes…) sont conservés.
 * Une sauvegarde complète des dossiers supprimés est enregistrée juste avant (onglet Sauvegardes).
 * L'historique, les retours, les commentaires et les pièces jointes partent avec les dossiers.
 */
export async function POST(request) {
  const admin = await verifierAdmin(request);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  if (!SERVICE_KEY) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel" }, { status: 500 });

  const { mode, date, confirmation } = await request.json();
  if (confirmation !== "SUPPRIMER") return NextResponse.json({ error: "Confirmation manquante" }, { status: 400 });
  if (!["tout", "avant"].includes(mode)) return NextResponse.json({ error: "Mode invalide" }, { status: 400 });
  if (mode === "avant" && !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return NextResponse.json({ error: "Date invalide" }, { status: 400 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const requete = () => {
    let q = db.from("dossiers").select("*");
    if (mode === "avant") q = q.lt("date", date);
    return q;
  };

  // 1. Lecture de tous les dossiers concernés (par pages) + sauvegarde
  const tous = [];
  for (let page = 0; ; page++) {
    const { data, error } = await requete()
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    tous.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  if (!tous.length) return NextResponse.json({ supprimes: 0, fichiers: 0 });

  const libelle = mode === "tout" ? "tous les dossiers" : `dossiers avant le ${date}`;
  const { error: errSauv } = await db.from("backups").insert({
    contenu: tous,
    nb_dossiers: tous.length,
    declenche_par: `${admin.profile.nom_complet || "admin"} — avant suppression (${libelle})`,
  });
  if (errSauv) return NextResponse.json({ error: "Sauvegarde impossible, rien n'a été supprimé : " + errSauv.message }, { status: 500 });

  // 2. Pièces jointes (stockage) puis dossiers (l'historique part en cascade)
  let fichiers = 0;
  let supprimes = 0;
  for (let i = 0; i < tous.length; i += LOT) {
    const ids = tous.slice(i, i + LOT).map((d) => d.id);
    const { data: fs } = await db.from("dossier_fichiers").select("chemin").in("dossier_id", ids);
    if (fs?.length) {
      const { error: e1 } = await db.storage.from(BUCKET).remove(fs.map((f) => f.chemin));
      if (!e1) fichiers += fs.length;
    }
    const { error: e2 } = await db.from("dossiers").delete().in("id", ids);
    if (e2) return NextResponse.json({ error: e2.message, supprimes, fichiers }, { status: 500 });
    supprimes += ids.length;
  }

  return NextResponse.json({ supprimes, fichiers });
}
