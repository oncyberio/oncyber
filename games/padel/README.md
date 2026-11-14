# Glasshouse · Padel

A separate doubles padel destination for Oncyber. Visit `/games/padel` in the local frontend (hidden until launch: development only, or `GAMES_PREVIEW=1`). Arrival opens a walkable club with your selected avatar and the same Oncyber chat, avatar picker, emotes and More menu. Choose **Play padel → Play doubles** when ready.

## Play

You control one avatar. Leo is your NPC partner; Noa and Mika play the other side. Blue identifies your team and coral identifies opponents. Practice is forgiving; Club player increases the challenge. This version is local NPC doubles, not networked competitive play.

- **WASD** moves; **Shift** runs, including while charging a shot. Manual positioning stays in your control until release; then bounded assistance helps you meet the ball from your new position.
- **J**, **Space**, or **left click** commits a control shot. Press once as the ball approaches; the queued shot waits briefly for real contact.
- **K** commits a lob over the opponents.
- **Hold Enter**, aim, then **release** for a power shot. Release in the blue window to keep its target inside the court, or inside the correct service box. Early/late releases retain out-of-bounds risk. The power meter is also a click-to-charge/click-to-release control.
- **Arrow keys** aim independently of movement. While charging, a flight path and first-bounce marker preview your shot; coral shows a risky path. Releasing locks the target and lets your player finish the short step into contact. **V** cycles Broadcast, Low third person and First person. **Escape** pauses.

For a power smash, move under a high ball and watch for **Smash opportunity**. Hold Enter, aim into open court and release in the blue window. Good overhead contact produces a steeper shot and a strong first bounce that can clear the enclosure. Clearing it after a legal bounce wins the point; sending the ball straight out before that bounce is still a fault. Weak timing and stretched contact reduce the effect. Defenders can block a smash when already in position, but have bounded reaction and reach.

The enclosure is 10×20 metres. Serves bounce and launch underhand into the diagonal service box; the receiving player must let the serve bounce. Rallies allow volleys and returns after the first bounce, including a rebound off glass or mesh. A shot hitting the opponent's wall before the floor loses the point. On serve, a mesh contact before the second floor bounce is a fault. Second serves, double faults and service lets are handled.

Matches use a short exhibition tiebreak: first to seven, win by two, capped at fifteen. All four players rotate serving. It is a simplified format inspired by the [FIP Rules of Padel](https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel-1.pdf), not a complete tournament rules implementation. Out-of-court retrieval is not supported.

After a point, fault or let, the ball keeps bouncing and rolling while players finish their strokes and walk back to serve positions. Scoring ends immediately, but the physical ball continues; spare balls fade away with a small bounded pool. The next serve waits for the players to settle, and match results wait for the final recovery. Shot inputs are cleared between rallies.

The physics stepper is shared by real flight, wall-aware incoming markers, NPC interception and human preparation. Slightly late/wide human contact gets a restrained defensive reach with less pace; unreachable balls still miss. Each pair assigns one receiver to avoid both NPCs chasing the same shot.

## Visit and travel

Click the ground or use WASD to walk, Shift to run, Space to jump. Drag to orbit and scroll to zoom. Paths avoid the glass and net and use the side gates. Visit animations use the native Oncyber movement library, without a paddle or match HUD. **Explore the club** from pause/results returns to the previous visit position.

The integrated frontend provides a separate `padel-club` social room. The Oncyber host owns the shared header, chat and avatar/emote controls above the game iframe. On lobby journeys, `PadelHostOverlay` remains in the outer Oncyber document; the trusted Padel adapter relays bounded state/actions for the current navigation attempt. Match HUD and controls belong to the game. Direct `/games/padel` visits use the same host above the renderer. The standalone build supplies walking and local play; social presence is supplied by Oncyber.

Arrival preserves incoming avatar scale, position offsets and camera framing during the native crouch/stand transition. The room reveal waits for rendered frames. Return travel exports framing back to the lobby. Reduced motion, input blocking during chat/dialogs, pause, teardown and a host-owned escape path are retained. See [the SDK guide](../../packages/sdk/llm.txt) for the shared integration contract.

## Graphics, animation and sound

The original Glasshouse venue has a blue court, transparent glass, filtered mesh, rounded clubhouse, spectator terraces, trees and warm daylight. Static fixtures are merged by material (38 batches from 514 fixtures); there is one shadow light. High quality uses bounded high-DPI rendering, MSAA where supported and shader edge smoothing. Balanced reduces resolution and shadow cost. Rendering is capped at 60 FPS and stops when hidden or paused.

Low third person hides the near rear enclosure so the glass and frame cannot cover your player. Physical rebounds remain active, with a brief local glow at a wall impact. Other views and visit/travel mode retain the full enclosure.

Paddles are original procedural geometry with real perforations and short grips. Sports motion adapts the existing licensed tennis capture, with a constrained underarm serve, overhead smash, preparation, defensive reach and directional footwork. Travel and social animation use the native packs. The original motion data and provenance remain in `src/anim/tennis-motion.json`: **Tennis_mixamo.fbx** by Rokoko / Sam Lazarus from the [Rokoko free sports mocap resource](https://www.rokoko.com/resources/rokoko-mocap-12-free-sports-animations). These are adapted tennis clips, not newly captured padel motion or assets from a commercial tennis game. Anton is bundled under the SIL Open Font License in `public/fonts/Anton-OFL.txt`.

Original synthesized sounds distinguish paddle, underarm serve, floor bounce, glass, mesh, net, footsteps, faults and points. Audio starts on a user gesture, defaults enabled, and can be muted in the game or settings. Voices are bounded and disposed on mute/suspend/exit; there is no continuous ambience loop or external sound dependency.

## Development

Run `npm run dev`, `npm run build`, or `npm test` here. `npm run build` writes `frontend/public/games/padel/` for the integrated preview. `/games/padel` handles identity, prepare/reveal, return travel, shared social UI and teardown. Public avatar URL, name and portrait are the identity inputs.

- `simulation.js`: fixed-step doubles physics, rules, AI, shot preparation and scoring.
- `visit.js`, `visit-peers.js`: bounded walking, click paths, follow camera and actual visitors.
- `avatars.js`, `animation-clips.js`, `underarm.js`: independent humanoids, retargeted capture and underarm correction.
- `world.js`, `rendering.js`, `audio.js`: venue, edge smoothing, sound and cleanup.
- `travel.js`, `travel-world.js`: native arrival/departure pose, camera and world reveal.

Read-only diagnostics on `#court` expose `data-mode`, `data-phase`, `data-players`, `data-rally`, `data-shot`, `data-trajectory`, `data-recovery`, `data-enclosure`, `data-sound`, `data-graphics`, `data-performance`, `data-assist` and travel/visit state. Performance reports CPU submission time and render counts, not measured GPU execution time.
