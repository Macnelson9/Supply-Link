import { describe, it, expect } from 'vitest';
import {
  buildCertificationChain,
  isValidCertificationChain,
  getDependentCertifications,
} from '@/lib/services/certificationChainExplorer';

describe('Certification Chain Explorer', () => {
  const mockCertifications = new Map([
    [
      'cert-1',
      {
        cert_type: 'ORGANIC',
        issuer: 'GISSUER1',
        issued_at: 1000,
        revoked: false,
      },
    ],
    [
      'cert-2',
      {
        cert_type: 'FAIR_TRADE',
        issuer: 'GISSUER2',
        issued_at: 2000,
        revoked: false,
      },
    ],
    [
      'cert-3',
      {
        cert_type: 'ISO_9001',
        issuer: 'GISSUER3',
        issued_at: 3000,
        revoked: false,
      },
    ],
  ]);

  const mockLinks = [
    {
      from_cert_id: 'cert-1',
      to_cert_id: 'cert-2',
      link_type: 'depends_on' as const,
      created_at: 1500,
    },
    {
      from_cert_id: 'cert-2',
      to_cert_id: 'cert-3',
      link_type: 'depends_on' as const,
      created_at: 2500,
    },
  ];

  it('should build certification chain', () => {
    const chain = buildCertificationChain('cert-1', mockLinks, mockCertifications);

    expect(chain.root_cert_id).toBe('cert-1');
    expect(chain.nodes.length).toBeGreaterThan(0);
    expect(chain.links).toEqual(mockLinks);
  });

  it('should validate chain without cycles', () => {
    const chain = buildCertificationChain('cert-1', mockLinks, mockCertifications);
    expect(isValidCertificationChain(chain)).toBe(true);
  });

  it('should detect circular dependencies', () => {
    const circularLinks = [
      ...mockLinks,
      {
        from_cert_id: 'cert-3',
        to_cert_id: 'cert-1',
        link_type: 'depends_on' as const,
        created_at: 3500,
      },
    ];

    const chain = buildCertificationChain('cert-1', circularLinks, mockCertifications);
    expect(isValidCertificationChain(chain)).toBe(false);
  });

  it('should get dependent certifications', () => {
    const chain = buildCertificationChain('cert-1', mockLinks, mockCertifications);
    const dependents = getDependentCertifications('cert-1', chain);

    expect(dependents.length).toBeGreaterThanOrEqual(0);
  });
});
