# Supply-Link Contract Error Codes

This document describes all typed errors emitted by the `SupplyLinkContract` on-chain (#390).

Soroban surfaces contract errors as strings in the format `Error(Contract, #<code>)`.
The frontend maps these codes using `parseContractError` in
[`lib/stellar/contract-errors.ts`](../lib/stellar/contract-errors.ts).

---

## Error table

| Code | Name | Recoverable | Description |
|------|------|-------------|-------------|
| 1 | `ProductNotFound` | No | No product with the given ID exists on-chain. |
| 2 | `ProductAlreadyExists` | Yes | A product with this ID is already registered. Choose a different ID. |
| 3 | `UnauthorizedActor` | No | The calling wallet is not the owner or an authorized actor for this product. |
| 4 | `OwnershipMismatch` | No | The provided owner address does not match the current on-chain owner. |
| 5 | `InvalidEventPayload` | Yes | The tracking event data is malformed or missing required fields. |
| 6 | `ProductRecalled` | No | The product has been recalled. New tracking events cannot be added until the recall is lifted. |
| 7 | `SelfTransferNotAllowed` | Yes | Ownership cannot be transferred to the current owner. Provide a different address. |

---

## Recoverable vs non-recoverable

- **Recoverable** — the user can fix their input and retry the transaction.
- **Non-recoverable** — the action is blocked by on-chain state; the user must take a different action (e.g. contact the product owner, or use a different product ID).

---

## Usage in the frontend

```typescript
import { parseContractError } from "@/lib/stellar/contract-errors";

try {
  await client.addTrackingEvent(/* ... */);
} catch (err) {
  const contractErr = parseContractError(err);
  if (contractErr) {
    console.error(`[${contractErr.code}] ${contractErr.title}: ${contractErr.message}`);
    if (!contractErr.recoverable) {
      // Show a blocking error UI
    }
  }
}
```

---

## Rust enum (lib.rs)

```rust
#[contracterror]
#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u32)]
pub enum ContractError {
    ProductNotFound        = 1,
    ProductAlreadyExists   = 2,
    UnauthorizedActor      = 3,
    OwnershipMismatch      = 4,
    InvalidEventPayload    = 5,
    ProductRecalled        = 6,
    SelfTransferNotAllowed = 7,
}
```
