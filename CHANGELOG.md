# Changelog

All notable changes to the SSL Helper extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- 🎉 Initial release
- Certificate fetching from any domain with custom port support
- Complete certificate chain inspection
- Certificate details panel with rich UI
- Subject Alternative Names (SAN) display
- Certificate fingerprints (SHA-256, SHA-1, MD5)
- Public key hash generation for pinning
- SPKI hash generation

### Pinning Code Generation
- Android OkHttp support
- Android Retrofit support
- iOS URLSession support
- iOS Alamofire support
- Flutter Dio support
- Flutter http package support
- React Native support

### Export Features
- PEM format export
- DER format export
- Copy hashes to clipboard

### Domain Management
- Save favorite domains
- Recent certificates history
- Sidebar views for quick access

### Bulk Operations
- Bulk certificate fetching
- Certificate comparison
- Expiry checking for all saved domains
- Chain validation

### UI Features
- Beautiful webview panel
- Tabbed interface (Details, Chain, Pinning, Export)
- Status bar integration
- Tree view providers

## [Unreleased]

### Planned
- Certificate Transparency log checking
- Automated expiry notifications
- Certificate change detection
- More export formats (PKCS#7, PKCS#12)
- Custom pinning templates
