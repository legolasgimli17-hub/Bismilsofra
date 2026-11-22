# Browser-rendered responsive QA and local HTTPS staging

## Browser quality gate

After building and starting the real Next.js frontend in GitHub Actions, `tools/mobile-browser-smoke.mjs` launches headless **Chromium** through Chrome DevTools Protocol (no browser testing package or dependency added). It tests `/`, an empty `/checkout` and a 404 route in four emulated screen sizes: 360×800, 390×844, 768×1024 and 1280×800. Each asserts:
- The local app (not a browser/network error page) rendered.
- No horizontal page overflow.
- Visible icon-only buttons have an accessible name.
- Every rendered HTML `img` has an `alt` attribute.
- Exactly one or more top-level `h1` headings per route.
- Appropriate Turkish content exists on the checkout/404 pages.
- Rendered screenshots are uploaded as the `mobile-rendering-qa` Actions artifact.

This is **Chrome screen emulation**, NOT physical Android/iOS hardware, VoiceOver/TalkBack or a real restaurant operator's phone. Those need separately recorded human/device evidence before launch. Merchant management is gated by genuine MFA and remains untested visually without authorized staging staff identities.

## Local HTTPS staging gate

`docker compose --profile tls -f deploy/staging.compose.yml up -d --build db migrate api gateway` provisions a separate Docker PostgreSQL volume, checksum-verified migrations, API container and Caddy reverse proxy on **https://localhost:8443** (bound to 127.0.0.1). Caddy uses an **internal/self-signed test CA**; in CI the HTTPS probe deliberately uses `--insecure` for this local trust model only. Never expose the internal certificate or use `--insecure` with real public hosting.

The staging job checks that HTTPS readiness and public discovery return 200 and `POST /v1/orders` returns **503 ORDER_INTAKE_CLOSED**. Demo records are not mistaken for real customers; no real OIDC tenant or notification provider is involved.

## Remaining mandatory external checks

To actually have public/stable staging, provision an isolated remotely hosted PostgreSQL instance with monitored capacity; trusted public HTTPS hostname and certificate; real Auth0 application with verified test users including restaurant and admin MFA; two independently operated alert channels; securely managed production secrets, WAF, real remote backup and recovery drill. Those are explicitly not established by the local pipeline.

Review the screenshot artifact, check small-phone merchant interactions with authorized accounts, and collect licensed food photography and written restaurant permissions before any customer pilot.
