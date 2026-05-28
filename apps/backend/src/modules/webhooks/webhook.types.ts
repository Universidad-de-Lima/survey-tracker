export interface ZohoWebhookPayload {
  response_status: 'COMPLETED' | 'INCOMPLETE' | 'PARTIAL';
  webhook_event: 'response_completed' | 'response_incomplete' | 'response_partial';
  [key: string]: unknown;
}

export interface WebhookResult {
  completed: number;
}
