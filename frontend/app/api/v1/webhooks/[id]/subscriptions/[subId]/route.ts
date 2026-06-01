/**
 * Re-export handlers from parent route.ts
 * This file handles nested routing for individual subscriptions.
 *
 * GET    /api/v1/webhooks/[id]/subscriptions/[subId]   - Get subscription details
 * PATCH  /api/v1/webhooks/[id]/subscriptions/[subId]   - Update a subscription
 * DELETE /api/v1/webhooks/[id]/subscriptions/[subId]   - Delete a subscription
 */

export { GET, PATCH, DELETE } from '../route';
