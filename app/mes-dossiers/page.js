"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SelectionPersonne from "@/components/SelectionPersonne";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import HorlogeDigitale from "@/components/HorlogeDigitale";
import VueCalendrier from "@/components/VueCalendrier";
import PageHeader, { SectionTitle } from "@/components/ui/PageHeader";
import StatutBadge, { Badge } from "@/components/ui/StatutBadge";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import UndoToast from "@/components/ui/UndoToast";
import { EcranChargement, EcranErreurProfil } from "@/components/ui/Screens";
import { formatDate } from "@/lib/constants";
import { useAppData } from "@/lib/useAppData";
import { useIngenieurSelectionne } from "@/lib/useNomSelectionne";

function estAujourdHui(dateStr) {
  const d = new Date(dateStr);
  const auj = new Date();
  return (
    d.getFullYear() === auj.getFullYear() &&
    d.getMonth() === auj.getMonth() &&
    d.getDate() === auj.getDate()
  );
}

function ancienneteJours(dateStr) {
  const d = new Date(dateStr);
  const auj = new Date();
  return Math.floor((auj - d) / (1000 * 60 * 60 * 24));
}

function CompteARebours({ dateAcceptation, delaiMaxHeures }) {
  const echeance = new Date(dateAcceptation).getTime() + delaiMaxHeures * 3600000;
  const resteMs = echeance - Date.now();
  const resteH = resteMs / 3600000;
  const depasse = resteH < 0;
  return (
    <p className={`text-[11px] mt-1 flex items-center gap-1 font-medium ${depasse ? "text-isoRed" : "text-isoGold-dark"}`}>
      <Icon name="clock" size={11} />
      {depasse
        ? `Délai dépassé de ${Math.abs(resteH).toFixed(1)} h`
        : `Il te reste ${resteH.toFixed(1)} h`}
    </p>
  );
}

const AUJOURD_HUI_ISO = new Date().toISOString().slice(0, 10);

