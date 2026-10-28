"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Timeline, { versItemsEvenements } from "@/components/Timeline";
import FichiersDossier from "@/components/FichiersDossier";
import { cleDossier } from "@/lib/regroupement";
import { formatDate, dateDerniereModif } from "@/lib/constants";

/**
 * Parcours complet d'un dossier : tous ses passages (création, chaque modification, même traitée
 * par un autre ingénieur) dans une seule frise, avec les pièces et livrables de chaque passage.
 * Même dossier = même nom, même client, même fiche CEE.
 */
export default function HistoriqueComplet({ supabase, dossier, onFermer }) {
  const [flux, setFlux] = useState([]);
  const [passages, setPassages] = useState([dossier]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      // Les autres passages du même dossier (même nom, client et fiche)
      let liste = [dossier];
      if (dossier.nom_dossier) {
        const { data } = await supabase.from("dossiers").select("*").ilike("nom_dossier", String(dossier.nom_dossier).trim().replace(/[%_]/g, "\\$&")).limit(200);
        const memes = (data || []).filter((d) => cleDossier(d) === cleDossier(dossier));
        if (memes.length) liste = memes;
        if (!liste.some((d) => d.id === dossier.id)) liste.push(dossier);
      }
      liste.sort((a, b) => `${a.date || ""}|${a.created_at || ""}`.localeCompare(`${b.date || ""}|${b.created_at || ""}`));
      const ids = liste.map((d) => d.id);
      const rang = new Map(liste.map((d, i) => [d.id, i]));

      const [{ data: evts }, { data: coms }] = await Promise.all([
        supabase.from("dossier_evenements").select("*").in("dossier_id", ids),
        supabase.from("dossier_commentaires").select("*").in("dossier_id", ids),
      ]);

      const plusieurs = liste.length > 1;
      const items = [
        ...versItemsEvenements(evts || []),
        ...(coms || []).map((c) => ({ key: "c-" + c.id, type: "commentaire", detail: c.contenu, auteur: c.auteur_nom, date: c.created_at, dossier_id: c.dossier_id })),
      ];
      // Un repère au début de chaque passage
      if (plusieurs) {
        liste.forEach((d, i) => {
          items.push({
            key: "p-" + d.id,
            type: "passage",
            titre: i === 0 ? `Passage 1 · ${d.nature_prod || "Dossier"}` : `Passage ${i + 1} · ${d.nature_prod || "Modification"}`,
            detail: [d.ingenieur_modif || d.ingenieur ? `ingénieur : ${d.ingenieur_modif || d.ingenieur}` : null, d.etat ? `statut : ${d.etat}` : null].filter(Boolean).join(" · "),
            date: d.created_at || `${d.date}T00:00:00`,
          });
        });
      }
      items.sort((a, b) => new Date(a.date) - new Date(b.date) || (a.type === "passage" ? -1 : b.type === "passage" ? 1 : 0));
      if (plusieurs) for (const it of items) if (it.dossier_id && rang.has(it.dossier_id) && it.type !== "passage") it.passage = rang.get(it.dossier_id) + 1;

      setPassages(liste);
      setFlux(items);
      setChargement(false);
    })();
  }, [dossier.id]);

  const sousTitre =
    passages.length > 1
      ? `${passages.length} passages · ${[dossier.client, dossier.nom_operation].filter(Boolean).join(" · ")} · dernière modification le ${formatDate(passages.map(dateDerniereModif).sort().pop())}`
      : "Parcours complet du dossier";

  return (
    <Modal titre={dossier.nom_dossier} sousTitre={sousTitre} onFermer={onFermer} taille={passages.length > 1 ? "xl" : "md"}>
      {chargement ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
        </div>
      ) : (
        <>
          <Timeline items={flux} />
          {passages.length > 1 && (
            <section className="mt-6 pt-4 border-t border-line">
              <h3 className="text-[15px] font-semibold mb-3">Pièces et livrables de tous les passages</h3>
              <div className="flex flex-col gap-4">
                {passages.map((p, i) => (
                  <div key={p.id}>
                    <p className="text-xs text-ink/55 mb-1.5">
                      Passage {i + 1} · {p.nature_prod || "—"} · {p.ingenieur_modif || p.ingenieur || "—"} · {formatDate(p.date)}
                    </p>
                    <FichiersDossier supabase={supabase} dossier={p} compact peutDeposerPieces={false} peutDeposerLivrables={false} peutSupprimer={false} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
