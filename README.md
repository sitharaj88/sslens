# 🔍 SSLens for VS Code

<p align="center">
  <img src="media/icon_large.png" width="160" height="160" alt="SSLens Logo">
</p>

<p align="center">
  <strong>Modern SSL/TLS Certificate Inspector & Pinning Toolkit</strong><br>
  <em>Fetch, analyze, and export certificates with ease</em>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-commands">Commands</a> •
  <a href="#-pinning-code-examples">Pinning Code</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.1-6366f1?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-10b981?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/VS%20Code-1.85+-8b5cf6?style=for-the-badge&logo=visual-studio-code" alt="VS Code">
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/🔍_Certificate_Inspection-Fetch_from_any_domain-6366f1?style=flat-square" alt="Feature">
  <img src="https://img.shields.io/badge/📌_SSL_Pinning-Android_iOS_Flutter_React_Native-8b5cf6?style=flat-square" alt="Feature">
  <img src="https://img.shields.io/badge/📤_Export-PEM_DER_Hashes-a855f7?style=flat-square" alt="Feature">
  <img src="https://img.shields.io/badge/⏰_Expiry_Monitoring-Visual_Status-10b981?style=flat-square" alt="Feature">
</p>

---

## 🎯 Why SSLens?

| Problem | SSLens Solution |
|---------|-----------------|
| 🔴 Manually extracting SSL hashes | ✅ One-click hash generation |
| 🔴 Writing pinning code from scratch | ✅ Ready-to-use code for 7 platforms |
| 🔴 Checking certificate expiry manually | ✅ Visual expiry monitoring |
| 🔴 Comparing staging vs production certs | ✅ Built-in comparison tool |
| 🔴 Managing multiple domain certificates | ✅ Save favorites & bulk fetch |

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 Certificate Inspection
- Fetch SSL certificates from **any domain**
- View **complete certificate chain**
- Inspect subject, issuer, validity, extensions
- **Custom port support** (not just 443)
- **SNI** support

</td>
<td width="50%">

### 📌 Certificate Pinning
- **One-click** hash generation
- Public Key Hash (SHA-256 Base64)
- SPKI Hash for modern pinning
- Ready-to-use code for:
  - Android (OkHttp, Retrofit)
  - iOS (URLSession, Alamofire)
  - Flutter (Dio, http)
  - React Native

</td>
</tr>
<tr>
<td width="50%">

### 📤 Export Options
- Export as **PEM** format
- Export as **DER** format
- Copy **fingerprints** (SHA-256, SHA-1, MD5)
- Copy hashes to **clipboard**

</td>
<td width="50%">

### ⏰ Expiry Monitoring
- **Visual status** (🟢 🟡 🔴)
- Batch expiry check
- Days-until-expiry tracking
- Warning badges

</td>
</tr>
<tr>
<td colspan="2">

### 📋 Domain Management
- **Save favorite domains** for quick access
- **Track certificate changes** over time
- **Bulk fetch** from multiple domains
- **Compare certificates** between environments
- **Import/Export** domain lists as JSON

</td>
</tr>
</table>

---

## 📥 Installation

### From VS Code Marketplace
```
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for "SSLens"
4. Click Install
```

### From VSIX
```bash
code --install-extension sslens-2.0.0.vsix
```

---

## 🚀 Usage

### Quick Start

```
1. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
2. Type "SSLens: Fetch Certificate from URL"
3. Enter a domain (e.g., api.github.com)
4. View certificate details in the beautiful panel
```

### From Sidebar

1. Click the **SSLens** icon in the Activity Bar (🛡️ shield icon)
2. Click the **+** button to add a domain
3. Click any saved domain to fetch its certificate

### Status Bar

Click **🛡️ SSLens** in the status bar to quickly fetch a certificate!

---

## 📝 Commands

| Command | Description |
|---------|-------------|
| `SSLens: Fetch Certificate from URL` | Fetch certificate from a domain |
| `SSLens: Inspect Local Certificate File` | Parse a local .pem/.crt file |
| `SSLens: Generate Pinning Code` | Generate platform-specific code |
| `SSLens: Export as PEM` | Export certificate as PEM |
| `SSLens: Export as DER` | Export certificate as DER |
| `SSLens: Copy Public Key Hash` | Copy SHA-256 hash for pinning |
| `SSLens: Copy SPKI Hash` | Copy SPKI hash |
| `SSLens: Bulk Fetch Certificates` | Fetch from multiple domains |
| `SSLens: Compare Two Certificates` | Compare staging vs production |
| `SSLens: Check Certificate Expiry` | Check all saved domains |
| `SSLens: Validate Certificate Chain` | Validate chain integrity |
| `SSLens: Save Domain to Favorites` | Add to saved domains |
| `SSLens: Export Saved Domains` | Export domains to JSON |
| `SSLens: Import Saved Domains` | Import domains from JSON |

