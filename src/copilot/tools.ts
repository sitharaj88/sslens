/**
 * SSLens - GitHub Copilot Language Model Tools
 * Exposes SSLens capabilities to Copilot agent mode (and any chat
 * extension) via the stable vscode.lm tool API. Tool names/schemas are
 * declared in package.json under `contributes.languageModelTools`.
 */

import * as vscode from 'vscode';
import { exportService } from '../services/exportService';
import { getStorageService } from '../services/storageService';
import { PinningCodeOptions, SUPPORTED_PLATFORMS } from '../types';
import { createSslService, normalizeTarget, summarizeChain } from './certContext';

interface InspectInput {
  domain: string;
  port?: number;
}

interface PinningInput {
  domain: string;
  port?: number;
  platform: PinningCodeOptions['platform'];
  includeChainHashes?: boolean;
}

interface ExpiryInput {
  domains: string[];
}

function textResult(text: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

function errorResult(action: string, error: unknown): vscode.LanguageModelToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return textResult(JSON.stringify({ error: `Failed to ${action}: ${message}` }));
}

/**
 * Live TLS inspection of a host — returns the full parsed chain as JSON.
 */
class InspectCertificateTool implements vscode.LanguageModelTool<InspectInput> {
  prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<InspectInput>) {
    const target = normalizeTarget(options.input.domain, options.input.port);
    return {
      invocationMessage: `Fetching TLS certificate from ${target.domain}:${target.port}`,
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<InspectInput>) {
    const target = normalizeTarget(options.input.domain, options.input.port);
    try {
      const chain = await createSslService().fetchCertificateChain(target.domain, target.port);
      return textResult(JSON.stringify(summarizeChain(chain)));
    } catch (error) {
      return errorResult(`fetch certificate from ${target.domain}:${target.port}`, error);
    }
  }
}

/**
 * Generate ready-to-use certificate pinning code for a mobile platform,
 * using live SPKI hashes fetched from the host.
 */
class GeneratePinningCodeTool implements vscode.LanguageModelTool<PinningInput> {
  prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<PinningInput>) {
    const target = normalizeTarget(options.input.domain, options.input.port);
    return {
      invocationMessage: `Generating ${options.input.platform} pinning code for ${target.domain}`,
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<PinningInput>) {
    const { platform, includeChainHashes } = options.input;
    const target = normalizeTarget(options.input.domain, options.input.port);

    if (!SUPPORTED_PLATFORMS.some(p => p.id === platform)) {
      return textResult(JSON.stringify({
        error: `Unsupported platform "${platform}". Supported: ${SUPPORTED_PLATFORMS.map(p => p.id).join(', ')}`,
      }));
    }

    try {
      const chain = await createSslService().fetchCertificateChain(target.domain, target.port);
      const certs = includeChainHashes ? chain.certificates : chain.certificates.slice(0, 1);
      const hashes = certs.map(c => c.spkiHash).filter(Boolean);

      const code = exportService.generatePinningCode({
        platform,
        domains: [target.domain],
        hashes,
        includeBackup: true,
      });

      const language = SUPPORTED_PLATFORMS.find(p => p.id === platform)?.language ?? 'text';
      return textResult(JSON.stringify({
        domain: target.domain,
        platform,
        language,
        spkiHashes: hashes,
        note: 'Hashes were computed live from the current certificate chain. Recommend adding a backup pin before shipping.',
        code,
      }));
    } catch (error) {
      return errorResult(`generate pinning code for ${target.domain}`, error);
    }
  }
}

/**
 * Bulk expiry check across one or more hosts.
 */
class CheckExpiryTool implements vscode.LanguageModelTool<ExpiryInput> {
  prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<ExpiryInput>) {
    const count = options.input.domains?.length ?? 0;
    return {
      invocationMessage: `Checking certificate expiry for ${count} host${count === 1 ? '' : 's'}`,
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<ExpiryInput>) {
    const domains = options.input.domains ?? [];
    if (domains.length === 0) {
      return textResult(JSON.stringify({ error: 'No domains provided' }));
    }

    const service = createSslService();
    const results = await Promise.all(domains.slice(0, 25).map(async raw => {
      const target = normalizeTarget(raw);
      try {
        const cert = await service.fetchCertificate(target.domain, target.port);
        return {
          domain: target.domain,
          port: target.port,
          expiresAt: new Date(cert.validTo).toISOString(),
          daysUntilExpiry: cert.daysUntilExpiry,
          isExpired: cert.isExpired,
          issuer: cert.issuer.commonName,
          status: cert.isExpired ? 'expired' : cert.daysUntilExpiry <= 30 ? 'expiring-soon' : 'ok',
        };
      } catch (error) {
        return {
          domain: target.domain,
          port: target.port,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));

    return textResult(JSON.stringify({ results }));
  }
}

/**
 * List the user's saved domains (favorites) with last-check metadata.
 */
class ListSavedDomainsTool implements vscode.LanguageModelTool<Record<string, never>> {
  prepareInvocation() {
    return { invocationMessage: 'Reading saved SSLens domains' };
  }

  async invoke() {
    try {
      const domains = getStorageService().getSavedDomains();
      return textResult(JSON.stringify({
        count: domains.length,
        domains: domains.map(d => ({
          domain: d.domain,
          port: d.port,
          alias: d.alias,
          lastChecked: d.lastChecked,
          lastFingerprintSha256: d.lastFingerprint,
        })),
      }));
    } catch (error) {
      return errorResult('list saved domains', error);
    }
  }
}

/**
 * Register all SSLens language model tools.
 */
export function registerLanguageModelTools(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.lm.registerTool('sslens_inspectCertificate', new InspectCertificateTool()),
    vscode.lm.registerTool('sslens_generatePinningCode', new GeneratePinningCodeTool()),
    vscode.lm.registerTool('sslens_checkExpiry', new CheckExpiryTool()),
    vscode.lm.registerTool('sslens_listSavedDomains', new ListSavedDomainsTool()),
  );
}
