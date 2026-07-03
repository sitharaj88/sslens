/**
 * SSLens - Copilot Shared Helpers
 * Normalizes user/model-provided targets and renders certificate data
 * into compact, LLM-friendly summaries shared by the chat participant
 * and the language model tools.
 */

import * as vscode from 'vscode';
import { SSLService } from '../services/sslService';
import { CertificateChain, CertificateInfo } from '../types';

export interface Target {
  domain: string;
  port: number;
}

/**
 * Normalize a domain/URL string (possibly with scheme, path, or port)
 * into a { domain, port } pair.
 */
export function normalizeTarget(input: string, defaultPort?: number): Target {
  const fallbackPort = defaultPort ?? vscode.workspace.getConfiguration('sslens').get<number>('defaultPort', 443);
  let value = input.trim();

  // Strip scheme and path if a full URL was given
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
      const url = new URL(value);
      return {
        domain: url.hostname,
        port: url.port ? parseInt(url.port, 10) : fallbackPort,
      };
    }
  } catch {
    // fall through to manual parsing
  }

  // Strip any path fragment
  value = value.split('/')[0];

  // host:port form (avoid mangling IPv6 literals without brackets)
  const match = value.match(/^(.+):(\d{1,5})$/);
  if (match && !value.includes(']') && value.indexOf(':') === value.lastIndexOf(':')) {
    return { domain: match[1], port: parseInt(match[2], 10) };
  }

  return { domain: value.replace(/^\[|\]$/g, ''), port: fallbackPort };
}

/**
 * Extract candidate hostnames from free-form text (a chat prompt).
 */
export function extractTargets(text: string): Target[] {
  const targets: Target[] = [];
  const seen = new Set<string>();

  const urlRegex = /https?:\/\/[^\s"'`<>)\]]+/g;
  const hostRegex = /\b((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})(?::(\d{1,5}))?\b/g;

  for (const match of text.matchAll(urlRegex)) {
    const target = normalizeTarget(match[0]);
    const key = `${target.domain}:${target.port}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(target);
    }
  }

  const withoutUrls = text.replace(urlRegex, ' ');
  for (const match of withoutUrls.matchAll(hostRegex)) {
    const target = normalizeTarget(match[2] ? `${match[1]}:${match[2]}` : match[1]);
    const key = `${target.domain}:${target.port}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(target);
    }
  }

  return targets;
}

/**
 * Create an SSLService honoring the user's configured timeout.
 */
export function createSslService(): SSLService {
  const timeout = vscode.workspace.getConfiguration('sslens').get<number>('timeout', 10000);
  return new SSLService(timeout);
}

/**
 * Compact single-certificate summary (no raw PEM/DER) safe to hand to a model.
 */
export function summarizeCertificate(cert: CertificateInfo): Record<string, unknown> {
  return {
    subject: {
      commonName: cert.subject.commonName,
      organization: cert.subject.organization,
      country: cert.subject.country,
    },
    issuer: {
      commonName: cert.issuer.commonName,
      organization: cert.issuer.organization,
    },
    validity: {
      notBefore: new Date(cert.validFrom).toISOString(),
      notAfter: new Date(cert.validTo).toISOString(),
      isExpired: cert.isExpired,
      daysUntilExpiry: cert.daysUntilExpiry,
    },
    serialNumber: cert.serialNumber,
    signatureAlgorithm: cert.signatureAlgorithm,
    publicKey: {
      algorithm: cert.publicKey.algorithm,
      keySize: cert.publicKey.keySize,
    },
    fingerprints: {
      sha256: cert.fingerprints.sha256,
      sha1: cert.fingerprints.sha1,
    },
    pinning: {
      publicKeyHashSha256Base64: cert.publicKeyHash,
      spkiPin: cert.spkiHash,
    },
    subjectAltNames: cert.subjectAltNames.slice(0, 50),
    keyUsage: cert.keyUsage,
    isRootCA: cert.isRootCA,
  };
}

/**
 * Full chain summary as a JSON-serializable object.
 */
export function summarizeChain(chain: CertificateChain): Record<string, unknown> {
  return {
    domain: chain.domain,
    port: chain.port,
    chainIsTrusted: chain.isValid,
    validationError: chain.validationError,
    chainLength: chain.certificates.length,
    certificates: chain.certificates.map((cert, index) => ({
      position: index === 0 ? 'leaf' : index === chain.certificates.length - 1 ? 'root' : `intermediate-${index}`,
      ...summarizeCertificate(cert),
    })),
  };
}

/**
 * Human-readable markdown report for a leaf certificate, used for
 * chat responses when no language model is available.
 */
export function renderCertificateMarkdown(chain: CertificateChain): string {
  const cert = chain.certificates[0];
  const expiryIcon = cert.isExpired ? '❌' : cert.daysUntilExpiry <= 30 ? '⚠️' : '✅';
  const trustIcon = chain.isValid ? '✅ Trusted' : `⚠️ Not trusted (${chain.validationError ?? 'unknown reason'})`;

  const lines = [
    `### 🔐 ${cert.subject.commonName || chain.domain}`,
    '',
    `| Field | Value |`,
    `| --- | --- |`,
    `| Host | \`${chain.domain}:${chain.port}\` |`,
    `| Issuer | ${cert.issuer.organization ?? cert.issuer.commonName} |`,
    `| Valid until | ${new Date(cert.validTo).toUTCString()} |`,
    `| Expiry | ${expiryIcon} ${cert.isExpired ? 'EXPIRED' : `${cert.daysUntilExpiry} days remaining`} |`,
    `| Chain trust | ${trustIcon} |`,
    `| Public key | ${cert.publicKey.algorithm} ${cert.publicKey.keySize}-bit |`,
    `| Signature | ${cert.signatureAlgorithm} |`,
    `| SHA-256 | \`${cert.fingerprints.sha256}\` |`,
    `| SPKI pin | \`${cert.spkiHash}\` |`,
  ];

  if (cert.subjectAltNames.length > 0) {
    const sans = cert.subjectAltNames.slice(0, 8).join(', ');
    const more = cert.subjectAltNames.length > 8 ? ` (+${cert.subjectAltNames.length - 8} more)` : '';
    lines.push(`| SANs | ${sans}${more} |`);
  }

  if (chain.certificates.length > 1) {
    lines.push('', `**Chain** (${chain.certificates.length} certificates):`);
    chain.certificates.forEach((c, i) => {
      const role = i === 0 ? 'Leaf' : i === chain.certificates.length - 1 ? 'Root' : 'Intermediate';
      lines.push(`${i + 1}. ${role} — ${c.subject.commonName} _(issued by ${c.issuer.commonName})_`);
    });
  }

  return lines.join('\n');
}
