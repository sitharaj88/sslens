/**
 * Webview Panel - Rich certificate display
 * Shows certificate details in a beautiful webview
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
    'sslCertificate',
    `SSL: ${chain.domain}`,
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
          await vscode.commands.executeCommand('ssl-helper.saveDomain');
          break;
        case 'exportPEM':
          await vscode.commands.executeCommand('ssl-helper.exportPEM');
          break;
        case 'exportDER':
          await vscode.commands.executeCommand('ssl-helper.exportDER');
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
      </div>
      ${i < chain.certificates.length - 1 ? '<div class="chain-arrow">↓</div>' : ''}
    `;
  }).join('\n');

  // SAN list
  const sanList = cert.subjectAltNames.length > 0 
    ? cert.subjectAltNames.map(s => `<div class="san-item">${s}</div>`).join('\n')
    : '<div class="san-item muted">No SANs</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSL Certificate</title>
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --bg-secondary: #252526;
      --bg-tertiary: #2d2d2d;
      --text-primary: #cccccc;
      --text-secondary: #9d9d9d;
      --accent: #007acc;
      --success: #4ec9b0;
      --warning: #dcdcaa;
      --error: #f14c4c;
      --border: #404040;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-left h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    .header-left .domain {
      color: var(--accent);
      font-size: 14px;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
    }

    .status-valid { background: rgba(78, 201, 176, 0.2); color: var(--success); }
    .status-warning { background: rgba(220, 220, 170, 0.2); color: var(--warning); }
    .status-critical { background: rgba(241, 76, 76, 0.2); color: var(--error); }
    .status-expired { background: rgba(241, 76, 76, 0.3); color: var(--error); }

    .chain-status {
      margin-top: 8px;
      font-size: 12px;
    }

    .chain-valid { color: var(--success); }
    .chain-invalid { color: var(--error); }

    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }

    .tab {
      padding: 10px 20px;
      cursor: pointer;
      border: none;
      background: none;
      color: var(--text-secondary);
      font-size: 14px;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab:hover { color: var(--text-primary); }
    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .section {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
    }

    .info-label {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .info-value {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      word-break: break-all;
    }

    .copyable {
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
      transition: background 0.2s;
    }

    .copyable:hover {
      background: var(--bg-tertiary);
    }

    .copy-hint {
      font-size: 11px;
      color: var(--text-secondary);
      margin-left: 8px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .copyable:hover .copy-hint {
      opacity: 1;
    }

    .chain-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .chain-cert {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--bg-tertiary);
      padding: 12px 16px;
      border-radius: 8px;
      width: 100%;
      max-width: 400px;
      border: 1px solid var(--border);
    }

    .chain-cert.active {
      border-color: var(--accent);
    }

    .chain-icon {
      font-size: 24px;
    }

    .chain-type {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-secondary);
    }

    .chain-cn {
      font-size: 14px;
    }

    .chain-arrow {
      color: var(--text-secondary);
      font-size: 18px;
    }

    .san-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .san-item {
      background: var(--bg-tertiary);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
    }

    .san-item.muted {
      color: var(--text-secondary);
    }

    .platforms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }

    .platform-btn {
      padding: 10px 16px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .platform-btn:hover {
      background: var(--accent);
      border-color: var(--accent);
    }

    .action-buttons {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 8px 16px;
      border: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: var(--bg-tertiary);
    }

    .action-btn.primary {
      background: var(--accent);
      border-color: var(--accent);
    }

    .action-btn.primary:hover {
      opacity: 0.9;
    }

    .fingerprint-box {
      background: var(--bg-tertiary);
      padding: 12px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 11px;
      margin-top: 8px;
      word-break: break-all;
      cursor: pointer;
    }

    .fingerprint-box:hover {
      background: var(--bg-primary);
    }

    .fingerprint-label {
      font-weight: bold;
      color: var(--accent);
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>🔒 ${cert.subject.commonName}</h1>
        <div class="domain">${cert.domain}:${cert.port}</div>
        <div class="chain-status">${chainStatus}</div>
      </div>
      <div class="status-badge ${statusClass}">${statusBadge}</div>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="showTab('details')">Details</button>
      <button class="tab" onclick="showTab('chain')">Chain</button>
      <button class="tab" onclick="showTab('pinning')">Pinning</button>
      <button class="tab" onclick="showTab('export')">Export</button>
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
        <div class="section-title">🔗 Certificate Chain (${chain.certificates.length} certificates)</div>
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
        <div class="section-title">📤 Export Certificate</div>
        <div class="action-buttons">
          <button class="action-btn primary" onclick="exportPEM()">Export PEM</button>
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
