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
    const hashArray = options.hashes.map(h => `        "${h.replace('sha256/', '')}"`).join(',\n');

    return `// iOS URLSession Certificate Pinning
// Implement URLSessionDelegate for certificate validation

import Foundation
import CryptoKit

class SSLPinningDelegate: NSObject, URLSessionDelegate {
    
    // SHA-256 hashes of pinned public keys (Base64 encoded)
    private let pinnedHashes: Set<String> = [
${hashArray}
    ]
    
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        // Validate the certificate chain
        let certificateCount = SecTrustGetCertificateCount(serverTrust)
        
        for index in 0..<certificateCount {
            guard let certificate = SecTrustGetCertificateAtIndex(serverTrust, index),
                  let publicKey = SecCertificateCopyKey(certificate),
                  let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
                continue
            }
            
            // Calculate SHA-256 hash of the public key
            let hash = SHA256.hash(data: publicKeyData)
            let hashBase64 = Data(hash).base64EncodedString()
            
            if pinnedHashes.contains(hashBase64) {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }
        }
        
        // Pin validation failed
        completionHandler(.cancelAuthenticationChallenge, nil)
    }
}

// Usage:
let delegate = SSLPinningDelegate()
let session = URLSession(
    configuration: .default,
    delegate: delegate,
    delegateQueue: nil
)

// Make request
let url = URL(string: "https://${options.domains[0]}/api/endpoint")!
let task = session.dataTask(with: url) { data, response, error in
    // Handle response
}
task.resume()
`;
  }

  /**
   * iOS Alamofire certificate pinning
   */
  private generateAlamofirePinning(options: PinningCodeOptions): string {
    const hashArray = options.hashes.map(h => `        "${h.replace('sha256/', '')}"`).join(',\n');

    return `// Alamofire Certificate Pinning (Alamofire 5.x)
// Configure ServerTrustManager for public key pinning

import Alamofire
import CryptoKit

// Expected public key hashes (SHA-256, Base64 encoded)
let expectedHashes: Set<String> = [
${hashArray}
]

// Option 1: Using PublicKeysTrustEvaluator (recommended for public key pinning)
let evaluators: [String: ServerTrustEvaluating] = [
    "${options.domains[0]}": PublicKeysTrustEvaluator(
        keys: [], // Will use keys from server certificate
        performDefaultValidation: true,
        validateHost: true
    )
]

let serverTrustManager = ServerTrustManager(evaluators: evaluators)
let session = Session(serverTrustManager: serverTrustManager)

// Usage:
session.request("https://${options.domains[0]}/api/endpoint")
    .validate()
    .responseDecodable(of: YourResponseType.self) { response in
        switch response.result {
        case .success(let data):
            print("Success: \\(data)")
        case .failure(let error):
            print("Error: \\(error)")
        }
    }

// Option 2: Bundle certificates in your app
// 1. Export the certificate as .cer file
// 2. Add to your app bundle
// 3. Use PinnedCertificatesTrustEvaluator
/*
let evaluators: [String: ServerTrustEvaluating] = [
    "${options.domains[0]}": PinnedCertificatesTrustEvaluator()
]
*/
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
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:crypto/crypto.dart';

class CertificatePinning {
  /// SHA-256 hashes of pinned certificates (Base64 encoded)
  static const List<String> pinnedHashes = [
${hashList},
  ];

  /// Creates a Dio instance with certificate pinning enabled
  static Dio createSecureDio({String? baseUrl}) {
    final dio = Dio(BaseOptions(baseUrl: baseUrl));
    
    dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        final client = HttpClient();
        
        client.badCertificateCallback = (X509Certificate cert, String host, int port) {
          // Only validate for the pinned domain
          if (!host.contains('${options.domains[0]}')) {
            return false; // Reject unknown hosts
          }
          
          // Calculate SHA-256 hash of the certificate's DER encoding
          final Uint8List derBytes = Uint8List.fromList(cert.der);
          final digest = sha256.convert(derBytes);
          final certHash = base64Encode(digest.bytes);
          
          // Check if the certificate hash matches any pinned hash
          final isValid = pinnedHashes.contains(certHash);
          
          if (!isValid) {
            print('Certificate pinning failed for $host');
            print('Received hash: $certHash');
          }
          
          return isValid;
        };
        
        return client;
      },
    );
    
    return dio;
  }
}

// Usage:
void main() async {
  final dio = CertificatePinning.createSecureDio(
    baseUrl: 'https://${options.domains[0]}',
  );
  
  try {
    final response = await dio.get('/api/endpoint');
    print(response.data);
  } on DioException catch (e) {
    print('Request failed: \${e.message}');
  }
}

// pubspec.yaml dependencies:
// dependencies:
//   dio: ^5.4.0
//   crypto: ^3.0.3
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
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

class SecureHttpClient {
  /// SHA-256 hashes of pinned certificates (Base64 encoded)
  static const List<String> pinnedHashes = [
${hashList},
  ];
  
  static const String pinnedHost = '${options.domains[0]}';

  /// Creates an http.Client with certificate pinning
  static http.Client create() {
    final httpClient = HttpClient();
    
    httpClient.badCertificateCallback = (X509Certificate cert, String host, int port) {
      // Only apply pinning to the target domain
      if (!host.contains(pinnedHost)) {
        return false;
      }
      
      // Calculate SHA-256 hash of the certificate
      final Uint8List derBytes = Uint8List.fromList(cert.der);
      final digest = sha256.convert(derBytes);
      final certHash = base64Encode(digest.bytes);
      
      return pinnedHashes.contains(certHash);
    };
    
    return IOClient(httpClient);
  }
  
  /// Close the client when done
  static void close(http.Client client) {
    client.close();
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
    const hashListClean = options.hashes.map(h => `            <pin digest="SHA-256">${h.replace('sha256/', '')}</pin>`).join('\n');

    return `// React Native Certificate Pinning
// Multiple implementation options

// ═══════════════════════════════════════════════════════════════
// OPTION 1: react-native-ssl-pinning (Recommended)
// ═══════════════════════════════════════════════════════════════
// npm install react-native-ssl-pinning
// cd ios && pod install

import { fetch as sslFetch } from 'react-native-ssl-pinning';

// SHA-256 public key hashes
const PINNED_HASHES = [
${hashList},
];

export async function secureRequest(endpoint: string, options = {}) {
  try {
    const response = await sslFetch(
      \`https://${options.domains[0]}\${endpoint}\`,
      {
        method: 'GET',
        timeoutInterval: 10000,
        sslPinning: {
          certs: ['${options.domains[0].replace(/\./g, '_')}'],
        },
        ...options,
      }
    );
    
    return await response.json();
  } catch (error) {
    if (error.message?.includes('SSL')) {
      console.error('SSL Pinning validation failed');
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// OPTION 2: Android Network Security Config (Native)
// ═══════════════════════════════════════════════════════════════
// Create: android/app/src/main/res/xml/network_security_config.xml

/*
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">${options.domains[0]}</domain>
        <pin-set expiration="2025-12-31">
${hashListClean}
            <!-- Backup pin (recommended) -->
            <!-- <pin digest="SHA-256">BACKUP_HASH_HERE</pin> -->
        </pin-set>
    </domain-config>
</network-security-config>
*/

// Then add to AndroidManifest.xml:
// <application android:networkSecurityConfig="@xml/network_security_config" ...>

// ═══════════════════════════════════════════════════════════════
// OPTION 3: TrustKit for iOS (Native)
// ═══════════════════════════════════════════════════════════════
// Add to Info.plist:

/*
<key>TSKConfiguration</key>
<dict>
    <key>TSKSwizzleNetworkDelegates</key>
    <true/>
    <key>TSKPinnedDomains</key>
    <dict>
        <key>${options.domains[0]}</key>
        <dict>
            <key>TSKIncludeSubdomains</key>
            <true/>
            <key>TSKPublicKeyHashes</key>
            <array>
${options.hashes.map(h => `                <string>${h.replace('sha256/', '')}</string>`).join('\n')}
            </array>
        </dict>
    </dict>
</dict>
*/
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
