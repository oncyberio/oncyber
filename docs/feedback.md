# Where errors and other feedback appear

One rule decides where a message goes, so the same kind of failure looks the
same everywhere:

**Beside the thing that failed, with a retry. Dialogs only when the visitor
must decide something. Toasts only for things that finished in the
background.**

When something the visitor just did fails, say so next to the control they
used, and offer Retry when running the same action again can help. They are
already looking there, and nothing else on the page is blocked.

A dialog stops everything, so it is kept for a choice only the visitor can
make: confirm a deletion, pick between two outcomes, type a password. An
error is not a choice. `showError` exists for the cases that have no control
to sit beside; do not reach for it first.

A toast is for news about work the visitor is no longer watching: an upload
that finished, a collaborator who joined, a save that completed after they
moved on. If they are still looking at the control, the message belongs
beside it instead.

The browser's `alert()` is never used. It blocks the page, cannot be styled
and cannot offer a retry.

## Which surface

| What happened                                       | Where it goes                                  | Shared piece                              |
| --------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Something the visitor just did failed               | Beside the control, with Retry if it can help  | `InlineError` with `onRetry`              |
| What they typed is not valid                        | Beside the field, no Retry (they correct it)   | `InlineError` without `onRetry`           |
| They must choose before anything continues          | Dialog                                         | `showConfirm`, `showPrompt`               |
| Something finished in the background                | Toast                                          | `useSnackbar`                             |
| The visitor cancelled (closed the wallet prompt)    | Nothing. Cancelling is a choice, not a failure | none                                      |
| A lasting state of the page (offline, reconnecting) | A status notice where that state is shown      | the surface's own notice, as in the lobby |

`InlineError` is in `@ui/components/InlineError`, the dialogs in
`@components/Dialogs` and `useSnackbar` in `@components/Snackbar`. In a world, a
failure that belongs to the dock rather than one control (asking to speak with
no moderator around) goes in `ExperienceShell`'s `notice` slot above the dock;
in world settings, a failed save uses `useSaveFailure` from the settings
`ActionsContext`, shown under Save.

## The inline error

`frontend/ui/components/InlineError` is one row: the message and an optional
outline action. It has `role="alert"`, so screen readers announce it when it
appears. It renders nothing while `message` is empty, so it can stay in the
markup.

```tsx
import InlineError from "@ui/components/InlineError";

const [failed, setFailed] = useState(false);

async function save() {
    setFailed(false); // the visitor is trying again
    try {
        await store.save(value);
    } catch (error) {
        console.error(error);
        setFailed(true);
    }
}

<SaveButton onClick={save} />
<InlineError message={failed && "Couldn't save your change."} onRetry={save} />
```

-   Put it directly after the control or field, inside the same panel.
-   Write one short sentence that says what failed: "Couldn't save the
    title." Keep the service's own message when it explains more than you
    can, as the purchase flow does.
-   Pass `onRetry` when the same action can succeed on a second try. Leave it
    out for validation, where the visitor has to change something first.
-   Clear the message when the visitor retries, and when the thing it was
    about changes (another artwork, a new listing).
-   Hide it while the retry is running, so the old failure is not on screen
    next to "Saving…".
-   It is styled for dark surfaces from `@styles/tokens`. Pass
    `surface="light"` on the few legacy light panels. The action should move
    to the shared outline button primitive in `@styles/brand` once that
    exists.

## Worked examples

-   Buying and making an offer on an artwork:
    `frontend/components/modals/ArtworkInfo/C/components/ArtworkContext.tsx`
    keeps the failure as `orderError` and `OrderInfo.tsx` shows it under the
    Buy now / Make Offer controls. Retry buys again, or submits the same
    offer amount. A closed wallet prompt ends silently (`isWalletCancel`).
    An invalid offer amount is explained under the amount field, without
    Retry.
-   Studio space details
    (`frontend/features/studio/StudioMenu/SpaceSettings/Forms/Details`):
    every keystroke saves, so a failed save is shown under its field until a
    save of that field succeeds. Retry saves what the field shows now.
-   Studio visitor picture
    (`frontend/features/studio/StudioMenu/SpaceSettings/Forms/Pfp`): the
    failure sits above the picker, and Retry saves the same picture.

Most call sites were written before this rule and still use `showError`, a
toast or `alert()`. Move them when you work on that screen; do not add new
ones.
