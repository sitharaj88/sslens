/**
 * SSLens - Type Definitions
 * Core types for certificate handling and export
 */

export interface CertificateInfo {
  // Basic Info
  domain: string;
  port: number;
  fetchedAt: Date;
  
  // Subject
  subject: {
    commonName: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
  };
  
  // Issuer
  issuer: {
    commonName: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
  };
  
  // Validity
  validFrom: Date;
  validTo: Date;
  isExpired: boolean;
  daysUntilExpiry: number;
  
  // Technical Details
  serialNumber: string;
  version: number;
  signatureAlgorithm: string;
  
  // Public Key
  publicKey: {
    algorithm: string;
    keySize: number;
    exponent?: string;
    modulus?: string;
  };
  
  // Fingerprints
  fingerprints: {
    sha1: string;
    sha256: string;
    md5: string;
  };
  
  // Extensions
  subjectAltNames: string[];
  keyUsage?: string[];
  extendedKeyUsage?: string[];
  
  // Hashes for pinning
  publicKeyHash: string;  // SHA-256 Base64
  spkiHash: string;       // SubjectPublicKeyInfo hash
  
  // Raw data
  pemEncoded: string;
  derEncoded: string;  // Base64 encoded DER
  
  // Chain
  isRootCA: boolean;
  chainIndex: number;
}

export interface CertificateChain {
  domain: string;
  port: number;
  certificates: CertificateInfo[];
  isValid: boolean;
  validationError?: string;
}

export interface SavedDomain {
  domain: string;
  port: number;
  addedAt: Date;
  lastChecked?: Date;
  lastFingerprint?: string;
  alias?: string;
}

export interface RecentCertificate {
  domain: string;
  port: number;
  fetchedAt: Date;
  fingerprint: string;
  expiresAt: Date;
  issuer: string;
}

export interface ExportFormat {
  name: string;
  extension: string;
  mimeType: string;
}

export interface PinningCodeOptions {
  platform: 'android-okhttp' | 'android-retrofit' | 'ios-swift' | 'ios-alamofire' | 'flutter-dio' | 'flutter-http' | 'react-native';
  domains: string[];
  hashes: string[];
  includeBackup: boolean;
}

export interface ComparisonResult {
  domain1: string;
  domain2: string;
  matches: boolean;
  differences: {
    field: string;
    value1: string;
    value2: string;
  }[];
}

export interface BulkFetchResult {
  domain: string;
  success: boolean;
  certificate?: CertificateInfo;
  error?: string;
}

export const EXPORT_FORMATS: Record<string, ExportFormat> = {
  PEM: {
    name: 'PEM',
    extension: '.pem',
    mimeType: 'application/x-pem-file'
  },
  DER: {
    name: 'DER',
    extension: '.der',
    mimeType: 'application/x-x509-ca-cert'
  },
  CRT: {
    name: 'CRT',
    extension: '.crt',
    mimeType: 'application/x-x509-ca-cert'
  },
  CER: {
    name: 'CER',
    extension: '.cer',
    mimeType: 'application/x-x509-ca-cert'
  }
};

export const SUPPORTED_PLATFORMS = [
  { id: 'android-okhttp', name: 'Android (OkHttp)', language: 'kotlin' },
  { id: 'android-retrofit', name: 'Android (Retrofit)', language: 'kotlin' },
  { id: 'ios-swift', name: 'iOS (URLSession)', language: 'swift' },
  { id: 'ios-alamofire', name: 'iOS (Alamofire)', language: 'swift' },
  { id: 'flutter-dio', name: 'Flutter (Dio)', language: 'dart' },
  { id: 'flutter-http', name: 'Flutter (http package)', language: 'dart' },
  { id: 'react-native', name: 'React Native', language: 'javascript' }
] as const;
