# Engine-independent Oncyber experiences

The visitor UI now has a shared `ExperienceShell` based on the current lobby:
the Oncyber identity/account header, back/title area, compact controls, chat,
and panels. Native gallery adapters retain artwork inspection, moderation,
avatar/emote actions, voice, editor/special camera modes and mobile movement.
Generic content exposes only capabilities it actually implements.

## Open or attach content

This is early, experimental plumbing, not a publishing flow yet. There is no
launcher page and no Studio screen for it. The only way in today is attaching a
page to a space you own or edit with `POST /api/content/register`, described
below, and the attached page doesn't get the visitor's identity, avatar or
multiplayer room yet.

Attaching persists the descriptor on an
existing experience, so `/spaces/:id` and its custom slug use the same player:

```json
{
    "kind": "web",
    "url": "https://games.example/my-world/",
    "engine": "Three.js",
    "capabilities": ["wallet.connect"]
}
```

Runtime kinds are `cyber` (also the default when absent), `web`, and
`awe-app`. `awe-app` serves awe.box `/play/` experiences; the code is in place
but not live yet. Records with any other kind are treated as unsupported. `engine` is descriptive; host code never imports
the engine. Arbitrary same-origin documents, credential-bearing URLs,
`javascript:`, `data:`, and non-HTTPS sources are rejected. Separate loopback
HTTP origins, including `*.localhost`, are accepted only in development.

`POST /api/content/register` takes `{experienceId,runtime}`. It requires an
exact same-origin request and an authenticated owner/editor checked inside a
Firestore transaction. Registering `{kind:"cyber"}` restores the saved gallery
player. Attaching content does not delete gallery data.
`POST /api/content/session` rechecks Oncyber admission (including passwords)
before returning the current descriptor. A fresh projected Firestore read rejects
missing or `deleted: true` spaces even when a cached descriptor still exists;
registration rejects deleted spaces inside its transaction. Both endpoints reject opaque-origin
requests, are uncached, and return no account credentials to content. An
Oncyber gate cannot make an independently public external URL private.

## Content boundary and wallet permissions

Embedded content uses an opaque sandbox with only `allow-scripts` and
`allow-pointer-lock`. No same-origin access, popups, top navigation, forms,
downloads, fullscreen, camera, microphone, payment, clipboard, or device grants.
The frame fills the viewport beneath the host-owned transparent header and
controls, matching native galleries. Host controls stay above the frame, and
keeps an “External content” or “Unregistered preview” label visible after the
engine reports ready. That label does not attest a publisher or the frame's
current URL following redirects.
`credentialless` and `no-referrer` add protection; correctness does not depend
on support for `credentialless`. Content can still use its own external network
resources. This is not a network-isolated runtime.

The versioned bridge validates source WindowProxy, opaque origin, fresh session
nonce, request shape/size, rate, and duplicate IDs. New loads rotate the nonce.
Pending requests are cancelled on reload, account changes, and disposal. Wallet
requests are rejected if any host ancestor has a different origin. Pages that
grant access or edit a space (`/studio`, `/create`, `/cli-auth`) also send
`frame-ancestors 'self'` so other sites can't frame them
(`frontend/next.config.js`).
Only `ready`, `menu`, and optional `wallet.connect` are supported; all other
methods (including raw JSON-RPC, signing, approvals, and transactions) fail
closed. No token, canonical account ID, provider, or signing function is in init.

`wallet.connect` means **share the selected public address**, not grant access
to a provider. Oncyber displays a separate confirmation naming the configured
source, and requires “Share address” each time. Its result travels only over a
request-specific transferred MessagePort so navigation cannot redirect the
response through a reused WindowProxy. There is no automated wallet interaction.

“Do not show this again” hides the explanation for that exact experience, URL,
and signed-in account for up to eight hours in the current tab session. It never
authorizes another disclosure or skips wallet confirmation. The permissions
panel resets the preference. Signing and transaction support requires new,
explicitly reviewed host adapters with action-specific confirmation; this
change deliberately does not expose a generic signing API.

No iframe boundary can promise zero risk from phishing, browser/extension
vulnerabilities, or resource exhaustion. In particular, browser extensions are
outside iframe Permissions Policy. The guarantee here is that this host does
not hand untrusted code its wallet authority or credentials. Registration requires
an owner/editor, but this is not a complete abuse-management system: public
preview URLs have no publisher attribution or takedown record, external content
can change after registration, and there is no content-reporting or domain
blocklist workflow here. Deletion denies new registered sessions; it does not
stop a document already running in a visitor's browser or the external site.

## Optional engine bridge

Copy `frontend/public/oncyber-content.js` into the game's static assets, or serve
it from the Oncyber deployment. The parent origin defaults to
`https://oncyber.io`; set `data-host-origin` explicitly for an alternate host.

