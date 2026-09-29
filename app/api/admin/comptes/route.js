import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Vérifie que la requête vient bien d'un utilisateur connecté avec le rôle admin.
// Le token d'accès est envoyé par le client dans l'en-tête Authorization.
async function verifierAdmin(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;

  return user;
}

// Client avec la clé service_role — accès admin complet, jamais exposé au navigateur.
function clientAdmin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request) {
  const admin = await verifierAdmin(request);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const client = clientAdmin();
  const { data: authData, error } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await client.from("profiles").select("*");

  const comptes = authData.users.map((u) => {
    const p = (profiles || []).find((p) => p.id === u.id);
    return {
      id: u.id,
      email: u.email,
      nom_complet: p?.nom_complet || null,
      role: p?.role || null,
      created_at: u.created_at,
    };
  });

  return NextResponse.json({ comptes });
}

export async function POST(request) {
  const admin = await verifierAdmin(request);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { nomUtilisateur, motDePasse, nomComplet, role } = await request.json();
  if (!nomUtilisateur || !motDePasse || !role) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const email = nomUtilisateur.includes("@") ? nomUtilisateur : `${nomUtilisateur}@hillsolution.local`;
  const client = clientAdmin();

  const { data, error } = await client.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: profileError } = await client.from("profiles").insert({
    id: data.user.id,
    nom_complet: nomComplet || nomUtilisateur,
    role,
  });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.user.id });
}

export async function PATCH(request) {
  const admin = await verifierAdmin(request);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id, nouveauMotDePasse, role } = await request.json();
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const client = clientAdmin();

  if (nouveauMotDePasse) {
    const { error } = await client.auth.admin.updateUserById(id, { password: nouveauMotDePasse });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (role) {
    const { error } = await client.from("profiles").update({ role }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const admin = await verifierAdmin(request);
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const client = clientAdmin();
  const { error } = await client.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await client.from("profiles").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
