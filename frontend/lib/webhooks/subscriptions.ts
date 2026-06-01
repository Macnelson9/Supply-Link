import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import type { WebhookSubscription, WebhookEventType, ProductEventType } from './types';

// Store subscriptions in a JSON file in the project (consider using a real DB in production)
const WEBHOOKS_DIR = path.join(process.cwd(), '.kiro', 'webhooks');
const SUBSCRIPTIONS_FILE = path.join(WEBHOOKS_DIR, 'subscriptions.json');

/**
 * Ensure the webhooks directory exists
 */
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(WEBHOOKS_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist or we're in a read-only environment
  }
}

/**
 * Read all subscriptions from storage
 */
export async function getSubscriptions(): Promise<WebhookSubscription[]> {
  await ensureDir();
  try {
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, 'utf-8');
    return JSON.parse(data) as WebhookSubscription[];
  } catch {
    // File doesn't exist yet
    return [];
  }
}

/**
 * Get a single subscription by ID
 */
export async function getSubscriptionById(id: string): Promise<WebhookSubscription | null> {
  const subscriptions = await getSubscriptions();
  return subscriptions.find((s) => s.id === id) || null;
}

/**
 * Get all subscriptions for a specific webhook
 */
export async function getSubscriptionsByWebhookId(
  webhookId: string,
): Promise<WebhookSubscription[]> {
  const subscriptions = await getSubscriptions();
  return subscriptions.filter((s) => s.webhookId === webhookId);
}

/**
 * Create a new webhook subscription
 */
export async function createSubscription(
  webhookId: string,
  name: string,
  eventTypes: WebhookEventType[],
  options?: {
    description?: string;
    productEventFilter?: {
      types?: ProductEventType[];
      productIds?: string[];
    };
    retryPolicy?: {
      maxRetries?: number;
      backoffMs?: number;
      maxBackoffMs?: number;
    };
  },
): Promise<WebhookSubscription> {
  await ensureDir();
  const id = randomBytes(16).toString('hex');
  const now = Date.now();

  const subscription: WebhookSubscription = {
    id,
    webhookId,
    name,
    description: options?.description,
    eventTypes,
    productEventFilter: options?.productEventFilter,
    retryPolicy: {
      maxRetries: options?.retryPolicy?.maxRetries ?? 5,
      backoffMs: options?.retryPolicy?.backoffMs ?? 1000,
      maxBackoffMs: options?.retryPolicy?.maxBackoffMs ?? 3600000,
    },
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const subscriptions = await getSubscriptions();
  subscriptions.push(subscription);
  await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));

  return subscription;
}

/**
 * Update a subscription
 */
export async function updateSubscription(
  id: string,
  updates: Partial<WebhookSubscription>,
): Promise<WebhookSubscription | null> {
  await ensureDir();
  const subscriptions = await getSubscriptions();
  const index = subscriptions.findIndex((s) => s.id === id);

  if (index === -1) return null;

  const subscription = subscriptions[index];
  const updated: WebhookSubscription = {
    ...subscription,
    ...updates,
    id: subscription.id, // Ensure ID doesn't change
    webhookId: subscription.webhookId, // Ensure webhook ID doesn't change
    updatedAt: Date.now(),
  };

  subscriptions[index] = updated;
  await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));

  return updated;
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(id: string): Promise<boolean> {
  await ensureDir();
  const subscriptions = await getSubscriptions();
  const filtered = subscriptions.filter((s) => s.id !== id);

  if (filtered.length === subscriptions.length) return false; // Not found

  await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(filtered, null, 2));
  return true;
}

/**
 * Get active subscriptions for a specific event type and product
 */
export async function getSubscriptionsForEvent(
  eventType: WebhookEventType,
  productEventType?: ProductEventType,
  productId?: string,
): Promise<WebhookSubscription[]> {
  const subscriptions = await getSubscriptions();

  return subscriptions.filter((sub) => {
    // Must be active
    if (!sub.active) return false;

    // Must support the event type
    if (!sub.eventTypes.includes(eventType)) return false;

    // For product events, check filters
    if (eventType === 'PRODUCT_EVENT_CHANGED') {
      const filter = sub.productEventFilter;
      if (filter) {
        // Check product event type filter
        if (filter.types && filter.types.length > 0 && productEventType) {
          if (!filter.types.includes(productEventType)) return false;
        }

        // Check product ID filter
        if (filter.productIds && filter.productIds.length > 0 && productId) {
          if (!filter.productIds.includes(productId)) return false;
        }
      }
    }

    return true;
  });
}

/**
 * Mark subscription as triggered (update lastTriggeredAt)
 */
export async function updateSubscriptionTrigger(id: string): Promise<WebhookSubscription | null> {
  return updateSubscription(id, {
    lastTriggeredAt: Date.now(),
  });
}

/**
 * Delete all subscriptions for a webhook (called when webhook is deleted)
 */
export async function deleteSubscriptionsByWebhookId(webhookId: string): Promise<number> {
  const subscriptions = await getSubscriptions();
  const filtered = subscriptions.filter((s) => s.webhookId !== webhookId);
  const deletedCount = subscriptions.length - filtered.length;

  if (deletedCount > 0) {
    await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(filtered, null, 2));
  }

  return deletedCount;
}
