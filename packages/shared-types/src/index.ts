// ============================================================
// @survey-tracker/shared-types
// Tipos compartidos entre el panel y el backend
// ============================================================

/** Lo que devuelve `GET /api/get-counts`. */
export interface SurveyCounts {
  scanned: number;
  completed: number;
}

/**
 * Lo que devuelve `GET /api/get-counts`: los contadores y las dos marcas del cronómetro
 * del salón (el primer escaneo y la última encuesta terminada).
 */
export interface GetCountsResponse extends SurveyCounts {
  firstScanAt?: number | null;
  lastCompletedAt?: number | null;
}

export interface ResetCountsResponse {
  message: string;
  previousCounts: SurveyCounts;
}
