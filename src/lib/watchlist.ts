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

export interface WatchTarget {
  /** Identifiant interne stable, en kebab-case. */
  id: string;
  employer: string;
  type: "workday";
  workday: WorkdayConfig;
  /** "high" : les nouveautés déclenchent une alerte immédiate. */
  priority: "high" | "normal";
}

export const WATCHLIST: WatchTarget[] = [
  {
    id: "tennis-australia",
    employer: "Tennis Australia",
    type: "workday",
    // Validé le 2026-09-07 : 19 offres réelles, dont 11 à Melbourne.
    workday: { tenant: "tennis", site: "ta_careers", employer: "Tennis Australia" },
    priority: "high",
  },
];
