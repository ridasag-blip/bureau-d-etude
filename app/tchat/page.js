"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { EcranChargement, EcranErreurProfil } from "@/components/ui/Screens";
import { useAppData } from "@/lib/useAppData";

const BUCKET = "dossiers-fichiers";
const MENTION = "Les échanges de ce tchat sont conservés et accessibles à l'administration.";

const nettoyerNom = (n) =>
  String(n || "fichier")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");

function heure(iso) {
  const d = new Date(iso);
  const auj = new Date();
  const memeJour = d.toDateString() === auj.toDateString();
  return memeJour
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const libelleRole = (p) => (p.fonction === "Responsable" ? "Responsable" : { qualite: "Qualité", ingenieur: "Ingénieur", admin: "Admin" }[p.role] || "");

export default function TchatPage() {
  const { profile, erreurProfil, loading, supabase } = useAppData();
  const estAdmin = profile?.role === "admin";
  const superviseur = estAdmin && profile?.fonction !== "Responsable";

  const [config, setConfig] = useState(null);
  const [migration, setMigration] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [membres, setMembres] = useState({}); // conv → [user_id]
  const [personnes, setPersonnes] = useState([]); // annuaire (ou toutes les personnes pour l'admin)
  const [nonLus, setNonLus] = useState({});
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("");
  const [recherche, setRecherche] = useState(null); // résultats de recherche dans les messages (admin)
  const [modal, setModal] = useState(null); // "prive" | "groupe" | "reglages" | "membres"
  const finRef = useRef(null);
  const fichierRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = active;

  const nomDe = useCallback((id) => personnes.find((p) => p.id === id)?.nom || (id === profile?.id ? profile?.nom_complet : "Administration"), [personnes, profile]);

  // ---------- chargement ----------
  const chargerListe = useCallback(async () => {
    const [{ data: cfg }, conv, mem, nl] = await Promise.all([
      supabase.from("parametres_config").select("*").limit(1).maybeSingle(),
      supabase.from("chat_conversations").select("*").order("dernier_message_at", { ascending: false }),
      supabase.from("chat_membres").select("conversation_id, user_id"),
      supabase.rpc("fn_chat_non_lus"),
    ]);
    if (conv.error) {
      setMigration(false);
      return;
    }
    setConfig(cfg);
    setConversations(conv.data || []);
    const m = {};
    for (const r of mem.data || []) (m[r.conversation_id] = m[r.conversation_id] || []).push(r.user_id);
    setMembres(m);
    setNonLus(Object.fromEntries((nl.data || []).map((r) => [r.conversation_id, Number(r.non_lus)])));
  }, [supabase]);

  const chargerPersonnes = useCallback(async () => {
    const { data } = await supabase.rpc(estAdmin ? "fn_chat_personnes_admin" : "fn_chat_annuaire");
    setPersonnes(data || []);
  }, [supabase, estAdmin]);

  useEffect(() => {
    if (!profile) return;
    chargerListe();
    chargerPersonnes();
    const t = setInterval(chargerListe, 20000);
    return () => clearInterval(t);
  }, [profile]);

  const chargerMessages = useCallback(
    async (convId) => {
      const { data } = await supabase.from("chat_messages").select("*").eq("conversation_id", convId).order("created_at").limit(2000);
      if (activeRef.current === convId) setMessages(data || []);
      if (!superviseur) {
        await supabase.rpc("fn_chat_marquer_lu", { p_conv: convId });
        setNonLus((n) => ({ ...n, [convId]: 0 }));
      }
    },
    [supabase, superviseur]
  );

  useEffect(() => {
    if (!active) return;
    setMessages([]);
    chargerMessages(active);
    const t = setInterval(() => chargerMessages(active), 15000);
    return () => clearInterval(t);
  }, [active]);

  // Temps réel : nouveaux messages
  useEffect(() => {
    if (!profile || !migration) return;
    const canal = supabase
      .channel("tchat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new;
        if (m.conversation_id === activeRef.current) {
          setMessages((liste) => (liste.some((x) => x.id === m.id) ? liste : [...liste, m]));
          if (!superviseur) supabase.rpc("fn_chat_marquer_lu", { p_conv: m.conversation_id });
        } else if (m.auteur_id !== profile.id) {
          setNonLus((n) => ({ ...n, [m.conversation_id]: (n[m.conversation_id] || 0) + 1 }));
        }
        setConversations((cs) => {
          const c = cs.find((x) => x.id === m.conversation_id);
          if (!c) {
            chargerListe();
            return cs;
          }
          return [{ ...c, dernier_message_at: m.created_at }, ...cs.filter((x) => x.id !== c.id)];
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [profile, migration]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active]);

  // ---------- libellés ----------
  const titre = useCallback(
    (c) => {
      if (!c) return "";
      if (c.type !== "prive") return c.nom || "Sans nom";
      const ids = membres[c.id] || [];
      const autres = superviseur ? ids : ids.filter((id) => id !== profile?.id);
      return autres.map(nomDe).join(superviseur ? " ↔ " : ", ") || "Conversation";
    },
    [membres, nomDe, profile, superviseur]
  );

  const filtrees = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    return conversations.filter((c) => !q || titre(c).toLowerCase().includes(q));
  }, [conversations, filtre, titre]);

  const groupes = [
    ["public", "Canaux", "list"],
    ["groupe", "Groupes", "users"],
    ["prive", "Messages privés", "message"],
  ];
  const convActive = conversations.find((c) => c.id === active);
  const peutEcrire =
    !superviseur &&
    profile?.chat_actif !== false &&
    convActive &&
    (convActive.type === "public" ? config?.chat_public_actif : config?.chat_prive_actif);

  // ---------- actions ----------
  async function envoyer(e) {
    e?.preventDefault();
    if (!texte.trim() || !active) return;
    setEnvoi(true);
    setErreur("");
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ conversation_id: active, auteur_id: profile.id, auteur_nom: profile.nom_complet || "Moi", contenu: texte.trim() })
      .select()
      .single();
    setEnvoi(false);
    if (error) return setErreur("Message non envoyé : " + error.message);
    setTexte("");
    setMessages((l) => (l.some((x) => x.id === data.id) ? l : [...l, data]));
  }

  async function envoyerFichier(f) {
    if (!f || !active) return;
    if (f.size > 50 * 1024 * 1024) return setErreur("Fichier trop lourd (50 Mo maximum).");
    setEnvoi(true);
    setErreur("");
    const chemin = `chat/${active}/${Date.now()}_${nettoyerNom(f.name)}`;
    const up = await supabase.storage.from(BUCKET).upload(chemin, f, { contentType: f.type || undefined });
    if (up.error) {
      setEnvoi(false);
      return setErreur("Envoi du fichier impossible : " + up.error.message);
    }
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ conversation_id: active, auteur_id: profile.id, auteur_nom: profile.nom_complet || "Moi", contenu: texte.trim() || null, fichier_chemin: chemin, fichier_nom: f.name })
      .select()
      .single();
    setEnvoi(false);
    if (error) return setErreur("Message non envoyé : " + error.message);
    setTexte("");
    setMessages((l) => [...l, data]);
  }

  async function ouvrirFichier(m) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(m.fichier_chemin, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function ouvrirPrive(userId) {
    const { data, error } = await supabase.rpc("fn_chat_ouvrir_prive", { p_autre: userId });
    if (error) return alert(error.message.includes("desactive") ? "Le tchat privé est désactivé." : error.message);
    setModal(null);
    await chargerListe();
    setActive(data);
  }

  async function rechercher(q) {
    if (!q.trim()) return setRecherche(null);
    const { data } = await supabase.from("chat_messages").select("*").ilike("contenu", `%${q.trim()}%`).order("created_at", { ascending: false }).limit(200);
    setRecherche(data || []);
  }

  // ---------- écrans ----------
  if (erreurProfil) return <EcranErreurProfil message={erreurProfil} />;
  if (loading || !profile) return <EcranChargement />;

  const coupe = profile.chat_actif === false && !estAdmin;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar role={profile.role} nom={profile.nom_complet || profile.ingenieur_ref} />
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-3 sm:px-4 lg:px-5 py-5 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <Icon name="message" size={22} className="text-brand-500" />
            Tchat
          </h1>
          {superviseur && <span className="badge badge-gold">Supervision — invisible, lecture seule</span>}
          <span className="ml-auto flex gap-2">
            {estAdmin && migration && (
              <button className="btn-secondary btn-sm" onClick={() => setModal("reglages")}>
                <Icon name="settings" size={14} />
                Réglages du tchat
              </button>
            )}
          </span>
        </div>

        {!migration ? (
          <div className="alert alert-gold">
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>Le tchat n'est pas encore installé : exécutez la migration V19 dans Supabase.</span>
          </div>
        ) : coupe ? (
          <div className="alert alert-red">
            <Icon name="lock" size={16} className="mt-0.5" />
            <span>Votre accès au tchat a été désactivé par l'administrateur.</span>
          </div>
        ) : (
          <div className="card flex-1 min-h-[560px] h-[calc(100vh-170px)] grid grid-cols-1 md:grid-cols-[300px_1fr] overflow-hidden">
            {/* Liste des conversations */}
            <aside className={`border-r border-line flex flex-col min-h-0 ${active ? "hidden md:flex" : "flex"}`}>
              <div className="p-3 border-b border-line flex flex-col gap-2">
                <div className="relative">
                  <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/35" />
                  <input className="input input-sm w-full pl-8" placeholder="Rechercher une conversation…" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
                </div>
                {!superviseur && (
                  <div className="flex gap-2">
                    {config?.chat_prive_actif && (
                      <button className="btn-primary btn-sm flex-1" onClick={() => setModal("prive")}>
                        <Icon name="plus" size={14} />
                        Message privé
                      </button>
                    )}
                    {config?.chat_prive_actif && (estAdmin || config?.chat_groupes_utilisateurs) && (
                      <button className="btn-secondary btn-sm flex-1" onClick={() => setModal("groupe")}>
                        <Icon name="users" size={14} />
                        Groupe
                      </button>
                    )}
                  </div>
                )}
                {superviseur && (
                  <button className="btn-secondary btn-sm" onClick={() => setModal("groupe")}>
                    <Icon name="plus" size={14} />
                    Nouveau canal / groupe
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {groupes.map(([type, label, icone]) => {
                  const liste = filtrees.filter((c) => c.type === type);
                  if (!liste.length) return null;
                  return (
                    <div key={type} className="py-2">
                      <p className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-ink/40 flex items-center gap-1.5">
                        <Icon name={icone} size={12} />
                        {label}
                      </p>
                      {liste.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setActive(c.id);
                            setRecherche(null);
                          }}
                          className={`w-full text-left px-4 py-2 flex items-center gap-2.5 text-sm transition-colors ${
                            active === c.id ? "bg-brand-50 text-brand-700 font-semibold" : "hover:bg-ink/[0.03]"
                          }`}
                        >
                          {c.type === "prive" ? (
                            <Avatar nom={titre(c)} taille={26} />
                          ) : (
                            <span className="w-[26px] h-[26px] rounded-lg bg-night/10 text-night flex items-center justify-center text-xs font-bold">#</span>
                          )}
                          <span className="flex-1 truncate">{titre(c)}</span>
                          {!!nonLus[c.id] && <span className="bg-isoRed text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center">{nonLus[c.id]}</span>}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {!filtrees.length && <p className="p-4 text-sm text-ink/50">Aucune conversation.</p>}
              </div>
              {config && (!config.chat_public_actif || !config.chat_prive_actif) && (
                <p className="px-4 py-2 text-[11px] text-ink/50 border-t border-line">
                  {!config.chat_public_actif && "Tchat public désactivé. "}
                  {!config.chat_prive_actif && "Tchat privé désactivé."}
                </p>
              )}
              {superviseur && (
                <div className="p-3 border-t border-line">
                  <input
                    className="input input-sm w-full"
                    placeholder="Chercher un mot dans tous les messages…"
                    onKeyDown={(e) => e.key === "Enter" && rechercher(e.currentTarget.value)}
                  />
                </div>
              )}
            </aside>

            {/* Conversation */}
            <section className={`flex flex-col min-h-0 ${active || recherche ? "flex" : "hidden md:flex"}`}>
              {recherche ? (
                <>
                  <div className="px-5 py-3 border-b border-line flex items-center gap-3">
                    <p className="font-semibold">Résultats de recherche ({recherche.length})</p>
                    <button className="btn-ghost btn-xs ml-auto" onClick={() => setRecherche(null)}>
                      Fermer
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-line">
                    {recherche.map((m) => {
                      const c = conversations.find((x) => x.id === m.conversation_id);
                      return (
                        <button
                          key={m.id}
                          className="w-full text-left px-5 py-3 hover:bg-ink/[0.03]"
                          onClick={() => {
                            setRecherche(null);
                            setActive(m.conversation_id);
                          }}
                        >
                          <p className="text-xs text-ink/50">
                            {titre(c)} · {m.auteur_nom} · {heure(m.created_at)}
                          </p>
                          <p className="text-sm">{m.contenu}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : !convActive ? (
                <div className="flex-1 flex flex-col items-center justify-center text-ink/45 gap-2 p-6 text-center">
                  <Icon name="message" size={36} />
                  <p>Choisissez une conversation.</p>
                  <p className="text-xs">{MENTION}</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-line flex items-center gap-3">
                    <button className="btn-icon md:hidden -ml-2" onClick={() => setActive(null)} aria-label="Retour">
                      <Icon name="chevronRight" size={18} className="rotate-180" />
                    </button>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{titre(convActive)}</p>
                      <p className="text-xs text-ink/50 truncate">
                        {convActive.type === "public"
                          ? "Canal public — tout le monde"
                          : `${(membres[convActive.id] || []).length} membre(s) : ${(membres[convActive.id] || []).map(nomDe).join(", ")}`}
                      </p>
                    </div>
                    {estAdmin && convActive.type !== "prive" && (
                      <button className="btn-secondary btn-xs ml-auto" onClick={() => setModal("membres")}>
                        <Icon name="users" size={13} />
                        Gérer
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2 bg-[#F7F8FA]">
                    {messages.map((m, i) => {
                      const moi = m.auteur_id === profile.id;
                      const suite = i > 0 && messages[i - 1].auteur_id === m.auteur_id && new Date(m.created_at) - new Date(messages[i - 1].created_at) < 5 * 60000;
                      return (
                        <div key={m.id} className={`flex gap-2 ${moi ? "flex-row-reverse" : ""}`}>
                          <div className="w-7 shrink-0">{!moi && !suite && <Avatar nom={m.auteur_nom} taille={28} />}</div>
                          <div className={`max-w-[70%] flex flex-col ${moi ? "items-end" : "items-start"}`}>
                            {!suite && (
                              <span className="text-[11px] text-ink/45 mb-0.5">
                                {moi ? "Vous" : m.auteur_nom} · {heure(m.created_at)}
                              </span>
                            )}
                            <div className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${moi ? "bg-brand-500 text-white rounded-tr-sm" : "bg-white border border-line rounded-tl-sm"}`}>
                              {m.contenu}
                              {m.fichier_chemin && (
                                <button onClick={() => ouvrirFichier(m)} className={`flex items-center gap-1.5 mt-1 underline text-xs ${moi ? "text-white" : "text-brand-600"}`}>
                                  <Icon name="file" size={13} />
                                  {m.fichier_nom || "Fichier"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!messages.length && <p className="text-center text-sm text-ink/45 py-10">Aucun message pour l'instant.</p>}
                    <div ref={finRef} />
                  </div>

                  {peutEcrire ? (
                    <form onSubmit={envoyer} className="border-t border-line p-3 flex items-end gap-2">
                      <button type="button" className="btn-icon" title="Joindre un fichier" onClick={() => fichierRef.current?.click()} disabled={envoi}>
                        <Icon name="upload" size={17} />
                      </button>
                      <input
                        ref={fichierRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          envoyerFichier(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      <textarea
                        className="input flex-1 resize-none min-h-[42px] max-h-40"
                        rows={1}
                        placeholder="Écrire un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
                        value={texte}
                        onChange={(e) => setTexte(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            envoyer();
                          }
                        }}
                      />
                      <button type="submit" className="btn-primary" disabled={envoi || !texte.trim()}>
                        <Icon name="send" size={15} />
                        Envoyer
                      </button>
                    </form>
                  ) : (
                    <p className="border-t border-line p-3 text-sm text-ink/50 text-center">
                      {superviseur ? "Mode supervision : lecture seule." : "L'envoi de messages est désactivé pour cette conversation."}
                    </p>
                  )}
                  {erreur && <p className="px-4 pb-2 text-xs text-isoRed-dark">{erreur}</p>}
                  <p className="px-4 pb-2 text-[11px] text-ink/40">{MENTION} Les messages envoyés ne peuvent pas être supprimés.</p>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      {modal === "prive" && (
        <ChoixPersonne
          titre="Nouveau message privé"
          personnes={personnes.filter((p) => p.id !== profile.id && (estAdmin ? p.chat_actif !== false && !(p.role === "admin" && p.fonction !== "Responsable") : true))}
          onChoisir={ouvrirPrive}
          onFermer={() => setModal(null)}
        />
      )}
      {modal === "groupe" && (
        <NouveauGroupe
          supabase={supabase}
          estAdmin={estAdmin}
          personnes={personnes.filter((p) => p.id !== profile.id && !(p.role === "admin" && p.fonction !== "Responsable"))}
          onFermer={() => setModal(null)}
          onCree={async (id) => {
            setModal(null);
            await chargerListe();
            setActive(id);
          }}
        />
      )}
      {modal === "membres" && convActive && (
        <GererMembres
          supabase={supabase}
          conv={convActive}
          membres={membres[convActive.id] || []}
          personnes={personnes.filter((p) => !(p.role === "admin" && p.fonction !== "Responsable"))}
          onFermer={() => setModal(null)}
          onMaj={chargerListe}
        />
      )}
      {modal === "reglages" && (
        <Reglages
          supabase={supabase}
          config={config}
          personnes={personnes}
          moi={profile.id}
          onFermer={() => setModal(null)}
          onMaj={async () => {
            await chargerListe();
            await chargerPersonnes();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ fenêtres */

function ChoixPersonne({ titre, personnes, onChoisir, onFermer }) {
  const [q, setQ] = useState("");
  const liste = personnes.filter((p) => p.nom.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal titre={titre} onFermer={onFermer}>
      <input autoFocus className="input w-full mb-3" placeholder="Rechercher une personne…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-[50vh] overflow-y-auto divide-y divide-line">
        {liste.map((p) => (
          <button key={p.id} onClick={() => onChoisir(p.id)} className="w-full text-left px-2 py-2.5 flex items-center gap-3 hover:bg-ink/[0.03]">
            <Avatar nom={p.nom} taille={28} />
            <span className="flex-1">{p.nom}</span>
            <span className="text-xs text-ink/45">{libelleRole(p)}</span>
          </button>
        ))}
        {!liste.length && <p className="text-sm text-ink/50 p-3">Personne trouvée.</p>}
      </div>
    </Modal>
  );
}

function NouveauGroupe({ supabase, estAdmin, personnes, onFermer, onCree }) {
  const [type, setType] = useState("groupe");
  const [nom, setNom] = useState("");
  const [choisis, setChoisis] = useState([]);
  const [err, setErr] = useState("");
  async function creer() {
    setErr("");
    const { data, error } = await supabase.rpc("fn_chat_creer", { p_type: type, p_nom: nom, p_membres: type === "groupe" ? choisis : [] });
    if (error) return setErr(error.message.includes("non_autorise") ? "Vous n'avez pas le droit de créer ce type de conversation." : error.message);
    onCree(data);
  }
  return (
    <Modal titre="Nouvelle conversation de groupe" onFermer={onFermer}>
      <div className="flex flex-col gap-3">
        {estAdmin && (
          <div className="segmented">
            <button data-active={type === "groupe"} onClick={() => setType("groupe")}>
              Groupe privé
            </button>
            <button data-active={type === "public"} onClick={() => setType("public")}>
              Canal public
            </button>
          </div>
        )}
        <input className="input" placeholder={type === "public" ? "Nom du canal (ex. Annonces)" : "Nom du groupe (ex. Équipe 174)"} value={nom} onChange={(e) => setNom(e.target.value)} />
        {type === "groupe" ? (
          <div className="max-h-[40vh] overflow-y-auto border border-line rounded-lg divide-y divide-line">
            {personnes.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={choisis.includes(p.id)} onChange={(e) => setChoisis((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))} />
                <Avatar nom={p.nom} taille={22} />
                <span className="flex-1">{p.nom}</span>
                <span className="text-xs text-ink/45">{libelleRole(p)}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink/55">Un canal public est visible par tout le monde.</p>
        )}
        {err && <p className="text-sm text-isoRed-dark">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn-primary" onClick={creer} disabled={!nom.trim() || (type === "groupe" && !choisis.length)}>
            Créer
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GererMembres({ supabase, conv, membres, personnes, onFermer, onMaj }) {
  const [nom, setNom] = useState(conv.nom || "");
  const [liste, setListe] = useState(membres);
  async function action(a, user) {
    const { error } = await supabase.rpc("fn_chat_gerer", { p_conv: conv.id, p_action: a, p_user: user || null, p_nom: a === "renommer" ? nom : null });
    if (error) return alert(error.message);
    if (a === "ajouter") setListe((l) => [...l, user]);
    if (a === "retirer") setListe((l) => l.filter((x) => x !== user));
    onMaj();
  }
  return (
    <Modal titre={`Gérer « ${conv.nom} »`} onFermer={onFermer}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input className="input flex-1" value={nom} onChange={(e) => setNom(e.target.value)} />
          <button className="btn-secondary" onClick={() => action("renommer")} disabled={!nom.trim()}>
            Renommer
          </button>
        </div>
        {conv.type === "groupe" ? (
          <div className="max-h-[45vh] overflow-y-auto border border-line rounded-lg divide-y divide-line">
            {personnes.map((p) => {
              const dedans = liste.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Avatar nom={p.nom} taille={22} />
                  <span className="flex-1">{p.nom}</span>
                  <button className={dedans ? "btn-danger btn-xs" : "btn-secondary btn-xs"} onClick={() => action(dedans ? "retirer" : "ajouter", p.id)}>
                    {dedans ? "Retirer" : "Ajouter"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-ink/55">Canal public : tout le monde y a accès.</p>
        )}
      </div>
    </Modal>
  );
}

function Reglages({ supabase, config, personnes, moi, onFermer, onMaj }) {
  const [cfg, setCfg] = useState({
    chat_public_actif: config?.chat_public_actif ?? true,
    chat_prive_actif: config?.chat_prive_actif ?? true,
    chat_groupes_utilisateurs: config?.chat_groupes_utilisateurs ?? false,
  });
  const [msg, setMsg] = useState("");
  async function basculer(cle) {
    const v = !cfg[cle];
    setCfg((c) => ({ ...c, [cle]: v }));
    const { error } = await supabase.from("parametres_config").update({ [cle]: v }).eq("id", config.id);
    setMsg(error ? "Erreur : " + error.message : "Enregistré ✓");
    onMaj();
  }
  async function personne(p) {
    const { error } = await supabase.rpc("fn_chat_personne", { p_user: p.id, p_actif: !p.chat_actif });
    if (error) return alert(error.message);
    onMaj();
  }
  const interrupteur = (cle, label, aide) => (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" className="mt-1" checked={!!cfg[cle]} onChange={() => basculer(cle)} />
      <span>
        <span className="font-semibold text-sm">{label}</span>
        <span className="block text-xs text-ink/55">{aide}</span>
      </span>
    </label>
  );
  return (
    <Modal titre="Réglages du tchat" onFermer={onFermer} taille="lg">
      <div className="flex flex-col gap-4">
        <div className="divide-y divide-line">
          {interrupteur("chat_public_actif", "Tchat public", "Canaux visibles par tout le monde (ex. Général).")}
          {interrupteur("chat_prive_actif", "Tchat privé", "Messages en tête-à-tête et groupes privés.")}
          {interrupteur("chat_groupes_utilisateurs", "Les utilisateurs peuvent créer des groupes", "Sinon, seuls l'admin et les Responsables créent des groupes et des canaux.")}
        </div>
        {msg && <p className="text-xs text-ink/55">{msg}</p>}
        <div>
          <p className="font-semibold text-sm mb-2">Accès au tchat par personne</p>
          <div className="max-h-[40vh] overflow-y-auto border border-line rounded-lg divide-y divide-line">
            {personnes
              .filter((p) => p.id !== moi)
              .map((p) => (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${p.chat_actif ? "" : "opacity-60"}`}>
                  <Avatar nom={p.nom} taille={22} />
                  <span className="flex-1">{p.nom}</span>
                  <span className="text-xs text-ink/45 w-24">{libelleRole(p)}</span>
                  {p.chat_actif ? <span className="badge badge-green">Actif</span> : <span className="badge badge-red">Coupé</span>}
                  <button className="btn-secondary btn-xs w-20" onClick={() => personne(p)}>
                    {p.chat_actif ? "Couper" : "Rétablir"}
                  </button>
                </div>
              ))}
          </div>
        </div>
        <p className="text-xs text-ink/50">
          L'admin n'apparaît pas dans l'annuaire du tchat et lit toutes les conversations en lecture seule. Les participants voient la mention : « {MENTION} »
        </p>
      </div>
    </Modal>
  );
}
