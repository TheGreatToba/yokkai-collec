# Local LR cinematic prototype

`reveal.html` is the unmodified animation supplied in `LR ANIMATION.html`.
Its embedded artwork is the default demo; real local LR reveals substitute the
card image and labels without changing the supplied animation timing.

Open **http://localhost:3000/design-system/lr-cinematic** with `npm run dev`.
No pack or database access is needed. Use **Replay cinematic** to restart the
whole sequence, or **Pause animations** to pause it. The prototype also keeps
its own `prefers-reduced-motion` fallback.

In development, LR cards in the normal pack reveal use the prototype. Continue
returns to the existing reveal flow. The final pack summary allows replaying
each LR without opening another pack or adding cards.

The document endpoint and demo return 404 outside development. The HTML is
served as plain text and rendered only inside a `srcDoc` iframe sandbox with
scripts enabled but no same-origin access, top-level navigation, forms or
popups. A restrictive document CSP disables connections and external non-image
resources.
No global security headers, pack odds, rewards, quotas, SQL or production
cinematics are changed. This branch is for local evaluation, not deployment.
