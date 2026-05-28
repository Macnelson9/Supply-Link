export type EventType = "HARVEST" | "PROCESSING" | "SHIPPING" | "RETAIL";

export interface OwnershipRecord {
  owner: string;
  transferredAt: number;
}

export interface Product {
  id: string;
  name: string;
  origin: string;
  owner: string;
  timestamp: number;
  active: boolean;
  authorizedActors: string[];
  ownershipHistory?: OwnershipRecord[];
  /** true while an on-chain transaction is in-flight (#49) */
  pending?: boolean;
  /** Whether this product has been recalled (#393) */
  recalled?: boolean;
  /** Reason provided when the product was recalled (#393) */
  recallReason?: string;
  /** Ledger timestamp when the product was recalled; 0 if never recalled (#393) */
  recallTimestamp?: number;
  /** Schema version of this record (#392) */
  schemaVersion?: number;
}

export interface TrackingEvent {
  productId: string;
  location: string;
  actor: string;
  timestamp: number;
  eventType: EventType;
  metadata: string;
  /** true while an on-chain transaction is in-flight (#49) */
  pending?: boolean;
  /** Schema version of this record (#392) */
  schemaVersion?: number;
}
