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
import type { AdzunaTarget } from "@/lib/watchlist";
import { OFF_PROFILE_EVENTS, TOO_SENIOR, type Screening } from "@/lib/relevance";
import type { HighlightOptions } from "@/lib/highlight";

export interface Profile {
  id: string;
  /** Mise en avant appliquée au classement et aux pastilles de l'alerte. */
  highlight?: HighlightOptions;
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

/**
 * Grands groupes que Matthieu veut voir remonter en premier.
 *
 * Liste tenue à la main, volontairement : il n'existe pas de source gratuite et
 * fiable de la taille des entreprises, et déduire la taille du nombre d'annonces
 * ferait remonter les cabinets de recrutement, pas les employeurs.
 */
const MAJOR_EMPLOYERS = [
  // conseil et audit
  "deloitte", "pwc", "pricewaterhouse", "ernst", "ey ", "kpmg", "accenture",
  "mckinsey", "boston consulting", "bain", "oliver wyman", "capgemini",
  // agroalimentaire et boisson
  "nestle", "nestlé", "danone", "unilever", "pepsico", "coca-cola", "mars ",
  "mondelez", "mccain", "kellogg", "lion", "asahi", "carlton", "treasury wine",
  "lactalis", "fonterra", "simplot",
  // sport, outdoor et mode
  "amer sports", "salomon", "arc'teryx", "arcteryx", "patagonia", "nike",
  "adidas", "decathlon", "the north face", "columbia", "lululemon", "asics",
  "new balance", "puma", "under armour", "kathmandu", "macpac", "rip curl",
  // retail et distribution
  "woolworths", "coles", "wesfarmers", "bunnings", "kmart", "target australia",
  "myer", "david jones", "ikea", "lvmh", "kering", "richemont", "chanel",
  // hôtellerie, restauration, événementiel
  "compass group", "sodexo", "aramark", "accor", "marriott", "hilton", "hyatt",
  "intercontinental", "delaware north", "levy",
  // grandes entreprises australiennes
  "qantas", "telstra", "bhp", "rio tinto", "anz", "national australia bank",
  "westpac", "commonwealth bank", "macquarie", "transurban", "cochlear", "csl",
  // logistique et industrie
  "dhl", "kuehne", "nagel", "linde", "saint-gobain", "schneider electric",
  "siemens", "bosch", "michelin", "downer", "nutrien",
];

/** Un stagiaire ne vise pas ces intitulés. */
const TOO_SENIOR_INTERN = [...TOO_SENIOR, "senior manager", "principal", "partner"];

/** Intitulés que Rémy veut voir remonter en premier. */
const JUNIOR_TERMS = [
  "junior", "trainee", "graduate", "intern", "assistant",
  "entry level", "casual", "crew", "attendant",
];

/**
 * Cibles de Virgile : mêmes offres que Rémy, à une exception près.
 *
 * Il ne parle pas allemand : la requête « german speaking » est retirée, sinon
 * il recevrait des postes exigeant une langue qu'il n'a pas. Son profil colle
 * par ailleurs au reste — master marketing et business development, plusieurs
 * éditions de Roland-Garros côté organisation, régie télé sur Roland-Garros et
 * le Tour de France, vente en boutique événementielle. Tennis Australia, déjà
 * surveillé, est pour lui la cible la plus évidente.
 */
const VIRGILE_TARGETS: WatchTarget[] = WATCHLIST.map((t) =>
  t.type === "adzuna"
    ? ({
        ...t,
        id: "adzuna-melbourne-virgile",
        adzuna: { ...t.adzuna, bodyQueries: ["french speaking"] },
      } satisfies AdzunaTarget)
    : t
);

export const PROFILES: Profile[] = [
  {
    id: "remy",
    label: "Rémy — événementiel sportif et hospitality, Melbourne",
    recipientEnv: "ALERT_EMAIL_TO",
    targets: WATCHLIST,
    screening: {
      offProfile: OFF_PROFILE_EVENTS,
      // « senior » ajouté le 2026-09-15 à sa demande.
      tooSenior: [...TOO_SENIOR, "senior"],
    },
    highlight: { preferTitleTerms: JUNIOR_TERMS },
  },
  {
    id: "virgile",
    label: "Virgile — événementiel sportif et marketing, Melbourne",
    recipientEnv: "ALERT_EMAIL_TO_VIRGILE",
    targets: VIRGILE_TARGETS,
    screening: {
      offProfile: OFF_PROFILE_EVENTS,
      tooSenior: [...TOO_SENIOR, "senior"],
    },
    highlight: { preferTitleTerms: JUNIOR_TERMS },
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
    highlight: { month: "january", majorEmployers: MAJOR_EMPLOYERS },
  },
];
