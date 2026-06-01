/**
 * Certification Chain Explorer Service (#496)
 * Handles exploration of certification dependencies and relationships
 */

export interface CertificationChainLink {
  from_cert_id: string;
  to_cert_id: string;
  link_type: 'depends_on' | 'supersedes' | 'related';
  created_at: number;
}

export interface CertificationNode {
  cert_id: string;
  cert_type: string;
  issuer: string;
  issued_at: number;
  revoked: boolean;
  dependencies: string[];
  dependents: string[];
}

export interface CertificationChain {
  root_cert_id: string;
  nodes: CertificationNode[];
  links: CertificationChainLink[];
  depth: number;
}

/**
 * Build a certification chain from links
 */
export function buildCertificationChain(
  rootCertId: string,
  links: CertificationChainLink[],
  certifications: Map<string, any>,
): CertificationChain {
  const nodes = new Map<string, CertificationNode>();
  const visited = new Set<string>();

  function traverse(certId: string, depth: number = 0): void {
    if (visited.has(certId) || depth > 10) return;
    visited.add(certId);

    const cert = certifications.get(certId);
    if (!cert) return;

    const node: CertificationNode = {
      cert_id: certId,
      cert_type: cert.cert_type,
      issuer: cert.issuer,
      issued_at: cert.issued_at,
      revoked: cert.revoked,
      dependencies: [],
      dependents: [],
    };

    // Find dependencies (links where this cert is the target)
    links.forEach((link) => {
      if (link.to_cert_id === certId && link.link_type === 'depends_on') {
        node.dependencies.push(link.from_cert_id);
        traverse(link.from_cert_id, depth + 1);
      }
    });

    // Find dependents (links where this cert is the source)
    links.forEach((link) => {
      if (link.from_cert_id === certId && link.link_type === 'depends_on') {
        node.dependents.push(link.to_cert_id);
        traverse(link.to_cert_id, depth + 1);
      }
    });

    nodes.set(certId, node);
  }

  traverse(rootCertId);

  return {
    root_cert_id: rootCertId,
    nodes: Array.from(nodes.values()),
    links,
    depth: Math.max(...Array.from(nodes.values()).map((n) => n.dependencies.length), 0),
  };
}

/**
 * Check if a certification chain is valid (no circular dependencies)
 */
export function isValidCertificationChain(chain: CertificationChain): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(certId: string): boolean {
    visited.add(certId);
    recursionStack.add(certId);

    const node = chain.nodes.find((n) => n.cert_id === certId);
    if (!node) return false;

    for (const dep of node.dependencies) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) return true;
      } else if (recursionStack.has(dep)) {
        return true;
      }
    }

    recursionStack.delete(certId);
    return false;
  }

  for (const node of chain.nodes) {
    if (!visited.has(node.cert_id)) {
      if (hasCycle(node.cert_id)) return false;
    }
  }

  return true;
}

/**
 * Get all certifications that depend on a given certification
 */
export function getDependentCertifications(
  certId: string,
  chain: CertificationChain,
): CertificationNode[] {
  const node = chain.nodes.find((n) => n.cert_id === certId);
  if (!node) return [];

  return chain.nodes.filter((n) => node.dependents.includes(n.cert_id));
}
