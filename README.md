# SCM – Gestion des redevances (Supabase)

Cette page web statique fournit une interface de connexion (médecin, remplaçant, administrateur) et des tableaux de bord liés à Supabase pour suivre les redevances sur 4 ans.

## Lancer l'interface en local

Aucune dépendance n'est nécessaire :

```bash
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Fonctionnalités principales

- Authentification Supabase (email/mot de passe) avec récupération du profil (table `profiles`).
- Tableaux dédiés selon le rôle :
  - **Administrateur** : import CSV/Excel, saisie manuelle, synthèse annuelle (appelé/payé/en attente).
  - **Médecins / Remplaçants** : vue personnelle filtrable (12/24/48 mois).
- Gestion des statuts "Appelée", "Payée" et "En attente" et historique sur 4 ans.
- Mode dégradé : en cas d'indisponibilité Supabase, des données d'exemple sont injectées pour garder une vue exploitable.

## Configuration Supabase

Le client est pré-configuré avec l'URL et la clé publique fournies :

- URL : `https://ixwzkhitzykokvzggmix.supabase.co`
- API Key : `sb_publishable_apJygRnFeCm6G6MW7IWfGw_LeOr31BK`

Pour un fonctionnement complet, créez les tables :

- `profiles(id uuid primary key references auth.users, full_name text, role text)`
- `redevances(id bigint primary key generated always as identity, actor_id uuid, actor_name text, actor_role text, period text, amount numeric, status text)`

Activez la politique RLS adaptée (par exemple : les administrateurs peuvent tout voir ; les autres uniquement leurs lignes via `actor_id`).

Vous pouvez exécuter directement le script `supabase_schema.sql` dans l'éditeur SQL Supabase : il crée les tables, ajoute des politiques RLS de base et charge quelques données d'exemple pour tester l'interface.
