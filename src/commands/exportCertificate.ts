/**
 * SSLens - Export Certificate Commands
 * Export certificates in various formats and copy hashes
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CertificateInfo, CertificateChain, SUPPORTED_PLATFORMS } from '../types';
import { ExportService } from '../services/exportService';
import { getStorageService } from '../services/storageService';
import { SSLService } from '../services/sslService';

const exportService = new ExportService();

// Store current certificate for export commands
let currentCertificate: CertificateInfo | undefined;

export function setCurrentCertificate(cert: CertificateInfo): void {
  currentCertificate = cert;
}

/**
 * Get certificate - either from current or fetch new
 */
async function getCertificate(): Promise<CertificateInfo | undefined> {
  if (currentCertificate) {
    return currentCertificate;
  }

  // Ask user for domain
  const input = await vscode.window.showInputBox({
    prompt: 'Enter domain to fetch certificate',
    placeHolder: 'example.com'
  });

  if (!input) {
    return undefined;
  }

  const sslService = new SSLService();
  try {
    const cert = await sslService.fetchCertificate(input.trim(), 443);
    return cert;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to fetch certificate: ${error}`);
    return undefined;
  }
}

/**
 * Export certificate as PEM
 */
export async function exportPEMCommand(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${cert.subject.commonName.replace(/[^a-zA-Z0-9]/g, '_')}.pem`),
    filters: {
      'PEM Certificate': ['pem']
    }
  });

  if (!saveUri) {
    return;
  }

  try {
    fs.writeFileSync(saveUri.fsPath, cert.pemEncoded, 'utf-8');
    vscode.window.showInformationMessage(`Certificate exported to ${path.basename(saveUri.fsPath)}`);
    
    // Open the file
    const doc = await vscode.workspace.openTextDocument(saveUri);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export certificate: ${error}`);
  }
}

/**
 * Export certificate as DER
 */
export async function exportDERCommand(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${cert.subject.commonName.replace(/[^a-zA-Z0-9]/g, '_')}.der`),
    filters: {
      'DER Certificate': ['der', 'cer', 'crt']
    }
  });

  if (!saveUri) {
    return;
  }

  try {
    const derBuffer = exportService.exportAsDER(cert);
    fs.writeFileSync(saveUri.fsPath, derBuffer);
    vscode.window.showInformationMessage(`Certificate exported to ${path.basename(saveUri.fsPath)}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export certificate: ${error}`);
  }
}

/**
 * Copy public key hash (for pinning)
 */
export async function copyPublicKeyHashCommand(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  await vscode.env.clipboard.writeText(cert.publicKeyHash);
  vscode.window.showInformationMessage(`Public key hash copied: ${cert.publicKeyHash.substring(0, 20)}...`);
}

/**
 * Copy SPKI hash
 */
export async function copySPKIHashCommand(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  await vscode.env.clipboard.writeText(cert.spkiHash);
  vscode.window.showInformationMessage(`SPKI hash copied: ${cert.spkiHash.substring(0, 30)}...`);
}

/**
 * Generate pinning code
 */
export async function generatePinningCodeCommand(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  // Let user select platform
  const platformItems = SUPPORTED_PLATFORMS.map(p => ({
    label: p.name,
    description: p.language,
    id: p.id
  }));

  const selected = await vscode.window.showQuickPick(platformItems, {
    placeHolder: 'Select target platform for pinning code',
    title: 'Generate Certificate Pinning Code'
  });

  if (!selected) {
    return;
  }

  try {
    const code = exportService.generatePinningCode({
      platform: selected.id as any,
      domains: [cert.domain],
      hashes: [cert.spkiHash],
      includeBackup: true
    });

    // Create a new document with the code
    const doc = await vscode.workspace.openTextDocument({
      content: code,
      language: getLanguageId(selected.id)
    });

    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`Pinning code generated for ${selected.label}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
  }
}

/**
 * Copy SHA-256 fingerprint
 */
export async function copySHA256Command(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  await vscode.env.clipboard.writeText(cert.fingerprints.sha256);
  vscode.window.showInformationMessage('SHA-256 fingerprint copied to clipboard');
}

/**
 * Copy SHA-1 fingerprint
 */
export async function copySHA1Command(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  await vscode.env.clipboard.writeText(cert.fingerprints.sha1);
  vscode.window.showInformationMessage('SHA-1 fingerprint copied to clipboard');
}

/**
 * Show certificate details in output channel
 */
export async function showCertificateDetailsCommand(): Promise<void> {
  const cert = await getCertificate();
  if (!cert) {
    return;
  }

  const formatted = exportService.formatCertificateDisplay(cert);
  
  const outputChannel = vscode.window.createOutputChannel('SSL Certificate');
  outputChannel.clear();
  outputChannel.appendLine(formatted);
  outputChannel.show();
}

/**
 * Get VS Code language ID for syntax highlighting
 */
function getLanguageId(platformId: string): string {
  switch (platformId) {
    case 'android-okhttp':
    case 'android-retrofit':
      return 'kotlin';
    case 'ios-swift':
    case 'ios-alamofire':
      return 'swift';
    case 'flutter-dio':
    case 'flutter-http':
      return 'dart';
    case 'react-native':
      return 'javascript';
    default:
      return 'plaintext';
  }
}

// Store current certificate chain for export commands
let currentCertificateChain: CertificateChain | undefined;

export function setCurrentCertificateChain(chain: CertificateChain): void {
  currentCertificateChain = chain;
}

/**
 * Export a specific certificate from the chain as PEM
 */
export async function exportChainCertPEMCommand(chainIndex: number): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { getCurrentCertificateChain } = await import('../providers/webviewPanel');
  const chain = getCurrentCertificateChain();

  if (!chain || chainIndex >= chain.certificates.length) {
    vscode.window.showErrorMessage('Certificate not found in chain');
    return;
  }

  const cert = chain.certificates[chainIndex];
  const totalCerts = chain.certificates.length;
  const type = chainIndex === 0 ? 'leaf' :
               chainIndex === totalCerts - 1 ? 'root' :
               `intermediate_${chainIndex}`;

  const defaultName = `${chain.domain.replace(/[^a-zA-Z0-9]/g, '_')}_${type}.pem`;

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultName),
    filters: { 'PEM Certificate': ['pem'] }
  });

  if (!saveUri) {
    return;
  }

  try {
    fs.writeFileSync(saveUri.fsPath, cert.pemEncoded, 'utf-8');
    vscode.window.showInformationMessage(`Certificate exported to ${path.basename(saveUri.fsPath)}`);
    const doc = await vscode.workspace.openTextDocument(saveUri);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export certificate: ${error}`);
  }
}

