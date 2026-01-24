/**
 * SSLens - Export Service
 * Certificate export and format conversion
 * Handles various export formats and pinning code generation
 */

import { CertificateInfo, PinningCodeOptions, SUPPORTED_PLATFORMS } from '../types';

export class ExportService {
  /**
   * Export certificate as PEM format
   */
  exportAsPEM(cert: CertificateInfo): string {
    return cert.pemEncoded;
  }

  /**
   * Export certificate as DER format (Base64)
   */
  exportAsDER(cert: CertificateInfo): Buffer {
    return Buffer.from(cert.derEncoded, 'base64');
  }

  /**
   * Get public key hash for pinning
   */
  getPublicKeyHash(cert: CertificateInfo): string {
    return cert.publicKeyHash;
  }

  /**
   * Get SPKI hash for pinning
   */
  getSPKIHash(cert: CertificateInfo): string {
    return cert.spkiHash;
  }

  /**
   * Generate pinning code for various platforms
   */
  generatePinningCode(options: PinningCodeOptions): string {
    switch (options.platform) {
      case 'android-okhttp':
        return this.generateOkHttpPinning(options);
      case 'android-retrofit':
        return this.generateRetrofitPinning(options);
      case 'ios-swift':
        return this.generateSwiftPinning(options);
      case 'ios-alamofire':
        return this.generateAlamofirePinning(options);
      case 'flutter-dio':
        return this.generateDioPinning(options);
      case 'flutter-http':
        return this.generateFlutterHttpPinning(options);
      case 'react-native':
        return this.generateReactNativePinning(options);
      default:
        throw new Error(`Unsupported platform: ${options.platform}`);
    }
  }

  /**
   * Android OkHttp certificate pinning
   */
  private generateOkHttpPinning(options: PinningCodeOptions): string {
    const pins = options.hashes.map(hash => `        .add("${options.domains[0]}", "${hash}")`).join('\n');
    const backupComment = options.includeBackup 
      ? `\n        // Add backup pins for certificate rotation\n        // .add("${options.domains[0]}", "sha256/BACKUP_HASH_HERE")`
      : '';

    return `// OkHttp Certificate Pinning
// Add to your OkHttpClient builder

import okhttp3.CertificatePinner

val certificatePinner = CertificatePinner.Builder()
${pins}${backupComment}
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()

// Usage example:
// val request = Request.Builder()
//     .url("https://${options.domains[0]}/api/endpoint")
//     .build()
// val response = client.newCall(request).execute()
`;
  }

  /**
   * Android Retrofit certificate pinning
   */
  private generateRetrofitPinning(options: PinningCodeOptions): string {
    const pins = options.hashes.map(hash => `        .add("${options.domains[0]}", "${hash}")`).join('\n');

    return `// Retrofit Certificate Pinning
// Configure your Retrofit instance with certificate pinning

import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

val certificatePinner = CertificatePinner.Builder()
${pins}
    .build()

val okHttpClient = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()

val retrofit = Retrofit.Builder()
    .baseUrl("https://${options.domains[0]}/")
    .client(okHttpClient)
    .addConverterFactory(GsonConverterFactory.create())
    .build()

// Create your API service
// val apiService = retrofit.create(ApiService::class.java)
`;
  }

  /**
   * iOS Swift URLSession certificate pinning
   */
  private generateSwiftPinning(options: PinningCodeOptions): string {
    const hashArray = options.hashes.map(h => `    "${h.replace('sha256/', '')}"`).join(',\n');

    return `// iOS URLSession Certificate Pinning
// Implement URLSessionDelegate for certificate validation

import Foundation
import CommonCrypto

class SSLPinningDelegate: NSObject, URLSessionDelegate {
    
    // SHA-256 hashes of pinned certificates
    private let pinnedHashes: [String] = [
${hashArray}
    ]
    
    func urlSession(_ session: URLSession,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust,
              challenge.protectionSpace.host == "${options.domains[0]}" else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        // Get the certificate chain
        if let certificateChain = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate] {
            for certificate in certificateChain {
                let publicKey = SecCertificateCopyKey(certificate)
                if let publicKeyData = SecKeyCopyExternalRepresentation(publicKey!, nil) as Data? {
                    let hash = sha256(data: publicKeyData)
                    if pinnedHashes.contains(hash) {
                        completionHandler(.useCredential, URLCredential(trust: serverTrust))
                        return
                    }
                }
            }
        }
        
        // Pin validation failed
        completionHandler(.cancelAuthenticationChallenge, nil)
    }
    
    private func sha256(data: Data) -> String {
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return Data(hash).base64EncodedString()
    }
}

// Usage:
// let session = URLSession(configuration: .default, delegate: SSLPinningDelegate(), delegateQueue: nil)
`;
  }

