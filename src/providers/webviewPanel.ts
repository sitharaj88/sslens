/**
 * SSLens - Webview Panel
 * Rich certificate display with modern UI
 */

import * as vscode from 'vscode';
import { CertificateChain, CertificateInfo, SUPPORTED_PLATFORMS } from '../types';
import { ExportService } from '../services/exportService';

const exportService = new ExportService();

let currentPanel: vscode.WebviewPanel | undefined;
let currentCertificateChain: CertificateChain | undefined;

/**
 * Show certificate in webview panel
 */
export function showCertificatePanel(
  context: vscode.ExtensionContext,
  chain: CertificateChain
): void {
  currentCertificateChain = chain;

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    currentPanel.webview.html = getWebviewContent(chain);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'sslensCertificate',
    `SSLens: ${chain.domain}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  currentPanel.webview.html = getWebviewContent(chain);

  // Handle messages from webview
  currentPanel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'copyToClipboard':
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage('Copied to clipboard');
          break;
        case 'generateCode':
          await handleGenerateCode(message.platform, chain);
          break;
        case 'saveDomain':
          await vscode.commands.executeCommand('sslens.saveDomain');
          break;
        case 'exportPEM':
          await vscode.commands.executeCommand('sslens.exportPEM');
          break;
        case 'exportDER':
          await vscode.commands.executeCommand('sslens.exportDER');
          break;
        case 'exportChainCertPEM':
          await vscode.commands.executeCommand('sslens.exportChainCertPEM', message.chainIndex);
          break;
        case 'exportChainCertDER':
          await vscode.commands.executeCommand('sslens.exportChainCertDER', message.chainIndex);
          break;
        case 'exportAllChainPEM':
          await vscode.commands.executeCommand('sslens.exportAllChainPEM');
          break;
        case 'exportAllChainDER':
          await vscode.commands.executeCommand('sslens.exportAllChainDER');
          break;
        case 'importLocalCert':
          await vscode.commands.executeCommand('sslens.inspectLocalCert');
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
      currentCertificateChain = undefined;
    },
    undefined,
    context.subscriptions
  );
}

/**
 * Handle generate code request from webview
 */
async function handleGenerateCode(platformId: string, chain: CertificateChain): Promise<void> {
  if (chain.certificates.length === 0) {
    return;
  }

  const cert = chain.certificates[0];
  
  try {
    const code = exportService.generatePinningCode({
      platform: platformId as any,
      domains: [cert.domain],
      hashes: [cert.spkiHash],
      includeBackup: true
    });

    const platform = SUPPORTED_PLATFORMS.find(p => p.id === platformId);
    const language = platform?.language || 'plaintext';

    const doc = await vscode.workspace.openTextDocument({
      content: code,
      language
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
  }
}

/**
 * Generate webview HTML content
 */
function getWebviewContent(chain: CertificateChain): string {
  const cert = chain.certificates[0];
  
  // Status badge
  let statusBadge: string;
  let statusClass: string;
  
  if (cert.isExpired) {
    statusBadge = 'EXPIRED';
    statusClass = 'status-expired';
  } else if (cert.daysUntilExpiry < 7) {
    statusBadge = `CRITICAL: ${cert.daysUntilExpiry} days`;
    statusClass = 'status-critical';
  } else if (cert.daysUntilExpiry < 30) {
    statusBadge = `WARNING: ${cert.daysUntilExpiry} days`;
    statusClass = 'status-warning';
  } else {
    statusBadge = `VALID: ${cert.daysUntilExpiry} days`;
    statusClass = 'status-valid';
  }

  // Chain validation
  const chainStatus = chain.isValid 
    ? '<span class="chain-valid">✓ Chain Valid</span>' 
    : `<span class="chain-invalid">✗ ${chain.validationError || 'Invalid'}</span>`;

  // Platform buttons
  const platformButtons = SUPPORTED_PLATFORMS.map(p => 
    `<button class="platform-btn" onclick="generateCode('${p.id}')">${p.name}</button>`
  ).join('\n');

  // Certificate chain visualization
  const chainViz = chain.certificates.map((c, i) => {
    const type = i === 0 ? 'Leaf' : i === chain.certificates.length - 1 ? 'Root' : 'Intermediate';
    const icon = i === 0 ? '🔒' : i === chain.certificates.length - 1 ? '🏛️' : '🔗';
    return `
      <div class="chain-cert ${i === 0 ? 'active' : ''}">
        <div class="chain-icon">${icon}</div>
        <div class="chain-info">
          <div class="chain-type">${type}</div>
          <div class="chain-cn">${c.subject.commonName}</div>
        </div>
        <div class="chain-actions">
          <button class="chain-export-btn" onclick="exportChainCertPEM(${i})" title="Export as PEM">PEM</button>
          <button class="chain-export-btn" onclick="exportChainCertDER(${i})" title="Export as DER">DER</button>
        </div>
      </div>
      ${i < chain.certificates.length - 1 ? '<div class="chain-arrow">↓</div>' : ''}
    `;
  }).join('\n');

  // Chain breadcrumb for header
  const chainBreadcrumb = chain.certificates.map((c, i) => {
    const icon = i === 0 ? '🔒' : i === chain.certificates.length - 1 ? '🏛️' : '🔗';
    const name = c.subject.commonName.length > 25
      ? c.subject.commonName.substring(0, 22) + '...'
      : c.subject.commonName;
    return `<span class="breadcrumb-item">${icon} ${name}</span>`;
  }).join('<span class="breadcrumb-separator">→</span>');

  // SAN list
  const sanList = cert.subjectAltNames.length > 0 
    ? cert.subjectAltNames.map(s => `<div class="san-item">${s}</div>`).join('\n')
    : '<div class="san-item muted">No SANs</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSLens Certificate</title>
  <style>
    :root {
      --bg-primary: #0a0f0a;
      --bg-secondary: rgba(16, 32, 24, 0.85);
      --bg-tertiary: rgba(24, 48, 36, 0.6);
      --bg-glass: rgba(16, 185, 129, 0.05);
      --text-primary: #e4f0e8;
      --text-secondary: #7a9988;
      --text-muted: #5a7568;
      --accent-primary: #10b981;
      --accent-secondary: #34d399;
      --accent-gradient: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --error: #ef4444;
      --error-bg: rgba(239, 68, 68, 0.15);
      --border: rgba(16, 185, 129, 0.15);
      --border-glow: rgba(16, 185, 129, 0.4);
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
      --shadow-glow: 0 0 40px rgba(16, 185, 129, 0.2);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      background-image:
        radial-gradient(ellipse at top left, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, rgba(52, 211, 153, 0.08) 0%, transparent 50%);
      color: var(--text-primary);
      padding: 24px;
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 920px;
      margin: 0 auto;
      animation: fadeIn 0.4s ease-out;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      padding: 24px;
      background: var(--bg-secondary);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }

    .header-left {
      flex: 1;
    }

    .header-left h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 0;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
    }

    .header-left h1::before {
      content: '🔐';
      -webkit-text-fill-color: initial;
      font-size: 22px;
    }

    .status-badge {
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-badge::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    .status-valid { 
      background: var(--success-bg); 
      color: var(--success); 
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-valid::before { background: var(--success); }

    .status-warning { 
      background: var(--warning-bg); 
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .status-warning::before { background: var(--warning); }

    .status-critical { 
      background: var(--error-bg); 
      color: var(--error);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .status-critical::before { background: var(--error); animation: pulse 1s infinite; }

    .status-expired { 
      background: var(--error-bg); 
      color: var(--error);
      border: 1px solid rgba(239, 68, 68, 0.5);
    }
    .status-expired::before { background: var(--error); }

    .chain-status {
      margin-top: 12px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .chain-valid { color: var(--success); }
    .chain-invalid { color: var(--error); }

    .chain-breadcrumb {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .chain-breadcrumb::-webkit-scrollbar {
      display: none;
    }

    .breadcrumb-item {
      font-size: 12px;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .breadcrumb-separator {
      color: var(--accent-primary);
      font-size: 12px;
      opacity: 0.6;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 4px;
      padding: 6px;
      background: var(--bg-secondary);
      backdrop-filter: blur(20px);
      border-radius: 12px;
      margin-bottom: 24px;
      border: 1px solid var(--border);
    }

    .tab {
      flex: 1;
      padding: 12px 20px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px;
      transition: all 0.25s ease;
    }

    .tab:hover { 
      color: var(--text-primary);
      background: var(--bg-glass);
    }

    .tab.active {
      color: white;
      background: var(--accent-gradient);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    .tab-content {
      display: none;
      animation: fadeIn 0.3s ease-out;
    }

    .tab-content.active {
      display: block;
    }

    /* Sections */
    .section {
      background: var(--bg-secondary);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid var(--border);
      transition: all 0.3s ease;
    }

    .section:hover {
      border-color: var(--border-glow);
      box-shadow: var(--shadow-glow);
    }

    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--border) 0%, transparent 100%);
    }

    .info-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 12px 16px;
    }

    .info-label {
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 500;
    }

    .info-value {
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      word-break: break-all;
      color: var(--text-primary);
    }

    /* Copyable items */
    .copyable {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s ease;
      position: relative;
    }

    .copyable:hover {
      background: var(--bg-glass);
      color: var(--accent-primary);
    }

    .copyable:active {
      transform: scale(0.98);
    }

    /* Chain visualization */
    .chain-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px 0;
    }

    .chain-cert {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-tertiary);
      padding: 16px 20px;
      border-radius: 12px;
      width: 100%;
      max-width: 420px;
      border: 1px solid var(--border);
      transition: all 0.3s ease;
    }

    .chain-cert:hover {
      transform: translateX(4px);
      border-color: var(--border-glow);
    }

    .chain-cert.active {
      border-color: var(--accent-primary);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
    }

    .chain-icon {
      font-size: 28px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }

    .chain-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      font-weight: 600;
    }

    .chain-cn {
      font-size: 14px;
      color: var(--text-primary);
      font-weight: 500;
    }

    .chain-arrow {
      color: var(--accent-primary);
      font-size: 20px;
      opacity: 0.6;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .section-header .section-title {
      margin-bottom: 0;
    }

    .section-header .section-title::after {
      display: none;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .chain-info {
      flex: 1;
    }

    .chain-actions {
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .chain-cert:hover .chain-actions {
      opacity: 1;
    }

    .chain-export-btn {
      background: var(--bg-glass);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .chain-export-btn:hover {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
      color: white;
    }

    /* SAN container */
    .san-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .san-item {
      background: var(--bg-tertiary);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'SF Mono', monospace;
      border: 1px solid var(--border);
      transition: all 0.2s ease;
    }

    .san-item:hover {
      border-color: var(--accent-primary);
      transform: translateY(-1px);
    }

    .san-item.muted {
      color: var(--text-muted);
      font-style: italic;
    }

    /* Platform buttons */
    .platforms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }

    .platform-btn {
      padding: 14px 18px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .platform-btn:hover {
      background: var(--accent-gradient);
      border-color: transparent;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
    }

    .platform-btn:active {
      transform: translateY(0);
    }

    /* Action buttons */
    .action-buttons {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 12px 20px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-btn:hover {
      background: var(--bg-glass);
      border-color: var(--border-glow);
      transform: translateY(-1px);
    }

    .action-btn.primary {
      background: var(--accent-gradient);
      border: none;
      color: white;
    }

    .action-btn.primary:hover {
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
      transform: translateY(-2px);
    }

    /* Fingerprint boxes */
    .fingerprint-box {
      background: var(--bg-tertiary);
      padding: 16px;
      border-radius: 12px;
      font-family: 'SF Mono', 'Monaco', monospace;
      font-size: 11px;
      margin-top: 12px;
      word-break: break-all;
      cursor: pointer;
      border: 1px solid var(--border);
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }

    .fingerprint-box::before {
      content: 'Click to copy';
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 10px;
      color: var(--text-muted);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .fingerprint-box:hover::before {
      opacity: 1;
    }

    .fingerprint-box:hover {
      border-color: var(--accent-primary);
      background: rgba(99, 102, 241, 0.05);
    }

    .fingerprint-box:active {
      transform: scale(0.99);
    }

    .fingerprint-label {
      font-weight: 600;
      color: var(--accent-primary);
      margin-bottom: 8px;
      font-size: 12px;
      letter-spacing: 0.5px;
    }

    /* Footer branding */
    .footer {
      text-align: center;
      padding: 24px;
      color: var(--text-muted);
      font-size: 12px;
    }

    .footer a {
      color: var(--accent-primary);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    .info-hint {
      margin-top: 12px;
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>${chain.domain}:${chain.port}</h1>
        <div class="chain-breadcrumb">${chainBreadcrumb}</div>
        <div class="chain-status">${chainStatus}</div>
      </div>
      <div class="status-badge ${statusClass}">${statusBadge}</div>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="showTab('details')">📋 Details</button>
      <button class="tab" onclick="showTab('chain')">🔗 Chain</button>
      <button class="tab" onclick="showTab('pinning')">📌 Pinning</button>
      <button class="tab" onclick="showTab('export')">📤 Export</button>
    </div>

    <!-- Details Tab -->
    <div id="details" class="tab-content active">
      <div class="section">
        <div class="section-title">📋 Subject</div>
        <div class="info-grid">
          <div class="info-label">Common Name</div>
          <div class="info-value">${cert.subject.commonName}</div>
          ${cert.subject.organization ? `
          <div class="info-label">Organization</div>
          <div class="info-value">${cert.subject.organization}</div>
          ` : ''}
          ${cert.subject.country ? `
          <div class="info-label">Country</div>
          <div class="info-value">${cert.subject.country}</div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">🏢 Issuer</div>
        <div class="info-grid">
          <div class="info-label">Common Name</div>
          <div class="info-value">${cert.issuer.commonName}</div>
          ${cert.issuer.organization ? `
          <div class="info-label">Organization</div>
          <div class="info-value">${cert.issuer.organization}</div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">📅 Validity</div>
        <div class="info-grid">
          <div class="info-label">Not Before</div>
          <div class="info-value">${new Date(cert.validFrom).toLocaleString()}</div>
          <div class="info-label">Not After</div>
          <div class="info-value">${new Date(cert.validTo).toLocaleString()}</div>
          <div class="info-label">Days Left</div>
          <div class="info-value">${cert.daysUntilExpiry}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🔑 Public Key</div>
        <div class="info-grid">
          <div class="info-label">Algorithm</div>
          <div class="info-value">${cert.publicKey.algorithm}</div>
          <div class="info-label">Key Size</div>
          <div class="info-value">${cert.publicKey.keySize} bits</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🌐 Subject Alternative Names</div>
        <div class="san-container">
          ${sanList}
        </div>
      </div>
    </div>

    <!-- Chain Tab -->
    <div id="chain" class="tab-content">
      <div class="section">
        <div class="section-header">
          <div class="section-title">🔗 Certificate Chain (${chain.certificates.length} certificates)</div>
          <div class="header-actions">
            <button class="action-btn primary" onclick="exportAllChainPEM()">Export All (PEM)</button>
            <button class="action-btn" onclick="exportAllChainDER()">Export All (DER)</button>
          </div>
        </div>
        <div class="chain-container">
          ${chainViz}
        </div>
      </div>
    </div>

    <!-- Pinning Tab -->
    <div id="pinning" class="tab-content">
      <div class="section">
        <div class="section-title">📌 Pinning Hashes (Click to copy)</div>
        
        <div class="fingerprint-box" onclick="copyText('${cert.publicKeyHash}')">
          <div class="fingerprint-label">Public Key Hash (Base64)</div>
          ${cert.publicKeyHash}
        </div>

        <div class="fingerprint-box" onclick="copyText('${cert.spkiHash}')">
          <div class="fingerprint-label">SPKI Hash</div>
          ${cert.spkiHash}
        </div>

        <div class="fingerprint-box" onclick="copyText('${cert.fingerprints.sha256}')">
          <div class="fingerprint-label">SHA-256 Fingerprint</div>
          ${cert.fingerprints.sha256}
        </div>
      </div>

      <div class="section">
        <div class="section-title">🛠️ Generate Pinning Code</div>
        <div class="platforms-grid">
          ${platformButtons}
        </div>
      </div>
    </div>

    <!-- Export Tab -->
    <div id="export" class="tab-content">
      <div class="section">
        <div class="section-title">📤 Export Full Chain</div>
        <div class="action-buttons">
          <button class="action-btn primary" onclick="exportAllChainPEM()">Export All (PEM)</button>
          <button class="action-btn" onclick="exportAllChainDER()">Export All (DER)</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📄 Export Leaf Certificate</div>
        <div class="action-buttons">
          <button class="action-btn" onclick="exportPEM()">Export PEM</button>
          <button class="action-btn" onclick="exportDER()">Export DER</button>
          <button class="action-btn" onclick="saveDomain()">⭐ Save Domain</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🔐 Fingerprints (Click to copy)</div>
        
        <div class="fingerprint-box" onclick="copyText('${cert.fingerprints.sha256}')">
          <div class="fingerprint-label">SHA-256</div>
          ${cert.fingerprints.sha256}
        </div>

        <div class="fingerprint-box" onclick="copyText('${cert.fingerprints.sha1}')">
          <div class="fingerprint-label">SHA-1</div>
          ${cert.fingerprints.sha1}
        </div>

        <div class="fingerprint-box" onclick="copyText('${cert.fingerprints.md5}')">
          <div class="fingerprint-label">MD5</div>
          ${cert.fingerprints.md5}
        </div>
      </div>

      <div class="section">
        <div class="section-title">📝 Serial Number</div>
        <div class="fingerprint-box" onclick="copyText('${cert.serialNumber}')">
          ${cert.serialNumber}
        </div>
      </div>

      <div class="section">
        <div class="section-title">📥 Import Local Certificate</div>
        <div class="action-buttons">
          <button class="action-btn" onclick="importLocalCert()">Import Certificate File</button>
        </div>
        <div class="info-hint">Import .pem, .crt, .cer, or .der files from your local system</div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function showTab(tabId) {
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
      });
      document.querySelectorAll('.tab').forEach(el => {
        el.classList.remove('active');
      });

      // Show selected tab
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }

    function copyText(text) {
      vscode.postMessage({ command: 'copyToClipboard', text: text });
    }

    function generateCode(platform) {
      vscode.postMessage({ command: 'generateCode', platform: platform });
    }

    function saveDomain() {
      vscode.postMessage({ command: 'saveDomain' });
    }

    function exportPEM() {
      vscode.postMessage({ command: 'exportPEM' });
    }

    function exportDER() {
      vscode.postMessage({ command: 'exportDER' });
    }

    function exportChainCertPEM(index) {
      vscode.postMessage({ command: 'exportChainCertPEM', chainIndex: index });
    }

    function exportChainCertDER(index) {
      vscode.postMessage({ command: 'exportChainCertDER', chainIndex: index });
    }

    function exportAllChainPEM() {
      vscode.postMessage({ command: 'exportAllChainPEM' });
    }

    function exportAllChainDER() {
      vscode.postMessage({ command: 'exportAllChainDER' });
    }

    function importLocalCert() {
      vscode.postMessage({ command: 'importLocalCert' });
    }
  </script>
</body>
</html>`;
}

/**
 * Get current certificate
 */
export function getCurrentCertificate(): CertificateInfo | undefined {
  return currentCertificateChain?.certificates[0];
}

/**
 * Get current certificate chain
 */
export function getCurrentCertificateChain(): CertificateChain | undefined {
  return currentCertificateChain;
}
