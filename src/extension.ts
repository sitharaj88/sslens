/**
 * SSLens - VS Code Extension
 * Modern SSL/TLS Certificate Inspector & Pinning Toolkit
 * 
 * Fetch, analyze, and export SSL certificates with ease.
 * Perfect for mobile developers working with certificate pinning.
 * 
 * @author sitharaj
 * @version 2.0.0
 */

import * as vscode from 'vscode';

// Services
import { initStorageService, getStorageService } from './services/storageService';

// Commands
import { fetchCertificateCommand, fetchFromSavedDomain } from './commands/fetchCertificate';
import { inspectLocalCertCommand } from './commands/inspectLocal';
import {
  exportPEMCommand,
  exportDERCommand,
  copyPublicKeyHashCommand,
  copySPKIHashCommand,
  generatePinningCodeCommand,
  setCurrentCertificate
} from './commands/exportCertificate';
import {
  bulkFetchCommand,
  compareCertificatesCommand,
  checkExpiryCommand,
  validateChainCommand
} from './commands/bulkOperations';
import {
  saveDomainCommand,
  removeDomainCommand,
  editDomainAliasCommand,
  exportDomainsCommand,
  importDomainsCommand
} from './commands/domainManagement';

// Providers
import { registerTreeViews, refreshTreeViews } from './providers/treeViewProvider';
import { getCurrentCertificate } from './providers/webviewPanel';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('SSLens extension is now active');

  // Initialize storage service
  initStorageService(context);

  // Register tree views
  registerTreeViews(context);

  // ============================================
  // FETCH COMMANDS
  // ============================================

  // Fetch certificate from URL
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.fetchCertificate', async () => {
      const cert = await fetchCertificateCommand(context);
      if (cert) {
        setCurrentCertificate(cert);
      }
    })
  );

  // Fetch from saved domain (internal command)
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.fetchFromDomain', async (domain: string, port: number) => {
      const cert = await fetchFromSavedDomain(context, domain, port);
      if (cert) {
        setCurrentCertificate(cert);
      }
    })
  );

  // Inspect local certificate file
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.inspectLocalCert', () => {
      inspectLocalCertCommand(context);
    })
  );

  // ============================================
  // EXPORT COMMANDS
  // ============================================

  // Export as PEM
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.exportPEM', () => {
      const cert = getCurrentCertificate();
      if (cert) {
        setCurrentCertificate(cert);
      }
      exportPEMCommand();
    })
  );

  // Export as DER
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.exportDER', () => {
      const cert = getCurrentCertificate();
      if (cert) {
        setCurrentCertificate(cert);
      }
      exportDERCommand();
    })
  );

  // Copy public key hash
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.copyPublicKeyHash', () => {
      const cert = getCurrentCertificate();
      if (cert) {
        setCurrentCertificate(cert);
      }
      copyPublicKeyHashCommand();
    })
  );

  // Copy SPKI hash
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.copySPKIHash', () => {
      const cert = getCurrentCertificate();
      if (cert) {
        setCurrentCertificate(cert);
      }
      copySPKIHashCommand();
    })
  );

  // Generate pinning code
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.generatePinningCode', () => {
      const cert = getCurrentCertificate();
      if (cert) {
        setCurrentCertificate(cert);
      }
      generatePinningCodeCommand();
    })
  );

  // ============================================
  // BULK OPERATIONS
  // ============================================

  // Bulk fetch
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.bulkFetch', () => {
      bulkFetchCommand(context);
    })
  );

  // Compare certificates
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.compareCertificates', () => {
      compareCertificatesCommand(context);
    })
  );

  // Check expiry
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.checkExpiry', () => {
      checkExpiryCommand();
    })
  );

  // Validate chain
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.validateChain', () => {
      validateChainCommand();
    })
  );

  // ============================================
  // DOMAIN MANAGEMENT
  // ============================================

  // Save domain
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.saveDomain', () => {
      const currentCert = getCurrentCertificate();
      saveDomainCommand(currentCert);
    })
  );

  // Remove domain
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.removeDomain', (item?: any) => {
      removeDomainCommand(item);
    })
  );

  // Edit domain alias
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.editDomainAlias', (item?: any) => {
      editDomainAliasCommand(item);
    })
  );

  // Export domains
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.exportDomains', () => {
      exportDomainsCommand();
    })
  );

  // Import domains
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.importDomains', () => {
      importDomainsCommand();
    })
  );

  // Refresh tree views
  context.subscriptions.push(
    vscode.commands.registerCommand('sslens.refreshDomains', () => {
      refreshTreeViews();
    })
  );

  // ============================================
  // STATUS BAR
  // ============================================

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(shield) SSLens';
  statusBarItem.tooltip = 'SSLens - Click to fetch SSL certificate';
  statusBarItem.command = 'sslens.fetchCertificate';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ============================================
  // WELCOME MESSAGE
  // ============================================

  // Show welcome message on first install
  const hasShownWelcome = context.globalState.get<boolean>('hasShownWelcome', false);
  if (!hasShownWelcome) {
    vscode.window.showInformationMessage(
      '🔍 SSLens installed! Use Cmd/Ctrl+Shift+P and search "SSLens:" to get started.',
      'Fetch Certificate',
      'Learn More'
    ).then(selection => {
      if (selection === 'Fetch Certificate') {
        vscode.commands.executeCommand('sslens.fetchCertificate');
      } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/sitharaj/sslens'));
      }
    });
    context.globalState.update('hasShownWelcome', true);
  }

  console.log('SSLens commands registered successfully');
}

/**
 * Extension deactivation
 */
export function deactivate() {
  console.log('SSLens extension deactivated');
}
