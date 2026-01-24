# Changelog

All notable changes to SSLens will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-24

### 🎉 Major Release - Rebrand to SSLens

This release marks a complete transformation of SSL Helper into **SSLens** - a modern, feature-rich SSL/TLS certificate inspection and pinning toolkit.

### ✨ Added

- **Modern UI Design**
  - Glassmorphism-inspired interface with smooth animations
  - Gradient accents with purple/indigo color scheme
  - Responsive card-based layout
  - Animated status badges with pulse effects
  - Hover effects and micro-interactions throughout

- **New Features**
  - `SSLens: Edit Domain Alias` - Modify domain aliases directly
  - `SSLens: Export Saved Domains` - Export domain list to JSON
  - `SSLens: Import Saved Domains` - Import domains from JSON file
  - Expiry warning configuration option
  - Auto-refresh on startup option

- **Enhanced UI Components**
  - Tabbed interface with icon labels (📋 Details, 🔗 Chain, 📌 Pinning, 📤 Export)
  - Visual certificate chain with connection lines
  - Click-to-copy fingerprint boxes with hover hints
  - Platform-specific code generation buttons with hover effects
  - Status bar item with SSLens branding

- **New Icon**
  - Modern gradient design with magnifying glass motif
  - Certificate document visualization
  - Glass effect with subtle glow
  - Dark theme optimized

### 🔄 Changed

- **Rebrand**
  - Extension renamed from `ssl-helper` to `sslens`
  - Display name changed from "SSL Helper" to "SSLens"
  - All command prefixes updated: `ssl-helper.*` → `sslens.*`
  - Configuration keys updated: `sslHelper.*` → `sslens.*`
  - View container and view IDs updated
  - Repository URL updated to `github.com/sitharaj/sslens`

- **Commands Renamed**
  - `SSL: Fetch Certificate from URL` → `SSLens: Fetch Certificate from URL`
  - `SSL: Inspect Local Certificate File` → `SSLens: Inspect Local Certificate File`
  - `SSL: Generate Pinning Code` → `SSLens: Generate Pinning Code`
  - (All other commands follow same pattern)

- **UI Improvements**
  - Enhanced color palette with better contrast
  - Improved typography with SF Mono for code
  - Better spacing and visual hierarchy
  - Smoother transitions and animations

### 🐛 Fixed

- Various minor UI inconsistencies
- Improved error handling in certificate parsing
- Better validation for domain input

### 📦 Dependencies

- No new dependencies added
- Maintained lightweight footprint

---

## [1.0.0] - 2025-12-01

### Added

- Initial release as SSL Helper
- Fetch SSL certificates from any domain
- View complete certificate chain
- Export as PEM and DER formats
- Copy fingerprints and hashes
- Generate pinning code for Android, iOS, Flutter, React Native
- Save favorite domains
- Track recent certificates
- Bulk fetch from multiple domains
- Compare certificates between environments
- Certificate chain validation
- Expiry monitoring

---

## Migration Guide (1.x → 2.x)

### Breaking Changes

1. **Command IDs Changed**
   - Old: `ssl-helper.fetchCertificate`
   - New: `sslens.fetchCertificate`
   - Update any keybindings or scripts that reference commands

2. **Configuration Keys Changed**
   - Old: `sslHelper.timeout`
   - New: `sslens.timeout`
   - Settings will need to be reconfigured

3. **View IDs Changed**
   - Old: `sslHelperDomains`, `sslHelperRecent`
   - New: `sslensDomains`, `sslensRecent`

### Data Migration

Saved domains and recent certificates are preserved automatically using the same storage keys.

---

<p align="center">
  Made with 💜 by <a href="https://github.com/sitharaj">Sitharaj</a>
</p>