---

## 🛠️ Pinning Code Examples

SSLens generates **ready-to-use** pinning code for all major platforms:

<details>
<summary><b>🤖 Android (OkHttp/Retrofit)</b></summary>

```kotlin
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient

val certificatePinner = CertificatePinner.Builder()
    .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    // Add backup pin for certificate rotation
    .add("api.example.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```
</details>

<details>
<summary><b>🍎 iOS (Swift URLSession)</b></summary>

```swift
import Foundation
import CryptoKit

class SSLPinningDelegate: NSObject, URLSessionDelegate {
    private let pinnedHashes: Set<String> = [
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    ]
    
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        // Validate public key hash against pinned hashes
        let certificateCount = SecTrustGetCertificateCount(serverTrust)
        for index in 0..<certificateCount {
            if let cert = SecTrustGetCertificateAtIndex(serverTrust, index),
               let publicKey = SecCertificateCopyKey(cert),
               let keyData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? {
                let hash = SHA256.hash(data: keyData)
                if pinnedHashes.contains(Data(hash).base64EncodedString()) {
                    completionHandler(.useCredential, URLCredential(trust: serverTrust))
                    return
                }
            }
        }
        completionHandler(.cancelAuthenticationChallenge, nil)
    }
}
```
</details>

<details>
<summary><b>🐦 Flutter (Dio)</b></summary>

```dart
import 'dart:io';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:crypto/crypto.dart';

final pinnedHashes = ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='];

Dio createSecureDio() {
  final dio = Dio();
  
  dio.httpClientAdapter = IOHttpClientAdapter(
    createHttpClient: () {
      final client = HttpClient();
      client.badCertificateCallback = (cert, host, port) {
        final hash = base64Encode(sha256.convert(cert.der).bytes);
        return pinnedHashes.contains(hash);
      };
      return client;
    },
  );
  
  return dio;
}
```
</details>

<details>
<summary><b>⚛️ React Native</b></summary>

```javascript
// Using react-native-ssl-pinning
import { fetch } from 'react-native-ssl-pinning';

const response = await fetch('https://api.example.com/endpoint', {
  method: 'GET',
  sslPinning: {
    certs: ['my_certificate'], // Certificate file name in assets
  },
});

// Or use Android network_security_config.xml:
// <pin digest="SHA-256">AAAAAAA...=</pin>
```
</details>

---

## ⚙️ Configuration

```json
{
  "sslens.defaultPort": 443,
  "sslens.timeout": 10000,
  "sslens.maxRecentItems": 10,
  "sslens.showExpiryWarnings": true,
  "sslens.autoRefresh": false
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `defaultPort` | 443 | Default port for connections |
| `timeout` | 10000 | Connection timeout (ms) |
| `maxRecentItems` | 10 | Max recent certificates to keep |
| `showExpiryWarnings` | true | Show warnings for expiring certs |
| `autoRefresh` | false | Auto-refresh domains on startup |

---

## 🔒 Security

| | |
|---|---|
| ✅ | Certificates stored **locally only** |
| ✅ | **No data** sent to external servers |
| ✅ | Uses system's **trust store** |
| ✅ | Self-signed certs can be inspected |
| ✅ | **Open source** and auditable |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Fork the repository
git clone https://github.com/sitharaj88/sslens.git
cd sslens

# Create your feature branch
git checkout -b feature/AmazingFeature

# Commit your changes
git commit -m 'Add some AmazingFeature'

# Push to the branch
git push origin feature/AmazingFeature

# Open a Pull Request
```

---

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Made with 💜 by <a href="https://github.com/sitharaj88">Sitharaj</a></strong>
</p>

<p align="center">
  <a href="https://www.buymeacoffee.com/sitharaj88" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
</p>

<p align="center">
  <a href="https://github.com/sitharaj88/sslens">⭐ Star on GitHub</a> •
  <a href="https://github.com/sitharaj88/sslens/issues">🐛 Report Bug</a> •
  <a href="https://github.com/sitharaj88/sslens/issues">💡 Request Feature</a>
</p>

<p align="center">
  <sub>🔍 SSLens — The SSL/TLS toolkit every developer needs</sub>
</p>
