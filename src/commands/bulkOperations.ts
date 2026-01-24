/**
 * SSLens - Bulk Operations Command
 * Fetch certificates for multiple domains at once
 */

import * as vscode from 'vscode';
import { SSLService } from '../services/sslService';
import { BulkFetchResult, CertificateInfo, CertificateChain } from '../types';
import { getStorageService } from '../services/storageService';

/**
 * Bulk fetch certificates from multiple domains
 */
export async function bulkFetchCommand(context: vscode.ExtensionContext): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: 'Enter domains (comma or newline separated)',
    placeHolder: 'google.com, github.com, example.com',
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'Please enter at least one domain';
      }
      return undefined;
    }
  });

  if (!input) {
    return;
  }

  const domains = input
    .split(/[,\n]/)
    .map(d => d.trim())
    .filter(d => d.length > 0);

  if (domains.length === 0) {
    vscode.window.showWarningMessage('No valid domains provided');
    return;
  }

  const results: BulkFetchResult[] = [];
  const sslService = new SSLService();
  const storageService = getStorageService();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Fetching certificates...',
      cancellable: true,
    },
    async (progress, token) => {
      const increment = 100 / domains.length;

      for (let i = 0; i < domains.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }

        const domain = domains[i];
        progress.report({
          message: `${domain} (${i + 1}/${domains.length})`,
          increment: i === 0 ? 0 : increment
        });

        try {
          const cert = await sslService.fetchCertificate(domain, 443);
          results.push({ domain, success: true, certificate: cert });
          await storageService.addRecentCertificate(cert);
        } catch (error) {
          results.push({
            domain,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  );

  const resultsContent = formatBulkResults(results);
  const doc = await vscode.workspace.openTextDocument({
    content: resultsContent,
    language: 'markdown'
  });
  await vscode.window.showTextDocument(doc);

  vscode.commands.executeCommand('sslens.refreshDomains');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  vscode.window.showInformationMessage(
    `Bulk fetch complete: ${successful} successful, ${failed} failed`
  );
}

/**
 * Compare two certificates
 */
export async function compareCertificatesCommand(context: vscode.ExtensionContext): Promise<void> {
  const domain1 = await vscode.window.showInputBox({
    prompt: 'Enter first domain',
    placeHolder: 'example.com'
  });

  if (!domain1) {
    return;
  }

  const domain2 = await vscode.window.showInputBox({
    prompt: 'Enter second domain to compare',
    placeHolder: 'staging.example.com'
  });

  if (!domain2) {
    return;
  }

  const sslService = new SSLService();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Comparing certificates...',
      cancellable: false,
    },
    async () => {
      try {
        const [cert1, cert2] = await Promise.all([
          sslService.fetchCertificate(domain1.trim(), 443),
          sslService.fetchCertificate(domain2.trim(), 443)
        ]);

        const comparison = compareCertificates(cert1, cert2);
        const doc = await vscode.workspace.openTextDocument({
          content: comparison,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);

      } catch (error) {
        vscode.window.showErrorMessage(`Comparison failed: ${error}`);
      }
    }
  );
}

/**
 * Check expiry for all saved domains
 */
export async function checkExpiryCommand(): Promise<void> {
  const storageService = getStorageService();
  const savedDomains = storageService.getSavedDomains();

  if (savedDomains.length === 0) {
    vscode.window.showWarningMessage('No saved domains to check');
    return;
  }

  const sslService = new SSLService();
  const expiryReport: Array<{domain: string; daysLeft: number; status: string}> = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Checking certificate expiry...',
      cancellable: true,
    },
    async (progress, token) => {
      const increment = 100 / savedDomains.length;

      for (let i = 0; i < savedDomains.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }

        const saved = savedDomains[i];
        progress.report({
          message: `${saved.domain} (${i + 1}/${savedDomains.length})`,
          increment: i === 0 ? 0 : increment
        });

        try {
          const cert = await sslService.fetchCertificate(saved.domain, saved.port);
          
          let status = '✅ OK';
          if (cert.isExpired) {
            status = '❌ EXPIRED';
          } else if (cert.daysUntilExpiry < 7) {
            status = '🔴 CRITICAL';
          } else if (cert.daysUntilExpiry < 30) {
            status = '🟡 WARNING';
          }

          expiryReport.push({
            domain: `${saved.domain}:${saved.port}`,
            daysLeft: cert.daysUntilExpiry,
            status
          });
        } catch (error) {
          expiryReport.push({
            domain: `${saved.domain}:${saved.port}`,
            daysLeft: -1,
            status: '⚠️ ERROR'
          });
        }
      }
    }
  );

  expiryReport.sort((a, b) => a.daysLeft - b.daysLeft);

  const report = formatExpiryReport(expiryReport);
  const doc = await vscode.workspace.openTextDocument({
    content: report,
    language: 'markdown'
  });
  await vscode.window.showTextDocument(doc);

  const critical = expiryReport.filter(r => r.daysLeft >= 0 && r.daysLeft < 30);
  if (critical.length > 0) {
    vscode.window.showWarningMessage(
      `${critical.length} certificate(s) expiring within 30 days!`
    );
  }
}

