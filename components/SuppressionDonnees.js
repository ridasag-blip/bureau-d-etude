"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

/** Admin : suppression des dossiers (tous, ou avant une date), avec sauvegarde automatique juste avant. */
export default function SuppressionDonnees({ supabase }) {
  const [mode, setMode] = useState("avant");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  });
  const [nombre, setNombre] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [etat, setEtat] = useState(null); // null | "envoi" | { ok, texte }

  useEffect(() => {
    (async () => {
      setNombre(null);
      let q = supabase.from("dossiers").select("*", { count: "exact", head: true });
      if (mode === "avant") q = q.lt("date", date);
      const { count } = await q;
      setNombre(count ?? 0);
    })();
  }, [mode, date, etat]);

  async function supprimer() {
    setEtat("envoi");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/admin/donnees", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ mode, date, confirmation }),
      });
      const j = await res.json();
      setConfirmation("");
      setEtat(
        res.ok
          ? { ok: true, texte: `${j.supprimes} dossier(s) supprimé(s), ${j.fichiers} pièce(s) jointe(s) effacée(s). Une sauvegarde a été faite avant (onglet Sauvegardes).` }
          : { ok: false, texte: j.error || "Erreur" }
      );
    } catch (e) {
      setEtat({ ok: false, texte: e.message });
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="alert alert-red">
        <Icon name="alert" size={16} className="mt-0.5" />
        <span>
          <strong>Action irréversible.</strong> Les dossiers choisis sont effacés avec leur historique, leurs retours, leurs
          commentaires et leurs pièces jointes. Les paramètres (ingénieurs, fiches, clients, comptes…) sont conservés. Une sauvegarde
          des dossiers supprimés est faite automatiquement juste avant.
        </span>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <div className="segmented w-fit">
          <button data-active={mode === "avant"} onClick={() => setMode("avant")}>
            Dossiers avant une date
          </button>
          <button data-active={mode === "tout"} onClick={() => setMode("tout")}>
            Tous les dossiers
          </button>
        </div>

        {mode === "avant" && (
          <div className="field max-w-xs">
            <label className="label">Supprimer les dossiers datés avant le</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}

        <p className="text-sm">
          Dossiers concernés : <strong className="tabular">{nombre === null ? "…" : nombre}</strong>
        </p>

        <div className="field max-w-xs">
          <label className="label">Pour confirmer, tape SUPPRIMER</label>
          <input className="input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="SUPPRIMER" />
        </div>

        <div>
          <button
            className="btn-danger"
            onClick={supprimer}
            disabled={confirmation !== "SUPPRIMER" || !nombre || etat === "envoi"}
          >
            <Icon name="x" size={15} />
            {etat === "envoi" ? "Suppression…" : `Supprimer ${nombre || 0} dossier(s)`}
          </button>
        </div>

        {etat && etat !== "envoi" && (
          <div className={`alert ${etat.ok ? "alert-green" : "alert-red"}`}>
            <Icon name={etat.ok ? "checkCircle" : "alert"} size={16} className="mt-0.5" />
            <span>{etat.texte}</span>
          </div>
        )}
      </div>
    </div>
  );
}
