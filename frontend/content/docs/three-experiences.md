---
title: Build a three.js experience
description: Bringing your own 3D page into Oncyber. Early, and where we're heading.
order: 3
---

# Build a three.js experience

Where we're heading: any 3D web page, built with three.js, WebGPU or any
engine, can become a space in Oncyber. Visitors walk in from the lobby, and
Oncyber brings their identity, avatar, friends and chat along.

**That isn't ready yet.** Today Oncyber can show your page inside a space, in
a safe sandbox, with Oncyber's header and controls around it. There's no
publishing screen, and your page doesn't get the visitor's identity, avatar or
multiplayer yet. If you want to help build those, this is the place to start.

## What works today

-   You host your page yourself, over HTTPS.
-   The owner of a space can attach your page to it (see below).
-   A small optional script lets your page tell Oncyber it's ready, open
    Oncyber's menu, and ask the visitor to share their wallet address.

:::details How the sandbox works

Oncyber loads your page in a sandboxed frame with only `allow-scripts` and
`allow-pointer-lock`. The frame has an opaque origin, so it can't read
Oncyber's cookies, storage or account, and it can't navigate the top page or
open popups. The page fills the viewport underneath Oncyber's transparent
header and controls.

-   Serve your page over HTTPS. During development, a separate loopback origin
    such as `http://127.0.0.1:5173` is accepted too.
-   ES modules, `fetch` and WASM requests come from origin `null`. Serve public
    assets with `Access-Control-Allow-Origin: *`. Never enable credentialed CORS
    for `null` on authenticated endpoints.
-   `localStorage` and cookies aren't available. Keep state in memory or on
    your own server.
-   Create workers from Blob URLs.
-   The page must allow being framed: no `X-Frame-Options: DENY` and no CSP
    `frame-ancestors` that excludes Oncyber.

:::

:::details A minimal page

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

:::

:::details The bridge script

Copy `frontend/public/oncyber-content.js` into your own static assets. Set
`data-host-origin` when the host isn't `https://oncyber.io`, for example
`http://localhost:13000` while you develop. It adds `window.oncyberContent`:

| Call                     | What it does                                                             |
| ------------------------ | ------------------------------------------------------------------------ |
| `ready()`                | Marks the experience as loaded. Call it after your first rendered frame. |
| `openMenu()`             | Opens Oncyber's menu, for a menu button inside your page.                |
| `requestWalletAddress()` | Asks the visitor to share their public wallet address.                   |

`requestWalletAddress()` only works when the space grants the
`wallet.connect` capability. Oncyber shows its own confirmation every time, and
the result is `{ address, chain }`. It never gives your page a wallet provider,
signing or transactions. Without the bridge, Oncyber can only tell that your
frame loaded, not that it rendered.

:::

:::details Attach a page to a space (developer hook)

This is a stopgap for developers, not how publishing will work. While signed
in as the owner or an editor of a space, run this in the browser console on
Oncyber:

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

The space's normal URL now opens your page. Registering `{ "kind": "cyber" }`
puts the original gallery back; gallery data is never deleted. `engine` is only
a label: Oncyber never imports your engine.

:::

:::details Controls to match the lobby

WASD and the arrow keys walk (left and right arrows turn the camera), Shift
runs, Space jumps twice, dragging looks around, the wheel tilts the camera, and
on touch screens a thumb pad walks. Use E for "interact", with an on-screen
button for touch. The lobby's controller is
`frontend/features/worldControls/followControls.ts`; its README shows how to
plug in your own ground, walls and keys.

:::

## What's next

A real way to publish, and passing the visitor's identity, avatar and
multiplayer room through to your page. See [Multiplayer](/docs/multiplayer)
and [Avatars](/docs/avatars) for how those work in Oncyber today.
Contributions are welcome.
