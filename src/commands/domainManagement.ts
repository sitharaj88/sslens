/**
 * SSLens - Domain Management Commands
 * Save and manage favorite domains
 */

import * as vscode from 'vscode';
import { getStorageService } from '../services/storageService';
import { SavedDomain } from '../types';

/**
 * Save a domain to favorites
 */
export async function saveDomainCommand(): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: 'Enter domain to save',
    placeHolder: 'api.example.com:443'
  });

  if (!input) {
    return;
  }

  const { domain, port } = parseDomainInput(input);

  // Optional: Get an alias
  const alias = await vscode.window.showInputBox({
    prompt: 'Enter an alias (optional)',
    placeHolder: 'Production API'
  });

  const storageService = getStorageService();
  await storageService.saveDomain(domain, port, alias || undefined);

  vscode.window.showInformationMessage(`Domain saved: ${domain}:${port}`);
  vscode.commands.executeCommand('sslens.refreshDomains');
}

/**
 * Remove a domain from favorites
 */
export async function removeDomainCommand(item?: any): Promise<void> {
  let domain: string;
  let port: number;

  if (item && item.domain) {
    // Called from tree view context menu
    domain = item.domain;
    port = item.port;
  } else {
    // Called from command palette - show picker
    const storageService = getStorageService();
    const savedDomains = storageService.getSavedDomains();

    if (savedDomains.length === 0) {
      vscode.window.showWarningMessage('No saved domains to remove');
      return;
    }

    const items = savedDomains.map(d => ({
      label: d.alias || d.domain,
      description: `${d.domain}:${d.port}`,
      domain: d.domain,
      port: d.port
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select domain to remove'
    });

    if (!selected) {
      return;
    }

    domain = selected.domain;
    port = selected.port;
  }

  // Confirm removal
  const confirm = await vscode.window.showWarningMessage(
    `Remove ${domain}:${port} from saved domains?`,
    { modal: true },
    'Remove'
  );

  if (confirm !== 'Remove') {
    return;
  }

  const storageService = getStorageService();
  await storageService.removeDomain(domain, port);

  vscode.window.showInformationMessage(`Domain removed: ${domain}:${port}`);
  vscode.commands.executeCommand('sslens.refreshDomains');
}

/**
 * Edit a saved domain's alias
 */
export async function editDomainAliasCommand(item?: any): Promise<void> {
  let domain: string;
  let port: number;
  let currentAlias: string | undefined;

  if (item && item.domain) {
    domain = item.domain;
    port = item.port;
    currentAlias = item.alias;
  } else {
    const storageService = getStorageService();
    const savedDomains = storageService.getSavedDomains();

    if (savedDomains.length === 0) {
      vscode.window.showWarningMessage('No saved domains');
      return;
    }

    const items = savedDomains.map(d => ({
      label: d.alias || d.domain,
      description: `${d.domain}:${d.port}`,
      domain: d.domain,
      port: d.port,
      alias: d.alias
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select domain to edit'
    });

    if (!selected) {
      return;
    }

    domain = selected.domain;
    port = selected.port;
    currentAlias = selected.alias;
  }

  const newAlias = await vscode.window.showInputBox({
    prompt: 'Enter new alias',
    value: currentAlias || '',
    placeHolder: 'Production API'
  });

  if (newAlias === undefined) {
    return;
  }

  const storageService = getStorageService();
  await storageService.saveDomain(domain, port, newAlias || undefined);

  vscode.window.showInformationMessage(`Alias updated for ${domain}`);
  vscode.commands.executeCommand('sslens.refreshDomains');
}

/**
 * Export saved domains
 */
export async function exportDomainsCommand(): Promise<void> {
  const storageService = getStorageService();
  const data = storageService.exportData();

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('sslens-data.json'),
    filters: {
      'JSON Files': ['json']
    }
  });

  if (!saveUri) {
    return;
  }

  const fs = require('fs');
  fs.writeFileSync(saveUri.fsPath, data, 'utf-8');
  vscode.window.showInformationMessage('Data exported successfully');
}

/**
 * Import saved domains
 */
export async function importDomainsCommand(): Promise<void> {
  const fileUri = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'JSON Files': ['json']
    }
  });

  if (!fileUri || fileUri.length === 0) {
    return;
  }

  const fs = require('fs');
  try {
    const data = fs.readFileSync(fileUri[0].fsPath, 'utf-8');
    const storageService = getStorageService();
    await storageService.importData(data);
    
    vscode.window.showInformationMessage('Data imported successfully');
    vscode.commands.executeCommand('ssl-helper.refreshDomains');
  } catch (error) {
    vscode.window.showErrorMessage(`Import failed: ${error}`);
  }
}

/**
 * Parse domain input to extract domain and port
 */
function parseDomainInput(input: string): { domain: string; port: number } {
  let domain = input.trim();
  let port = 443;

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove path
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
