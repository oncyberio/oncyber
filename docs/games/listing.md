# Game listings

What the site shows about a game before anyone plays it: the card in the
lobby's Explore panel, who is playing now, and the way into a party that is
already there. Written for whoever (person or coding agent) adds or changes
a game. The rest of the games SDK: [../games.md](../games.md).

## The rule

Every `games/<id>/game.json` has a `listing`. `pnpm games:check <id>` fails
without one, so a game that is not listed correctly cannot be published.

```json
{
    "name": "ACE! Tennis",
    "listing": {
        "tagline": "an arcade tennis match",
        "description": "Charge it up, time it right, hear the crowd go wild. Play the house solo, or bring a party for 1 v 1, doubles or a tournament.",
        "players": { "min": 1, "max": 8 },
        "partySizes": [2, 3, 4, 5, 6, 7, 8],
        "devices": ["desktop", "phone"],
        "tags": ["sports", "arcade", "party"]
    }
}
```

| Field         | Required | What to write                                                                                                                                                                           |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description` | yes      | 30 to 200 characters of plain text: what the player does. No markup, no links.                                                                                                          |
| `tagline`     | yes      | One phrase, at most 60 characters. Shown after the title and on the card.                                                                                                               |
| `players`     | yes      | `{ "min", "max" }`: the fewest and the most people who can play together. A game one person can play alone has `min: 1`.                                                                |
| `partySizes`  | no       | Each party size (2 to 8) the game has a format for. Leave it out when a party gets nothing a lone visitor doesn't.                                                                      |
| `devices`     | yes      | Where the game is playable, from `desktop`, `phone`, `headset`. List a device only if you played it there.                                                                              |
| `tags`        | yes      | One to six lowercase tags (`sports`, `co-op`). Explore's search reads them.                                                                                                             |
| `thumbnail`   | no       | A `.jpg`, `.png` or `.webp` in the build (for example `"preview.jpg"` from the game's `public/`), under 512 KiB. Leave it out and the check takes one from the running game; see below. |

Page settings sit beside the listing in `page`, all optional: `room` (the
shared room everyone playing joins), `relay` (pass `<id>:net` packets through
that room), `crowdLabel` ("in the garden"), `controls` (where the social
controls sit) and `ownPage` (the game has its own page in `pages/games/`).

## What the check enforces

The listing stage runs inside `pnpm games:check <id>`
(`scripts/games/listing.mjs`) and adds findings to `check.json`:

| Finding                 | Means                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LISTING_MISSING`       | No `listing` in `game.json`.                                                                                                                                                            |
| `LISTING_DESCRIPTION`   | Missing, too short, too long, or not plain text.                                                                                                                                        |
| `LISTING_THUMBNAIL`     | The named file is not in the build, is the wrong type or too large; or none was named and the game never drew a frame to take one from.                                                 |
| `LISTING_PLAYERS`       | The counts contradict the rest: a party size outside `min` to `max`; `max` above 1 with no shared room and no party sizes; `min` above 1 with no party of that size and no shared room. |
| `LISTING_PARTY_SIZES`   | Not whole numbers from 2 to 8, each once.                                                                                                                                               |
| `LISTING_DEVICES`       | Empty, or names a device the site doesn't know.                                                                                                                                         |
| `LISTING_TAGS`          | None, more than six, or not lowercase.                                                                                                                                                  |
| `LISTING_TAGLINE`       | Missing or longer than 60 characters.                                                                                                                                                   |
| `LISTING_ROOM`          | `page.room` is not a lowercase room label.                                                                                                                                              |
| `LISTING_CATALOG_STALE` | The site's catalog no longer matches the manifests. Run `pnpm games:catalog`.                                                                                                           |

Keep `partySizes` honest with a test in the game: Ace's
`games/ace/test/listing.test.js` asserts the listed sizes are exactly the
sizes its format rules (`partyFormats`) offer something for.

## The thumbnail

With no `listing.thumbnail`, the check saves the running game's frame as
`frontend/public/games/<id>/thumbnail.jpg` (1280 × 720), the first time it
passes boot. It is taken again by `pnpm games:publish <id>` and by
`pnpm games:check <id> --thumbnail`, so a release's card shows that release.
The file is a report like `check.json`: it is committed with the build but is
not one of the release's files, and `thumbnail.jpg` is a reserved name. Make
the first screen worth looking at: that is the screen the check sees.

## The catalog is generated

`frontend/features/games/catalog.generated.ts` is written from every
`games/*/game.json` by:

```sh
pnpm games:catalog           # write it
pnpm games:catalog --check   # exit 1 when it is behind the manifests
```

Never edit it, and never add a game to the site by hand: change the manifest
and run the command. `pnpm games:publish` does not write it for you; the
check tells you when it is behind.

## What the lobby shows

On the development server (games stay hidden elsewhere), each game has a
card in Explore built from its listing (`features/games/gameCards.ts`):
thumbnail, title, tagline and player count.

-   **Who is playing now.** While Explore is open the lobby reads the
    realtime server's room list every 30 seconds
    (`features/games/gamePresence.ts`) and adds up the people in the game's
    shared room and in every party's room: "5 playing now". It shows a
    count, not names; names are only sent to people inside a room.
-   **Join your party.** When a party the visitor belongs to is in a game, a
    second card leads: "Your party is here · 3 in your party". It opens
    `/games/<id>?join=<party id>` (`features/games/gamePartyJoin.ts`), which
    puts the late arrival in the party's room. A party counts as the
    visitor's when its id is the trip id of one of their lobby groups, or a
    party this browser tab played with in the last two hours. Other parties
    are counted but never linked.

A game sees a late arrival as `party: { id, size: 1, members: [], late: true }`
followed by `self` and `peers` from the party's room. Treat the room's roster
as the party, as for any member; don't require `members` to be non-empty when
`late` is set (see `readParty` in `games/ace/src/host.js`).