/**
 * Export a specific certificate from the chain as DER
 */
export async function exportChainCertDERCommand(chainIndex: number): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { getCurrentCertificateChain } = await import('../providers/webviewPanel');
  const chain = getCurrentCertificateChain();

  if (!chain || chainIndex >= chain.certificates.length) {
    vscode.window.showErrorMessage('Certificate not found in chain');
    return;
  }

  const cert = chain.certificates[chainIndex];
  const totalCerts = chain.certificates.length;
  const type = chainIndex === 0 ? 'leaf' :
               chainIndex === totalCerts - 1 ? 'root' :
               `intermediate_${chainIndex}`;

  const defaultName = `${chain.domain.replace(/[^a-zA-Z0-9]/g, '_')}_${type}.der`;

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultName),
    filters: { 'DER Certificate': ['der', 'cer', 'crt'] }
  });

  if (!saveUri) {
    return;
  }

  try {
    const derBuffer = exportService.exportAsDER(cert);
    fs.writeFileSync(saveUri.fsPath, derBuffer);
    vscode.window.showInformationMessage(`Certificate exported to ${path.basename(saveUri.fsPath)}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export certificate: ${error}`);
  }
}

/**
 * Export all certificates in the chain as a single PEM bundle
 */
export async function exportAllChainPEMCommand(): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { getCurrentCertificateChain } = await import('../providers/webviewPanel');
  const chain = getCurrentCertificateChain();

  if (!chain) {
    vscode.window.showErrorMessage('No certificate chain available');
    return;
  }

  const defaultName = `${chain.domain.replace(/[^a-zA-Z0-9]/g, '_')}_chain.pem`;

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultName),
    filters: { 'PEM Certificate Bundle': ['pem'] }
  });

  if (!saveUri) {
    return;
  }

  try {
    const bundleContent = exportService.exportChainAsPEM(chain);
    fs.writeFileSync(saveUri.fsPath, bundleContent, 'utf-8');
    vscode.window.showInformationMessage(
      `Certificate chain (${chain.certificates.length} certs) exported to ${path.basename(saveUri.fsPath)}`
    );
    const doc = await vscode.workspace.openTextDocument(saveUri);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export certificate chain: ${error}`);
  }
}

/**
 * Export all certificates in the chain as separate DER files
 */
export async function exportAllChainDERCommand(): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { getCurrentCertificateChain } = await import('../providers/webviewPanel');
  const chain = getCurrentCertificateChain();

  if (!chain) {
    vscode.window.showErrorMessage('No certificate chain available');
    return;
  }

  // Ask user to select a folder
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select folder to save DER files'
  });

  if (!folderUri || folderUri.length === 0) {
    return;
  }

  const folder = folderUri[0].fsPath;
  const domainPrefix = chain.domain.replace(/[^a-zA-Z0-9]/g, '_');
  const totalCerts = chain.certificates.length;

  try {
    for (let i = 0; i < totalCerts; i++) {
      const cert = chain.certificates[i];
      const type = i === 0 ? 'leaf' :
                   i === totalCerts - 1 ? 'root' :
                   `intermediate_${i}`;

      const fileName = `${domainPrefix}_${type}.der`;
      const filePath = path.join(folder, fileName);

      const derBuffer = exportService.exportAsDER(cert);
      fs.writeFileSync(filePath, derBuffer);
    }

    vscode.window.showInformationMessage(
      `${totalCerts} DER certificates exported to ${path.basename(folder)}/`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to export DER certificates: ${error}`);
  }
}
