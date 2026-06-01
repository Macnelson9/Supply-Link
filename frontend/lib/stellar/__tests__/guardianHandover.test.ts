import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardianHandoverClient } from '../guardianHandover';
import { kvStore } from '@/lib/kv';

// Mock the Stellar SDK and client dependencies
vi.mock('@stellar/stellar-sdk', () => ({
  Contract: vi.fn(),
  rpc: {
    Server: vi.fn(() => ({
      getAccount: vi.fn().mockResolvedValue({ id: 'GCALLER', sequence: '1' }),
      simulateTransaction: vi.fn().mockResolvedValue({ result: { retval: null } }),
      sendTransaction: vi.fn().mockResolvedValue({ hash: 'mock-hash-abc' }),
    })),
    Api: { isSimulationSuccess: vi.fn().mockReturnValue(true) },
    assembleTransaction: vi.fn().mockReturnValue({ build: vi.fn().mockReturnValue({ toXDR: vi.fn().mockReturnValue('xdr') }) }),
  },
  TransactionBuilder: vi.fn(() => ({
    addOperation: vi.fn().mockReturnThis(),
    setTimeout: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue({ toXDR: vi.fn().mockReturnValue('xdr') }),
    fromXDR: vi.fn(),
  })),
  BASE_FEE: '100',
  Address: vi.fn((addr) => addr),
  nativeToScVal: vi.fn((v) => v),
  scValToNative: vi.fn((v) => v),
}));

vi.mock('../client', () => ({
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'signed-xdr' }),
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  RPC_URL: 'https://soroban-testnet.stellar.org',
  CONTRACT_ID: 'CTEST',
  getNetwork: vi.fn().mockReturnValue('testnet'),
}));

vi.mock('@/lib/resilience', () => ({
  withContractRetry: vi.fn((fn) => fn()),
  withContractWriteRetry: vi.fn((fn) => fn()),
}));

vi.mock('@/lib/api/metrics', () => ({
  recordDependency: vi.fn(),
  recordOperation: vi.fn(),
}));

const PRODUCT_ID = 'prod-001';
const CALLER = 'GCALLER123';
const PROPOSED = 'GPROPOSED456';

beforeEach(() => {
  // Clear KV between tests
  vi.spyOn(kvStore, 'set').mockResolvedValue(undefined);
  vi.spyOn(kvStore, 'get').mockResolvedValue(null);
  vi.spyOn(kvStore, 'del').mockResolvedValue(undefined);
});

describe('guardianHandoverClient.proposeHandover', () => {
  it('stores a proposal in KV after successful contract call', async () => {
    await guardianHandoverClient.proposeHandover(PRODUCT_ID, PROPOSED, CALLER);
    expect(kvStore.set).toHaveBeenCalledWith(
      `guardian:handover:${PRODUCT_ID}`,
      expect.stringContaining('"status":"proposed"'),
      86400,
    );
  });
});

describe('guardianHandoverClient.acceptHandover', () => {
  it('updates proposal status to accepted in KV', async () => {
    const existing = JSON.stringify({
      productId: PRODUCT_ID,
      currentGuardian: CALLER,
      proposedGuardian: PROPOSED,
      proposedAt: Date.now(),
      status: 'proposed',
      nonce: 1,
    });
    vi.spyOn(kvStore, 'get').mockResolvedValue(existing);

    await guardianHandoverClient.acceptHandover(PRODUCT_ID, PROPOSED);

    expect(kvStore.set).toHaveBeenCalledWith(
      `guardian:handover:${PRODUCT_ID}`,
      expect.stringContaining('"status":"accepted"'),
      86400,
    );
  });
});

describe('guardianHandoverClient.cancelHandover', () => {
  it('deletes the proposal from KV', async () => {
    await guardianHandoverClient.cancelHandover(PRODUCT_ID, CALLER);
    expect(kvStore.del).toHaveBeenCalledWith(`guardian:handover:${PRODUCT_ID}`);
  });
});

describe('guardianHandoverClient.getHandoverProposal', () => {
  it('returns null when no proposal exists', async () => {
    const result = await guardianHandoverClient.getHandoverProposal(PRODUCT_ID);
    expect(result).toBeNull();
  });

  it('returns parsed proposal when one exists', async () => {
    const proposal = {
      productId: PRODUCT_ID,
      currentGuardian: CALLER,
      proposedGuardian: PROPOSED,
      proposedAt: 1000,
      status: 'proposed',
      nonce: 1,
    };
    vi.spyOn(kvStore, 'get').mockResolvedValue(JSON.stringify(proposal));
    const result = await guardianHandoverClient.getHandoverProposal(PRODUCT_ID);
    expect(result?.status).toBe('proposed');
    expect(result?.proposedGuardian).toBe(PROPOSED);
  });
});
