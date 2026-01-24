# 🔐 SSL Helper for VS Code

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="SSL Helper Logo">
</p>

<p align="center">
  <strong>Fetch, inspect, and export SSL certificates for pinning</strong><br>
  Perfect for mobile developers working with certificate pinning
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#commands">Commands</a> •
  <a href="#pinning-code">Pinning Code</a>
</p>

---

## ✨ Features

### 🔍 Certificate Inspection
- Fetch SSL certificates from any domain
- View complete certificate chain
- Inspect subject, issuer, validity, and extensions
- Support for custom ports (not just 443)
- SNI (Server Name Indication) support

### 📌 Certificate Pinning Made Easy
- One-click public key hash generation
- SPKI hash for modern pinning
- Generate pinning code for:
  - **Android**: OkHttp, Retrofit
  - **iOS**: URLSession, Alamofire
  - **Flutter**: Dio, http package
  - **React Native**: ssl-pinning library

### 📤 Export Options
- Export as PEM format
- Export as DER format
- Copy fingerprints (SHA-256, SHA-1, MD5)
- Copy hashes to clipboard

### 📋 Domain Management
- Save favorite domains
- Track certificate changes
- Bulk fetch multiple domains
- Compare certificates between environments

### ⏰ Expiry Monitoring
- Visual expiry status
- Batch expiry check for saved domains
- Days-until-expiry tracking

---

## 📥 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "SSL Helper"
4. Click Install

### From VSIX
```bash
code --install-extension ssl-helper-1.0.0.vsix
```

---

## 🚀 Usage

### Quick Start

1. **Open Command Palette** (Ctrl+Shift+P / Cmd+Shift+P)
2. Type `SSL: Fetch Certificate from URL`
3. Enter a domain (e.g., `api.github.com`)
4. View certificate details in the panel

### From Sidebar

1. Click the **SSL Helper** icon in the Activity Bar
2. Click the **+** button to add a domain
3. Click any saved domain to fetch its certificate

---

## 📝 Commands

| Command | Description |
|---------|-------------|
| `SSL: Fetch Certificate from URL` | Fetch certificate from a domain |
| `SSL: Inspect Local Certificate File` | Parse a local .pem/.crt file |
| `SSL: Generate Pinning Code` | Generate platform-specific code |
| `SSL: Export as PEM` | Export certificate as PEM |
| `SSL: Export as DER` | Export certificate as DER |
| `SSL: Copy Public Key Hash` | Copy SHA-256 hash for pinning |
| `SSL: Copy SPKI Hash` | Copy SPKI hash |
| `SSL: Bulk Fetch Certificates` | Fetch from multiple domains |
| `SSL: Compare Two Certificates` | Compare staging vs production |
| `SSL: Check Certificate Expiry` | Check all saved domains |
| `SSL: Validate Certificate Chain` | Validate chain integrity |
| `SSL: Save Domain to Favorites` | Add to saved domains |

---

## 🛠️ Pinning Code Examples

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
  "sslHelper.defaultPort": 443,
  "sslHelper.timeout": 10000,
  "sslHelper.maxRecentItems": 10
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `defaultPort` | 443 | Default port for connections |
| `timeout` | 10000 | Connection timeout (ms) |
| `maxRecentItems` | 10 | Max recent certificates to keep |

---

## 🔒 Security Notes

- Certificates are only stored locally
- No data is sent to external servers
- All TLS connections use your system's trust store
- Self-signed certificates can be inspected (but shown as invalid)

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

---

<p align="center">
  <strong>Made by <a href="https://github.com/sitharaj">Sitharaj</a></strong>
</p>
