# Refonte du Job Hunter Agent — veilleur d'emploi Melbourne

**Date :** 2026-09-07
**Statut :** conception validée, prête pour le plan d'implémentation

## 1. Contexte et constat

L'agent existant ne remonte **aucune offre réelle**. Un scan complet exécuté le 2026-09-07 confirme que les 5 sources retombent toutes sur les données fictives de `data/sample-jobs.json` :

| Source | Comportement observé |
|---|---|
| Indeed | HTTP 403 |
| Welcome to the Jungle | HTTP 403 (Algolia) — clé corrompue dans le code |
| APEC, LinkedIn, HelloWork | 0 résultat, sans erreur levée |

Les 10 offres affichées dans le dashboard sont fictives. Le fallback silencieux sur données d'exemple masque l'échec total de la couche d'acquisition.

En parallèle, la cible du projet a changé. Les critères câblés (Paris / Berlin, sales et événementiel France-Allemagne) ne correspondent plus au besoin réel :

- **Destination :** Melbourne, Australie
- **Statut :** Working Holiday Visa (subclass 417) visé
- **Profil :** franco-allemand, trilingue FR / EN / DE, niveau junior
- **Priorité 1 :** événementiel sportif — Grand Prix de Melbourne, Australian Open, festivals
- **Priorité 2 :** gastronomie / hospitality, et autres postes juniors

### Contrainte structurante : les fenêtres de recrutement

L'événementiel sportif australien ne recrute pas en continu. Les campagnes ouvrent quelques semaines par an :

- **Australian Open 2027 :** la campagne casual de masse était ouverte du 24 juin au 12 juillet 2026. **Le recrutement reste actif hors campagne** — vérifié le 2026-09-07 : 19 postes ouverts chez Tennis Australia, dont 11 à Melbourne et un publié le jour même. Entretiens HireVue et Teams en août-septembre, prise de poste des contrats casual à partir du 5 octobre 2026.
- **Grand Prix de Melbourne 2027 :** recrutement non encore ouvert au 2026-09-07, ouverture annoncée « plus tard en 2026 ».

Un agent qui score les offres du jour ne répond donc pas au besoin. La valeur est dans la **détection de l'ouverture des campagnes**.

## 2. Objectif

Transformer l'agent en **veilleur** ciblé sur Melbourne, capable de :

1. surveiller une liste nommée d'employeurs et alerter à l'ouverture d'une campagne ;
2. ingérer un flux quotidien d'offres juniors événementiel / gastronomie ;
3. scorer chaque offre contre le CV **et contre l'éligibilité WHV 417** ;
4. ne jamais présenter de donnée fictive comme réelle.

## 3. Sources retenues

Vérifiées le 2026-09-07.

| Source | Statut vérifié | Rôle |
|---|---|---|
| Adzuna AU | endpoint `/jobs/au/` confirmé, `AUTH_FAIL` sans clé — clé gratuite | flux large quotidien |
| **Workday (API CXS)** | **validé le 2026-09-07 : 19 offres réelles remontées chez Tennis Australia, sans authentification** | **employeurs sous Workday — source n°1** |
| SmartRecruiters | API publique gratuite, contrôle positif Bosch = 4816 offres | employeurs à ATS connu |
| Alertes mail LinkedIn / Seek | via l'OAuth Gmail déjà implémenté | couverture LinkedIn |
| Pages carrières | extraction par Claude + détection de changement | AGPC et assimilés |

### Sources écartées, et pourquoi

- **LinkedIn en accès direct** — pas d'API publique pour les offres, scraping interdit par les CGU, blocage rapide en pratique. Remplacé par l'ingestion des alertes mail, qui donne la même couverture sans risque.
- **Seek, Indeed** — pas d'API publique, scraping interdit par les CGU.
- **Bundesagentur für Arbeit** — HTTP 403 sur les deux méthodes d'authentification testées ; hors cible géographique de toute façon.
- **WTTJ, APEC, HelloWork** — hors cible géographique.

### Piège de validation à ne pas reproduire

L'API SmartRecruiters répond `HTTP 200 / totalFound: 0` pour **tout identifiant d'entreprise inexistant**. Un contrôle avec un identifiant inventé (`ZzzNotARealCompany12345`) renvoie exactement la même réponse qu'un employeur réel sans poste ouvert.

**Règle :** chaque identifiant employeur doit être validé contre sa page carrière officielle, jamais contre un code HTTP.

## 4. Architecture

Trois briques séparées.

### 4.1 Le moteur — GitHub Actions

Exécute la veille sur cron. Interroge les sources, déduplique, score les nouveautés, écrit l'état, envoie les alertes. Remplace les fonctions serverless Vercel pour tout le travail de fond.

