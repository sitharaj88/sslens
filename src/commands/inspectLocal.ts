/**
 * SSLens - Inspect Local Certificate Command
 * Parse and inspect local certificate files (.pem, .crt, .cer)
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SSLService } from '../services/sslService';
import { showCertificatePanel } from '../providers/webviewPanel';

export async function inspectLocalCertCommand(context: vscode.ExtensionContext): Promise<void> {
  // Let user select a certificate file
  const fileUri = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'Certificate Files': ['pem', 'crt', 'cer', 'cert'],
      'All Files': ['*']
    },
    title: 'Select Certificate File'
  });

  if (!fileUri || fileUri.length === 0) {
    return;
  }

  const filePath = fileUri[0].fsPath;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sslService = new SSLService();
    const fileName = path.basename(filePath);

    // Check if it's a PEM file
    if (content.includes('-----BEGIN CERTIFICATE-----')) {
      // Parse as chain (supports single or multiple certificates)
      const chain = sslService.parsePEMChain(content, fileName);

      // Show in panel with full chain
      showCertificatePanel(context, chain);

      const certCount = chain.certificates.length;
      const message = certCount === 1
        ? `Certificate loaded from ${fileName}`
        : `Certificate chain (${certCount} certificates) loaded from ${fileName}`;
      vscode.window.showInformationMessage(message);
    } else {
      // Try to parse as DER (binary format)
      const derBuffer = fs.readFileSync(filePath);

      // Convert DER to PEM for parsing
      const base64 = derBuffer.toString('base64');
      const pemContent = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;

      const chain = sslService.parsePEMChain(pemContent, fileName);

      showCertificatePanel(context, chain);

      vscode.window.showInformationMessage(`Certificate loaded from ${fileName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to parse certificate: ${errorMessage}`);
  }
}

/**
 * Inspect certificate from active editor (if it contains a PEM)
 */
export async function inspectFromEditorCommand(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showWarningMessage('No active editor with certificate content');
    return;
  }

  const content = editor.document.getText();
  
  if (!content.includes('-----BEGIN CERTIFICATE-----')) {
    vscode.window.showWarningMessage('No PEM certificate found in current file');
    return;
  }

  try {
    const sslService = new SSLService();
    const sourceName = path.basename(editor.document.fileName) || 'Editor Content';
    const chain = sslService.parsePEMChain(content, sourceName);

    showCertificatePanel(context, chain);

    const certCount = chain.certificates.length;
    const message = certCount === 1
      ? 'Certificate parsed from editor content'
      : `Certificate chain (${certCount} certificates) parsed from editor content`;
    vscode.window.showInformationMessage(message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to parse certificate: ${errorMessage}`);
  }
}
