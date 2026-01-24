# 🔍 SSLens for VS Code

<p align="center">
  <img src="media/icon.svg" width="128" height="128" alt="SSLens Logo">
</p>

<p align="center">
  <strong>Modern SSL/TLS Certificate Inspector & Pinning Toolkit</strong><br>
  Fetch, analyze, and export certificates with ease
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#commands">Commands</a> •
  <a href="#pinning-code">Pinning Code</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-6366f1?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-10b981?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/vscode-1.85+-8b5cf6?style=flat-square" alt="VS Code">
</p>

---

## ✨ Features

### 🔍 Certificate Inspection
- **Fetch SSL certificates** from any domain instantly
- **View complete certificate chain** with visual hierarchy
- **Inspect all details**: subject, issuer, validity, extensions
- **Custom port support** (not just 443)
- **SNI (Server Name Indication)** support

### 📌 Certificate Pinning Made Easy
- **One-click hash generation** for all major platforms
- **Public Key Hash** (SHA-256 Base64)
- **SPKI Hash** for modern pinning implementations
- **Generate ready-to-use code** for:
  - **Android**: OkHttp, Retrofit
  - **iOS**: URLSession, Alamofire
  - **Flutter**: Dio, http package
  - **React Native**: ssl-pinning library

### 📤 Export Options
- Export as **PEM** format
- Export as **DER** format
- **Copy fingerprints** (SHA-256, SHA-1, MD5)
- **Copy hashes** directly to clipboard

### 📋 Domain Management
- **Save favorite domains** for quick access
- **Track certificate changes** over time
- **Bulk fetch** from multiple domains
- **Compare certificates** between environments
- **Import/Export** domain lists as JSON

### ⏰ Expiry Monitoring
- **Visual status indicators** (green/yellow/red)
- **Batch expiry check** for all saved domains
- **Days-until-expiry** tracking
- **Warning badges** for expiring certificates

---

## 📥 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for **"SSLens"**
4. Click **Install**

### From VSIX
```bash
code --install-extension sslens-2.0.0.vsix
```

---

## 🚀 Usage

### Quick Start

1. **Open Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type `SSLens: Fetch Certificate from URL`
3. Enter a domain (e.g., `api.github.com`)
4. View certificate details in the beautiful panel

### From Sidebar

1. Click the **SSLens** icon in the Activity Bar (shield icon)
2. Click the **+** button to add a domain
3. Click any saved domain to fetch its certificate

### Keyboard Shortcut

The extension adds a status bar item — just click **🛡️ SSLens** to quickly fetch a certificate!

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

SSLens generates ready-to-use pinning code for all major platforms:

### Android (OkHttp)

```kotlin
val certificatePinner = CertificatePinner.Builder()
    .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

### iOS (Swift)

```swift
let pinnedHashes = ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="]

func urlSession(_ session: URLSession,
                didReceive challenge: URLAuthenticationChallenge,
                completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    // Validate certificate hash against pinnedHashes
}
```

### Flutter (Dio)

```dart
final dio = Dio();
(dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
  final client = HttpClient();
  client.badCertificateCallback = (cert, host, port) {
    final hash = base64Encode(sha256.convert(cert.der).bytes);
    return pinnedHashes.contains(hash);
  };
  return client;
};
```

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

## 🔒 Security Notes

- ✅ Certificates are only stored locally
- ✅ No data is sent to external servers
- ✅ All TLS connections use your system's trust store
- ✅ Self-signed certificates can be inspected (shown as invalid)
- ✅ Open source and auditable

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by the need for easier certificate pinning
- Built with ❤️ for mobile developers
- Modern UI inspired by contemporary design trends

---

<p align="center">
  <strong>Made with 💜 by <a href="https://github.com/sitharaj">Sitharaj</a></strong>
</p>

<p align="center">
  <a href="https://github.com/sitharaj/sslens">GitHub</a> •
  <a href="https://github.com/sitharaj/sslens/issues">Report Bug</a> •
  <a href="https://github.com/sitharaj/sslens/issues">Request Feature</a>
</p>
