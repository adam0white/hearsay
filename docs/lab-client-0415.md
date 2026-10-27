# Lab artifact adoption, 2026-10-27

Scope ends at client 0.4.15 and kit 0.5.17 deployed from a signed commit with exact green CI and a matching clean release stamp. Adam requested the deployment. Playtests remain deferred.

Both tarballs in `vendor/` were downloaded from `adam0white/human-framework` releases `lab-client-v0.4.15` and `lab-kit-v0.5.17`. Before copying, SHA-256 matched the release asset digest, `SHA256SUMS` and `artifact-manifest.json`:

- Client: `a317b83fdbf9239a9fea729d9ec7a95cf5b2c54d87d70d780148720a7e2a2eb7`.
- Kit: `e31e2d632617a3b680e7ba5f0d0e5f3e8c477f5584277e1302cb83177091db16`.

The reproduced failure was the native control in `test/garden-file-session.test.ts`: expected one Shelf construction, observed zero. The game's test inserted its counter using the literal `function personaChannel() {`. The released client now has `personaChannel(options = {})`, so the probe never ran. The foreign-file test already passed with 0.4.15. The replacement accepts a parameter list and requires exactly one match before serving the instrumented SDK. It preserves the real constructor and all its effects. The existing foreign-file regression and native control cover storage separation and export replay; the headless garden export tests retain replay and tamper checks. No simulation, recording binding or native/file routing change is required.

`public/_headers` and the live response restrict only `frame-src`. With no `default-src`, `script-src` or `connect-src`, they allow scripts from `static.cloudflareinsights.com` and connections to `cloudflareinsights.com`. No policy expansion is needed.
