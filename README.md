# Hill Solution — Qualité Bureau d'Études

App web remplaçant le classeur `QUALITE_suivi_prod.xlsx`. Stack : **Next.js 14 + Supabase + Vercel**, identité visuelle Hill Solution (vert #5BAE46 / bleu #1B6FAF).

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
