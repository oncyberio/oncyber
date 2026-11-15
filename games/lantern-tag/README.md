# Lantern Tag

A night-time courtyard: lanterns light up, walk to one to catch it before it
fades. A round lasts 90 seconds. Start with [BRIEF.md](BRIEF.md); the rules
are in [docs/games/good-game.md](../../docs/games/good-game.md).

```sh
npm ci
npm run dev                         # standalone: ?arrive, ?party=3, ?round=20
npm test                            # the round's rules and the party's round
pnpm games:publish lantern-tag      # from the repository root: build, check, release
```

| File            | What                                                            |
| --------------- | --------------------------------------------------------------- |
| `src/round.js`  | The rules: lanterns, scores, snapshots, the result. Pure.       |
| `src/match.js`  | Who runs a round in a party, joining, dropping, taking it over. |
| `src/game.js`   | The lifecycle game: screens, walking, drawing, leaving.         |
| `src/host.js`   | The browser host: the page bridge and every runtime helper.     |
| `src/world.js`  | The courtyard and the body of a visitor without an avatar.      |
| `src/motion.js` | The avatars' idle, walk, run and jump, generated in code.       |
| `src/sound.js`  | Every sound, synthesised.                                       |
