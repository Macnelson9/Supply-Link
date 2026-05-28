export type EventType = 'HARVEST' | 'PROCESSING' | 'SHIPPING' | 'RETAIL';
export type ProductStatus = 'active' | 'inactive';

export interface TemplateStage {
  label: string;
  eventType: EventType;
}

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
  status?: ProductStatus;
  authorizedActors: string[];
  ownershipHistory?: OwnershipRecord[];
  /** Number of signatures required for events (0 or 1 = immediate, >1 = multi-sig) */
  requiredSignatures?: number;
  /** true while an on-chain transaction is in-flight (#49) */
  pending?: boolean;
  /** Off-chain image URL stored in product metadata (#112) */
  imageUrl?: string;
}

export interface TrackingEvent {
  productId: string;
  location: string;
  actor: string;
  timestamp: number;
  eventType: EventType;
  metadata: string;
  /**
   * Hex commitment (SHA-256) of the off-chain encrypted metadata payload (#409).
   * Empty/undefined for public events.
   */
  metadataCommitment?: string;
  /**
   * true when this event's metadata is private: encrypted off-chain with only
   * the commitment on-chain (#409). `metadata` is empty for such events.
   */
  privateMetadata?: boolean;
  /** true while an on-chain transaction is in-flight (#49) */
  pending?: boolean;
}

export interface PendingEvent {
  productId: string;
  event: TrackingEvent;
  approvals: string[];
  requiredSignatures: number;
  createdAt: number;
}

export interface Notification {
  id: string; // `${productId}-${timestamp}`
  productId: string;
  productName: string;
  eventType: EventType;
  location: string;
  actor: string;
  timestamp: number;
  read: boolean;
}

export interface TransactionResult {
  hash: string;
  status: 'success' | 'failed' | 'pending';
  fee: string;
  timestamp: number;
}

export interface ContractError {
  code: number;
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface Rating {
  id: string;
  productId: string;
  walletAddress: string;
  stars: number;
  comment: string | null;
  timestamp: number;
}