  /**
   * iOS Alamofire certificate pinning
   */
  private generateAlamofirePinning(options: PinningCodeOptions): string {
    return `// Alamofire Certificate Pinning
// Configure ServerTrustManager for certificate pinning

import Alamofire

// Create the server trust manager with pinned certificates
let evaluators: [String: ServerTrustEvaluating] = [
    "${options.domains[0]}": PublicKeysTrustEvaluator()
]

let serverTrustManager = ServerTrustManager(evaluators: evaluators)

// Create session with certificate pinning
let session = Session(serverTrustManager: serverTrustManager)

// For hash-based pinning, use PinnedCertificatesTrustEvaluator:
// let pinnedCertificates = [
//     SecCertificateCreateWithData(nil, certificateData as CFData)!
// ]
// let evaluators: [String: ServerTrustEvaluating] = [
//     "${options.domains[0]}": PinnedCertificatesTrustEvaluator(certificates: pinnedCertificates)
// ]

// Usage:
// session.request("https://${options.domains[0]}/api/endpoint")
//     .responseDecodable(of: MyResponse.self) { response in
//         // Handle response
//     }
`;
  }

  /**
   * Flutter Dio certificate pinning
   */
  private generateDioPinning(options: PinningCodeOptions): string {
    const hashList = options.hashes.map(h => `    '${h.replace('sha256/', '')}'`).join(',\n');

    return `// Flutter Dio Certificate Pinning
// Add certificate pinning to your Dio instance

import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';

class CertificatePinningInterceptor {
  static const List<String> _pinnedHashes = [
${hashList},
  ];

  static Dio createPinnedDio() {
    final dio = Dio();
    
    (dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
      final client = HttpClient();
      
      client.badCertificateCallback = (X509Certificate cert, String host, int port) {
        if (host != '${options.domains[0]}') {
          return false;
        }
        
        // Calculate the certificate hash
        final certHash = base64Encode(
          sha256.convert(cert.der).bytes
        );
        
        return _pinnedHashes.contains(certHash);
      };
      
      return client;
    };
    
    return dio;
  }
}

// Usage:
// final dio = CertificatePinningInterceptor.createPinnedDio();
// final response = await dio.get('https://${options.domains[0]}/api/endpoint');

// Add to pubspec.yaml:
// dependencies:
//   dio: ^5.0.0
//   crypto: ^3.0.0
`;
  }

  /**
   * Flutter http package certificate pinning
   */
  private generateFlutterHttpPinning(options: PinningCodeOptions): string {
    const hashList = options.hashes.map(h => `    '${h.replace('sha256/', '')}'`).join(',\n');

    return `// Flutter HTTP Package Certificate Pinning
// Create a custom HttpClient with certificate pinning

import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

class PinnedHttpClient {
  static const List<String> _pinnedHashes = [
${hashList},
  ];

  static http.Client create() {
    final httpClient = HttpClient();
    
    httpClient.badCertificateCallback = (X509Certificate cert, String host, int port) {
      if (host != '${options.domains[0]}') {
        return false;
      }
      
      final certHash = base64Encode(
        sha256.convert(cert.der).bytes
      );
      
      return _pinnedHashes.contains(certHash);
    };
    
    return IOClient(httpClient);
  }
}

// Usage:
// final client = PinnedHttpClient.create();
// final response = await client.get(Uri.parse('https://${options.domains[0]}/api/endpoint'));
// print(response.body);

// Add to pubspec.yaml:
// dependencies:
//   http: ^1.0.0
//   crypto: ^3.0.0
`;
  }

