# %NAME%

A game for Oncyber, created with `oncyber new %ID%`. As created it is the
starter game: a night-time courtyard where lanterns light up and you walk to
one to catch it before it fades. It passes `oncyber check` as it is; make it
yours from there.

```sh
npm install
oncyber dev        # the game alone: add ?arrive, ?party=3 or ?round=20 to the address
npm test           # the rules and the party's match, without a browser
oncyber check      # every check a published game is held to; done is this exiting 0
oncyber login      # once
oncyber publish    # build, check, upload; prints the game's link
```

Read first: `oncyber docs` (how a game fits Oncyber, what is required, the
helper for each thing), then `oncyber docs good-game` (the rules and what
each finding means). `oncyber docs --list` names every page.

## Where to change things

| File            | What                                                            |
| --------------- | --------------------------------------------------------------- |
| `BRIEF.md`      | What the game is. Rewrite it first; the check reads it.         |
| `game.json`     | The manifest: name, listing, devices, input, party, credits.    |
| `src/world.js`  | The world: everything a visitor sees.                           |
| `src/round.js`  | The rules of a round. Pure, tested.                             |
| `src/match.js`  | Who runs a round in a party, joining, dropping, taking it over. |
| `src/game.js`   | The lifecycle game: screens, walking, drawing, leaving.         |
| `src/host.js`   | The browser host: the page bridge and every runtime helper.     |
| `src/motion.js` | The avatars' idle, walk, run and jump, generated in code.       |
| `src/sound.js`  | Every sound, synthesised.                                       |
| `scenario.json` | The lifecycle scenario the check plays.                         |
| `bot.json`      | The bot that plays a whole round through declared input.        |

The build goes to `dist/`, the check's report to `.oncyber/check.json` and
its screenshots to `.check/`. Look at the screenshots: a stage can pass with
something drawn wrongly.

The id the game is published under is `oncyber.id` in `package.json`.
