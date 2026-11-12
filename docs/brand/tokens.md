# Design tokens

Oncyber has three UI surfaces with different jobs, so they share a base and
keep their own set on top of it. All values live in
[`frontend/styles/tokens/`](../../frontend/styles/tokens/). A live reference of
every value, with samples of the real primitives, is at `/dev/tokens`.

| File         | Surface                                   | Character                                               |
| ------------ | ----------------------------------------- | ------------------------------------------------------- |
| `base.ts`    | Everything                                | Fonts, ink, accent blue + create red, hairlines, motion |
| `action.ts`  | Action buttons on every surface           | One spec; blue, white and outline variants              |
| `landing.ts` | 2D landing (`/`, `/landing-carousel`)     | Quiet canvas, paper cards, blue actions                 |
| `lobby.ts`   | UI over the 3D lobby and visitor runtimes | Glass panels, dock controls, curved pickers             |
| `studio.ts`  | Studio editor                             | Dense, flat neutral greys, no glass                     |

Import from `@styles/tokens`:

```ts
import { baseTokens, lobbyTokens } from "@styles/tokens";
```

## What reads from where

-   **Base** feeds every set: the Aeonik and Space Mono files, the type scale,
    the accent blue and its gradient stops, Create red (`accentCreate`,
    `#ff4b4b`), the cyan-to-lime selection line,
    white hairline strengths (`line.faint` to `line.selected`), radii, motion
    durations and easing, focus rings and breakpoints.
-   **Action** (`actionTokens`) is the one button spec for the whole app: 40 px
    minimum height, 10/16 padding, a 1 px border, Aeonik 500 at 13 px/1.35, and
    a 12 px or fully round corner. It also holds the colours of the three
    variants (blue, white, outline) and the focus and disabled states. The
    primitives in `frontend/styles/brand/index.ts` read it: `actionSpec`,
    `actionButton`, `pillAction`, `blueAction`, `whiteAction`, `outlineAction`
    and the `ActionButton` component. So do the older `NButton` and
    `RoundButton`. Its font stack ends in the app-wide "Aeonik" family, so a
    button also renders correctly on a page that does not mount
    `brandFoundation`. `landingTokens.action` points at the same values.
-   **Landing** is exposed as CSS variables by `brandFoundation`
    (`frontend/styles/brand/index.ts`, the `--oc-*` variables) and through
    `brandTokens`, which is kept so existing imports keep working.
    `compactActionSizing` reads from it too. `brandFoundation` is made of
    `brandFonts` and `brandVariables` plus the root font. The shared dialog
    (`components/Dialogs/styles.tsx`) takes the two parts without the root
    font, and reads its dark colours from the landing, base and action sets.
-   **Lobby** is read by `promptGlass` (`ui/components/PromptGlass.ts`),
    `experienceControl` (`features/content-host/experienceChrome.ts`), the
    panel and dock styles in `features/lobby/`, and the card-picker curve in
    `lobbyPanelCurve.ts`. Lobby surfaces also mount `brandFoundation`, so
    `--oc-*` variables are available there.
-   **Studio** is exposed as the `--studio-*` CSS variables by `StudioTheme`
    (`features/studio/styles/StudioTheme.tsx`). Studio fonts use their own
    family names ("Studio Aeonik") so their weights stay independent of the
    legacy font mappings; the files are the same as the base.

The token sets record each surface's existing visual direction. Studio's shared
controls consume its tokens directly; compatibility exports keep older controls
working with the same theme.

## Where the surfaces differ today

These are deliberate or inherited differences, recorded so they can be unified
on purpose rather than by accident.

| Role           | Landing           | Lobby                 | Studio        |
| -------------- | ----------------- | --------------------- | ------------- |
| Canvas         | `#101010`         | 3D scene              | `#111111`     |
| Panel          | `#191919`         | glass over `#16191f`  | `#181818`     |
| Primary text   | `#f3f3f1`         | `#f3f3f1` / `#e8e9ec` | `#f1f1f1`     |
| Secondary text | `#c2c2bd`         | `#c2c2bd` / `#c2c5cc` | `#c6c6c6`     |
| Muted text     | `#93938e`         | `#969daa`             | `#a0a0a0`     |
| Control radius | 12                | 12                    | 10            |
| Card radius    | 24 (16 on phones) | 12 (panel 16)         | 12 (panel 18) |

The lobby uses cooler blue-greys for text so it reads over moving world
backgrounds. Studio greys are slightly warmer-neutral and its corners tighter
to suit a dense editor.

## Still hardcoded