Motifs du choix :

- pas de limite de 60 s par fonction ;
- 2000 minutes/mois gratuites ;
- ouvre la porte à un navigateur headless plus tard sans changer d'hébergeur ;
- supprime le problème de persistance par construction.

### 4.2 L'état — branche `data`

Les résultats sont commités en JSON sur une branche `data` dédiée, isolée de l'historique du code. Un commit par run.

Conséquence directe : **« ce qui est nouveau depuis le dernier run » est un `git diff`**. La détection de nouveauté, l'historique et la persistance sont obtenus sans base de données.

Fichiers :

- `jobs.json` — offres connues, avec leur score
- `watch-state.json` — empreintes des pages carrières surveillées, compteurs d'échec par source
- `alerts.json` — journal des alertes envoyées, pour ne pas alerter deux fois

### 4.3 La vitrine — Vercel

Le dashboard Next.js lit le JSON de la branche `data` en le récupérant depuis `raw.githubusercontent.com` à chaque requête, en rendu dynamique et sans cache. Aucun redéploiement n'est déclenché par un run de veille, et l'affichage reflète toujours le dernier commit de `data`. Vercel ne fait plus tourner ni scan ni cron.

## 5. Couche d'acquisition

Interface unique. Chaque adaptateur reçoit la configuration et retourne `RawJob[]`, ou lève une erreur — **jamais de fallback silencieux**.

### 5.1 `workday` — adaptateur prioritaire, validé

Workday expose une API JSON publique sans authentification :

```
POST https://{tenant}.wd3.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
body: {"appliedFacets":{},"limit":20,"offset":0,"searchText":""}
```

Le détail d'un poste s'obtient en concaténant l'`externalPath` retourné à la même racine `/wday/cxs/{tenant}/{site}`.

**Validé le 2026-09-07** sur Tennis Australia (`tenant: tennis`, `site: ta_careers`) : 19 offres réelles, avec titre, lieu, type de contrat, date de publication et description complète.

L'adaptateur est générique et paramétré par `tenant` + `site`. Workday étant très répandu chez les grands employeurs australiens, il couvrira vraisemblablement plusieurs cibles de la watchlist.

### 5.2 `adzuna-au`

REST, clé gratuite (`app_id` + `app_key`). Requêtes ciblées : Melbourne croisé avec les familles de mots-clés événementiel, hospitality, festival, gastronomie, junior.

### 5.3 `smartrecruiters`

Adaptateur générique paramétré par identifiant d'entreprise. Réutilisable pour tout employeur de la watchlist utilisant cet ATS.

### 5.4 `gmail-alerts`

Lit les mails d'alerte emploi LinkedIn et Seek dans la boîte de l'utilisateur via l'OAuth Gmail existant, et en extrait les offres. Accès en lecture seule sur un filtre restreint aux expéditeurs d'alertes.

Prérequis utilisateur : créer les alertes emploi côté LinkedIn et Seek.

### 5.5 `career-page`

Récupère le HTML, le nettoie, et fait extraire les postes par Claude via un tool call forcé produisant du JSON structuré — même technique que le scoring actuel, pas de parsing de prose.

**Filet de sécurité :** si l'extraction ne rend aucun poste, l'adaptateur calcule une empreinte du texte visible et la compare à celle du run précédent. Tout changement déclenche une alerte « la page X a bougé ».

C'est ce mécanisme qui garantit la détection de l'ouverture de la campagne Grand Prix.

**Correction du 2026-09-07 :** l'AGPC ne recrute pas via ApplyNow mais via **ELMO Talent**, à l'adresse `https://grandprix.elmotalent.com.au/careers/AustralianGrandPrixCorporationEvents/`. Contrairement au portail ApplyNow, cette page est **rendue côté serveur** : les liens d'offres apparaissent en clair dans le HTML sous la forme `job/view/<id>`, vérifié le 2026-09-07 (une offre ouverte, `job/view/89`). L'AGPC devient donc une cible parsable par simple récupération HTML, sans navigateur headless ni extraction Claude. Aucun flux JSON ou RSS n'est exposé (404 sur `jobs.json`, `api/jobs`, `jobs/feed`, `rss`) : le parseur travaille sur le HTML.

## 6. Watchlist employeurs

Fichier de configuration versionné. Chaque entrée porte : nom, type de source, paramètres, priorité.

Cibles initiales (chaque identifiant à valider individuellement contre la page carrière officielle) :

