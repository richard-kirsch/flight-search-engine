export interface FlightSearchQuery {
  /** List of 3-letter origin airport codes */
  origins: string[];

  /** List of 3-letter destination airport codes */
  destinations: string[];

  /** List of dates of departure in YYYY-MM-DD format */
  departure_dates: string[];
}