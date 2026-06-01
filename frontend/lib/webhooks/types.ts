/**
 * Webhook registration types and interfaces
 */

export type WebhookEventType = 'TRACKING_EVENT_CREATED' | 'PRODUCT_EVENT_CHANGED';

export type ProductEventType =
  | 'product_registered'
  | 'product_updated'
  | 'event_added'
  | 'actor_authorized'
  | 'actor_removed'
  | 'compliance_policy_updated';

export interface Webhook {
  id: string;
  url: string;
  secret: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  lastDeliveryAt?: number;
  lastDeliveryStatus?: number;
  failureCount: number;
}

export interface WebhookSubscription {
  id: string;
  webhookId: string;
  name: string;
  description?: string;
  eventTypes: WebhookEventType[];
  productEventFilter?: {
    types?: ProductEventType[];
    productIds?: string[]; // Empty array or undefined means all products
  };
  retryPolicy: {
    maxRetries: number; // Number of retry attempts
    backoffMs: number; // Base backoff in milliseconds
    maxBackoffMs: number; // Maximum backoff in milliseconds
  };
  active: boolean;
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt?: number;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: number;
  id: string;
}

export type WebhookEvent = TrackingWebhookEvent | ProductWebhookEvent;

export interface TrackingWebhookEvent {
  type: 'TRACKING_EVENT_CREATED';
  data: {
    productId: string;
    location: string;
    actor: string;
    timestamp: number;
    eventType: 'HARVEST' | 'PROCESSING' | 'SHIPPING' | 'RETAIL';
    metadata: string;
  };
}

export interface ProductWebhookEvent {
  type: 'PRODUCT_EVENT_CHANGED';
  data: {
    eventType: ProductEventType;
    productId: string;
    timestamp: number;
    details: Record<string, any>; // Product or tracking event data
  };
}

export interface WebhookDeliveryAttempt {
  webhookId: string;
  subscriptionId?: string;
  payloadId: string;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  errorMessage?: string;
  attemptNumber: number;
  nextRetryAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Response types for API endpoints
 */
export interface WebhookRegistrationRequest {
  url: string;
  secret?: string; // If not provided, one will be generated
}

export interface WebhookRegistrationResponse {
  id: string;
  url: string;
  secret: string;
  active: boolean;
  createdAt: number;
}

export interface WebhookListResponse {
  webhooks: Array<{
    id: string;
    url: string;
    active: boolean;
    createdAt: number;
    lastDeliveryAt?: number;
    lastDeliveryStatus?: number;
  }>;
  total: number;
}

export interface WebhookSubscriptionRequest {
  name: string;
  description?: string;
  eventTypes: WebhookEventType[];
  productEventFilter?: {
    types?: ProductEventType[];
    productIds?: string[];
  };
  retryPolicy?: {
    maxRetries?: number;
    backoffMs?: number;
    maxBackoffMs?: number;
  };
  active?: boolean;
}

export interface WebhookSubscriptionResponse {
  id: string;
  webhookId: string;
  name: string;
  description?: string;
  eventTypes: WebhookEventType[];
  productEventFilter?: {
    types?: ProductEventType[];
    productIds?: string[];
  };
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
  active: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
}

export interface WebhookSubscriptionListResponse {
  subscriptions: WebhookSubscriptionResponse[];
  total: number;
}
