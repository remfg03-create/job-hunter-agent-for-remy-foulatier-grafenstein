/**
 * Employeurs surveillés à Melbourne.
 *
 * ATTENTION — règle de validation : ne jamais ajouter une cible sur la seule
 * foi d'un code HTTP. L'API SmartRecruiters répond 200 / totalFound:0 pour tout
 * identifiant inexistant, ce qui produit de faux positifs indiscernables d'un
 * employeur réel sans poste ouvert. Chaque identifiant doit être confirmé
 * depuis la page carrières officielle de l'employeur.
 */

import type { WorkdayConfig } from "@/lib/sources/workday";
import type { ElmoConfig } from "@/lib/sources/elmo";
import type { AdzunaConfig } from "@/lib/sources/adzuna";

interface WatchTargetBase {
  /** Identifiant interne stable, en kebab-case. */
  id: string;
  employer: string;
  /** "high" : les nouveautés déclenchent une alerte immédiate. */
  priority: "high" | "normal";
  /**
   * "melbourne" : tous les postes de cet employeur sont à Melbourne, le filtre
   * géographique ne s'applique pas — l'AGPC écrit « ... Head Office » dans le
   * champ lieu, un filtre naïf écarterait le poste le plus important.
   * "multi-city" : l'employeur recrute dans plusieurs villes, il faut filtrer.
   */
  geo: "melbourne" | "multi-city";
}

export interface WorkdayTarget extends WatchTargetBase {
  type: "workday";
  workday: WorkdayConfig;
}

export interface ElmoTarget extends WatchTargetBase {
  type: "elmo";
  elmo: ElmoConfig;
}

export interface AdzunaTarget extends WatchTargetBase {
  type: "adzuna";
  /** Les clés viennent de l'environnement, jamais du dépôt. */
  adzuna: Omit<AdzunaConfig, "appId" | "appKey">;
}

export type WatchTarget = WorkdayTarget | ElmoTarget | AdzunaTarget;

export const WATCHLIST: WatchTarget[] = [
  {
    // Poste visé : le Communications Coordinator de la campagne 2027.
    id: "agpc-head-office",
    employer: "Australian Grand Prix Corporation — Head Office",
    type: "elmo",
    // Validé le 2026-09-12 : 1 offre réelle (job/view/89, clôture 16/09/2026).
    // Contrôle négatif sur un site inventé : HTTP 404.
    elmo: {
      host: "grandprix.elmotalent.com.au",
      site: "AustralianGrandPrixCorporationHeadOffice",
      employer: "Australian Grand Prix Corporation",
    },
    priority: "high",
    geo: "melbourne",
  },
  {
    // Portail distinct du précédent : c'est ici que passeront les postes
    // événementiels de la campagne du Grand Prix, encore non ouverte.
    id: "agpc-events",
    employer: "Australian Grand Prix Corporation — Events",
    type: "elmo",
    // Validé le 2026-09-12 : portail réel, distinct, offre 89 aussi publiée ici.
    elmo: {
      host: "grandprix.elmotalent.com.au",
      site: "AustralianGrandPrixCorporationEvents",
      employer: "Australian Grand Prix Corporation",
    },
    priority: "high",
    geo: "melbourne",
  },
  {
    id: "tennis-australia",
    employer: "Tennis Australia",
    type: "workday",
    // Validé le 2026-09-07 : 19 offres réelles, dont 11 à Melbourne.
    workday: { tenant: "tennis", site: "ta_careers", employer: "Tennis Australia" },
    priority: "high",
    // Recrute à Melbourne, Sydney, Brisbane, Adélaïde, Darwin et Canberra.
    geo: "multi-city",
  },
  {
    // Flux large : couvre ce qu'aucune liste d'employeurs ne peut couvrir.
    // Termes arrêtés avec Rémy le 2026-09-14.
    id: "adzuna-melbourne",
    employer: "Adzuna (flux Melbourne)",
    type: "adzuna",
    adzuna: {
      where: "melbourne",
      maxDaysOld: 7,
      resultsPerQuery: 20,
      titleQueries: [
        "event coordinator",
        "events assistant",
        "event crew",
        "functions coordinator",
        "catering",
        "festival",
        "venue",
        "guest experience",
        "marketing coordinator",
        "production assistant",
        "cinema",
      ],
      // Une annonce qui exige un francophone le dit dans le corps du texte.
      bodyQueries: ["french speaking", "german speaking"],
    },
    priority: "normal",
    // Adzuna indexe toute l'Australie : le filtre géographique reste actif.
    geo: "multi-city",
  },
];