  /**
   * React Native certificate pinning
   */
  private generateReactNativePinning(options: PinningCodeOptions): string {
    const hashList = options.hashes.map(h => `      '${h}'`).join(',\n');

    return `// React Native Certificate Pinning
// Using react-native-ssl-pinning or similar library

// Option 1: Using react-native-ssl-pinning
// npm install react-native-ssl-pinning

import { fetch } from 'react-native-ssl-pinning';

const pinnedDomains = {
  '${options.domains[0]}': {
    includeSubdomains: true,
    publicKeyHashes: [
${hashList},
    ],
  },
};

async function makeSecureRequest() {
  try {
    const response = await fetch('https://${options.domains[0]}/api/endpoint', {
      method: 'GET',
      timeoutInterval: 10000,
      sslPinning: {
        certs: ['${options.domains[0].replace(/\./g, '_')}'], // Certificate file name without extension
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('SSL Pinning failed:', error);
    throw error;
  }
}

// Option 2: Using TrustKit (iOS) + OkHttp (Android)
// For Android, add to network_security_config.xml:
/*
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config>
        <domain includeSubdomains="true">${options.domains[0]}</domain>
        <pin-set>
${options.hashes.map(h => `            <pin digest="SHA-256">${h.replace('sha256/', '')}</pin>`).join('\n')}
        </pin-set>
    </domain-config>
</network-security-config>
*/

// Export for use
export { makeSecureRequest, pinnedDomains };
`;
  }

  /**
   * Generate all platform code snippets
   */
  generateAllPlatformCode(domains: string[], hashes: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const platform of SUPPORTED_PLATFORMS) {
      result[platform.id] = this.generatePinningCode({
        platform: platform.id as PinningCodeOptions['platform'],
        domains,
        hashes,
        includeBackup: true,
      });
    }
    
    return result;
  }

  /**
   * Format certificate for display
   */
  formatCertificateDisplay(cert: CertificateInfo): string {
    const lines: string[] = [];
    
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  Certificate Details: ${cert.subject.commonName}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    
    lines.push('📋 SUBJECT');
    lines.push(`   Common Name (CN):     ${cert.subject.commonName}`);
    if (cert.subject.organization) {
      lines.push(`   Organization (O):     ${cert.subject.organization}`);
    }
    if (cert.subject.organizationalUnit) {
      lines.push(`   Org Unit (OU):        ${cert.subject.organizationalUnit}`);
    }
    if (cert.subject.country) {
      lines.push(`   Country (C):          ${cert.subject.country}`);
    }
    lines.push('');
    
    lines.push('🏢 ISSUER');
    lines.push(`   Common Name (CN):     ${cert.issuer.commonName}`);
    if (cert.issuer.organization) {
      lines.push(`   Organization (O):     ${cert.issuer.organization}`);
    }
    lines.push('');
    
    lines.push('📅 VALIDITY');
    lines.push(`   Not Before:           ${cert.validFrom.toISOString()}`);
    lines.push(`   Not After:            ${cert.validTo.toISOString()}`);
    lines.push(`   Status:               ${cert.isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
    lines.push(`   Days Until Expiry:    ${cert.daysUntilExpiry}`);
    lines.push('');
    
    lines.push('🔑 PUBLIC KEY');
    lines.push(`   Algorithm:            ${cert.publicKey.algorithm}`);
    lines.push(`   Key Size:             ${cert.publicKey.keySize} bits`);
    lines.push('');
    
    lines.push('🔐 FINGERPRINTS');
    lines.push(`   SHA-256:              ${cert.fingerprints.sha256}`);
    lines.push(`   SHA-1:                ${cert.fingerprints.sha1}`);
    lines.push(`   MD5:                  ${cert.fingerprints.md5}`);
    lines.push('');
    
    lines.push('📌 PINNING HASHES');
    lines.push(`   Public Key (SHA-256): ${cert.publicKeyHash}`);
    lines.push(`   SPKI Hash:            ${cert.spkiHash}`);
    lines.push('');
    
    if (cert.subjectAltNames.length > 0) {
      lines.push('🌐 SUBJECT ALTERNATIVE NAMES');
      for (const san of cert.subjectAltNames) {
        lines.push(`   • ${san}`);
      }
      lines.push('');
    }
    
    lines.push('═══════════════════════════════════════════════════════════════');
    
    return lines.join('\n');
  }
}

export const exportService = new ExportService();
