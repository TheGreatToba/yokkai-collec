# Final SSR and LR local cinematics

Original assets supplied by the user, copied without modification:

- `lr.html`: `yokkai_lr_reveal_final (3).html`
- `ssr.html`: `yokkai_ssr_reveal_final (1).html`

Open **http://localhost:3000/design-system/card-cinematics** to compare them,
or **http://localhost:3000/design-system/lr-packs** to open a full simulated
pack (SSR in slot 4, LR in slot 5). Replay remounts the entire document, so
all introduction phases restart. Pause, resume and continue stay accessible
outside the iframe. The older `/design-system/lr-cinematic` URL now uses the
final LR file as well; its legacy document endpoint is retained for regression
coverage, not used by the new flow.

Development pack openings opt into the final SSR/LR player. Production keeps
the existing cinematics, drop rates, quotas, rewards and backend calls. The
new demo pages/document endpoint are unavailable outside development.

## Integration boundary

The application supplies `name`, `category`, `anime` as `license`, `rarity` as
`rank`, and the card's existing `image`. The rarity color is taken from the
site's current LR/SSR palette. This app has CSS card borders, not a dedicated
transparent border image, so no border image URL is fabricated.

The server validates the rarity and image URL and injects escaped JSON. The
source's broad iframe message bridge/demo startup is replaced in the served
document by a bridge restricted to the actual parent window and origin.
No card mutation is accepted through postMessage. The supplied showCard
function loads actual artwork before releasing the hidden, paused stage.
Image preloads time out after 5 seconds; a failed image never reveals the
standalone example. The parent also bounds document/image startup and keeps
Continue available even on failure. Palette sampling remains optional when
CORS/canvas access is unavailable.

The document is fetched as inert plain text, then used only as `srcDoc` inside
an iframe with `sandbox="allow-scripts"` (no same-origin access, forms, popups,
or top-level navigation). Its restrictive CSP permits inline visuals/scripts
and images but disables connections and other resources. Global security
headers remain unchanged. Supplied reduced-motion behavior is preserved.
