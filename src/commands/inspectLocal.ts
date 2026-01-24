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
    
    // Check if it's a PEM file
    if (content.includes('-----BEGIN CERTIFICATE-----')) {
      const cert = sslService.parsePEMFile(content);
      
      // Update the domain to show the file name
      cert.domain = path.basename(filePath);
      
      // Show in panel
      showCertificatePanel(context, {
        domain: cert.domain,
        port: 0,
        certificates: [cert],
        isValid: true
      });

      vscode.window.showInformationMessage(`Certificate loaded from ${path.basename(filePath)}`);
    } else {
      // Try to parse as DER
      const derBuffer = fs.readFileSync(filePath);
      
      // Convert DER to PEM for parsing
      const base64 = derBuffer.toString('base64');
      const pemContent = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
      
      const cert = sslService.parsePEMFile(pemContent);
      cert.domain = path.basename(filePath);
      
      showCertificatePanel(context, {
        domain: cert.domain,
        port: 0,
        certificates: [cert],
        isValid: true
      });

      vscode.window.showInformationMessage(`Certificate loaded from ${path.basename(filePath)}`);
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
    const cert = sslService.parsePEMFile(content);
    cert.domain = path.basename(editor.document.fileName) || 'Editor Content';
    
    showCertificatePanel(context, {
      domain: cert.domain,
      port: 0,
      certificates: [cert],
      isValid: true
    });

    vscode.window.showInformationMessage('Certificate parsed from editor content');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to parse certificate: ${errorMessage}`);
  }
}
