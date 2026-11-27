# Scene profile

Before a game is published, the check says what its build costs a visitor,
and warns about each number that is over its budget, with what to change.
It is part of `oncyber check` (`pnpm games:check <id>` here), so it also
runs in `oncyber publish`, which repeats the warnings after the link.

```
  scene: 1.0 MiB in 5 files before the first frame · about 1.9 s to a first frame at 9 Mbit/s (budget 5.0 s)
  scene: a frame draws 1,892 triangles (1,976 when heavy) in 59 draw calls, the scene 1 time · 6 textures, about 0.4 MiB on the card, the largest 256 x 256 · webgl2
  scene: on the phone the canvas is 824 x 1678, 2 pixels per point
  scene: within its budgets
```

That is Lantern Tag, the starter game. A number over its budget adds a
line like this one:

```
  warning SCENE_TRIANGLES_PHONE: a frame draws 240,000 triangles. Oncyber worlds over 100,000 run under 30 frames a second 13.8% of the time on phones, against 6% under it. Draw fewer on a phone: simpler models, or a shorter view.
```

The warnings never fail the check and never stop a publish. They are for
the maker, or the agent, to keep working against: fix one, run
`oncyber check` again, and its line is gone. The numbers are also in
`check.json` under `scene`, and the warnings under `warnings`.

## What is measured

The check's browser usually has no graphics card, so its frame times say
little about a phone. The profile reads facts of the build that hold on
any device:

| Number                       | How it is read                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bytes before the first frame | What the check's server sent before the game's `first-frame` (or its first draw), each file once        |
| Wait for a first frame       | Those bytes at 9 Mbit/s, plus the time to the first frame in the check                                  |
| Triangles and draw calls     | Counted on every WebGL and WebGPU draw call, per frame, over every pass: usual (median) and heavy (95%) |
| Times the scene is drawn     | Passes in the heaviest frame that draw at least half of what the largest one does                       |
| Textures                     | Live textures, their estimated bytes on the card, the largest one                                       |
| The phone's canvas           | Its backing size against its layout size, on the phone visit of the device check                        |

The counting is done by a script the check adds to the game's frame before
the game loads (`scripts/games/scene-probe.mjs`). It wraps the drawing
calls of WebGL and WebGPU, so it works for any game whatever library drew
it, and the game does nothing for it.

The bytes are the build's own files. What a game fetches from another
host before its first frame (an avatar, say) is not counted.

It cannot see a canvas drawn from a worker, or a 2D canvas; the profile
then says frames are not profiled. Indirect and bundled WebGPU draws are
counted as calls with no triangles, and the profile says how many.

## Warnings and budgets

| Code                     | When                                                          | What to do                                                                |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `SCENE_FIRST_FRAME_WAIT` | The estimated wait is over the first-frame budget (5 s)       | Load after the first frame what the first frame does not show             |
| `SCENE_TRIANGLES_PHONE`  | A heavy frame draws over 100,000 triangles                    | Draw fewer on a phone: simpler models, a shorter view                     |
| `SCENE_TRIANGLES`        | A heavy frame draws over 700,000 (the text changes over 1.5M) | Simpler models, fewer triangles for far things                            |
| `SCENE_DRAWN_AGAIN`      | A frame draws the scene more than once                        | Leave the mirror, water or shadow pass out on a phone, or draw less in it |
| `SCENE_PIXELS_PHONE`     | The phone's canvas is over 2 pixels per point                 | Use the graphics settings' `pixelRatio` from the SDK, which stops at 2    |

A game that sets `loading.firstFrameBudgetMs` in `game.json` is held to
that budget for the wait as well. The warning names the three largest
files that arrived before the first frame.

Draw calls and textures are reported without a budget: Oncyber has no
field number for draw calls, and the number of textures showed no clear
effect (below).

## Where the budgets come from

Each budget sits where Oncyber's own numbers change. These are 30 days of
visits to worlds, read in November 2026. A world samples its frame rate
every 20 seconds with the scene's triangles and features; "slow" is the
share of those samples under 30 frames a second.

| Triangles a frame  | Slow on desktops | Slow on phones        |
| ------------------ | ---------------- | --------------------- |
| under 100,000      | 8.6%             | 6.0%                  |
| 100,000 to 300,000 | 10.7%            | 13.8%                 |
| 300,000 to 700,000 | 12.9%            | too few visits to say |
| 700,000 to 1.5M    | 15.3%            | too few visits to say |
| over 1.5M          | 29.8%            | too few visits to say |

| Scene has a reflection | Slow on desktops | Slow on phones |
| ---------------------- | ---------------- | -------------- |
| no                     | 10.3%            | 4.5%           |
| yes                    | 14.8%            | 20.8%          |

The field number is for reflections. A shadow pass also draws the scene
again and is named by the same warning, on the same reasoning, without a
field number of its own.

| Textures in the scene | Slow on desktops | Slow on phones |
| --------------------- | ---------------- | -------------- |
| under 50              | 9.8%             | 7.6%           |
| 50 to 150             | 10.2%            | 7.7%           |
| 150 to 400            | 10.5%            | 7.4%           |
| 400 to 1,000          | 13.0%            | 3.9%           |

Starting: of the visits that open a world's page, 33% start the world.
The usual wait before a start is 17 s on phones and 21 s on desktops. That
is why the wait for a first frame is the first line of the profile.

Two things the same numbers say not to chase. The usual frame rate is 60
in every band above, so the budgets are about the slow share, not the
median. And visits that began at a low frame rate did not end sooner, so a
game already at 60 gains little from more.

These come from worlds, not games: until games have visitors of their own,
worlds are the nearest measurement. Once a game is live, `oncyber health`
reports its own ([field-health.md](field-health.md)).

### Reading them again

The numbers are from the `fps sample 20s` event (`currentFps`,
`deviceType`, `triangles`, `textures`, `hasReflector`) and from
`open exhibit page` followed by `start exhibit` in the same session. When
they are read again, update `FIELD` and `SCENE_BUDGETS` in
`scripts/games/scene-profile.mjs` and the tables here together.

## Not in the profile yet

-   The site does not measure the build itself: the profile is the
    command's, like the rest of the check, and the site records only that a
    check passed.
-   Whether sound and video files play on every phone.
-   How soon a visitor can act, and whether they do. Those need visits:
    see [field-health.md](field-health.md).
