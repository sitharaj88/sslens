# Fetch a certificate

Run **SSLens: Fetch Certificate from URL** from the Command Palette (`Ctrl/Cmd+Shift+P`) and enter any hostname, e.g. `github.com`.

SSLens connects over TLS and shows the **full certificate chain** — subject, issuer, validity, fingerprints, SPKI pinning hashes, and SANs — in a rich viewer.

```
@sslens /check github.com
```

You can also fetch from Copilot Chat with the command above.
