/**
 * SSLens - Tree View Providers
 * Sidebar views for saved domains and recent certificates
 */

import * as vscode from 'vscode';
import { getStorageService } from '../services/storageService';
import { SavedDomain, RecentCertificate } from '../types';

/**
 * Tree item for saved domains
 */
class DomainTreeItem extends vscode.TreeItem {
  constructor(
    public readonly domain: string,
    public readonly port: number,
    public readonly alias?: string,
    public readonly lastChecked?: Date,
    public readonly lastFingerprint?: string
  ) {
    super(
      alias || domain,
      vscode.TreeItemCollapsibleState.None
    );

    this.description = port !== 443 ? `:${port}` : '';
    this.tooltip = this.createTooltip();
    this.contextValue = 'domain';

    // Set icon based on status
    this.iconPath = new vscode.ThemeIcon('globe');

    // Click to fetch certificate
    this.command = {
      command: 'sslens.fetchFromDomain',
      title: 'Fetch Certificate',
      arguments: [domain, port]
    };
  }

  private createTooltip(): string {
    const lines: string[] = [];
    lines.push(`Domain: ${this.domain}:${this.port}`);
    
    if (this.alias) {
      lines.push(`Alias: ${this.alias}`);
    }
    
    if (this.lastChecked) {
      lines.push(`Last checked: ${new Date(this.lastChecked).toLocaleString()}`);
    }
    
    if (this.lastFingerprint) {
      lines.push(`Fingerprint: ${this.lastFingerprint.substring(0, 20)}...`);
    }

    lines.push('');
    lines.push('Click to fetch certificate');
    
    return lines.join('\n');
  }
}

/**
 * Tree item for recent certificates
 */
class RecentCertTreeItem extends vscode.TreeItem {
  constructor(
    public readonly domain: string,
    public readonly port: number,
    public readonly fetchedAt: Date,
    public readonly fingerprint: string,
    public readonly expiresAt: Date,
    public readonly issuer: string
  ) {
    super(
      domain,
      vscode.TreeItemCollapsibleState.None
    );

    const now = new Date();
    const daysLeft = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Status icon
    let icon: string;
    if (daysLeft < 0) {
      icon = 'error';
      this.description = 'EXPIRED';
    } else if (daysLeft < 7) {
      icon = 'warning';
      this.description = `${daysLeft}d left`;
    } else if (daysLeft < 30) {
      icon = 'warning';
      this.description = `${daysLeft}d left`;
    } else {
      icon = 'pass';
      this.description = `${daysLeft}d left`;
    }

    this.iconPath = new vscode.ThemeIcon(icon);
    this.tooltip = this.createTooltip(daysLeft);
    this.contextValue = 'recentCert';

    this.command = {
      command: 'sslens.fetchFromDomain',
      title: 'Fetch Certificate',
      arguments: [domain, port]
    };
  }

  private createTooltip(daysLeft: number): string {
    const lines: string[] = [];
    lines.push(`Domain: ${this.domain}:${this.port}`);
    lines.push(`Issuer: ${this.issuer}`);
    lines.push(`Expires: ${new Date(this.expiresAt).toLocaleDateString()}`);
    lines.push(`Days left: ${daysLeft}`);
    lines.push(`Fetched: ${new Date(this.fetchedAt).toLocaleString()}`);
    lines.push('');
    lines.push('Click to fetch latest certificate');
    return lines.join('\n');
  }
}

/**
 * Tree data provider for saved domains
 */
export class SavedDomainsProvider implements vscode.TreeDataProvider<DomainTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DomainTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<DomainTreeItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<DomainTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DomainTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DomainTreeItem): Thenable<DomainTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    try {
      const storageService = getStorageService();
      const savedDomains = storageService.getSavedDomains();

      if (savedDomains.length === 0) {
        return Promise.resolve([]);
      }

      const items = savedDomains.map((d: SavedDomain) => new DomainTreeItem(
        d.domain,
        d.port,
        d.alias,
        d.lastChecked,
        d.lastFingerprint
      ));

      return Promise.resolve(items);
    } catch (error) {
      return Promise.resolve([]);
    }
  }
}

/**
 * Tree data provider for recent certificates
 */
export class RecentCertificatesProvider implements vscode.TreeDataProvider<RecentCertTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RecentCertTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<RecentCertTreeItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<RecentCertTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: RecentCertTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RecentCertTreeItem): Thenable<RecentCertTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    try {
      const storageService = getStorageService();
      const recentCerts = storageService.getRecentCertificates();

      if (recentCerts.length === 0) {
        return Promise.resolve([]);
      }

      const items = recentCerts.map((r: RecentCertificate) => new RecentCertTreeItem(
        r.domain,
        r.port,
        new Date(r.fetchedAt),
        r.fingerprint,
        new Date(r.expiresAt),
        r.issuer
      ));

      return Promise.resolve(items);
    } catch (error) {
      return Promise.resolve([]);
    }
  }
}

// Provider instances
let savedDomainsProvider: SavedDomainsProvider;
let recentCertificatesProvider: RecentCertificatesProvider;

/**
 * Register tree view providers
 */
export function registerTreeViews(context: vscode.ExtensionContext): void {
  savedDomainsProvider = new SavedDomainsProvider();
  recentCertificatesProvider = new RecentCertificatesProvider();

  vscode.window.registerTreeDataProvider('sslensDomains', savedDomainsProvider);
  vscode.window.registerTreeDataProvider('sslensRecent', recentCertificatesProvider);
}

/**
 * Refresh all tree views
 */
export function refreshTreeViews(): void {
  if (savedDomainsProvider) {
    savedDomainsProvider.refresh();
  }
  if (recentCertificatesProvider) {
    recentCertificatesProvider.refresh();
  }
}
