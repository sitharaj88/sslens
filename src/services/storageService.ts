/**
 * Storage Service - Persist saved domains and recent certificates
 * Uses VS Code's workspace configuration for storage
 */

import * as vscode from 'vscode';
import { SavedDomain, RecentCertificate, CertificateInfo } from '../types';

export class StorageService {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get saved domains
   */
  getSavedDomains(): SavedDomain[] {
    return this.context.globalState.get<SavedDomain[]>('savedDomains', []);
  }

  /**
   * Save a domain to favorites
   */
  async saveDomain(domain: string, port: number = 443, alias?: string): Promise<void> {
    const domains = this.getSavedDomains();
    
    // Check if already exists
    const existing = domains.find(d => d.domain === domain && d.port === port);
    if (existing) {
      // Update existing
      existing.alias = alias;
      existing.lastChecked = new Date();
    } else {
      // Add new
      domains.push({
        domain,
        port,
        addedAt: new Date(),
        alias,
      });
    }

    await this.context.globalState.update('savedDomains', domains);
  }

  /**
   * Remove a domain from favorites
   */
  async removeDomain(domain: string, port: number = 443): Promise<void> {
    const domains = this.getSavedDomains();
    const filtered = domains.filter(d => !(d.domain === domain && d.port === port));
    await this.context.globalState.update('savedDomains', filtered);
  }

  /**
   * Update domain's last check info
   */
  async updateDomainCheck(domain: string, port: number, fingerprint: string): Promise<void> {
    const domains = this.getSavedDomains();
    const existing = domains.find(d => d.domain === domain && d.port === port);
    
    if (existing) {
      existing.lastChecked = new Date();
      existing.lastFingerprint = fingerprint;
      await this.context.globalState.update('savedDomains', domains);
    }
  }

  /**
   * Get recent certificates
   */
  getRecentCertificates(): RecentCertificate[] {
    return this.context.globalState.get<RecentCertificate[]>('recentCertificates', []);
  }

  /**
   * Add a certificate to recent history
   */
  async addRecentCertificate(cert: CertificateInfo): Promise<void> {
    const recent = this.getRecentCertificates();
    const maxItems = vscode.workspace.getConfiguration('sslHelper').get<number>('maxRecentItems', 10);

    // Remove existing entry for same domain
    const filtered = recent.filter(r => !(r.domain === cert.domain && r.port === cert.port));

    // Add new entry at the beginning
    filtered.unshift({
      domain: cert.domain,
      port: cert.port,
      fetchedAt: cert.fetchedAt,
      fingerprint: cert.fingerprints.sha256,
      expiresAt: cert.validTo,
      issuer: cert.issuer.commonName,
    });

    // Trim to max items
    const trimmed = filtered.slice(0, maxItems);
    
    await this.context.globalState.update('recentCertificates', trimmed);
  }

  /**
   * Clear recent certificates
   */
  async clearRecentCertificates(): Promise<void> {
    await this.context.globalState.update('recentCertificates', []);
  }

  /**
   * Store certificate in cache for quick access
   */
  async cacheCertificate(cert: CertificateInfo): Promise<void> {
    const key = `cert_${cert.domain}_${cert.port}`;
    await this.context.globalState.update(key, cert);
  }

  /**
   * Get cached certificate
   */
  getCachedCertificate(domain: string, port: number): CertificateInfo | undefined {
    const key = `cert_${domain}_${port}`;
    return this.context.globalState.get<CertificateInfo>(key);
  }

  /**
   * Clear certificate cache
   */
  async clearCertificateCache(): Promise<void> {
    const keys = this.context.globalState.keys();
    for (const key of keys) {
      if (key.startsWith('cert_')) {
        await this.context.globalState.update(key, undefined);
      }
    }
  }

  /**
   * Export all data
   */
  exportData(): string {
    return JSON.stringify({
      savedDomains: this.getSavedDomains(),
      recentCertificates: this.getRecentCertificates(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import data
   */
  async importData(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData);
    
    if (data.savedDomains) {
      await this.context.globalState.update('savedDomains', data.savedDomains);
    }
    
    if (data.recentCertificates) {
      await this.context.globalState.update('recentCertificates', data.recentCertificates);
    }
  }
}

let storageServiceInstance: StorageService | undefined;

export function initStorageService(context: vscode.ExtensionContext): StorageService {
  storageServiceInstance = new StorageService(context);
  return storageServiceInstance;
}

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    throw new Error('Storage service not initialized');
  }
  return storageServiceInstance;
}
