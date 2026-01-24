/**
 * SSL Service - Core certificate fetching and parsing
 * Handles TLS connections and certificate extraction
 */

import * as tls from 'tls';
import * as crypto from 'crypto';
import { CertificateInfo, CertificateChain } from '../types';

export class SSLService {
  private timeout: number;

  constructor(timeout: number = 10000) {
    this.timeout = timeout;
  }

  /**
   * Fetch certificate chain from a domain
   */
  async fetchCertificateChain(domain: string, port: number = 443): Promise<CertificateChain> {
    return new Promise((resolve, reject) => {
      const certificates: CertificateInfo[] = [];
      
      const socket = tls.connect(
        {
          host: domain,
          port: port,
          servername: domain, // SNI support
          rejectUnauthorized: false, // Allow self-signed for inspection
          requestCert: true,
        },
        () => {
          try {
            const cert = socket.getPeerCertificate(true);
            
            if (!cert || Object.keys(cert).length === 0) {
              socket.destroy();
              reject(new Error('No certificate received from server'));
              return;
            }

            // Parse the certificate chain
            let currentCert: tls.DetailedPeerCertificate | undefined = cert;
            let chainIndex = 0;

            while (currentCert && Object.keys(currentCert).length > 0) {
              const certInfo = this.parseCertificate(currentCert, domain, port, chainIndex);
              certificates.push(certInfo);

              // Move to issuer certificate
              if (currentCert.issuerCertificate && 
                  currentCert.issuerCertificate !== currentCert &&
                  currentCert.issuerCertificate.fingerprint !== currentCert.fingerprint) {
                currentCert = currentCert.issuerCertificate;
                chainIndex++;
              } else {
                break;
              }
            }

            socket.destroy();

            resolve({
              domain,
              port,
              certificates,
              isValid: socket.authorized,
              validationError: socket.authorized ? undefined : (socket.authorizationError?.toString() || 'Unknown error')
            });
          } catch (error) {
            socket.destroy();
            reject(error);
          }
        }
      );

      socket.setTimeout(this.timeout);
      
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Connection timeout after ${this.timeout}ms`));
      });

      socket.on('error', (error) => {
        socket.destroy();
        reject(error);
      });
    });
  }

  /**
   * Fetch only the leaf certificate
   */
  async fetchCertificate(domain: string, port: number = 443): Promise<CertificateInfo> {
    const chain = await this.fetchCertificateChain(domain, port);
    if (chain.certificates.length === 0) {
      throw new Error('No certificates found');
    }
    return chain.certificates[0];
  }

  /**
   * Parse a certificate into our CertificateInfo format
   */
  private parseCertificate(
    cert: tls.DetailedPeerCertificate,
    domain: string,
    port: number,
    chainIndex: number
  ): CertificateInfo {
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);
    const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate fingerprints
    const rawDer = cert.raw;
    const sha1 = this.formatFingerprint(crypto.createHash('sha1').update(rawDer).digest('hex'));
    const sha256 = this.formatFingerprint(crypto.createHash('sha256').update(rawDer).digest('hex'));
    const md5 = this.formatFingerprint(crypto.createHash('md5').update(rawDer).digest('hex'));

    // Calculate public key hash (for pinning)
    const publicKeyHash = this.calculatePublicKeyHash(cert);
    const spkiHash = this.calculateSPKIHash(cert);

    // Generate PEM
    const pemEncoded = this.derToPem(rawDer);
    const derEncoded = rawDer.toString('base64');

    // Parse subject alternative names
    const subjectAltNames = this.parseSubjectAltNames(cert.subjectaltname);

    // Determine if this is a root CA
    const isRootCA = cert.subject?.CN === cert.issuer?.CN && chainIndex > 0;

    // Parse public key info
    const publicKeyInfo = this.parsePublicKeyInfo(cert);

    return {
      domain,
      port,
      fetchedAt: now,
      subject: {
        commonName: cert.subject?.CN || '',
        organization: cert.subject?.O,
        organizationalUnit: cert.subject?.OU,
        country: cert.subject?.C,
        state: cert.subject?.ST,
        locality: cert.subject?.L,
      },
      issuer: {
        commonName: cert.issuer?.CN || '',
        organization: cert.issuer?.O,
        organizationalUnit: cert.issuer?.OU,
        country: cert.issuer?.C,
      },
      validFrom,
      validTo,
      isExpired: now > validTo,
      daysUntilExpiry,
      serialNumber: cert.serialNumber,
      version: 3, // Most certs are v3
      signatureAlgorithm: cert.fingerprint256 ? 'SHA-256' : 'SHA-1',
      publicKey: publicKeyInfo,
      fingerprints: {
        sha1,
        sha256,
        md5,
      },
      subjectAltNames,
      keyUsage: cert.ext_key_usage,
      publicKeyHash,
      spkiHash,
      pemEncoded,
      derEncoded,
      isRootCA,
      chainIndex,
    };
  }

  /**
   * Calculate SHA-256 hash of the public key (for Android/iOS pinning)
   */
  private calculatePublicKeyHash(cert: tls.DetailedPeerCertificate): string {
    try {
      // The pubkey property contains the public key in DER format
      if (cert.pubkey) {
        const hash = crypto.createHash('sha256').update(cert.pubkey).digest('base64');
        return hash;
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Calculate SPKI hash (SubjectPublicKeyInfo)
   */
  private calculateSPKIHash(cert: tls.DetailedPeerCertificate): string {
    try {
      if (cert.pubkey) {
        // SPKI is the entire SubjectPublicKeyInfo structure
        const hash = crypto.createHash('sha256').update(cert.pubkey).digest('base64');
        return `sha256/${hash}`;
      }
      return '';
    } catch {
      return '';
    }
  }

  /**
   * Convert DER buffer to PEM format
   */
  private derToPem(der: Buffer): string {
    const base64 = der.toString('base64');
    const lines: string[] = [];
    
    lines.push('-----BEGIN CERTIFICATE-----');
    
    // Split into 64-character lines
    for (let i = 0; i < base64.length; i += 64) {
      lines.push(base64.substring(i, i + 64));
    }
    
    lines.push('-----END CERTIFICATE-----');
    
    return lines.join('\n');
  }

  /**
   * Format fingerprint with colons
   */
  private formatFingerprint(hex: string): string {
    return hex.toUpperCase().match(/.{2}/g)?.join(':') || hex;
  }

  /**
   * Parse Subject Alternative Names
   */
  private parseSubjectAltNames(san: string | undefined): string[] {
    if (!san) {
      return [];
    }

    return san.split(', ').map(entry => {
      // Remove prefix like "DNS:" or "IP Address:"
      const colonIndex = entry.indexOf(':');
      return colonIndex !== -1 ? entry.substring(colonIndex + 1) : entry;
    });
  }

  /**
   * Parse public key information
   */
  private parsePublicKeyInfo(cert: tls.DetailedPeerCertificate): CertificateInfo['publicKey'] {
    // Default values
    let algorithm = 'RSA';
    let keySize = 2048;

    // Try to determine from bits property
    if (cert.bits) {
      keySize = cert.bits;
    }

    // Check modulus length for RSA keys
    if (cert.modulus) {
      keySize = cert.modulus.length * 4; // Convert hex chars to bits
    }

    // Check for EC keys
    if (cert.asn1Curve) {
      algorithm = `ECDSA (${cert.asn1Curve})`;
      // EC key sizes based on curve
      const curveSizes: Record<string, number> = {
        'prime256v1': 256,
        'secp384r1': 384,
        'secp521r1': 521,
      };
      keySize = curveSizes[cert.asn1Curve] || 256;
    }

    return {
      algorithm,
      keySize,
      exponent: cert.exponent,
      modulus: cert.modulus ? `${cert.modulus.substring(0, 20)}...` : undefined,
    };
  }

  /**
   * Parse a local PEM file
   */
  parsePEMFile(pemContent: string): CertificateInfo {
    // Extract the base64 content
    const matches = pemContent.match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/);
    
    if (!matches || !matches[1]) {
      throw new Error('Invalid PEM format');
    }

    const base64 = matches[1].replace(/\s/g, '');
    const der = Buffer.from(base64, 'base64');

    // Create a minimal certificate info for local files
    // Note: Full parsing would require a proper X.509 parser
    const sha256 = this.formatFingerprint(crypto.createHash('sha256').update(der).digest('hex'));
    const sha1 = this.formatFingerprint(crypto.createHash('sha1').update(der).digest('hex'));
    const md5 = this.formatFingerprint(crypto.createHash('md5').update(der).digest('hex'));

    return {
      domain: 'local-file',
      port: 0,
      fetchedAt: new Date(),
      subject: {
        commonName: 'Parsed from local file',
      },
      issuer: {
        commonName: 'Unknown (local file)',
      },
      validFrom: new Date(),
      validTo: new Date(),
      isExpired: false,
      daysUntilExpiry: 0,
      serialNumber: 'Unknown',
      version: 3,
      signatureAlgorithm: 'Unknown',
      publicKey: {
        algorithm: 'Unknown',
        keySize: 0,
      },
      fingerprints: {
        sha1,
        sha256,
        md5,
      },
      subjectAltNames: [],
      publicKeyHash: crypto.createHash('sha256').update(der).digest('base64'),
      spkiHash: `sha256/${crypto.createHash('sha256').update(der).digest('base64')}`,
      pemEncoded: pemContent,
      derEncoded: base64,
      isRootCA: false,
      chainIndex: 0,
    };
  }

  /**
   * Validate a certificate chain
   */
  async validateChain(chain: CertificateChain): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (chain.certificates.length === 0) {
      return { valid: false, errors: ['No certificates in chain'] };
    }

    // Check each certificate
    for (const cert of chain.certificates) {
      if (cert.isExpired) {
        errors.push(`Certificate ${cert.subject.commonName} is expired`);
      }

      if (cert.daysUntilExpiry < 30 && !cert.isExpired) {
        errors.push(`Certificate ${cert.subject.commonName} expires in ${cert.daysUntilExpiry} days`);
      }
    }

    // Check chain integrity
    for (let i = 0; i < chain.certificates.length - 1; i++) {
      const current = chain.certificates[i];
      const issuer = chain.certificates[i + 1];

      if (current.issuer.commonName !== issuer.subject.commonName) {
        errors.push(`Chain broken: ${current.subject.commonName} issuer doesn't match next certificate`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const sslService = new SSLService();
