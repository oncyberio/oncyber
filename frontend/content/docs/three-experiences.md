---
title: Build a three.js experience
description: Where outside WebGPU and three.js pages in Oncyber are heading, and what works today.
order: 3
---

# Build a three.js experience

Where this is going: any web page can become an Oncyber space. You keep your
own engine, whether that's plain three.js, WebGPU or something else, and Oncyber
puts its header, back button, chat and controls around it, with the visitor's
identity, avatar and friends coming along.

That's the direction, not a finished path. Today there's no publishing screen:
you host the page yourself, attach it to a space you own with one API call,
and the page doesn't get the visitor's identity, avatar or the lobby's
multiplayer room yet (see [What isn't there yet](#what-isn-t-there-yet)). This
page describes the pieces that exist, so you can try them and help build the
rest.

## How it runs

Oncyber loads your page in a sandboxed frame with only `allow-scripts` and
`allow-pointer-lock`. The frame has an opaque origin, so it can't read Oncyber's
cookies, storage or account, and it can't navigate the top page or open popups.
The page fills the viewport underneath Oncyber's transparent header and controls.

That boundary has a few consequences for how you build:

-   Serve your page over HTTPS. During development, a separate loopback origin
    such as `http://127.0.0.1:5173` is accepted too.
-   ES modules, `fetch` and WASM requests come from origin `null`. Serve public
    assets with `Access-Control-Allow-Origin: *`. Never enable credentialed CORS for
    `null` on authenticated endpoints.
-   `localStorage` and cookies aren't available. Keep state in memory or on your
    own server.
-   Create workers from Blob URLs.
-   The page must allow being framed: no `X-Frame-Options: DENY` and no CSP
    `frame-ancestors` that excludes Oncyber.

## A minimal page

```html
<!DOCTYPE html>
<html>
    <body style="margin:0">
        <!-- Copied from frontend/public/oncyber-content.js in this repository. -->
        <script
            src="./oncyber-content.js"
            data-host-origin="https://oncyber.io"
        ></script>
        <script type="module">
            import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(innerWidth, innerHeight);
            document.body.append(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                60,
                innerWidth / innerHeight,
                0.1,
                100
            );
            camera.position.set(0, 1.6, 4);
            const cube = new THREE.Mesh(
                new THREE.BoxGeometry(),
                new THREE.MeshNormalMaterial()
            );
            scene.add(cube);

            let readySent = false;
            renderer.setAnimationLoop((time) => {
                cube.rotation.y = time / 1000;
                renderer.render(scene, camera);
                if (!readySent) {
                    readySent = true;
                    // Tell Oncyber the first frame is on screen.
                    window.oncyberContent?.ready().catch(console.error);
                }
            });
            addEventListener("resize", () => {
                camera.aspect = innerWidth / innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(innerWidth, innerHeight);
            });
        </script>
    </body>
</html>
```

WebGPU works the same way: create a `WebGPURenderer` and keep a fallback for
browsers without WebGPU.

## The bridge

`oncyber-content.js` is optional but recommended. Copy it from
`frontend/public/oncyber-content.js` into your own static assets. Set
`data-host-origin` when the host isn't `https://oncyber.io`, for example `http://localhost:13000` while you
develop. It adds `window.oncyberContent` with three calls:

| Call                     | What it does                                                             |
| ------------------------ | ------------------------------------------------------------------------ |
| `ready()`                | Marks the experience as loaded. Call it after your first rendered frame. |
| `openMenu()`             | Opens Oncyber's menu, for a menu button inside your page.                |
| `requestWalletAddress()` | Asks the visitor to share their public wallet address.                   |

`requestWalletAddress()` only works when the space grants the
`wallet.connect` capability. Oncyber shows its own confirmation every time, and
the result is `{ address, chain }`. It never gives your page a wallet provider,
signing or transactions.

Without the bridge, Oncyber can only tell that your frame loaded, not that it
rendered.

## Attach it to a space (experimental)

This is a developer hook, not the way publishing will work. An experience is
attached to an existing space that you own or edit. While
signed in to Oncyber, call this from a page on the same Oncyber origin (for
example the browser console):

```js
await fetch("/api/content/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        experienceId: "YOUR_SPACE_ID",
        runtime: {
            kind: "web",
            url: "https://your-site.example/my-world/",
            engine: "Three.js",
            capabilities: [], // or ["wallet.connect"]
        },
    }),
}).then((response) => response.json());
```

The space's normal URL now opens your page in the Oncyber player. Registering
`{ "kind": "cyber" }` puts the original gallery back; gallery data is never
deleted. `engine` is only a label: Oncyber never imports your engine.

## Controls

Worlds that render inside Oncyber should move and look like the lobby: WASD
and the arrow keys walk (left and right arrows turn the camera), Shift runs,
Space jumps twice, dragging looks around, the wheel tilts the camera, and on
touch screens a thumb pad walks. In this repository that controller is
`frontend/features/worldControls/followControls.ts`; its README shows how to
plug in your own ground, walls and keys. Use E for "interact" (sit, open,
read), with an on-screen button for touch.

## What isn't there yet

There's no publishing flow yet: no Studio screen, no review, and the attach call
above is the only way in. Hosted pages don't yet get the visitor's identity,
avatar or the lobby's multiplayer room. Bring your own networking if your experience needs it, and
see [Multiplayer](/docs/multiplayer) and [Avatars](/docs/avatars) for how
Oncyber's own systems work today. Wiring those into the bridge is open work, and
contributions are welcome.
