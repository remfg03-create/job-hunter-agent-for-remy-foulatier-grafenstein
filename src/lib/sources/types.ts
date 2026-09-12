/** Une offre normalisée, quelle que soit sa source. */
export interface JobPosting {
  /** Identifiant stable et unique, préfixé par la source : "workday:tennis:R5163-1". */
  id: string;
  /** Identifiant de la source : "workday:tennis". */
  source: string;
  /** Nom lisible de l'employeur. */
  employer: string;
  title: string;
  location: string;
  /** Lien public vers l'annonce. */
  url: string;
  /** Texte de publication tel que fourni par la source ("Posted Today"). */
  postedOn?: string;
  /** Temps plein / temps partiel, tel que fourni par la source. */
  timeType?: string;
  /**
   * Date de clôture des candidatures, telle qu'affichée par la source.
   * Déterminante sur l'événementiel saisonnier, où les campagnes ferment vite.
   */
  closesOn?: string;
}
