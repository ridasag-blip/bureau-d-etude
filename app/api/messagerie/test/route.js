import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { clientService, configEmail, listeEmailsRh, problemeConfigEmail, utilisateurDepuisRequete } from "@/lib/messagerieEmail";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Admin : vérifie la connexion SMTP et envoie un e-mail d'essai aux adresses RH. */
export async function POST(request) {
  const u = await utilisateurDepuisRequete(request);
  if (u?.profil?.role !== "admin") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const pb = problemeConfigEmail();
  if (pb) return NextResponse.json({ error: pb }, { status: 500 });
  const c = configEmail();
  const { data: cfg } = await clientService().from("parametres_config").select("rh_emails").limit(1).maybeSingle();
  const to = listeEmailsRh(cfg);
  if (!to.length) return NextResponse.json({ error: "Aucune adresse RH enregistrée" }, { status: 400 });
  try {
    const t = nodemailer.createTransport({ host: c.smtpHost, port: c.smtpPort, secure: c.smtpPort === 465, auth: { user: c.user, pass: c.pass } });
    await t.verify();
    await t.sendMail({
      from: { name: "Messagerie Hill Solution", address: c.adresse },
      to,
      subject: "Test — Messagerie Hill Solution",
      text:
        "Ceci est un e-mail de test de la Messagerie Hill Solution.\n\n" +
        "Pour écrire à quelqu'un : envoyez un e-mail à cette adresse avec pour objet « Nom — sujet » (ex. « Sami — visite médicale »).\n" +
        "Pour écrire à tout le monde : « Tous — sujet ».\nPour répondre à un message reçu : cliquez simplement sur « Répondre ».",
    });
    return NextResponse.json({ ok: true, envoyeA: to });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