export default function MesDossiersPage() {
  const { profile, erreurProfil, loading, supabase } = useAppData();
  const { nom, pret, selectionner, changerDePersonne } = useIngenieurSelectionne();
  const [ingenieursAvecPin, setIngenieursAvecPin] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [objectifsJour, setObjectifsJour] = useState([]); // liste d'objectifs du jour, par opération
  const [dossiersEquipeAujourdHui, setDossiersEquipeAujourdHui] = useState([]); // tous les dossiers de l'équipe, pour la progression collective
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const [commentaireEnCours, setCommentaireEnCours] = useState({});
  const [vue, setVue] = useState("liste"); // liste | calendrier
  const [delaiMaxHeures, setDelaiMaxHeures] = useState(null);
  const [derniereAction, setDerniereAction] = useState(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: ings }, { data: config }] = await Promise.all([
        supabase.from("parametres_ingenieurs").select("nom, pin").eq("actif", true).order("nom"),
        supabase.from("parametres_config").select("*").limit(1).maybeSingle(),
      ]);
      setIngenieursAvecPin(ings || []);
      if (config) setDelaiMaxHeures(config.delai_max_traitement_heures);
    })();
  }, [profile]);

  async function chargerDossiers() {
    if (!nom) return;
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .eq("ingenieur", nom)
      .order("date", { ascending: false })
      .limit(300);
    setDossiers(data || []);
  }

  async function chargerObjectifsEtProgressionEquipe() {
    const [{ data: objs }, { data: doss }] = await Promise.all([
      supabase.from("objectifs_journaliers").select("*").eq("date", AUJOURD_HUI_ISO),
      supabase.from("dossiers").select("nom_operation, nature_prod, date").eq("date", AUJOURD_HUI_ISO),
    ]);
    setObjectifsJour(objs || []);
    setDossiersEquipeAujourdHui(doss || []);
  }

  useEffect(() => {
    chargerDossiers();
    chargerObjectifsEtProgressionEquipe();
  }, [nom]);

  function memoriserPourAnnulation(d) {
    setDerniereAction({
      dossierId: d.id,
      nomDossier: d.nom_dossier,
      ancienChamps: { etat: d.etat, date_acceptation: d.date_acceptation, date_soumission: d.date_soumission },
    });
    setTimeout(() => setDerniereAction((a) => (a?.dossierId === d.id ? null : a)), 8000);
  }

  async function annulerDerniereAction() {
    if (!derniereAction) return;
    await supabase.from("dossiers").update(derniereAction.ancienChamps).eq("id", derniereAction.dossierId);
    setDerniereAction(null);
    chargerDossiers();
  }

  async function accepterDossier(d) {
    memoriserPourAnnulation(d);
    await supabase
      .from("dossiers")
      .update({ etat: "Encours", date_acceptation: new Date().toISOString() })
      .eq("id", d.id);

    await supabase.from("dossier_evenements").insert({
      dossier_id: d.id,
      type: "acceptation",
      effectue_par_nom: nom,
    });

    chargerDossiers();
  }

  async function envoyerPourVerification(d) {
    memoriserPourAnnulation(d);
    const texteCommentaire = (commentaireEnCours[d.id] || "").trim();

    await supabase
      .from("dossiers")
      .update({ etat: "En attente de vérification", date_soumission: new Date().toISOString() })
      .eq("id", d.id);

    await supabase.from("dossier_evenements").insert({
      dossier_id: d.id,
      type: "soumission_verification",
      effectue_par_nom: nom,
    });

    if (texteCommentaire) {
      await supabase.from("dossier_commentaires").insert({
        dossier_id: d.id,
        auteur_nom: nom,
        contenu: texteCommentaire,
      });
    }

    setCommentaireEnCours((c) => ({ ...c, [d.id]: "" }));
    chargerDossiers();
  }

  if (erreurProfil) return <EcranErreurProfil message={erreurProfil} />;
  if (loading || !profile || !pret) return <EcranChargement />;

  if (!nom) {
    return (
      <SelectionPersonne
        personnes={ingenieursAvecPin}
        onSelection={selectionner}
      />
    );
  }

  const nouveauxAssignes = dossiers.filter((d) => d.etat === "En attente de traitement");
  const nonTraites = dossiers.filter((d) => ["Encours", "en pause"].includes(d.etat));
  const aujourdHui = nonTraites.filter((d) => estAujourdHui(d.date));
  const ancien = nonTraites
    .filter((d) => !estAujourdHui(d.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const enAttenteVerif = dossiers.filter((d) =>
    ["En attente de vérification", "En cours de vérification"].includes(d.etat)
  );
  const traites = dossiers.filter(
    (d) =>
      !["En attente de traitement", "Encours", "en pause", "En attente de vérification", "En cours de vérification"].includes(
        d.etat
      )
  );

  // Progression du jour, par opération : équipe entière (tous) + personnelle (cet ingénieur)
  const traitesAujourdHui = dossiers.filter((d) => d.date === AUJOURD_HUI_ISO);
  const operationsAvecActivite = [
    ...new Set([...objectifsJour.map((o) => o.operation), ...traitesAujourdHui.map((d) => d.nom_operation)]),
  ];
  const progressionParOperation = operationsAvecActivite.map((op) => {
    const objectif = objectifsJour.find((o) => o.operation === op);
    const equipeOp = dossiersEquipeAujourdHui.filter((d) => d.nom_operation === op);
    const persoOp = traitesAujourdHui.filter((d) => d.nom_operation === op);
    return {
      operation: op,
      objectif,
      equipeNv: equipeOp.filter((d) => d.nature_prod === "Nouveau dossier").length,
      equipeModif: equipeOp.filter((d) => d.nature_prod === "Modification").length,
      persoNv: persoOp.filter((d) => d.nature_prod === "Nouveau dossier").length,
      persoModif: persoOp.filter((d) => d.nature_prod === "Modification").length,
    };
  });


  // Fonction de rendu (pas un composant déclaré dans le rendu) : sinon le champ
  // commentaire était recréé à chaque frappe et perdait le focus.
  function tableauDossiers({ titre, icone, liste, avecAnciennete, ton = "neutral" }) {
    return (
      <section className="mb-8">
        <SectionTitle icone={icone} titre={titre} compteur={liste.length} ton={liste.length ? ton : "neutral"} />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Nom dossier</th>
                <th>Opération</th>
                <th>Nature</th>
                <th>Statut</th>
                {avecAnciennete && <th>Ancienneté</th>}
                <th className="!text-right">Envoyer à la Qualité</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => {
                const enRetour = d.retour_interne || d.retour_client;
                const jours = ancienneteJours(d.date);
                return (
                  <tr key={d.id} className={enRetour ? "bg-isoRed-light/40" : ""}>
                    <td className="whitespace-nowrap text-ink/60 tabular">{formatDate(d.date)}</td>
                    <td className="font-semibold">{d.nom_dossier}</td>
                    <td className="text-ink/70">{d.nom_operation}</td>
                    <td className="text-ink/60">{d.nature_prod || "—"}</td>
                    <td>
                      {enRetour ? (
                        <div>
                          <Badge ton="red" dot>
                            {d.retour_interne ? "Retour interne" : "Retour client"}
                            {d.nb_retours > 0 && ` · ${d.nb_retours}`}
                          </Badge>
                          <p className="text-xs text-ink/55 mt-1 max-w-[220px]">
                            {d.retour_interne ? d.cause_retour_interne : d.cause_retour_client}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <StatutBadge etat={d.etat} />
                          {delaiMaxHeures && d.date_acceptation && (
                            <CompteARebours dateAcceptation={d.date_acceptation} delaiMaxHeures={delaiMaxHeures} />
                          )}
                        </div>
                      )}
                    </td>
                    {avecAnciennete && (
                      <td>
                        <Badge ton={jours > 3 ? "red" : "gold"}>{jours} j</Badge>
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-1.5 justify-end">
                        {d.nb_retours > 0 && (
                          <button
                            onClick={() => setDossierHistorique(d)}
                            className="btn-icon w-8 h-8"
                            title="Historique"
                            aria-label="Historique"
                          >
                            <Icon name="history" size={15} />
                          </button>
                        )}
                        <input
                          type="text"
                          placeholder="Commentaire (optionnel)"
                          value={commentaireEnCours[d.id] || ""}
                          onChange={(e) => setCommentaireEnCours((c) => ({ ...c, [d.id]: e.target.value }))}
                          className="input input-sm w-44"
                        />
                        <button onClick={() => envoyerPourVerification(d)} className="btn-primary btn-sm">
                          <Icon name="send" size={13} />
                          Envoyer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {liste.length === 0 && (
                <tr>
                  <td colSpan={avecAnciennete ? 7 : 6}>
                    <EmptyState icone="checkCircle" texte="Rien ici pour l'instant." compact />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function barre(valeur, objectif) {
    if (!objectif) return null;
    const pct = Math.min(100, Math.round((valeur / objectif) * 100));
    return (
      <div className="h-1.5 rounded-full bg-ink/[0.06] overflow-hidden mt-1">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-isoGreen" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nom} onChangerPersonne={changerDePersonne} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="folder"
          titre="Mes dossiers"
          sousTitre={
            <>
              Bonjour <span className="capitalize font-medium text-ink/80">{nom}</span>, voici ce qu'il te reste à traiter.
            </>
          }
          actions={
            <div className="flex items-center gap-4">
              <div className="segmented">
                <button data-active={vue === "liste"} onClick={() => setVue("liste")}>
                  <Icon name="list" size={13} />
                  Liste
                </button>
                <button data-active={vue === "calendrier"} onClick={() => setVue("calendrier")}>
                  <Icon name="calendar" size={13} />
                  Calendrier
                </button>
              </div>
              <div className="hidden md:block">
                <HorlogeDigitale sansLabel />
              </div>
            </div>
          }
        />

        {/* Résumé personnel */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Nouveaux assignés", v: nouveauxAssignes.length, icone: "inbox", c: "bg-isoGold-light text-isoGold-dark" },
            { label: "À traiter", v: nonTraites.length, icone: "pencil", c: "bg-brand-50 text-brand-600" },
            { label: "En vérification", v: enAttenteVerif.length, icone: "shield", c: "bg-brand-50 text-brand-600" },
            { label: "Traités", v: traites.length, icone: "checkCircle", c: "bg-isoGreen-light text-isoGreen-dark" },
          ].map((k) => (
            <div key={k.label} className="card p-4 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${k.c}`}>
                <Icon name={k.icone} size={18} />
              </span>
              <span>
                <span className="block font-display text-2xl font-extrabold leading-none tabular">{k.v}</span>
                <span className="block text-xs text-ink/55 mt-1">{k.label}</span>
              </span>
            </div>
          ))}
        </section>

        {progressionParOperation.length > 0 && (
          <div className="card mb-8">
            <div className="card-header border-b border-line">
              <p className="card-title">
                <Icon name="target" size={15} className="text-ink/40" />
                Aujourd'hui, par opération
              </p>
            </div>
            <div className="overflow-hidden rounded-b-card">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 -mr-px -mb-px">
              {progressionParOperation.map((p) => (
                <div key={p.operation} className="p-4 text-sm border-r border-b border-line">
                  <p className="font-semibold mb-2">{p.operation}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-ink/50">Nouveaux (équipe)</p>
                      <p className="font-display font-bold tabular">
                        {p.equipeNv}
                        {p.objectif && <span className="text-ink/35 font-medium">/{p.objectif.objectif_nv_dossier}</span>}
                      </p>
                      {barre(p.equipeNv, p.objectif?.objectif_nv_dossier)}
                    </div>
                    <div>
                      <p className="text-xs text-ink/50">Modifs (équipe)</p>
                      <p className="font-display font-bold tabular">
                        {p.equipeModif}
                        {p.objectif && <span className="text-ink/35 font-medium">/{p.objectif.objectif_modif}</span>}
                      </p>
                      {barre(p.equipeModif, p.objectif?.objectif_modif)}
                    </div>
                  </div>
                  <p className="text-xs text-ink/45 mt-3">
                    Toi : {p.persoNv} nouveau(x) · {p.persoModif} modification(s)
                  </p>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}

        {vue === "calendrier" ? (
          <VueCalendrier dossiers={dossiers} />
        ) : (
          <>
            {nouveauxAssignes.length > 0 && (
              <section className="mb-8">
                <SectionTitle icone="inbox" titre="Nouveaux dossiers assignés" compteur={nouveauxAssignes.length} ton="gold" />
                <div className="card divide-y divide-line border-isoGold/40">
                  {nouveauxAssignes.map((d) => (
                    <div key={d.id} className="px-5 py-3.5 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <p className="font-semibold">{d.nom_dossier}</p>
                        <p className="text-xs text-ink/50">
                          {[d.nom_operation, d.client, d.nature_prod].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <button onClick={() => accepterDossier(d)} className="btn-success btn-sm">
                        <Icon name="check" size={14} />
                        Accepter
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {tableauDossiers({ titre: "À traiter aujourd'hui", icone: "pencil", liste: aujourdHui, avecAnciennete: false, ton: "brand" })}

            {enAttenteVerif.length > 0 && (
              <section className="mb-8">
                <SectionTitle icone="shield" titre="Envoyés — en attente de la Qualité" compteur={enAttenteVerif.length} ton="brand" />
                <div className="card divide-y divide-line">
                  {enAttenteVerif.map((d) => (
                    <div key={d.id} className="px-5 py-3 flex justify-between items-center gap-3">
                      <p className="font-medium">{d.nom_dossier}</p>
                      <StatutBadge etat={d.etat} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {ancien.length > 0 &&
              tableauDossiers({ titre: "À traiter (jours précédents)", icone: "clock", liste: ancien, avecAnciennete: true, ton: "red" })}

            <section>
              <SectionTitle icone="checkCircle" titre="Tous mes dossiers traités" compteur={traites.length} />
              <div className="card overflow-x-auto">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Nom dossier</th>
                      <th>Opération</th>
                      <th>Nature</th>
                      <th>État final</th>
                      <th>Validé par</th>
                      <th>Vérifié le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traites.map((d) => (
                      <tr key={d.id}>
                        <td className="whitespace-nowrap text-ink/60 tabular">{formatDate(d.date)}</td>
                        <td className="font-semibold">{d.nom_dossier}</td>
                        <td className="text-ink/70">{d.nom_operation}</td>
                        <td className="text-ink/60">{d.nature_prod || "—"}</td>
                        <td>
                          <StatutBadge etat={d.etat} />
                        </td>
                        <td className="capitalize">{d.valide_par || "—"}</td>
                        <td className="text-ink/60 tabular">
                          {d.date_verification ? new Date(d.date_verification).toLocaleDateString("fr-FR") : "—"}
                        </td>
                      </tr>
                    ))}
                    {traites.length === 0 && (
                      <tr>
                        <td colSpan={7} className="table-empty">Rien encore.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {dossierHistorique && (
        <HistoriqueComplet supabase={supabase} dossier={dossierHistorique} onFermer={() => setDossierHistorique(null)} />
      )}

      {derniereAction && (
        <UndoToast message={`Action effectuée sur « ${derniereAction.nomDossier} »`} onAnnuler={annulerDerniereAction} />
      )}
    </div>
  );
}