Only the shared primitives were moved. These still carry literal values and
are the next candidates: `features/lobby/conversationStyles.ts` (chat and group
notices; matching tokens already exist under `lobbyTokens.color` and
`lobbyTokens.control`), styles inside individual lobby panels such as
`LobbyPeoplePanel.tsx`, component-specific Studio layouts, and per-component
styles on the landing.

## Adding a value

Put it in the surface set if only that surface uses it. Move it to the base
when a second surface needs the same value, and reference it from both sets
rather than copying the literal.

## Building Studio features

The Studio system is in `frontend/styles/tokens/studio.ts`, exported as
`studioTokens` (and the `StudioTokens` type) from `@styles/tokens`. The editable
reference at **`/dev/tokens#studio`** renders the real field, button, heading,
panel, and tab primitives, including selected and disabled states. The controls
on that reference are samples and do not save anything.

### Surface and control roles

| Token group                 | Purpose                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`                     | Canvas `bg`, solid `panel`, `card`, dark `inset` fields, raised `surface`, `hover` and `selected` states, three text levels, borders, action blue |
| `font`                      | Aeonik body 13/20, medium actions 13/20, headings 16/22, labels 12/24; Space Mono numeric utilities 11/18                                         |
| `radius`                    | Panels 18, cards 12, controls 10, compact controls and previews 8                                                                                 |
| `space`                     | Panel padding 14, grid/field gap 8, section gap 12                                                                                                |
| `field`                     | Minimum height 40, padding 9 × 12, disabled opacity 0.45                                                                                          |
| `action`                    | Minimum height 38, padding 8 × 14, gap 8, disabled opacity 0.4                                                                                    |
| `tab`, `menuItem`           | Tabs 44 high; menu rows padded 8 × 12                                                                                                             |
| `layout`, `breakpoint`      | Inspector width 340, close control 32, touch target 44; compact editor breakpoint 600                                                             |
| `focus`, `motion`, `shadow` | Visible 2 px focus ring with 3 px offset, 150 ms control feedback, quiet panel edge/shadow                                                        |
| `legacy`                    | Compatibility-only slider colors; avoid these in new features                                                                                     |

Dimensions are pixels and durations are milliseconds unless the value already
contains a CSS unit. Use the named role rather than a similar-looking literal.
Studio deliberately has tighter controls and neutral solid panels. Use
`blueAction` from `@styles/brand` for Play/Preview; ordinary primary actions use
light ink on a dark editor. Keep lobby glass, travel effects, and landing paper
cards out of editor inspectors.

### Use the existing primitives

Mount `<StudioTheme />` once at the editor route boundary. It provides the local
Aeonik/Space Mono fonts and `--studio-*` variables on the document, so portalled
menus also inherit the theme. Existing editor routes already do
this. Do not remount the global theme in every feature.

For a Studio surface embedded in another page, apply `studioFoundation` to its
wrapper instead. It uses the same variables and fonts without changing the
rest of the page. Apply it to a portal's own root as well if that portal is
outside the wrapper. `StudioTheme` and the scoped foundation share one variable
mapping in `features/studio/styles/foundation.ts`.

```tsx
import styled from "styled-components";
import { studioTokens } from "@styles/tokens";
import { studioPanel, studioHeading } from "@features/studio/styles/primitives";
import { Button } from "@features/studio/styles/Button";
import { TextInput } from "@features/studio/styles/Input";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";

// Inside an editor route that already mounts StudioTheme.
export function ObjectSettings() {
    return (
        <Panel data-studio-surface aria-labelledby="object-settings-title">
            <Heading id="object-settings-title">Object settings</Heading>
            <Field>
                <Label as="label" htmlFor="object-title">
                    Title
                </Label>
                <TextInput id="object-title" placeholder="Untitled object" />
            </Field>
            <Button type="button" disabled>
                Choose an object to edit
            </Button>
        </Panel>
    );
}

const Panel = styled.section`
    ${studioPanel}
    display: grid;
    gap: ${studioTokens.space.sectionGap}px;
    padding: var(--studio-panel-padding);
    width: min(100%, ${studioTokens.layout.inspectorWidth}px);
    box-sizing: border-box;
`;
const Heading = styled.h2`
    ${studioHeading}
`;
```

Other reusable styles in `primitives.ts` are `studioField`, `studioAction`,
`studioFocus`, `studioTab`, and `studioMenuItem`. Use native buttons and labels,
`disabled` for unavailable controls, and `aria-pressed` or `aria-selected` for
selection. Allow content to scroll within panels, keep their close action
reachable, and use the 44 px target on touch layouts. Add keyboard behavior
when composing actual tablists or menus; the style mixins supply appearance,
not those interactions.

`features/studio/styles/tokens.ts` remains a compatibility adapter for old
imports. Add new values to the canonical Studio set, not that adapter.
