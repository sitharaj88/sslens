# SSLens ✕ GitHub Copilot

Type `@sslens` in Copilot Chat:

```
@sslens /check api.example.com
@sslens /pin api.example.com for okhttp
@sslens /expiry
@sslens /compare example.com example.org
@sslens is the cert for myapi.com safe to pin?
```

In **agent mode**, Copilot can call SSLens tools on its own — reference them explicitly with `#sslCertificate`, `#sslPinningCode`, `#sslExpiry`, or `#sslSavedDomains`.
