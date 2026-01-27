/**
 * SSLens - SSL Service
 * Core certificate fetching and parsing
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
   * Parse a local PEM file (single certificate)
   */
  parsePEMFile(pemContent: string): CertificateInfo {
    const chain = this.parsePEMChain(pemContent);
    if (chain.certificates.length === 0) {
      throw new Error('No certificates found in PEM file');
    }
    return chain.certificates[0];
  }

  /**
   * Parse a PEM file that may contain multiple certificates (chain)
   */
  parsePEMChain(pemContent: string, sourceName: string = 'local-file'): CertificateChain {
    // Find all certificates in the PEM content
    const certRegex = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
    const certificates: CertificateInfo[] = [];
    let match;
    let chainIndex = 0;

    while ((match = certRegex.exec(pemContent)) !== null) {
      const base64 = match[1].replace(/\s/g, '');
      const pemBlock = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;

      try {
        const certInfo = this.parseX509Certificate(pemBlock, sourceName, chainIndex);
        certificates.push(certInfo);
        chainIndex++;
      } catch (error) {
        console.error(`Failed to parse certificate at index ${chainIndex}:`, error);
      }
    }

    if (certificates.length === 0) {
      throw new Error('No valid certificates found in PEM file');
    }

    // Determine if the chain is valid
    let isValid = true;
    for (const cert of certificates) {
      if (cert.isExpired) {
        isValid = false;
        break;
      }
    }

    return {
      domain: sourceName,
      port: 0,
      certificates,
      isValid
    };
  }

  /**
   * Parse a single X.509 certificate using Node.js crypto
   */
  private parseX509Certificate(pemContent: string, domain: string, chainIndex: number): CertificateInfo {
    // Use Node.js crypto.X509Certificate for proper parsing
    const x509 = new crypto.X509Certificate(pemContent);

    const now = new Date();
    const validFrom = new Date(x509.validFrom);
    const validTo = new Date(x509.validTo);
    const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Parse subject and issuer
    const subject = this.parseX509Name(x509.subject);
    const issuer = this.parseX509Name(x509.issuer);

    // Calculate fingerprints from raw DER
    const derBuffer = Buffer.from(x509.raw);
    const sha256 = this.formatFingerprint(crypto.createHash('sha256').update(derBuffer).digest('hex'));
    const sha1 = this.formatFingerprint(crypto.createHash('sha1').update(derBuffer).digest('hex'));
    const md5 = this.formatFingerprint(crypto.createHash('md5').update(derBuffer).digest('hex'));

    // Get public key info
    const publicKey = x509.publicKey;
    const keyType = publicKey.asymmetricKeyType || 'unknown';
    let algorithm = keyType.toUpperCase();
    let keySize = 0;

    if (keyType === 'rsa') {
      const keyDetails = publicKey.asymmetricKeyDetails;
      keySize = keyDetails?.modulusLength || 2048;
    } else if (keyType === 'ec') {
      const keyDetails = publicKey.asymmetricKeyDetails;
      algorithm = `ECDSA (${keyDetails?.namedCurve || 'unknown'})`;
      const curveSizes: Record<string, number> = {
        'prime256v1': 256,
        'P-256': 256,
        'secp384r1': 384,
        'P-384': 384,
        'secp521r1': 521,
        'P-521': 521,
      };
      keySize = curveSizes[keyDetails?.namedCurve || ''] || 256;
    }

    // Calculate SPKI hash for pinning
    const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
    const publicKeyHash = crypto.createHash('sha256').update(spkiDer).digest('base64');
    const spkiHash = `sha256/${publicKeyHash}`;

    // Parse Subject Alternative Names
    const subjectAltNames = this.parseX509SAN(x509.subjectAltName);

    // Parse key usage
    const keyUsage = x509.keyUsage;

    // Determine if this is a root CA
    const isRootCA = subject.commonName === issuer.commonName && x509.ca;

    // Convert to PEM with proper formatting
    const base64 = derBuffer.toString('base64');
    const pemEncoded = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;

    return {
      domain,
      port: 0,
      fetchedAt: now,
      subject: {
        commonName: subject.commonName || '',
        organization: subject.organization,
        organizationalUnit: subject.organizationalUnit,
        country: subject.country,
        state: subject.state,
        locality: subject.locality,
      },
      issuer: {
        commonName: issuer.commonName || '',
        organization: issuer.organization,
        organizationalUnit: issuer.organizationalUnit,
        country: issuer.country,
      },
      validFrom,
      validTo,
      isExpired: now > validTo,
      daysUntilExpiry,
      serialNumber: x509.serialNumber,
      version: 3,
      signatureAlgorithm: this.extractSignatureAlgorithm(x509),
      publicKey: {
        algorithm,
        keySize,
      },
      fingerprints: {
        sha1,
        sha256,
        md5,
      },
      subjectAltNames,
      keyUsage: keyUsage || undefined,
      publicKeyHash,
      spkiHash,
      pemEncoded,
      derEncoded: base64,
      isRootCA,
      chainIndex,
    };
  }

  /**
   * Parse X.509 distinguished name string
   */
  private parseX509Name(nameStr: string): {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
  } {
    const result: Record<string, string> = {};

    // Parse format like "CN=example.com\nO=Example Inc\nC=US"
    const parts = nameStr.split('\n');
    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      const value = valueParts.join('='); // Handle values with = in them
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }

    return {
      commonName: result['CN'],
      organization: result['O'],
      organizationalUnit: result['OU'],
      country: result['C'],
      state: result['ST'],
      locality: result['L'],
    };
  }

  /**
   * Parse Subject Alternative Names from X.509 extension
   */
  private parseX509SAN(sanStr: string | undefined): string[] {
    if (!sanStr) {
      return [];
    }

    const sans: string[] = [];
    const entries = sanStr.split(', ');

    for (const entry of entries) {
      // Format is like "DNS:example.com" or "IP Address:1.2.3.4"
      const colonIndex = entry.indexOf(':');
      if (colonIndex !== -1) {
        sans.push(entry.substring(colonIndex + 1));
      } else {
        sans.push(entry);
      }
    }

    return sans;
  }

  /**
   * Extract signature algorithm from X.509 certificate
   */
  private extractSignatureAlgorithm(x509: crypto.X509Certificate): string {
    // Try to get from fingerprint type (SHA-256 fingerprint means SHA-256 based signature)
    if (x509.fingerprint256) {
      // Check the public key type to determine full algorithm
      const keyType = x509.publicKey.asymmetricKeyType;
      if (keyType === 'rsa') {
        return 'SHA256withRSA';
      } else if (keyType === 'ec') {
        return 'SHA256withECDSA';
      }
      return 'SHA-256';
    }
    return 'Unknown';
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