```html
<script
    src="/oncyber-content.js"
    data-host-origin="https://oncyber.io"
></script>
<script>
    // After the first rendered frame:
    window.oncyberContent?.ready().catch(console.error);
    // From a game control; Oncyber displays its separate review:
    async function showWalletAddress() {
        const { address, chain } =
            await window.oncyberContent.requestWalletAddress();
    }
    // From the game's own pause key: pause, then show Oncyber's world menu.
    function pause() {
        game.pause();
        window.oncyberContent?.openMenu().catch(console.error);
    }
    // The visitor chose Resume in that menu. Oncyber has closed it and
    // focused the game; pointer lock still needs a click inside the game.
    const stopListening = window.oncyberContent?.onResume(() => game.resume());
</script>
```

| Call                     | What it does                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `ready()`                | Says the world has drawn its first frame. Resolves once Oncyber has noted it.                |
| `openMenu()`             | Shows Oncyber's world menu: Resume, Content permissions, Back to exploring. Pause first.     |
| `requestWalletAddress()` | Asks the visitor to share a public address. Resolves `{ address, chain }`, or rejects.       |
| `onResume(listener)`     | Calls `listener` each time the visitor closes the world menu with Resume. Returns a remover. |

`onResume` is new: a world that never calls it behaves as before, and a copy of
the script from before it existed keeps working with Oncyber unchanged. The
message names the script and Oncyber exchange are listed in
`frontend/features/content-host/contentBridgeMessages.ts`; the script carries a
copy, and `contentBridgeMessages.test.ts` fails when the two differ.

Games using ES modules/fetch/WASM must serve public assets with anonymous CORS
support (`Access-Control-Allow-Origin: *` or correctly support `Origin: null`).
Use Blob workers in an opaque frame; origin storage is unavailable. Do not
enable credentialed null-origin CORS on authenticated endpoints. Sites that
deny framing via CSP/X-Frame-Options cannot be embedded. Browsers do not expose
reliable cross-origin framing-error detection, so “External content” denotes
only a frame load; the optional bridge provides a stronger ready signal.
WebGPU availability still depends on a secure context, browser, GPU, and the
game's own fallback. No WebGPU-specific bridge is required.

## Verification

From the Oncyber repository root:

```sh
pnpm -C frontend exec jest --watchman=false --runInBand features/content-host \
  features/lobby/Lobby.test.tsx features/lobby/useLobbyJourney.test.tsx \
  utils/lobbyDestinationBridge.test.ts features/landing-carousel/galleryFlow.test.tsx \
  features/landing-carousel/components/DiscoveryHeader.test.tsx
node scripts/content-host-preview.mjs
```

For the browser check you need a local Firebase project (see `AGENTS.md`) and
a space you own on it. With Oncyber running on `localhost:13000` and the
fixture server above on `127.0.0.1:13001`, sign in and attach the fixture to
that space from the browser console:

```js
await fetch("/api/content/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        experienceId: "YOUR_SPACE_ID",
        runtime: {
            kind: "web",
            url: "http://127.0.0.1:13001/",
            engine: "Three.js",
            capabilities: ["wallet.connect"],
        },
    }),
}).then((response) => response.json());
```

Then open `/spaces/YOUR_SPACE_ID`. Loopback HTTP URLs are accepted only in
development. The standalone Three.js fixture verifies module CORS, rendering,
ready/menu protocol, separate wallet review, cancellation, and reload without
credentials. Its server exposes only five public fixture/dependency files on
loopback. For the benign attack probe, register
`http://127.0.0.1:13001/security.html` the same way. It exercises the browser
sandbox and rejected bridge methods without signing or transferring anything.
Register `{ "kind": "cyber" }` afterwards to put the gallery back.

Latest local verification (October 9, 2026, before the `/play` launcher page
was removed, so it ran there): 185 focused Oncyber tests across
13 suites and 20 browser isolation checks passed. This includes the content
permission/admission and cookie-auth changes, plus lobby/gallery UI regressions.
Real cross-origin Three.js rendering,
WebGPU device creation and command submission, and wallet-review cancellation
in the browser were verified. A published
native gallery (`/vvd`) loaded and entered with the shared header/chat/dock, and
its existing Fly Mode, Guided Tour, Settings and gallery inspector remained
available. Full repository type checks still contain existing errors; none
were reported in the new content-host/runtime routes.
No deployment or production registration was performed.

The shared cookie-authentication boundary rejects `Origin: null` and requests
marked `Sec-Fetch-Site: same-site` or `cross-site`, including images and iframe
navigations that omit Origin. The exception is a top-level GET navigation to a
normalized non-API page, so incoming gallery links retain login. API navigation
cannot borrow cookies, and account switching uses the same guard. Existing
same-origin requests and explicit bearer/body/query credentials retain their
behavior; cross-origin integrations must supply their own credentials. New auth
cookies explicitly use `SameSite=Lax`. Older clients without both Origin and
Fetch Metadata retain legacy compatibility, so this scoped boundary is not a
complete CSRF guarantee for every existing endpoint or browser.
