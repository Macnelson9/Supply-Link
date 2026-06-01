/**
 * Guardian handover and emergency key rotation (#478).
 *
 * Provides contract stubs for:
 *   - propose_guardian_handover
 *   - accept_guardian_handover
 *   - cancel_guardian_handover
 *   - rotate_guardian_key
 *
 * All write methods follow the same pattern as contractClient in contract.ts:
 * build → simulate → sign → submit.
 */
import {
  Contract,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { signTransaction, NETWORK_PASSPHRASE, RPC_URL, CONTRACT_ID } from './client';
import { withContractRetry, withContractWriteRetry } from '@/lib/resilience';
import { recordDependency, recordOperation } from '@/lib/api/metrics';
import type { GuardianHandoverProposal } from '@/lib/types';
import { kvStore } from '@/lib/kv';

const server = new rpc.Server(RPC_URL);

// KV key helpers
const kvKeyHandover = (productId: string) => `guardian:handover:${productId}`;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function buildSignAndSubmit(
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  callerAddress: string,
): Promise<string> {
  const account = await server.getAccount(callerAddress);
  const contract = new Contract(CONTRACT_ID);

  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args.map((a) => nativeToScVal(a))))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }
  tx = rpc.assembleTransaction(tx, simulated).build();

  const signed = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
  const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);

  const result = await server.sendTransaction(signedTx);
  return result.hash;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const guardianHandoverClient = {
  /**
   * Propose a guardian handover for a product.
   * The current guardian initiates the transfer to a proposed new guardian.
   */
  async proposeHandover(
    productId: string,
    proposedGuardian: string,
    callerAddress: string,
  ): Promise<string> {
    return withContractWriteRetry(() =>
      buildSignAndSubmit(
        'propose_guardian_handover',
        [productId, new Address(proposedGuardian)],
        callerAddress,
      ),
    )
      .then(async (hash) => {
        recordDependency('soroban-rpc', true);
        recordOperation('guardian.propose_handover', 'success');

        // Persist proposal state in KV for UI polling
        const proposal: GuardianHandoverProposal = {
          productId,
          currentGuardian: callerAddress,
          proposedGuardian,
          proposedAt: Date.now(),
          status: 'proposed',
          nonce: Date.now(), // replaced by on-chain nonce in production
        };
        await kvStore.set(kvKeyHandover(productId), JSON.stringify(proposal), 86400);

        return hash;
      })
      .catch((err) => {
        recordDependency('soroban-rpc', false);
        recordOperation('guardian.propose_handover', 'failure');
        throw err;
      });
  },

  /**
   * Accept a pending guardian handover proposal.
   * Must be called by the proposed new guardian.
   */
  async acceptHandover(productId: string, callerAddress: string): Promise<string> {
    return withContractWriteRetry(() =>
      buildSignAndSubmit('accept_guardian_handover', [productId], callerAddress),
    )
      .then(async (hash) => {
        recordDependency('soroban-rpc', true);
        recordOperation('guardian.accept_handover', 'success');

        const raw = await kvStore.get(kvKeyHandover(productId));
        if (raw) {
          const proposal: GuardianHandoverProposal = JSON.parse(raw);
          await kvStore.set(
            kvKeyHandover(productId),
            JSON.stringify({ ...proposal, status: 'accepted' }),
            86400,
          );
        }

        return hash;
      })
      .catch((err) => {
        recordDependency('soroban-rpc', false);
        recordOperation('guardian.accept_handover', 'failure');
        throw err;
      });
  },

  /**
   * Cancel a pending guardian handover proposal.
   * Can be called by the current guardian.
   */
  async cancelHandover(productId: string, callerAddress: string): Promise<string> {
    return withContractWriteRetry(() =>
      buildSignAndSubmit('cancel_guardian_handover', [productId], callerAddress),
    )
      .then(async (hash) => {
        recordDependency('soroban-rpc', true);
        recordOperation('guardian.cancel_handover', 'success');
        await kvStore.del(kvKeyHandover(productId));
        return hash;
      })
      .catch((err) => {
        recordDependency('soroban-rpc', false);
        recordOperation('guardian.cancel_handover', 'failure');
        throw err;
      });
  },

  /**
   * Emergency key rotation — replaces the guardian key for a product.
   * Requires the current guardian to sign with the existing key.
   */
  async rotateGuardianKey(
    productId: string,
    newGuardianKey: string,
    callerAddress: string,
  ): Promise<string> {
    return withContractWriteRetry(() =>
      buildSignAndSubmit(
        'rotate_guardian_key',
        [productId, new Address(newGuardianKey)],
        callerAddress,
      ),
    )
      .then((hash) => {
        recordDependency('soroban-rpc', true);
        recordOperation('guardian.rotate_key', 'success');
        return hash;
      })
      .catch((err) => {
        recordDependency('soroban-rpc', false);
        recordOperation('guardian.rotate_key', 'failure');
        throw err;
      });
  },

  /** Fetch the current handover proposal from KV (for UI polling). */
  async getHandoverProposal(productId: string): Promise<GuardianHandoverProposal | null> {
    return withContractRetry(async () => {
      const raw = await kvStore.get(kvKeyHandover(productId));
      return raw ? (JSON.parse(raw) as GuardianHandoverProposal) : null;
    });
  },
};
