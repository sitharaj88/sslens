/**
 * SSLens - Fetch Certificate Command
 * Main command to fetch SSL certificate from a URL
 */

import * as vscode from 'vscode';
import { SSLService } from '../services/sslService';
import { getStorageService } from '../services/storageService';
import { showCertificatePanel } from '../providers/webviewPanel';
import { CertificateInfo } from '../types';

export async function fetchCertificateCommand(context: vscode.ExtensionContext): Promise<CertificateInfo | undefined> {
  // Get URL from user
  const input = await vscode.window.showInputBox({
    prompt: 'Enter domain or URL to fetch SSL certificate',
    placeHolder: 'example.com or https://example.com:443',
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'Please enter a domain or URL';
      }
      return undefined;
    }
  });

  if (!input) {
    return undefined;
  }

  // Parse the input
  const { domain, port } = parseInput(input);

  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Fetching certificate from ${domain}:${port}...`,
      cancellable: false,
    },
    async () => {
      try {
        const sslService = new SSLService(
          vscode.workspace.getConfiguration('sslens').get<number>('timeout', 10000)
        );

        const chain = await sslService.fetchCertificateChain(domain, port);
        
        if (chain.certificates.length === 0) {
          vscode.window.showErrorMessage(`No certificate found for ${domain}:${port}`);
          return undefined;
        }

        const cert = chain.certificates[0];

        // Store in recent
        const storageService = getStorageService();
        await storageService.addRecentCertificate(cert);
        await storageService.cacheCertificate(cert);

        // Refresh views
        vscode.commands.executeCommand('sslens.refreshDomains');

        // Show certificate panel
        showCertificatePanel(context, chain);

        // Show success message
        const expiryStatus = cert.isExpired 
          ? '❌ EXPIRED' 
          : cert.daysUntilExpiry < 30 
            ? `⚠️ Expires in ${cert.daysUntilExpiry} days`
            : `✅ Valid for ${cert.daysUntilExpiry} days`;

        vscode.window.showInformationMessage(
          `Certificate fetched: ${cert.subject.commonName} | ${expiryStatus}`,
          'Copy SHA-256',
          'Generate Pinning Code'
        ).then(selection => {
          if (selection === 'Copy SHA-256') {
            vscode.env.clipboard.writeText(cert.fingerprints.sha256);
            vscode.window.showInformationMessage('SHA-256 fingerprint copied to clipboard');
          } else if (selection === 'Generate Pinning Code') {
            vscode.commands.executeCommand('sslens.generatePinningCode');
          }
        });

        return cert;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to fetch certificate: ${errorMessage}`);
        return undefined;
      }
    }
  );
}

/**
 * Fetch certificate from a saved domain (no prompt)
 */
export async function fetchFromSavedDomain(
  context: vscode.ExtensionContext,
  domain: string,
  port: number
): Promise<CertificateInfo | undefined> {
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Fetching certificate from ${domain}:${port}...`,
      cancellable: false,
    },
    async () => {
      try {
        const sslService = new SSLService();
        const chain = await sslService.fetchCertificateChain(domain, port);
        
        if (chain.certificates.length === 0) {
          vscode.window.showErrorMessage(`No certificate found for ${domain}:${port}`);
          return undefined;
        }

        const cert = chain.certificates[0];

        // Update storage
        const storageService = getStorageService();
        await storageService.addRecentCertificate(cert);
        await storageService.cacheCertificate(cert);
        await storageService.updateDomainCheck(domain, port, cert.fingerprints.sha256);

        // Show certificate panel
        showCertificatePanel(context, chain);

        return cert;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to fetch certificate: ${errorMessage}`);
        return undefined;
      }
    }
  );
}

/**
 * Parse user input to extract domain and port
 */
function parseInput(input: string): { domain: string; port: number } {
  let domain = input.trim();
  let port = vscode.workspace.getConfiguration('sslens').get<number>('defaultPort', 443);

  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, '');

  // Remove path if present
  const pathIndex = domain.indexOf('/');
  if (pathIndex !== -1) {
    domain = domain.substring(0, pathIndex);
  }

  // Check for port
  const colonIndex = domain.lastIndexOf(':');
  if (colonIndex !== -1) {
    const portStr = domain.substring(colonIndex + 1);
    const parsedPort = parseInt(portStr, 10);
    if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      port = parsedPort;
      domain = domain.substring(0, colonIndex);
    }
  }

  return { domain, port };
}
