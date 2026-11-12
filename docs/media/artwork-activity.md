# Artwork activity and profile pictures

Ethereum and Polygon artwork history uses OpenSea v2 via the same-origin
`/api/artwork-history` endpoint. The former Reservoir activity endpoint failed
for the affected Cologne Dude NFTs. History now loads independently of metadata
and marketplace orders, so those services cannot hold the activity panel open
indefinitely. Requests are tied to the complete NFT identity and aborted when
selection changes.

The endpoint requests the 50 most recent sale, transfer, mint and listing events.
It preserves payment token symbols and decimals, removes the transfer paired with
a sale in the same transaction, and skips malformed events. This is recent
activity, not a complete paginated ledger. Provider errors remain distinct from
successful empty results. Tezos history is unchanged.

Activity avatars prefer OpenSea's account profile image. `/api/opensea-profile`
returns only that public image URL; accounts without a usable image retain the
existing Oncyber/default avatar. Visible rows load profiles lazily, share lookups
for the same account and limit client concurrency to three. Both API routes
validate identifiers, use fixed OpenSea destinations, bound time/response size,
and cache successful responses. Server credentials are never returned to clients.
The existing OpenSea key is used, with `OPENSEA_X_API_KEY` taking precedence.

Activity scrollbars are hidden without disabling scrolling. The desktop HTML
interaction backdrop forwards hover movement to the 3D canvas while leaving
embedded HTML, clicks and dragging alone. Previously that overlay swallowed
mouse movement when pointer lock was unavailable, preventing artwork info bubbles.
The forwarding and mouse-down listeners are removed on mode changes/unmount.

Reference endpoints:
- https://docs.opensea.io/reference/list_events_by_nft
- https://docs.opensea.io/reference/get_account

Focused regression checks:
`pnpm -C frontend exec jest --runInBand utils/artworks utils/media components/modals/ArtworkInfo/ActivityAvatar.test.tsx`

Validated locally on 2026-09-16: a new browser page loaded all 131 Cologne Dude
placements without an uncaught page exception. The unlocked cursor displayed
M3LT3D #051's info bubble; E opened its nine activity rows. Its visible OpenSea
avatars loaded, and wheel scrolling moved the timeline with both standard and
WebKit scrollbars hidden. Switching to #11 − Making Intelligence returned 49
normalized rows from the provider's recent-event window. All 40 focused tests
passed. Full TypeScript checking remains at the same 623 existing diagnostics,
with no new diagnostics. No application deployment was performed.

The gallery wrapper is pinned to the dynamic viewport (`100dvh`, with the
existing height variable as fallback). Scene rendering observes the actual canvas
container with ResizeObserver and schedules measurements after layout settles,
instead of relying only on a window resize callback. Hidden/zero dimensions are
ignored. Window, visual viewport and fullscreen changes also schedule a check;
all listeners and pending frames are cleaned up.

Browser validation at 1122px wide: scene, WebGL canvas and HTML renderer matched
viewport heights of 934, 600 and 480px. The info bubble's bottom was 926px in the
934px viewport and 592px in the 600px viewport. A container-only resize to 480px
also updated both renderers without a window event. No uncaught page exceptions
were observed. Temporary local viewport diagnostics were removed.

Final validation: 42 tests across 13 suites passed, including viewport resizing.

Attribution refresh: OpenSea NFT metadata can omit owner and creator accounts.
`formatAsset` normalizes those omissions to empty objects, so shallow merging a
refresh previously erased the saved attribution and hid both profile pills.
Both artwork contexts now use `mergeArtworkMetadata` to preserve omitted account
information and missing profile fields for the same address. Explicit account
changes replace the identity and clear stale ownership lists; the creator is
never substituted for an unknown collector. Profile pills remount when their
account address changes so a previous account's cached name/avatar cannot linger.
Twelve focused metadata and rendered-pill regression cases cover these behaviors.

Collection thumbnails: the saved Japanese GenArt Collection logo beside
`Geisha 6 I 芸者` used an `ipfs.io` URL returning HTTP 429. The same CID's Objkt
`thumb288` image returns HTTP 200 and decodes in Chrome at 288 × 192. Artwork
collection pills now prefer that thumbnail for Tezos IPFS logos, retaining the
original gateway as a fallback. This also handles old saved gallery metadata
before a refresh completes. Other chains and non-IPFS URLs keep their sources.

Artwork detail thumbnail components now try each candidate once, then the local
placeholder, then a CSS initial if even the local image fails. A source change
resets the chain; ordinary rerenders do not restart failed requests. The collection
label and attribution pills remain visible. Twenty-two focused collection,
thumbnail, attribution and activity-avatar tests passed; Chrome also decoded the
local placeholder. No gallery records were modified for this thumbnail fix.

PR validation: 63 tests across 17 focused suites pass. Full TypeScript checking
remains at the existing 623 diagnostics with no additional errors. The media
recovery endpoint uses OpenSea's `matic` chain name for Polygon, matching the
history endpoint and existing NFT lookup. Application deployment is separate
from the saved-gallery media repair described in the recovery notes.


## OpenSea profile links — 2026-09-17

Creator and collector links now use `https://opensea.io/{address}`. The shared `marketplaceProfileUrl` helper normalizes legacy `/account` and `/accounts` bases already stored in gallery metadata, including trailing slashes. Other marketplace profiles retain their routes. All artwork-info layouts, destination attribution, and the legacy activity table use the helper; new NFT metadata defaults to the current base. OpenSea API account lookup endpoints are unchanged.

Validation: 18 tests across profile URL normalization, rendered creator/collector anchors, and the account API endpoint passed. The approved Vercel preview deployment is ready at https://cyber-h169zn3cf-oncyber.vercel.app (deployment `dpl_FzPjm1TjrfyZcL8R9oTaSq4KJKZW`). A fresh Chrome session loaded Cologne Dude with HTTP 200 and no uncaught page errors. This link fix has not been promoted to the production domain.
