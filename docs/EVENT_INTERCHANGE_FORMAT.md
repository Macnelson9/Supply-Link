# Supply-Link Event Interchange Format

Version: **1.0.0**

This document describes the standard interchange format for exporting product event histories from Supply-Link to external integration partners.

---

## Overview

The interchange format is a JSON-LD document that carries a product's full supply-chain event history in a self-describing, semantically rich envelope. Partners can consume it as plain JSON or as Linked Data.

**Endpoint:**
```
GET /api/v1/events/export?productId=<id>
```

**Authentication:** `x-api-key` header (partner tier or higher)

---

## Request Parameters

| Parameter   | Type    | Required | Default | Description                                      |
|-------------|---------|----------|---------|--------------------------------------------------|
| `productId` | string  | yes      | —       | The product ID to export                         |
| `offset`    | integer | no       | `0`     | Pagination offset (zero-based)                   |
| `limit`     | integer | no       | `100`   | Max events per page (max `500`)                  |
| `format`    | string  | no       | `json`  | `json` or `jsonld` (sets `application/ld+json`)  |

---

## Response Envelope

```json
{
  "@context": "https://supply-link.app/schemas/event-interchange/v1",
  "@type": "SupplyChainEventHistory",
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-05-30T12:00:00.000Z",
  "source": "supply-link",
  "product": { ... },
  "events": [ ... ],
  "totalEvents": 4,
  "offset": 0,
  "limit": 100
}
```

### Top-level fields

| Field           | Type    | Description                                                  |
|-----------------|---------|--------------------------------------------------------------|
| `@context`      | string  | JSON-LD context URI for semantic consumers                   |
| `@type`         | string  | Always `"SupplyChainEventHistory"`                           |
| `schemaVersion` | string  | Interchange schema version — check this before parsing       |
| `exportedAt`    | string  | ISO 8601 UTC timestamp of export generation                  |
| `source`        | string  | Always `"supply-link"`                                       |
| `product`       | object  | Product summary (see below)                                  |
| `events`        | array   | Ordered list of events, oldest first                         |
| `totalEvents`   | integer | Total events for the product (across all pages)              |
| `offset`        | integer | Offset of the first event in this payload                    |
| `limit`         | integer | Max events per page requested                                |

---

## Product Object

```json
{
  "@type": "Product",
  "id": "prod-001",
  "name": "Organic Coffee Beans",
  "origin": "Ethiopia",
  "owner": "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "registeredAt": "2024-03-10T00:00:00.000Z",
  "active": true,
  "category": "agricultural",
  "subcategory": "coffee"
}
```

| Field          | Type    | Description                                      |
|----------------|---------|--------------------------------------------------|
| `@type`        | string  | Always `"Product"`                               |
| `id`           | string  | Unique product identifier                        |
| `name`         | string  | Human-readable product name                      |
| `origin`       | string  | Geographic or organisational origin              |
| `owner`        | string  | Stellar wallet address of the current owner      |
| `registeredAt` | string  | ISO 8601 UTC registration timestamp              |
| `active`       | boolean | Whether the product is currently active          |
| `category`     | string  | Taxonomy category (optional)                     |
| `subcategory`  | string  | Taxonomy subcategory (optional)                  |

---

## Event Object

```json
{
  "@type": "SupplyChainEvent",
  "id": "a1b2c3d4e5f6...",
  "productId": "prod-001",
  "eventType": "HARVEST",
  "location": "Yirgacheffe, Ethiopia",
  "actor": "GACTOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
  "occurredAt": "2024-03-10T00:00:00.000Z",
  "metadata": {
    "notes": "Hand-picked, shade-grown",
    "lat": 6.1667,
    "lng": 38.2
  },
  "sourceSchemaVersion": 2
}
```

| Field                 | Type   | Description                                                        |
|-----------------------|--------|--------------------------------------------------------------------|
| `@type`               | string | Always `"SupplyChainEvent"`                                        |
| `id`                  | string | Stable deterministic event ID (SHA-256 hex from on-chain `stableId`, or generated fallback) |
| `productId`           | string | ID of the product this event belongs to                            |
| `eventType`           | string | `HARVEST` \| `PROCESSING` \| `SHIPPING` \| `RETAIL` (or custom)   |
| `location`            | string | Where the event occurred                                           |
| `actor`               | string | Stellar wallet address of the recording actor                      |
| `occurredAt`          | string | ISO 8601 UTC timestamp                                             |
| `metadata`            | object | Parsed event metadata (arbitrary key-value pairs)                  |
| `sourceSchemaVersion` | number | Schema version of the source on-chain record (optional)            |

### Event types

| Value        | Description                                      |
|--------------|--------------------------------------------------|
| `HARVEST`    | Raw material collection / origin event           |
| `PROCESSING` | Transformation or manufacturing step             |
| `SHIPPING`   | Logistics / transport event                      |
| `RETAIL`     | Final distribution or sale event                 |

---

## Pagination

Use `offset` and `limit` to page through large event histories:

```
GET /api/v1/events/export?productId=prod-001&offset=0&limit=50
GET /api/v1/events/export?productId=prod-001&offset=50&limit=50
```

The `totalEvents` field in the response tells you the total count so you can calculate the number of pages.

---

## Content-Type

| `format` param | `Content-Type` response header |
|----------------|-------------------------------|
| `json` (default) | `application/json`          |
| `jsonld`         | `application/ld+json`       |

---

## Example: Full Export

```bash
curl -H "x-api-key: sl_partner_..." \
  "https://supply-link.app/api/v1/events/export?productId=prod-001"
```

```json
{
  "@context": "https://supply-link.app/schemas/event-interchange/v1",
  "@type": "SupplyChainEventHistory",
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-05-30T12:00:00.000Z",
  "source": "supply-link",
  "product": {
    "@type": "Product",
    "id": "prod-001",
    "name": "Organic Coffee Beans",
    "origin": "Ethiopia",
    "owner": "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "registeredAt": "2024-03-10T00:00:00.000Z",
    "active": true,
    "category": "agricultural",
    "subcategory": "coffee"
  },
  "events": [
    {
      "@type": "SupplyChainEvent",
      "id": "a1b2c3d4...",
      "productId": "prod-001",
      "eventType": "HARVEST",
      "location": "Yirgacheffe, Ethiopia",
      "actor": "GACTOR1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567",
      "occurredAt": "2024-03-10T00:00:00.000Z",
      "metadata": { "notes": "Hand-picked, shade-grown", "lat": 6.1667, "lng": 38.2 }
    }
  ],
  "totalEvents": 4,
  "offset": 0,
  "limit": 100
}
```

---

## Schema Versioning

The `schemaVersion` field in the envelope follows [Semantic Versioning](https://semver.org/):

- **Patch** (`1.0.x`) — bug fixes, no field changes
- **Minor** (`1.x.0`) — new optional fields added (backward compatible)
- **Major** (`x.0.0`) — breaking changes; consumers must update their parsers

Partners should check `schemaVersion` before parsing and reject payloads with an unsupported major version.

---

## Error Responses

All errors follow the standard Supply-Link error envelope:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "productId query parameter is required",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

| Status | Code               | Cause                              |
|--------|--------------------|------------------------------------|
| 400    | `VALIDATION_ERROR` | Missing or invalid `productId`     |
| 401    | `UNAUTHORIZED`     | Missing or invalid `x-api-key`     |
| 404    | `VALIDATION_ERROR` | Product not found                  |
| 429    | `RATE_LIMITED`     | Too many requests                  |
