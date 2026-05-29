// ============================================================
// @survey-tracker/shared-types
// Tipos compartidos entre frontend y backend
// ============================================================

// --- Survey Counts ---
export interface SurveyCounts {
  scanned: number;
  completed: number;
}

// --- Zoho Webhook ---
export interface ZohoWebhookPayload {
  response_status: 'COMPLETED' | 'INCOMPLETE' | 'PARTIAL';
  webhook_event: 'response_completed' | 'response_incomplete' | 'response_partial';
  [key: string]: unknown;
}

export interface ZohoWebhookResponse {
  message: string;
}

// --- API Responses ---
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

// --- API Endpoints ---
export type GetCountsResponse = SurveyCounts;

export type QrScanResponse = never; // HTTP 302 redirect, no body

export type ZohoWebhookSuccessResponse = { message: string };

// --- Reset Counts ---
export interface ResetCountsResponse {
  message: string;
  previousCounts: SurveyCounts;
}

// --- Dashboard ---
export interface DashboardState {
  scanned: number;
  completed: number;
  pending: number;
}

// --- Environment Variables ---
export interface EnvironmentVariables {
  FIREBASE_SERVICE_ACCOUNT_KEY: string;
  FIREBASE_DATABASE_URL: string;
  ZOHO_SURVEY_URL: string;
  PORT?: string;
  NODE_ENV?: 'development' | 'production' | 'test';
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
}
