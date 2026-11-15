# Glasshouse · Padel

A doubles padel destination for Oncyber, on the games SDK ([docs/games.md](../../docs/games.md)): a lifecycle game (`src/game.js`) behind a host (`src/host.js`) on the shared game page, in the sandboxed frame. Visit `/games/padel` in the local frontend (hidden until launch: development only, or `GAMES_PREVIEW=1`). You arrive in a walkable club as your avatar, with the page's chat and voice. Choose **Play padel → Play doubles** when ready. What it is held to and how the bot plays it: [BRIEF.md](BRIEF.md).

## Play

You control one avatar. Leo is your NPC partner; Noa and Mika play the other side. Blue identifies your team and coral identifies opponents. Practice is forgiving; Club player increases the challenge. This version is local NPC doubles, not networked competitive play.

- **WASD** moves; **Shift** runs, including while charging a shot. Manual positioning stays in your control until release; then bounded assistance helps you meet the ball from your new position.
- **J**, **Space**, or **left click** commits a control shot. Press once as the ball approaches; the queued shot waits briefly for real contact.
- **K** commits a lob over the opponents.
- **Hold F**, aim, then **release** for a power shot. Release in the blue window to keep its target inside the court, or inside the correct service box. Early/late releases retain out-of-bounds risk. The power meter is also a click-to-charge/click-to-release control.
- **Arrow keys** aim independently of movement. While charging, a flight path and first-bounce marker preview your shot; coral shows a risky path. Releasing locks the target and lets your player finish the short step into contact. **C** cycles Broadcast, Low third person and First person. **P** pauses. Escape, Enter and M belong to the page (its menu, chat and sound).

For a power smash, move under a high ball and watch for **Smash opportunity**. Hold F, aim into open court and release in the blue window. Good overhead contact produces a steeper shot and a strong first bounce that can clear the enclosure. Clearing it after a legal bounce wins the point; sending the ball straight out before that bounce is still a fault. Weak timing and stretched contact reduce the effect. Defenders can block a smash when already in position, but have bounded reaction and reach.

The enclosure is 10×20 metres. Serves bounce and launch underhand into the diagonal service box; the receiving player must let the serve bounce. Rallies allow volleys and returns after the first bounce, including a rebound off glass or mesh. A shot hitting the opponent's wall before the floor loses the point. On serve, a mesh contact before the second floor bounce is a fault. Second serves, double faults and service lets are handled.

Matches use a short exhibition tiebreak: first to seven, win by two, capped at fifteen. All four players rotate serving. It is a simplified format inspired by the [FIP Rules of Padel](https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel-1.pdf), not a complete tournament rules implementation. Out-of-court retrieval is not supported.

After a point, fault or let, the ball keeps bouncing and rolling while players finish their strokes and walk back to serve positions. Scoring ends immediately, but the physical ball continues; spare balls fade away with a small bounded pool. The next serve waits for the players to settle, and match results wait for the final recovery. Shot inputs are cleared between rallies.

The physics stepper is shared by real flight, wall-aware incoming markers, NPC interception and human preparation. Slightly late/wide human contact gets a restrained defensive reach with less pace; unreachable balls still miss. Each pair assigns one receiver to avoid both NPCs chasing the same shot.

## The club, arriving and leaving

W A S D (or the arrow keys) walks, Shift runs, Space jumps, and a drag looks around: the lobby's own movement and camera, from the locomotion kit. The glass, the net and the fence block; the four side doors lead onto the court. G waves, B dances and V sits. **Explore the club** from pause or results returns to the club where your player stood.

A visitor from the lobby arrives in the lobby's last framing, crouched and facing its camera, and stands up when the page reveals the game (the avatar kit's arrival pose, the locomotion kit's `arrival()`). Everyone else in the club's room is drawn as their Oncyber avatar with a name tag. Chat, voice, the sound setting and the menu are the page's. **Back to the lobby** leaves through the departure: the visitor is stood in the club, the world fades to black around the avatar and the lobby opens on that frame.

## Graphics, animation and sound

The original Glasshouse venue has a blue court, transparent glass, filtered mesh, rounded clubhouse, spectator terraces, trees and warm daylight. Static fixtures are merged by material (38 batches from 514 fixtures); there is one shadow light. High quality uses bounded high-DPI rendering, MSAA where supported and shader edge smoothing. Balanced reduces resolution and shadow cost. The host owns the clock: nothing is drawn or simulated while the game is suspended (a hidden tab, the page's menu, typing during a match).

Low third person hides the near rear enclosure so the glass and frame cannot cover your player. Physical rebounds remain active, with a brief local glow at a wall impact. Other views and visit/travel mode retain the full enclosure.

Paddles are original procedural geometry with real perforations and short grips. Sports motion adapts a tennis capture, with a constrained underarm serve, overhead smash, preparation, defensive reach and directional footwork. Walking and running on court, and everything in the club, use the lobby's motion from the avatar kit; Padel bundles no lobby clips of its own. The original motion data and provenance remain in `src/anim/tennis-motion.json`: **Tennis_mixamo.fbx** by Rokoko / Sam Lazarus from the [Rokoko free sports mocap resource](https://www.rokoko.com/resources/rokoko-mocap-12-free-sports-animations). These are adapted tennis clips, not newly captured padel motion or assets from a commercial tennis game. Anton is bundled under the SIL Open Font License in `public/fonts/Anton-OFL.txt`. Every shipped file and its licence is in `game.json` (`credits`); four have no confirmed licence yet and are listed as exceptions in `games/licenses.json`.

Original synthesized sounds distinguish paddle, underarm serve, floor bounce, glass, mesh, net, footsteps, faults and points, over a very quiet open-air bed. All of it goes through the SDK's one sound output: the page owns volume, mute and the first gesture, and the game is silent while it is suspended. Voices are bounded and disconnect when they end.

## Development

Run `npm run dev`, `npm run build`, or `npm test` here. `npm run build` writes `frontend/public/games/padel/`; `pnpm games:check padel` checks it and `pnpm games:publish padel` builds, checks and writes the release (here: `GAMES_CHECK_TIMEOUT_S=900`). Standalone (`npm run dev`), `?arrive` stands in for a lobby trip and `?party=4` for a party.

- `host.js`: the browser host: the page bridge, the declared input, saved settings, avatar bytes, results, departure, loading, the one pause, sound.
- `game.js`: the lifecycle game: the club (the avatar and locomotion kits), the menus (the UI kit), the match and its HUD.
- `simulation.js`: fixed-step doubles physics, rules, AI, shot preparation and scoring.
- `club.js`: where a walking visitor can go.
- `avatars.js`, `animation-clips.js`, `underarm.js`, `overhead.js`, `locomotion.js`: the four match bodies, retargeted capture and court footwork.
- `world.js`, `rendering.js`, `camera.js`, `audio.js`: venue, edge smoothing, match cameras, sound.
- `input.js`, `devices.js`: the declared actions as the simulation's controls; the mouse.
- `result.js`, `saved.js`, `departure.js`, `hud.js`: the match report, saved settings, the last frame, the HUD's place for the checks.
