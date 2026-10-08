# Hill Solution — Qualité Bureau d'Études

App web remplaçant le classeur `QUALITE_suivi_prod.xlsx`. Stack : **Next.js 14 + Supabase + Vercel**, identité visuelle alignée sur le logo Hill Solution (bleu `#1F6FA8` / vert `#4E9F3D`).

## Version 3.13 — rapport qualité, dossiers par agent, comptes personnels

**Migrations à exécuter (Supabase → SQL Editor → Run), dans l'ordre :** `migration_workflow_v17.sql` puis
`migration_workflow_v18.sql` (et V11 à V16 si elles n'ont pas encore été passées).

- **Tableau de bord → onglet « Rapport qualité »** : même présentation que le rapport PDF mensuel (en-tête, méthodologie,
  par opération : indicateurs clés, détail par ingénieur avec une colonne par cause, classement coloré, Pareto).
  Période = date de production (un mois ou dates libres) ; seuls les dossiers audités comptent ; un dossier de
  modification compte pour l'ingénieur de modif ; le taux moyen simple exclut les ingénieurs sous le minimum de dossiers.
  En choisissant un ingénieur : détail par opération comparé à l'équipe, son Pareto et la liste de ses dossiers.
  Boutons **Excel** et **Imprimer / PDF**.
- **Vue d'ensemble → « Dossiers par agent »** : choisir un agent pour voir tous ses dossiers (statut, retours, audité par), avec export.
- **Paramètres → Config SLA** : seuils de la grille (10 / 30 / 50 %), minimum de dossiers, « Rédigé par » et « Diffusion ».
  Les colonnes de causes = la liste « Causes de retour interne ».
- **Paramètres → Comptes** : « Générer les comptes » crée un compte par ingénieur + 4 Qualité + 2 Responsable (nombres
  modifiables), avec identifiants et mots de passe générés, modifiables avant validation, puis téléchargés en Excel.
  Les mots de passe restent consultables (œil) par l'admin, export / import Excel, bouton « Renommer ».
  Responsable = mêmes droits que l'admin. Un ingénieur avec son compte arrive directement sur ses dossiers, sans PIN
  (le compte partagé + PIN fonctionne toujours).
  ⚠️ Nécessite `SUPABASE_SERVICE_ROLE_KEY` = clé **service_role** dans Vercel.

## Version 3.12 — la feuille Production s'importe telle quelle

**À faire une fois :** Supabase → SQL Editor → exécuter `supabase/migration_workflow_v16.sql`, puis `notify pgrst, 'reload schema';`
(la V15 n'est plus nécessaire pour l'import).

- **Lecture** : ligne d'entête trouvée automatiquement (titres de groupe au-dessus, colonnes vides acceptées) ;
  intitulés « Nom de l'opération », « Cause de retour interne / client », « Date retour client », « Date nouvelle modification ».
- **Fiches abrégées** : « 174 » ou « TH-174 » → BAR-TH-174.
- **Noms** : une seule orthographe par personne pour Ingénieur / Ingénieur de modif / Validé par
  (majuscules ignorées, une lettre d'écart rapprochée : « mariem nechi » → Meriem Nechi) ; nouveaux noms mis en forme.
- **Service qualité** : les nouveaux noms « Validé par » sont cochés (membres actifs) ; décocher ceux qui ne font pas partie
  de la qualité (enregistrés désactivés). « Autre » est désactivé d'office.
- **Causes de retour** absentes : ajoutées à la liste (interne / client).
- **Date de modification** (nouveau champ) et **Date retour client** : reprises du fichier, modifiables, exportées.
- **« Modif n/N »** : un même dossier modifié plusieurs fois (une ligne par modification) est repéré dans Saisie et Qualité.

## Version 3.11 — import de la production (dossiers déjà traités)

**À faire une fois :** Supabase → SQL Editor → exécuter `supabase/migration_workflow_v15.sql`, puis `notify pgrst, 'reload schema';`.

- **Import** : choix de l'onglet (« Production » par défaut s'il existe) et du type :
  « À traiter » (file d'attente, ou assigné à l'ingénieur du fichier) ou « Déjà traités (production) ».
- **Production** : reprend Statut / État (Audité, En cours, À contrôler, Retour interne / client / qualité, En pause, Annulé…),
  Ingénieur, Ingénieur de modif, Retour interne + cause, Retour client + cause, Validé par, date de vérification.
  Statut vide → Audité. Ingénieur ou « Validé par » vide → « Autre » (à corriger ensuite).
- **Listes** : les ingénieurs et les noms « Validé par » absents sont ajoutés automatiquement (Ingénieurs / Service qualité),
  sans doublon de majuscules ou d'accents.
- **Ingénieur de modif** : modifiable dans « Modifier les informations », affiché sous l'ingénieur, exporté.

## Version 3.10 — listes et statuts modifiables, filtre date dans Saisie

**À faire une fois :** Supabase → SQL Editor → exécuter `supabase/migration_workflow_v14.sql`, puis `notify pgrst, 'reload schema';`.

- **Listes déroulantes** : ajout / désactivation / réactivation / **suppression** passent par une fonction de la base
  (`fn_parametre_liste`) qui contrôle le rôle — plus de blocage silencieux. Une valeur utilisée par des dossiers
  ne se supprime pas (message) : la désactiver.
- **Statuts** : on peut ajouter des statuts (servent à « Mettre de côté » dans Qualité, tuile dédiée) et les supprimer ;
  les statuts du circuit restent fixes (renommables, couleur modifiable).
- **Saisie** : filtre Date (Tout, Aujourd'hui, Un jour, Un mois) sur les deux tableaux.

## Version 3.9 — suppression fiable, filtres façon Excel, import tolérant

**À faire une fois :** Supabase → SQL Editor → exécuter `supabase/migration_workflow_v13.sql`, puis `notify pgrst, 'reload schema';`.

- **Données** (admin) : la suppression passe par une fonction de la base (plus besoin de la clé service_role).
- **Comptes / purge** : si la variable Vercel `SUPABASE_SERVICE_ROLE_KEY` n'est pas la clé « service_role », l'app l'indique clairement.
- **Paramètres** : un ajout ou une désactivation dans les listes s'applique tout de suite partout ; bouton « Réactiver ».
- **Qualité** : statuts en tuiles avec leur nombre, carte Opération / Date / Recherche, bouton « Réinitialiser les filtres ».
- **Saisie** : filtres façon Excel dans les en-têtes Statut, Ingénieur, Fiche (et Fiche de la file d'attente).
- **Import** : les lignes incomplètes sont importées quand même (badge « À compléter ») ; la fiche CEE peut être vide
  (le dossier n'est distribué qu'une fois la fiche renseignée).
- **Connexion** : logo en haut du panneau, au-dessus des montagnes.

## Version 3.8 — équipes clients, comptes Qualité nominatifs, 3 types de retour

**À faire une fois :** Supabase → SQL Editor → exécuter `supabase/migration_workflow_v12.sql`, puis `notify pgrst, 'reload schema';`.
Ensuite, dans Paramètres → Comptes, créer **un compte par personne du service Qualité** (rôle Qualité).

- **Équipes clients** (Paramètres) : les dossiers d'un client qui a une équipe ne vont qu'à ses ingénieurs
  (Auto et « Terminé → suivant ») et attendent dans la file sinon. Sans équipe, rien ne change.
- **Saisie** : bouton « Ingénieurs » (libres / occupés, dossier en cours, à faire, retours) ; titre « File d'attente ».
- **Qualité** : filtre Date (Tout, Aujourd'hui, Jour, Mois) ; filtres « Annulé » et « En pause » ;
  « Mettre de côté » = En pause ou Annuler. Retours : **Retour interne** (pendant la vérification),
  **Retour qualité** (erreur découverte chez le client), **Retour modif client** — affichés comme statut.
- **Comptes** : Admin et Qualité ont chacun leur identifiant + mot de passe (plus de code PIN) ; les ingénieurs gardent
  le compte partagé + PIN. Le service Qualité accède à Paramètres sans Comptes, Journal d'audit, Sauvegardes, Données,
  ni les listes Ingénieurs / Clients / Service qualité (ex-« Validateurs »).
- **Statuts** : la liste « États » quitte les listes déroulantes ; l'onglet Statuts permet de renommer et colorer.
- **Données** (admin) : suppression de tous les dossiers ou des dossiers avant une date, avec sauvegarde automatique avant.

## Version 3.7 — retours typés, filtre par opération, coordonnées complétées par l'ingénieur

**À faire une fois :** Supabase → SQL Editor → exécuter `supabase/migration_workflow_v11.sql`, puis `notify pgrst, 'reload schema';`.

- **Ingénieur** : « Dossiers en retour » (avec Retour interne / Retour client) puis « À faire » ; l'ingénieur peut
  compléter les coordonnées du bénéficiaire de son dossier en cours.
- **Nouveau champ « Responsable »** (personne à contacter) : saisie, modification, import/export Excel.
- **Qualité** : 2ᵉ rangée de filtres par opération (combinable avec le statut) ; « Insérer » retiré de la ligne
  (dépôt via « Traiter ») ; chaque dossier en retour affiche « Retour interne » ou « Retour client ».

## Version 3.6 — Bleu nuit, filtres Qualité, fichiers sur la ligne

Aucun script SQL nouveau (la V10 doit être passée).

- **Barre du haut** : Bleu nuit (#0F2742), logo sur fond blanc ; marges réduites, tableaux plus larges.
- **Libellés** : « Assigné » → « À faire », « Validé » → « Audité », « En cours de vérification » → « En vérification Q ».
- **Qualité** : filtres En file · En production · À contrôler · En vérification Q · Retour · Audité · Annulé / Suspendu.
  Bouton **« Je contrôle »** (le dossier passe en vérification à ton nom ; « Remettre à contrôler » pour le libérer).
  Un dossier renvoyé pour correction apparaît uniquement dans « Retour ». Bouton **Exporter** (Excel, tous les dossiers).
- **Colonne Fichiers** (Qualité et les deux tableaux de Saisie) : Insérer, ⬇ N pour tout télécharger,
  pastille verte = livrable déposé par l'ingénieur. Sans ouvrir le dossier.
- **Saisie** : le 2ᵉ tableau s'appelle « Dossiers en cours ».

## Version 3.5 — Qualité en un tableau, couleurs des statuts, pièces jointes

**À faire une fois :** Supabase → SQL Editor → exécuter `supabase/migration_workflow_v10.sql`, puis `notify pgrst, 'reload schema';`.
Pour la purge automatique, la variable `SUPABASE_SERVICE_ROLE_KEY` doit exister dans Vercel (option : `CRON_SECRET`).

- **Qualité** : un seul tableau, du dossier le plus récent au plus ancien, statut sur chaque ligne,
  pastilles de filtre par statut (avec compteur). « Traiter » ouvre les actions sous la ligne.
- **Couleurs des statuts** : Paramètres → Statuts. La couleur choisie s'applique partout.
- **Pièces jointes** : la Qualité dépose une ou plusieurs pièces sur un dossier (Saisie et Qualité) ;
  l'ingénieur les télécharge depuis son dossier en cours et dépose son livrable (facultatif, versions v1, v2…).
  50 Mo max par fichier. Stockage privé Supabase (bucket `dossiers-fichiers`).
- **Conservation** : les fichiers des dossiers validés ou annulés sont supprimés après 90 jours
  (réglable dans Paramètres → Config SLA, bouton « Purger maintenant »). Purge automatique chaque nuit (`vercel.json`).

## Version 3.4 — file d'attente et attribution automatique

- **Saisie** = 2 tableaux : la **file d'attente** (dossiers non attribués : Auto / Assigner, Importer Excel, Exporter)
  et **tous les autres dossiers** (statut en fin de ligne, recherche). Objectif du jour conservé.
- **Ingénieur** : « Terminé → suivant » envoie au contrôle et donne automatiquement le dossier suivant ;
  « Terminé, je m'arrête » envoie au contrôle sans en prendre un nouveau (pause, fin de journée).
- **Attribution automatique** (Saisie et Qualité) : à l'ingénieur habilité le plus disponible — libre d'abord,
  puis le moins de dossiers en attente, puis le moins de dossiers du jour.
- **Import Excel** : alimente uniquement la file. **Export** de la file au même format (réimportable).

## Version 3.2

- **Import de dossiers** (page Saisie → « Importer un fichier ») : Excel ou CSV, modèle téléchargeable, aperçu
  ligne par ligne avant enregistrement. Colonne « Ingénieur » vide → dossier dans la file (dispatch automatique) ;
  remplie → assigné à cet ingénieur (dispatch manuel).
- **Modification d'un dossier** (Admin / Qualité) : clic sur une ligne dans Saisie → « Modifier les informations »
  (dossier + bénéficiaire : nom/raison sociale, SIRET, adresse, e-mail, téléphone).
- Supprimés : point du matin, page Bénéficiaires, import de la page Export (remplacé par celui de Saisie).

## Version 3.1 — navigation

- **Saisie** est la page d'accueil (Admin/Qualité), avec le **point du matin** en haut.
- **Statistiques** devient l'onglet « Statistiques agents » du **Dashboard** (l'ancienne adresse redirige).
- Menu : Saisie · Qualité · Dashboard · Export · Erreurs · Bénéficiaires · Paramètres.
- Une seule horloge, dans l'en-tête de chaque page. Connexion : grand logo seul.
- Menu du nom (admin) : accès direct à **Paramètres** et **Vue ingénieur** (aperçu de l'écran d'un ingénieur, sans code).

## Version 3 — file de travail, bénéficiaires, bibliothèque des erreurs

**À faire une fois, AVANT de déployer ce code** : Supabase → SQL Editor → coller
`supabase/migration_workflow_v9.sql` → Run. Le script est additif (aucune donnée supprimée).

Ce qui change :
- **Circuit simplifié** : Dans la file → Assigné → En cours → À contrôler → Validé (+ « En attente d'info »).
  Les étapes « Accepter » et « Prendre en charge » disparaissent. Les libellés existants en base sont conservés
  (« Encours », « Audité »…), seul l'affichage change.
- **File commune** : la Qualité crée les dossiers dans la file (ou les assigne à la main). L'ingénieur clique
  « Prendre le suivant » : ses retours d'abord, puis ses dossiers assignés, puis la file de ses fiches habilitées
  (prioritaires puis plus anciens). **Un seul dossier en cours à la fois.** Attribution atomique côté base
  (`fn_prendre_suivant`) : deux ingénieurs ne peuvent jamais obtenir le même dossier.
- **Habilitations** ingénieur × fiche CEE : Paramètres → Habilitations (au départ, tout le monde est habilité partout).
- **Fiche bénéficiaire** sur chaque dossier : nom / raison sociale, SIRET (optionnel, clé vérifiée), adresse,
  e-mail, téléphone. Alerte doublon si une adresse très proche existe déjà sur la même fiche CEE.
- **Retours détaillés** (table `dossier_retours`) : un enregistrement par retour, avec cause et remarque.
  Les statistiques comptent chaque retour, et la productivité ne compte que les dossiers validés.
- **Bibliothèque des erreurs** (page « Erreurs », tous les rôles) + rappel des 3 erreurs fréquentes de la fiche
  sur la carte du dossier en cours de l'ingénieur.
- **Point du matin** en haut du tableau de bord.
- **Page Bénéficiaires** (admin uniquement) : remplace la page Rapport (PDF supprimé). Regroupement automatique par
  SIRET / téléphone / e-mail, fusion ou séparation manuelle, export Excel.
- « Annuler » retire aussi l'événement de l'historique ; « Mettre de côté » (suspendu, pause, annulé) exige un motif.

## Refonte graphique (v2)

- **Design system unique** : couleurs, boutons, champs, tableaux, badges définis une seule fois (`tailwind.config.js` + `app/globals.css`).
- **Référentiel unique des états et événements** (`lib/constants.js` → `ETATS`, `EVENEMENTS`) : un même statut a la même couleur et le même libellé sur toutes les pages.
- **Composants partagés** dans `components/ui/` : icônes, badge de statut, fenêtre modale, en-tête de page, avatar, bandeau « Annuler », écrans de chargement.
- **Logo recadré** (`public/logo-hillsolution-h.png`) + favicon (`public/icon.png`).
- Corrections : logo cassé sur l'écran de connexion (middleware), perte de focus du champ commentaire (Mes dossiers), objectifs du jour qui ne s'affichaient pas à l'ouverture, dossiers « pas encore acceptés » listés comme traités.

## 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → New Project.
2. Une fois créé, ouvre **SQL Editor** → colle le contenu de `supabase/schema.sql` → Run.
   Cela crée toutes les tables (dossiers, paramètres, objectifs, commentaires, journal d'audit, sauvegardes), les règles de sécurité (RLS) par rôle, et les données de référence de départ (états, opérations, causes de retour...).
3. Va dans **Authentication → Users** → crée un compte pour chaque utilisateur (email + mot de passe).
4. Va dans **Table editor → profiles** → ajoute une ligne par utilisateur créé :
   - `id` = l'UUID de l'utilisateur (visible dans Authentication → Users)
   - `nom_complet` = son nom
   - `role` = `admin`, `ingenieur` ou `qualite`
   - `ingenieur_ref` = pour un rôle `ingenieur`, le nom exact utilisé dans la liste "Ingénieurs" des Paramètres (ex: "fatma") — sert à filtrer ce qu'il voit.
5. (Optionnel) Dans **Database → Cron Jobs**, active la sauvegarde automatique hebdomadaire :
   ```sql
   select cron.schedule('backup_hebdo', '0 3 * * 1', 'select fn_backup_hebdomadaire();');
   ```
6. Récupère tes clés dans **Project Settings → API** : `Project URL` et `anon public key`.

## 2. Configurer l'app

Copie `.env.local.example` en `.env.local` et remplis avec tes clés Supabase.

## 3. Déploiement (même méthode que ton CRM)

1. Crée un nouveau repo GitHub (ex: `isobat-qualite-app`).
2. Uploade tous les fichiers de ce zip via l'interface web GitHub ("Add file → Upload files") — attention à bien recréer les sous-dossiers `app/`, `components/`, `lib/`, `supabase/`.
3. Sur [vercel.com](https://vercel.com) → New Project → importe le repo.
4. Dans les paramètres du projet Vercel → **Environment Variables**, ajoute les 2 variables du `.env.local`.
5. Deploy.

⚠️ Comme pour ton CRM : après chaque mise à jour de fichiers sur GitHub, vide le cache du navigateur / attends la fin du build Vercel avant de tester (délai possible de propagation cache).

## 3bis. Mise à jour vers le cycle en 3 étapes (si l'app tournait déjà)

Si ton projet Supabase a déjà le schéma initial, exécute en plus **`supabase/migration_workflow_v2.sql`**
dans SQL Editor (Run) — sans danger, n'écrase aucune donnée. Sur un projet neuf, `schema.sql` suffit,
il contient déjà tout.

Ce script ajoute :
- Le suivi des 3 étapes : **Saisie/Dispatching** → **Vérification qualité** → **Retours post-audit**
- Deux nouvelles pages : `/verification` (file d'attente qualité) et `/retours` (dossiers déjà audités
  qui reviennent — faute interne découverte après coup ou modification demandée par le client)
- Un historique complet par dossier (`dossier_evenements`) — frise chronologique visible dans Saisie
- Un seuil d'alerte SLA configurable (Paramètres → Config SLA), par défaut 1h entre assignation et
  1ère vérification
- Le score Qualité ne pénalise plus que les fautes internes imputables — une modification demandée
  par le client n'impacte plus le score de l'ingénieur

## 3ter. Cycle enrichi (soumission + prise en charge + compte partagé ingénieurs)

Si tu as déjà exécuté `migration_workflow_v2.sql`, exécute maintenant **`supabase/migration_workflow_v3.sql`**
dans SQL Editor (Run) — sans danger, additif uniquement. Sur un projet neuf, `schema.sql` suffit.

Ce script ajoute :
- **`date_soumission`** : horodatage du moment où l'ingénieur clique "Envoyer pour vérification"
  (le SLA se mesure depuis ce moment-là, pas depuis l'assignation initiale)
- **`pris_en_charge_par`** / **`date_prise_en_charge`** : la Qualité "prend en charge" un dossier
  avant de le traiter, pour éviter que deux personnes le traitent en même temps
- **Deux nouveaux états** : `En attente de vérification` et `En cours de vérification`
- **PIN par ingénieur** (`parametres_ingenieurs.pin`) : les ingénieurs partagent un seul compte de
  connexion, puis choisissent leur nom + code personnel à 4 chiffres pour accéder à leur espace
  "Mes dossiers" — à définir dans Paramètres → Ingénieurs (modifiable à tout moment par l'Admin,
  utile en cas d'oubli)

### Nouvelles pages
- **`/mes-dossiers`** (rôle Ingénieur) : écran "Qui es-tu ?" (nom + PIN) puis 2 tableaux — "À traiter
  aujourd'hui" (avec cause + commentaires des retours affichés directement) et "Tous mes dossiers
  traités". Remplace l'accès au Dashboard pour ce rôle.
- **`/qualite`** (Admin/Qualité) : remplace les anciennes pages Vérification + Retours, fusionnées en
  une seule liste filtrable par statut, avec actions contextuelles (Prendre en charge / Valider /
  Retour interne / Retour client selon l'état du dossier).

### Dashboard (Admin/Qualité uniquement désormais)
Ajout de deux widgets "Charge actuelle" détaillés par nom de dossier + opération (un pour les
ingénieurs, un pour la Qualité), et distinction claire entre les 2 nouveaux statuts intermédiaires.

## 3quater. Connexion par nom d'utilisateur (pas d'email visible) + comptes partagés Admin/Qualité

Exécute **`supabase/migration_workflow_v5.sql`** puis **`supabase/migration_workflow_v6.sql`** (dans cet ordre) dans SQL Editor.

**Comment créer les comptes maintenant** : dans Supabase → Authentication → Users, crée toujours un email technique, mais choisis un format cohérent avec un nom d'utilisateur simple devant :
- `ingenieurs@hillsolution.local` → la personne tape juste `ingenieurs` à l'écran de connexion
- `qualite@hillsolution.local` → tape `qualite`
- `admin@hillsolution.local` → tape `admin`

L'app ajoute automatiquement `@hillsolution.local` avant d'envoyer la requête à Supabase — personne ne voit jamais d'email à l'écran.

**Comptes partagés + nom + PIN (6 chiffres)** : comme pour les ingénieurs, Admin et Qualité utilisent maintenant un compte de connexion partagé, puis choisissent leur nom + code PIN (liste "Validateurs" dans Paramètres, avec le champ PIN à côté de chaque nom) sur toutes les pages sauf Paramètres (qui reste protégée par rôle uniquement, sans sélection de nom).

## 4. Fonctionnalités incluses

| Page | Contenu |
|---|---|
| **Dashboard** | KPI cards filtrables, alertes qualité (dossiers bloqués, dossiers à risque), tâches du jour, top causes de retour |
| **Saisie** | Formulaire de saisie quotidienne avec détection de doublon en direct, validation obligatoire ("Audité" → "Validé par" requis), fil de commentaires par dossier |
| **Statistiques** | Score Qualité/Productivité/Global par ingénieur (mêmes formules que l'Excel), classement, délai moyen de traitement, dossiers à risque |
| **Export** | Export Excel filtré, import en masse depuis un fichier Excel |
| **Rapport** | Génération PDF automatique (KPIs + scores + top causes) en un clic |
| **Paramètres** (Admin) | Gestion des listes déroulantes, objectifs par ingénieur, journal d'audit, sauvegardes manuelles/automatiques |

## 5. Rôles

- **Admin** : accès total + Paramètres
- **Qualité** : Dashboard, Saisie, Statistiques, Export, Rapport (pas Paramètres)
- **Ingénieur** : Dashboard (ses dossiers), Saisie (ses dossiers uniquement, `ingenieur` pré-rempli)

## 6. Points volontairement laissés simples pour V1

- **Alertes email** : la vue `v_alertes_encours_vieux` existe côté base ; brancher un envoi d'email (ex: via Resend + Supabase Edge Function) est une itération suivante.
- **Objectifs** : gardés en valeur fixe unique par ingénieur (comme l'Excel), pas mensualisés — comme demandé.
- **Retour dossier** : un seul retour interne / un seul retour client par dossier (comme l'Excel), pas d'historique multi-retours.

Dis-moi ce qui doit être ajusté après le premier test !
