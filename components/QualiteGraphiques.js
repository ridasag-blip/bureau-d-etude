"use client";
import Icon from "@/components/ui/Icon";

const auj = () => new Date().toLocaleDateString("sv-SE");

function Barres({ lignes, vide }) {
  if (!lignes.length) return <p className="px-4 pb-4 text-sm text-ink/45">{vide}</p>;
  const max = Math.max(1, ...lignes.map((l) => l[1]));
  return (
    <div className="pb-3">
      {lignes.map(([lib, n], i) => (
        <div key={lib} className="grid grid-cols-[minmax(0,140px)_1fr_36px] gap-2 items-center px-4 py-1.5 text-sm">
          <span className="truncate capitalize" title={lib}>{lib}</span>
          <span className="block h-3 rounded-r" style={{ width: `${(n / max) * 100}%`, background: i === 0 ? "#1F6FA8" : "#7FB0D9" }} />
          <b className="text-right font-medium tabular">{n}</b>
        </div>
      ))}
    </div>
  );
}

/**
 * Colonne de droite de la page Qualité quand aucun dossier n'est ouvert :
 * envois au contrôle du jour par heure, causes de retour du mois, contrôles par contrôleur aujourd'hui.
 */
export default function QualiteGraphiques({ dossiers, verifications, moi = "", seulementMoi = false }) {
  const jour = auj();
  const mois = jour.slice(0, 7);

  // Envois au contrôle aujourd'hui, par heure (8 h → 18 h)
  const heures = Array.from({ length: 11 }, (_, i) => 8 + i);
  const parHeure = Object.fromEntries(heures.map((h) => [h, 0]));
  for (const d of dossiers) {
    if (!d.date_soumission) continue;
    const dt = new Date(d.date_soumission);
    if (dt.toLocaleDateString("sv-SE") !== jour) continue;
    const h = Math.min(18, Math.max(8, dt.getHours()));
    parHeure[h] += 1;
  }
  const valeurs = heures.map((h) => parHeure[h]);
  const max = Math.max(1, ...valeurs);
  const pic = valeurs.indexOf(Math.max(...valeurs));
  const total = valeurs.reduce((a, b) => a + b, 0);

  // Causes de retour du mois
  const causes = {};
  for (const d of dossiers) {
    if (String(d.date || "").slice(0, 7) !== mois) continue;
    if (d.retour_interne && d.cause_retour_interne) causes[d.cause_retour_interne] = (causes[d.cause_retour_interne] || 0) + 1;
    if (d.retour_client && d.cause_retour_client) causes[d.cause_retour_client] = (causes[d.cause_retour_client] || 0) + 1;
  }
  const topCauses = Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Contrôles faits aujourd'hui, par contrôleur
  const ctrl = {};
  // Contrôles par contrôleur : « audités » = dossiers validés, « vérifications » = chaque contrôle
  // (y compris ceux qui finissent en retour interne). Un même dossier vérifié deux fois compte deux fois.
  const cle = (n) => String(n || "").trim().toLowerCase();
  const liste = verifications || dossiers.filter((d) => d.date_verification).map((d) => ({ date: d.date_verification, par: d.valide_par, audit: true }));
  const parPersonne = {}; // { nom: { jour: {a, v}, mois: {a, v} } }
  for (const v of liste) {
    if (!v.par || !v.date) continue;
    const j = new Date(v.date).toLocaleDateString("sv-SE");
    const k = cle(v.par);
    const p = (parPersonne[k] = parPersonne[k] || { nom: v.par, jour: { a: 0, v: 0 }, mois: { a: 0, v: 0 } });
    for (const [periode, ok] of [["jour", j === jour], ["mois", j.slice(0, 7) === mois]]) {
      if (!ok) continue;
      p[periode].v += 1;
      if (v.audit) p[periode].a += 1;
    }
  }
  const mes = parPersonne[cle(moi)] || { jour: { a: 0, v: 0 }, mois: { a: 0, v: 0 } };
  const equipe = Object.values(parPersonne).filter((p) => p.jour.v > 0).sort((x, y) => y.jour.v - x.jour.v);

  return (
    <div className="flex flex-col gap-4 xl:sticky xl:top-[84px]">
      <p className="text-sm text-ink/55 flex items-center gap-2 px-1">
        <Icon name="shield" size={15} className="text-brand-500" />
        Ouvre un dossier de la liste pour le contrôler : ses pièces, les échanges et la décision s'affichent ici.
      </p>
      <section className="card">
        <h3 className="text-[15px] font-semibold px-4 pt-4 flex justify-between items-baseline">
          Envois au contrôle aujourd'hui <span className="text-xs font-normal text-ink/45">par heure</span>
        </h3>
        <svg viewBox="0 0 330 140" width="100%" role="img" aria-label="Dossiers envoyés au contrôle aujourd'hui, par heure">
          <line x1="8" x2="322" y1="112" y2="112" stroke="#D9E3EC" />
          {valeurs.map((v, i) => {
            const x = 14 + i * 28.5;
            const h = (v / max) * 82;
            const fort = total > 0 && i === pic;
            return (
              <g key={i}>
                <rect x={x} y={112 - Math.max(h, v ? 3 : 0)} width="18" height={Math.max(h, v ? 3 : 0)} rx="3" fill={fort ? "#1F6FA8" : "#A9C8E2"}>
                  <title>{`${heures[i]} h : ${v}`}</title>
                </rect>
                {i % 2 === 0 && (
                  <text x={x + 9} y="128" textAnchor="middle" fontSize="11" fill="#6B7F92">
                    {heures[i]}h
                  </text>
                )}
                {fort && (
                  <text x={x + 9} y={106 - h} textAnchor="middle" fontSize="12" fontWeight="600" fill="#17324A">
                    {v}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="text-xs text-ink/50 px-4 pb-4">
          {total ? `${total} envoi(s) aujourd'hui, pic à ${heures[pic]} h.` : "Aucun envoi au contrôle pour l'instant aujourd'hui."}
        </p>
      </section>
      <section className="card">
        <h3 className="text-[15px] font-semibold px-4 pt-4 pb-2 flex justify-between items-baseline">
          Causes de retour <span className="text-xs font-normal text-ink/45">ce mois</span>
        </h3>
        <Barres lignes={topCauses} vide="Aucun retour ce mois-ci." />
      </section>
      {seulementMoi ? (
        <section className="card">
          <h3 className="text-[15px] font-semibold px-4 pt-4 pb-1 flex justify-between items-baseline">
            Mes contrôles <span className="text-xs font-normal text-ink/45 capitalize">{moi}</span>
          </h3>
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-xs text-ink/50">
                <th className="text-left font-medium px-4 py-2" />
                <th className="text-right font-medium px-2 py-2">Dossiers audités</th>
                <th className="text-right font-medium px-4 py-2">Vérifications</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Aujourd'hui", mes.jour],
                ["Ce mois", mes.mois],
              ].map(([l, c]) => (
                <tr key={l} className="border-t border-line">
                  <td className="px-4 py-2.5 text-ink/70">{l}</td>
                  <td className="px-2 py-2.5 text-right">
                    <b className="font-display chiffre text-[22px] text-isoGreen-dark">{c.a}</b>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <b className="font-display chiffre text-[22px] text-brand-600">{c.v}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 pb-4 text-xs text-ink/50">Vérifications : chaque contrôle compte, y compris ceux qui finissent en retour interne, et un dossier revenu puis revérifié compte à chaque fois.</p>
        </section>
      ) : (
        <section className="card">
          <h3 className="text-[15px] font-semibold px-4 pt-4 pb-1 flex justify-between items-baseline">
            Contrôleurs <span className="text-xs font-normal text-ink/45">aujourd'hui</span>
          </h3>
          {equipe.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink/45">Aucun contrôle aujourd'hui.</p>
          ) : (
            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="text-xs text-ink/50">
                  <th className="text-left font-medium px-4 py-2">Contrôleur</th>
                  <th className="text-right font-medium px-2 py-2">Audités</th>
                  <th className="text-right font-medium px-4 py-2">Vérifications</th>
                </tr>
              </thead>
              <tbody>
                {equipe.map((p) => (
                  <tr key={p.nom} className="border-t border-line">
                    <td className="px-4 py-2 capitalize">{p.nom}</td>
                    <td className="px-2 py-2 text-right tabular font-semibold text-isoGreen-dark">{p.jour.a}</td>
                    <td className="px-4 py-2 text-right tabular font-semibold text-brand-600">{p.jour.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
