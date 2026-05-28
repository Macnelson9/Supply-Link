/**
 * Tests for audit mode (#421).
 *
 * Verifies that write actions are disabled and the audit banner renders
 * when ?audit=1 is present.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  redirect: vi.fn(),
}));

vi.mock('@/lib/state/store', () => ({
  useStore: (selector: (s: { walletAddress: string | null }) => unknown) =>
    selector({ walletAddress: 'GOWNER' }),
}));

vi.mock('@/lib/stellar/client', () => ({
  addAuthorizedActor: vi.fn(),
  removeAuthorizedActor: vi.fn(),
}));

vi.mock('@/lib/api/approvalLog', () => ({
  recordApprovalEvent: vi.fn(),
}));

vi.mock('@/lib/validators', () => ({
  stellarAddressSchema: {
    safeParse: (v: string) => ({ success: v.startsWith('G') && v.length === 56 }),
  },
}));

vi.mock('@/components/products/InviteButton', () => ({
  InviteButton: () => React.createElement('button', null, 'Invite'),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAuditMode', () => {
  it('returns false when audit param is absent', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    const { useAuditMode } = await import('@/lib/hooks/useAuditMode');
    expect(useAuditMode()).toBe(false);
  });

  it('returns true when ?audit=1 is present', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('audit=1'));
    const { useAuditMode } = await import('@/lib/hooks/useAuditMode');
    expect(useAuditMode()).toBe(true);
  });
});

describe('AuditModeBanner', () => {
  it('renders nothing when audit mode is off', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    const { AuditModeBanner } = await import('@/components/layouts/AuditModeBanner');
    const { container } = render(React.createElement(AuditModeBanner));
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner when audit mode is on', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('audit=1'));
    const { AuditModeBanner } = await import('@/components/layouts/AuditModeBanner');
    render(React.createElement(AuditModeBanner));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/audit mode/i)).toBeTruthy();
  });
});

describe('AuthorizedActorsPanel in audit mode', () => {
  it('hides the add-actor form and disables remove buttons in audit mode', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('audit=1'));
    const { AuthorizedActorsPanel } = await import('@/components/products/AuthorizedActorsPanel');
    render(
      React.createElement(AuthorizedActorsPanel, {
        productId: 'p1',
        initialActors: ['GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
      }),
    );

    // Add form should not be present
    expect(screen.queryByPlaceholderText(/G\.\.\. Stellar address/)).toBeNull();

    // Remove button should be disabled
    const removeBtn = screen.getByRole('button', { name: /remove/i });
    expect(removeBtn).toHaveAttribute('disabled');
  });
});
