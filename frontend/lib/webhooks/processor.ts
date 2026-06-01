import { randomBytes } from 'crypto';
import type { TrackingEvent } from '@/lib/types';
import type { WebhookPayload, WebhookEvent, ProductEventType } from './types';
import { getActiveWebhooks, getFailedWebhooks, updateWebhook } from './storage';
import { broadcastWebhook } from './delivery';
import { getSubscriptionsForEvent, updateSubscriptionTrigger } from './subscriptions';
import { getWebhookById } from './storage';

/**
 * Create a webhook event payload from a tracking event
 */
export function createWebhookPayload(event: TrackingEvent): WebhookPayload {
  const webhookEvent: WebhookEvent = {
    type: 'TRACKING_EVENT_CREATED',
    data: {
      productId: event.productId,
      location: event.location,
      actor: event.actor,
      timestamp: event.timestamp,
      eventType: event.eventType,
      metadata: event.metadata,
    },
  };

  return {
    event: webhookEvent,
    timestamp: Date.now(),
    id: randomBytes(8).toString('hex'),
  };
}

/**
 * Create a webhook event payload from a product event change
 */
export function createProductEventPayload(
  eventType: ProductEventType,
  productId: string,
  details: Record<string, any>,
): WebhookPayload {
  const webhookEvent: WebhookEvent = {
    type: 'PRODUCT_EVENT_CHANGED',
    data: {
      eventType,
      productId,
      timestamp: Date.now(),
      details,
    },
  };

  return {
    event: webhookEvent,
    timestamp: Date.now(),
    id: randomBytes(8).toString('hex'),
  };
}

/**
 * Send webhooks for a new tracking event
 * This is called when a new event is detected via polling
 */
export async function notifyWebhooksOfEvent(event: TrackingEvent): Promise<{
  delivered: boolean;
  successCount: number;
  failureCount: number;
  failedWebhookIds: string[];
}> {
  try {
    // Check for failed webhooks that should be deactivated
    const failedWebhooks = await getFailedWebhooks(5); // 5+ failures
    for (const webhook of failedWebhooks) {
      console.warn(`Deactivating webhook ${webhook.id} due to ${webhook.failureCount} failures`);
      await updateWebhook(webhook.id, { active: false });
    }

    // Get all active webhooks
    const webhooks = await getActiveWebhooks();

    if (webhooks.length === 0) {
      return {
        delivered: true,
        successCount: 0,
        failureCount: 0,
        failedWebhookIds: [],
      };
    }

    // Create payload
    const payload = createWebhookPayload(event);

    // Broadcast to all active webhooks
    const result = await broadcastWebhook(webhooks, payload);

    console.log(`Webhook delivery: ${result.successful} successful, ${result.failed} failed`);

    return {
      delivered: true,
      successCount: result.successful,
      failureCount: result.failed,
      failedWebhookIds: result.details.filter((d) => !d.success).map((d) => d.webhookId),
    };
  } catch (err) {
    console.error('Failed to notify webhooks:', err);
    return {
      delivered: false,
      successCount: 0,
      failureCount: 0,
      failedWebhookIds: [],
    };
  }
}

/**
 * Send webhooks for product event changes (product_updated, product_registered, etc.)
 * This is called when product metadata or state changes
 */
export async function notifyWebhooksOfProductEvent(
  eventType: ProductEventType,
  productId: string,
  details: Record<string, any>,
): Promise<{
  delivered: boolean;
  successCount: number;
  failureCount: number;
  failedWebhookIds: string[];
  triggedSubscriptionIds: string[];
}> {
  try {
    // Get subscriptions that match this product event
    const subscriptions = await getSubscriptionsForEvent(
      'PRODUCT_EVENT_CHANGED',
      eventType,
      productId,
    );

    if (subscriptions.length === 0) {
      return {
        delivered: true,
        successCount: 0,
        failureCount: 0,
        failedWebhookIds: [],
        triggedSubscriptionIds: [],
      };
    }

    // Get unique webhooks from subscriptions
    const webhookIds = [...new Set(subscriptions.map((s) => s.webhookId))];
    const webhooks = [];
    for (const id of webhookIds) {
      const webhook = await getWebhookById(id);
      if (webhook && webhook.active) {
        webhooks.push(webhook);
      }
    }

    if (webhooks.length === 0) {
      return {
        delivered: true,
        successCount: 0,
        failureCount: 0,
        failedWebhookIds: [],
        triggedSubscriptionIds: [],
      };
    }

    // Create payload
    const payload = createProductEventPayload(eventType, productId, details);

    // Broadcast to matching webhooks
    const result = await broadcastWebhook(webhooks, payload);

    // Update subscription triggers
    for (const subscription of subscriptions) {
      await updateSubscriptionTrigger(subscription.id);
    }

    console.log(
      `Product event webhook delivery: ${result.successful} successful, ${result.failed} failed`,
    );

    return {
      delivered: true,
      successCount: result.successful,
      failureCount: result.failed,
      failedWebhookIds: result.details.filter((d) => !d.success).map((d) => d.webhookId),
      triggedSubscriptionIds: subscriptions.map((s) => s.id),
    };
  } catch (err) {
    console.error('Failed to notify webhooks of product event:', err);
    return {
      delivered: false,
      successCount: 0,
      failureCount: 0,
      failedWebhookIds: [],
      triggedSubscriptionIds: [],
    };
  }
}

/**
 * Re-attempt to send a failed webhook delivery
 * (Called by a retry job/cron task)
 */
export async function retryFailedDeliveries(): Promise<void> {
  // This would be implemented as a separate job/cron task
  // that reads pending delivery attempts and retries them
  // with exponential backoff
  console.log('Retry logic would run here as a scheduled task');
}
