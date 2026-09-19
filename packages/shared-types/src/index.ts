// ============================================================
// @survey-tracker/shared-types
// Tipos compartidos entre el panel y el backend
// ============================================================

/** Lo que devuelve `GET /api/get-counts`. */
export interface SurveyCounts {
  scanned: number;
  completed: number;
}

export type GetCountsResponse = SurveyCounts;

export interface ResetCountsResponse {
  message: string;
  previousCounts: SurveyCounts;
}
