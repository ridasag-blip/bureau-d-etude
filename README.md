# ISO BAT — Qualité Bureau d'Étude

App web remplaçant le classeur `QUALITE_suivi_prod.xlsx`. Stack : **Next.js 14 + Supabase + Vercel**, même identité visuelle que le CRM ISO BAT (vert #0E8A3E / rouge #C7070A).

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