- Australian Grand Prix Corporation — `career-page` ELMO Talent (`grandprix.elmotalent.com.au/careers/AustralianGrandPrixCorporationEvents/`, liens `job/view/<id>` en HTML serveur) — **identifiant validé**, priorité haute
- Tennis Australia / Australian Open — `workday` (`tenant: tennis`, `site: ta_careers`) — **identifiant validé**, priorité haute
- Compass Group Australia — partenaire hospitality de l'AO
- Melbourne & Olympic Parks
- Victoria Racing Club — Melbourne Cup
- Melbourne Food & Wine Festival
- Melbourne Cricket Club / MCG
- Live Nation Australia, Frontier Touring

## 7. Scoring

### 7.1 Prompt recalibré

Réécrit autour du profil réel : WHV 417, trilingue FR / EN / DE, junior, événementiel sportif et gastronomie, Melbourne.

### 7.2 Critère `whvFriendly`

Nouveau champ structuré dans le tool call, à trois valeurs :

- `yes` — poste casual, saisonnier ou explicitement ouvert aux WHV : score relevé
- `unclear` — non précisé : score inchangé
- `no` — exige la résidence permanente, la citoyenneté ou un sponsor : **score forcé à 1**

Objectif : ne jamais faire lire à l'utilisateur une offre pour laquelle il n'est pas éligible.

### 7.3 Optimisations de coût

Trois changements, indépendants les uns des autres :

1. **Ne scorer que les offres nouvelles.** Le code actuel re-score l'intégralité du corpus à chaque scan. La comparaison à l'état commité élimine ce gaspillage.
2. **Prompt caching sur le CV.** Le CV et le prompt système sont identiques pour toutes les offres d'un run et sont aujourd'hui renvoyés intégralement à chaque appel. Un point de cache placé après le bloc CV supprime ce coût répété. À vérifier via `usage.cache_read_input_tokens`.
3. **Modèle de scoring `claude-sonnet-5`** au lieu de `claude-sonnet-4-6` : plus récent et moins cher (2 $ / 10 $ par million de tokens contre 3 $ / 15 $). `claude-opus-4-8` reste sur la rédaction des lettres.

## 8. Alertes

Envoyées par Gmail, sur deux niveaux :

- **Alerte immédiate** — un employeur surveillé ouvre une campagne, une page surveillée change, ou une offre score 8 ou plus.
- **Digest quotidien** — le reste des nouveautés.

`alerts.json` empêche la double notification sur un même événement.

## 9. Gestion des erreurs

**Changement de principe : suppression totale du fallback sur données fictives.** Une source en échec est signalée comme telle dans l'état et dans le dashboard. Elle n'est jamais remplacée en silence.

- Une source qui échoue n'interrompt pas le run.
- Trois échecs consécutifs d'une même source déclenchent une alerte mail « source cassée ».
- Le dashboard affiche par source : dernier succès, dernier échec, nombre d'offres.

## 10. Tests

Vitest. Aucun test n'existe aujourd'hui.

- **Parseurs** — un test par adaptateur contre des réponses réelles capturées et versionnées comme fixtures.
- **Déduplication et détection de nouveauté** — cœur du veilleur, priorité de couverture la plus haute.
- **Scoring** — API mockée ; couvre le forçage à 1 sur `whvFriendly: no` et le repli heuristique.
- **Alertes** — vérifie qu'un même événement ne notifie pas deux fois.

## 11. Suppressions

- Les 5 scrapers `src/lib/scrapers/` : WTTJ, APEC, Indeed, LinkedIn, HelloWork.
- `data/sample-jobs.json` et `src/lib/scrapers/fallback.ts`.
- Les critères par défaut Paris / Berlin dans `src/lib/config.ts`.
- Le cron Vercel de `vercel.json`, redondant avec GitHub Actions et incohérent (1×/jour alors que le projet annonce 4×/jour).

## 12. Prérequis utilisateur

1. Créer un compte développeur Adzuna (gratuit, sans carte) et fournir `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`.
2. Créer les alertes emploi LinkedIn et Seek ciblées Melbourne / événementiel.
3. Fournir `ANTHROPIC_API_KEY` pour le scoring réel.
4. Compléter l'OAuth Gmail pour la lecture des alertes et l'envoi des notifications.

## 13. Hors périmètre

Deux chantiers identifiés mais volontairement exclus de cette spec, à traiter séparément :

- **Refonte du CV au format australien** — conventions distinctes du CV français (pas de photo ni d'état civil, 2 à 3 pages, orthographe australienne, référents, work rights annoncés en tête). Indépendant de l'agent et à plus fort rendement immédiat.
- **Support d'un navigateur headless** pour les pages carrières entièrement rendues en JavaScript. L'architecture GitHub Actions le permet sans déménagement, si la détection de changement se révèle insuffisante.
