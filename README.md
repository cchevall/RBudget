# 🐷 Mochi Budget

Une app de budget perso **kawaii**, en PWA, dont les données restent **uniquement sur le téléphone** (IndexedDB). Aucun serveur, aucun compte.

## Fonctionnalités

- **Saisie éclair** : pavé numérique, favoris en 1 tap, catégorie devinée depuis le libellé (l'app apprend de tes choix), autocomplétion.
- **Profil salarié ou auto-entrepreneur** (choisi au premier lancement) : pour les AE, un espace **Pro** séparé du perso avec factures (multi-devise, numérotation auto, taux de change appris), déclarations URSSAF mensuelles/trimestrielles pré-calculées, frais et charges fixes pro, CFE, trésorerie et « ce que tu peux te verser », plafonds micro/TVA, passage au réel, aide à la déclaration de revenus et export CSV.
- **Projet immo** : capacité d'emprunt (taux d'endettement, TAEG, durée), apport projeté, revente du logement actuel et prêt relais.
- **Récurrentes** : salaire, CAF, crédit voiture, Matmut, Netflix… ajoutées automatiquement ou « à confirmer » si le montant varie (CAF).
- **Enveloppes** mensuelles par catégorie (avec sous-catégories), report optionnel, projection « à ce rythme », et **assistant** qui les propose depuis tes moyennes.
- **Reste à vivre** : ce qu'il reste une fois les prélèvements à venir payés, et combien par jour.
- **Mois budgétaire** configurable (ex. commencer le jour de paie).
- **Santé** : suivi des remboursements Sécu / mutuelle (estimation automatique), reste à charge annuel.
- **Projets** : jauges d'épargne (« 2 000 € pour les vacances »), **Noël** (cadeaux par personne, budget par personne, statuts 💡 → 🛒 → 🎀 → ✅), **vacances** (budget prévu/réel, checklist).
- **Détective** : doublons, montants inhabituels, hausses de prix, abonnements non déclarés, dépenses en hausse, remboursements en retard, fin de mois tendue.
- **Prompt IA** : génère un prompt complet (synthèse, catégories, enveloppes, récurrentes, projets, détail CSV, option anonymisation) à coller dans n'importe quelle IA.
- **Gamification** : XP & niveaux, série de jours, journées « zen » sans dépense, 34 succès, défis de la semaine, thèmes à débloquer, mascotte qui réagit.
- **Import CSV** bancaire (détection auto des colonnes, doublons ignorés), export CSV, sauvegarde/restauration JSON, code PIN, mode sombre.

## Développement

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + build dans dist/
npm run icons     # régénère les PNG depuis public/favicon.svg
```

Stack : Vite + Preact + Signals + TypeScript, `vite-plugin-pwa` (hors-ligne), `idb-keyval`.

## Déploiement GitHub Pages

1. Crée un repo GitHub et pousse ce dossier sur la branche `main`.
2. Dans le repo : **Settings → Pages → Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` build et publie à chaque push.
   L'app utilise des chemins relatifs, elle marche quel que soit le nom du repo.

## Installer sur le téléphone

- **iPhone** : ouvrir l'URL dans Safari → Partager → « Sur l'écran d'accueil ».
- **Android** : Chrome → ⋮ → « Installer l'application ».

⚠️ Les données vivent dans le navigateur du téléphone. Sur iPhone, l'app installée et Safari ont des stockages séparés : utilise toujours l'app installée. Fais des **sauvegardes** régulières (Réglages → Sauvegarder), l'app te le rappelle.

Totalement vibe codé, utilisez ça à vos propres risques.
