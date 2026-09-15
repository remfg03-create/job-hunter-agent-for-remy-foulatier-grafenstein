/**
 * Profils surveillés.
 *
 * Un profil, c'est une personne : ses cibles, ses filtres, son état et son
 * destinataire. Le veilleur boucle sur les profils à chaque passage.
 *
 * Le dépôt est public : aucune adresse mail n'est écrite ici. Chaque profil
 * désigne la variable d'environnement qui porte la sienne, alimentée par les
 * secrets GitHub.
 */

import { WATCHLIST, type WatchTarget } from "@/lib/watchlist";
import { OFF_PROFILE_EVENTS, TOO_SENIOR, type Screening } from "@/lib/relevance";

export interface Profile {
  id: string;
  label: string;
  /** Nom de la variable d'environnement contenant l'adresse du destinataire. */
  recipientEnv: string;
  targets: WatchTarget[];
  screening: Screening;
}

/**
 * Cibles de Matthieu : stage à partir de janvier 2027, profil finance et
 * stratégie, avec une pratique du F&B et du commercial retail. Il vise le
 * sport, l'événementiel, les marques outdoor, les sociétés de F&B et le
 * conseil. Rien à voir avec l'événementiel sportif de Rémy, d'où un jeu de
 * requêtes distinct.
 */
const MATTHIEU_TARGETS: WatchTarget[] = [
  {
    id: "adzuna-melbourne-stage",
    employer: "Adzuna (flux Melbourne, stages)",
    type: "adzuna",
    adzuna: {
      where: "melbourne",
      maxDaysOld: 7,
      resultsPerQuery: 20,
      // Requêtes ancrées sur l'entrée de carrière, pas sur le métier : chercher
      // « business development » remontait une centaine de postes seniors en
      // CDI. Le domaine est imposé ensuite par requireAny.
      titleQueries: [
        "intern",
        "internship",
        "graduate",
        "trainee",
        "junior",
        "assistant",
        "vacation program",
      ],
      // Les marques outdoor qu'il cite ne mettent pas leur nom dans l'intitulé
      // du poste : on les cherche dans le corps de l'annonce.
      bodyQueries: [
        "french speaking",
        "Patagonia",
        "Arc'teryx",
        "Salomon",
        "outdoor brand",
      ],
    },
    priority: "normal",
    geo: "multi-city",
  },
];

/** Métiers hors du profil finance et commercial de Matthieu. */
const OFF_PROFILE_FINANCE = [
  "nurse",
  "doctor",
  "physiotherapist",
  "software",
  "developer",
  "engineer",
  "architect",
  "cyber",
  "paralegal",
  "lawyer",
  "chef",
  "cook",
  "kitchen hand",
  "cleaner",
  "driver",
  "warehouse",
];

/**
 * Domaines de Matthieu. Un intitulé doit en contenir au moins un.
 * Sans ce garde-fou, « intern » ramenait 132 offres dont des stages en
 * radiographie, orthophonie, design et réfrigération.
 */
const FIELDS_FINANCE_COMMERCIAL = [
  "finance", "financial", "accounting", "audit", "controller", "controlling",
  "commercial", "sales", "business development", "account", "marketing",
  "brand", "retail", "merchandis", "buyer", "category",
  "consultant", "consulting", "strategy", "corporate",
  "hospitality", "food", "beverage", "f&b", "restaurant", "venue",
  "event", "partnership", "procurement", "supply chain", "customer",
];

/** Un stagiaire ne vise pas ces intitulés. */
const TOO_SENIOR_INTERN = [...TOO_SENIOR, "senior manager", "principal", "partner"];

export const PROFILES: Profile[] = [
  {
    id: "remy",
    label: "Rémy — événementiel sportif et hospitality, Melbourne",
    recipientEnv: "ALERT_EMAIL_TO",
    targets: WATCHLIST,
    screening: { offProfile: OFF_PROFILE_EVENTS, tooSenior: TOO_SENIOR },
  },
  {
    id: "matthieu",
    label: "Matthieu — stage finance, F&B et retail, Melbourne, janvier 2027",
    recipientEnv: "ALERT_EMAIL_TO_MATTHIEU",
    targets: MATTHIEU_TARGETS,
    screening: {
      offProfile: OFF_PROFILE_FINANCE,
      tooSenior: TOO_SENIOR_INTERN,
      requireAny: FIELDS_FINANCE_COMMERCIAL,
    },
  },
];
