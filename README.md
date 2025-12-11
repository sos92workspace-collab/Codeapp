# SCM – Gestion des redevances (mode local)

Cette version est une page HTML autonome qui stocke toutes les données de redevances directement dans le navigateur (localStorage). Aucun service externe n'est requis : il suffit d'ouvrir `index.html`.

## Lancer l'interface

- Double-cliquez sur `index.html` ou servez le répertoire via un petit serveur local :

```bash
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Fonctionnement

- **Persistance locale** : chaque saisie ou import CSV est enregistré automatiquement dans `localStorage`.
- **Import CSV** : colonnes attendues `identite`, `profil`, `periode`, `montant`, `statut` (les variantes `nom`, `role`, `period`, `amount`, `status` sont aussi reconnues).
- **Formulaire manuel** : ajoutez une redevance (identité, rôle, période, montant, statut) ; les valeurs sont ajoutées en tête d'historique.
- **Filtrage** : la synthèse peut être limitée aux 12, 24 ou 48 derniers mois ou afficher tout l'historique.
- **Réinitialisation** : le bouton « Réinitialiser » vide les données locales.

## Structure

- `index.html` : page unique et interface utilisateur.
- `styles.css` : thème sombre et composants.
- `app.js` : logique front-end (lecture/écriture `localStorage`, import CSV, affichage des totaux).

_Old Supabase assets (ex. `supabase_schema.sql`) restent pour référence mais ne sont plus nécessaires._