/**
 * Validate certificate chain
 */
export async function validateChainCommand(): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: 'Enter domain to validate certificate chain',
    placeHolder: 'example.com'
  });

  if (!input) {
    return;
  }

  const sslService = new SSLService();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Validating certificate chain for ${input}...`,
      cancellable: false,
    },
    async () => {
      try {
        const chain = await sslService.fetchCertificateChain(input.trim(), 443);
        const validation = await sslService.validateChain(chain);

        const doc = await vscode.workspace.openTextDocument({
          content: formatChainValidation(chain, validation),
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);

      } catch (error) {
        vscode.window.showErrorMessage(`Chain validation failed: ${error}`);
      }
    }
  );
}

// Helper functions

function formatBulkResults(results: BulkFetchResult[]): string {
  const lines: string[] = [];
  
  lines.push('# Bulk Certificate Fetch Results');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total domains**: ${results.length}`);
  lines.push(`- **Successful**: ${results.filter(r => r.success).length}`);
  lines.push(`- **Failed**: ${results.filter(r => !r.success).length}`);
  lines.push('');
  lines.push('## Results');
  lines.push('');
  lines.push('| Domain | Status | Issuer | Expires | Days Left |');
  lines.push('|--------|--------|--------|---------|-----------|');

  for (const result of results) {
    if (result.success && result.certificate) {
      const cert = result.certificate;
      const status = cert.isExpired ? '❌ Expired' : '✅ Valid';
      lines.push(`| ${result.domain} | ${status} | ${cert.issuer.commonName} | ${cert.validTo.toLocaleDateString()} | ${cert.daysUntilExpiry} |`);
    } else {
      lines.push(`| ${result.domain} | ⚠️ Error | ${result.error || 'Unknown'} | - | - |`);
    }
  }

  lines.push('');
  lines.push('## Pinning Hashes');
  lines.push('');

  for (const result of results) {
    if (result.success && result.certificate) {
      lines.push(`### ${result.domain}`);
      lines.push('');
      lines.push('```');
      lines.push(`SHA-256: ${result.certificate.fingerprints.sha256}`);
      lines.push(`SPKI: ${result.certificate.spkiHash}`);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function compareCertificates(cert1: CertificateInfo, cert2: CertificateInfo): string {
  const lines: string[] = [];

  lines.push('# Certificate Comparison');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push('| Property | ' + cert1.domain + ' | ' + cert2.domain + ' | Match |');
  lines.push('|----------|---|---|-------|');

  const same = cert1.fingerprints.sha256 === cert2.fingerprints.sha256;
  
  lines.push(`| Subject CN | ${cert1.subject.commonName} | ${cert2.subject.commonName} | ${cert1.subject.commonName === cert2.subject.commonName ? '✅' : '❌'} |`);
  lines.push(`| Issuer | ${cert1.issuer.commonName} | ${cert2.issuer.commonName} | ${cert1.issuer.commonName === cert2.issuer.commonName ? '✅' : '❌'} |`);
  lines.push(`| Valid From | ${cert1.validFrom.toLocaleDateString()} | ${cert2.validFrom.toLocaleDateString()} | ${cert1.validFrom.getTime() === cert2.validFrom.getTime() ? '✅' : '❌'} |`);
  lines.push(`| Valid To | ${cert1.validTo.toLocaleDateString()} | ${cert2.validTo.toLocaleDateString()} | ${cert1.validTo.getTime() === cert2.validTo.getTime() ? '✅' : '❌'} |`);
  lines.push(`| SHA-256 | ...${cert1.fingerprints.sha256.slice(-20)} | ...${cert2.fingerprints.sha256.slice(-20)} | ${same ? '✅' : '❌'} |`);
  lines.push(`| Serial | ${cert1.serialNumber} | ${cert2.serialNumber} | ${cert1.serialNumber === cert2.serialNumber ? '✅' : '❌'} |`);

  lines.push('');
  lines.push(`## Conclusion`);
  lines.push('');
  
  if (same) {
    lines.push('✅ **Certificates are identical** - Same certificate is deployed on both domains.');
  } else {
    lines.push('❌ **Certificates are different** - Different certificates are deployed on each domain.');
  }

  return lines.join('\n');
}

function formatExpiryReport(report: Array<{domain: string; daysLeft: number; status: string}>): string {
  const lines: string[] = [];

  lines.push('# Certificate Expiry Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  
  const expired = report.filter(r => r.daysLeft < 0 || r.status.includes('EXPIRED'));
  const critical = report.filter(r => r.daysLeft >= 0 && r.daysLeft < 7);
  const warning = report.filter(r => r.daysLeft >= 7 && r.daysLeft < 30);
  const ok = report.filter(r => r.daysLeft >= 30);

  lines.push(`- 🔴 **Expired**: ${expired.length}`);
  lines.push(`- 🔴 **Critical (<7 days)**: ${critical.length}`);
  lines.push(`- 🟡 **Warning (<30 days)**: ${warning.length}`);
  lines.push(`- ✅ **OK**: ${ok.length}`);
  lines.push('');
  lines.push('## Details');
  lines.push('');
  lines.push('| Status | Domain | Days Left |');
  lines.push('|--------|--------|-----------|');

  for (const item of report) {
    const days = item.daysLeft < 0 ? 'ERROR' : item.daysLeft.toString();
    lines.push(`| ${item.status} | ${item.domain} | ${days} |`);
  }

  return lines.join('\n');
}

function formatChainValidation(chain: CertificateChain, validation: { valid: boolean; errors: string[] }): string {
  const lines: string[] = [];

  lines.push('# Certificate Chain Validation');
  lines.push('');
  lines.push(`Domain: **${chain.domain}**`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Validation Result');
  lines.push('');
  
  if (validation.valid) {
    lines.push('✅ **Certificate chain is valid**');
  } else {
    lines.push('❌ **Certificate chain validation failed**');
    lines.push('');
    lines.push('### Errors');
    for (const error of validation.errors) {
      lines.push(`- ${error}`);
    }
  }

  lines.push('');
  lines.push('## Certificate Chain');
  lines.push('');

  for (let i = 0; i < chain.certificates.length; i++) {
    const cert = chain.certificates[i];
    const prefix = i === 0 ? '🔒 Leaf' : i === chain.certificates.length - 1 ? '🏛️ Root' : '🔗 Intermediate';
    
    lines.push(`### ${prefix} Certificate (${i + 1}/${chain.certificates.length})`);
    lines.push('');
    lines.push(`- **Subject**: ${cert.subject.commonName}`);
    lines.push(`- **Issuer**: ${cert.issuer.commonName}`);
    lines.push(`- **Valid Until**: ${cert.validTo.toLocaleDateString()}`);
    lines.push(`- **Days Left**: ${cert.daysUntilExpiry}`);
    lines.push('');
  }

  return lines.join('\n');
}
