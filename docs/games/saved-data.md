# Saved data

How a game keeps anything between visits. Written for whoever is building
the game, person or coding agent. The game runs in a sandboxed frame with no
storage of its own, so the page keeps its values and the game asks for them.

## The rule

**Declare every key. Saved values are plain JSON with a version.**

1. Every value a game saves has a name declared in `game.json` under
   `saved`, with a scope, a `stateVersion` and a size limit. A key that is
   not declared is refused, by the game's own runtime, the page and the server.
2. A value is plain JSON: objects, arrays, strings, finite numbers, booleans.
   No dates, maps, class instances or `undefined`. Sixteen levels deep at most.
3. When the shape of a value changes, add 1 to the key's `stateVersion`, add
   a `migrate` case that converts the previous version, and list a save from
   the previous version under `old` so the check boots the game with it.
4. Read a key before you write it, and treat whatever comes back as input:
   a save can be missing, from another version, or (for shared keys) written
   by someone else. Fall back to defaults field by field; never throw.

## Declare

```json
{
    "name": "ACE! Tennis",
    "saved": {
        "settings": {
            "scope": "visitor",
            "stateVersion": 1,
            "maxBytes": 256,
            "sample": { "difficulty": "rookie", "games": 3 },
            "old": [
                {
                    "stateVersion": 0,
                    "value": "{\"difficulty\":\"ace\",\"games\":1}",
                    "expect": "migrated"
                }
            ]
        },
        "tally": {
            "scope": "game",
            "stateVersion": 1,
            "maxBytes": 64,
            "sample": { "matches": 1 }
        }
    }
}
```

| Field          | Meaning                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| key name       | Lowercase letters, digits and dashes, starting with a letter, 32 characters at most. Sixteen keys at most. |
| `scope`        | `visitor`, `party` or `game` (below).                                                                      |
| `stateVersion` | A whole number from 1: the shape the game writes today.                                                    |
| `maxBytes`     | Limit on the value's JSON in UTF-8 bytes. At most 256 KiB for `visitor`, 64 KiB for `party` and `game`.    |
| `sample`       | A value the game really saves. The check saves it and reads it back; the game must boot with it.           |
| `old`          | Saves from earlier versions: `{ stateVersion, value, expect? }`, `expect` being `"migrated"` or `"reset"`. |

After editing `saved`, run `node scripts/games/saved-data.mjs sync` and
commit `frontend/features/games/savedData.declared.json`. The page and the
server know a game's keys only through that file; the check fails when it
is out of date.

## Scopes

| Scope     | One value per       | Kept                                                               | Who can write                  |
| --------- | ------------------- | ------------------------------------------------------------------ | ------------------------------ |
| `visitor` | person              | Signed in: on the server, on every device. Guest: in this browser. | That person                    |
| `party`   | party, for the trip | On the server under the trip id, for a day after the last write    | Signed-in members of the party |
| `game`    | game, shared by all | On the server                                                      | Any signed-in player           |

-   A guest's `visitor` values carry over the first time they sign in: the
    game reads the browser's value and its next save lands on the account.
-   Guests can read `party` and `game` keys but not write them
    (`sign-in-required`). A visitor who came alone has no party (`no-party`).
-   `party` and `game` values are written by other players' games. Validate
    them like any network input: check types and ranges, cap lengths.
-   Shared keys are written **compare-and-set**: a write names the revision
    it read, and loses with `conflict` if someone else wrote first. Use
    `update`, which reads, applies your change and retries.

## Use

```js
import { connectSavedData } from "@oncyber/game-runtime/saved"; // games/runtime/src/saved.ts
import manifest from "../game.json";

const saved = connectSavedData({
    prefix: "ace:", // the game's message prefix
    declared: manifest.saved,
    migrate: {
        // (value saved earlier, the version it was saved at) -> today's shape.
        // Return undefined (or throw) to start fresh.
        settings: (old, from) => (from === 0 ? JSON.parse(old) : undefined),
    },
});

const { value, outcome } = await saved.get("settings"); // value is null when there is nothing usable
await saved.set("settings", { difficulty: "pro", games: 2 });
await saved.update("tally", (tally) => ({
    matches: (tally?.matches ?? 0) + 1,
}));
```

`get` never throws. Its `outcome` says what happened:

| Outcome       | Meaning                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `current`     | Saved at the declared version.                                                                      |
| `empty`       | Nothing saved.                                                                                      |
| `migrated`    | Saved at another version; `migrate` converted it and the converted value was saved back.            |
| `reset`       | Saved at another version and `migrate` had no answer. `value` is null; the old save is left alone.  |
| `unavailable` | The store could not be reached (or the key is undeclared). `value` is null; carry on with defaults. |

`set`, `update` and `remove` resolve to `{ ok: true, revision }` or
`{ ok: false, reason }`, never reject. Reasons: `undeclared`, `invalid`,
`too-large`, `revision-required`, `conflict`, `stale-version` (an older
build writing over a newer save), `no-party`, `sign-in-required`,
`rate-limited` (60 writes a minute per account), `unavailable`. Don't save
every frame: save when something changes.

`stateVersion: 0` is special: it is what a game kept under the fixed keys
`save`, `settings` and `muted` before declarations existed, handed over as
the raw string. A key with one of those names should migrate from 0.

Opened on its own (`vite dev`), the game uses the frame's localStorage.

## Check

`pnpm games:check <id>` runs a saved-data stage for any game that declares
keys (`node scripts/games/saved-data.mjs check <id>` runs it alone). In the
same sandbox as the site, with the page's real rules:

1. **Round trip.** Each key's `sample` is saved through the game, the game
   is reloaded, and the sample must come back. A game that writes a key
   before reading it fails here.
2. **Limits.** A value over `maxBytes`, a write to a shared key with no
   revision and one with a stale revision must all be refused.
3. **Old saves.** The game is booted with each listed `old` save, with a
   version 0 save it cannot parse, and with a save from a future version.
   It must boot with no page errors and report `migrated` or `reset` for
   every key (and match `expect` where given).

Any use of an undeclared key during these boots fails the check, as do a
missing `sample`, a `stateVersion` above 1 with no `old` save from the
version before, and declarations that were not synced.

## How it is built

| Path                                         | What it is                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `games/runtime/src/saved.ts`                 | The game side: `connectSavedData`, versions and migration, `update`.       |
| `frontend/features/games/savedData.ts`       | The rules every side shares: declarations, JSON and size, compare-and-set. |
| `frontend/features/games/savedDataBridge.ts` | The page: answers the game's `<id>:saved` messages, picks the store.       |
| `frontend/features/games/savedDataServer.ts` | The server rules, inside one transaction.                                  |
| `frontend/pages/api/_v2/gameSaved/`          | RPC procedures `savedRead` and `savedWrite` over Firestore.                |
| `scripts/games/saved-data.mjs`               | The check stage and `sync`.                                                |

Messages: the game posts `<id>:saved` `{ request, op: "get" | "set" |
"remove", key, stateVersion?, value?, ifRevision? }`; the page answers
`<id>:saved-result` `{ request, ok, entry? | reason }`, where `entry` is
`{ stateVersion, value, revision }`.

On the server, values live in the `gameSaved` collection and per-account
write counts in `gameSavedQuota`, both reached only through the Admin SDK.
Party values carry `expiresAt`; add a Firestore TTL policy on that field to
have them deleted (they are ignored once expired either way).
