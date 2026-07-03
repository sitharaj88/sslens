# Generate pinning code

SSLens turns a live certificate into **ready-to-ship pinning code** for:

- Android — OkHttp, Retrofit
- iOS — URLSession, Alamofire
- Flutter — Dio, http
- React Native

It pins the **SPKI hash** (the recommended approach), and reminds you to add a backup pin for certificate rotation.
