# State machines

Where a feature moves through a fixed set of states, the states and the legal
moves between them live in one place. This page says how that is written here
and lists the machines that already follow it.

## The pattern

No state library. Each machine is three small things beside its feature:

1. **One named state**: a union or a snapshot type, exported.
2. **A pure transition function**, `transition(state, event)`, in its own
   file. It imports no React, starts no timers and does no I/O. When an event
   does not apply in the current state it returns the same object, so callers
   can skip the update.
3. **A table-driven test** next to it.

The hook, context or class that already owns the feature keeps its public API
and keeps everything that touches the outside world (timers, sockets, frames,
`postMessage`). It builds an event, calls the transition and applies the
result. `useLobbyJourney.ts` is the worked example.

Where the same vocabulary is needed on two sides of a boundary (lobby and
destination frame, browser and realtime server), declare it once in the shared
protocol module and import it on both sides instead of retyping the strings.

A machine that renders UI puts its state on its root element as
`data-machine="<name>" data-state="<state>"` (for example
`[data-machine="space-connection"][data-state="connected"]`), so browser
tests and agents wait on the state instead of guessing from text and timing.
Today: `lobby-journey` (the lobby surface), `space-connection`, `space-panel` (`none` when no panel is open),
`purchase` and `upload`.

## Index

| Machine                     | Definition                                                                                               | States                                                                                                | Owner of side effects                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Lobby travel journey        | `frontend/features/lobby/lobbyJourneyMachine.ts`                                                         | idle, loading, ready, entering, revealing, entered, returning, error                                  | `frontend/features/lobby/useLobbyJourney.ts`                                                                                    |
| Enter key owner             | `frontend/features/lobby/lobbyEnterKey.ts`                                                               | lobby-chat, enter-world, party-chat, space-chat, none (while travelling)                              | `frontend/features/lobby/Lobby.tsx`; the space's own chat: `frontend/components/_3DExhibit-v2/displyUI/DisplayScene.tsx`        |
| Lobby/destination handshake | `frontend/features/lobby/lobbyJourneyProtocol.ts`                                                        | host commands: enter, stage-reveal, reveal, dispose; destination messages: `LobbyDestinationMessage`  | host: `useLobbyJourney.ts`; destination: `frontend/utils/lobbyDestinationBridge.ts`                                             |
| Group trip status           | `multiplayer/protocol/lobby-groups.js` (types in `lobby-groups.d.ts`)                                    | inviting, preparing, gathering, travelling, complete, cancelled                                       | server: `multiplayer/src/world/groups.ts`; client: `frontend/features/lobby/useLobbyGroupJourney.ts`                            |
| Lobby connection            | `frontend/features/lobby/LobbyConnection.ts`                                                             | status: connecting, connected, offline; stop reason: replaced, removed; plus a typed connection phase | the same class                                                                                                                  |
| Space panel                 | `frontend/components/_3DExhibit-v2/ui/ControlPanel/context/spacePanelMachine.ts`                         | one open panel, `""` for none: a control-panel tab (`PanelTab`) or the dock's emotes, more, search    | `PanelProvider.tsx` beside it holds the value; focus and dismissal: `frontend/features/content-host/NativeExperienceChrome.tsx` |
| Space connection            | `frontend/components/_3DExhibit-v2/context/multiplayerConnection.ts`                                     | idle, connecting, connected, failed, lost; endings: removed, password-changed, inactive               | `MultiplayerProvider.tsx` beside it; `lost` is reported by `hooks/useRoom.tsx`                                                  |
| Artwork purchase            | `frontend/components/modals/ArtworkInfo/C/components/purchaseMachine.ts`                                 | idle, confirming, waiting (overlay closed, order still going), succeeded, failed                      | `ArtworkContext.tsx` beside it (wallet, marketplace, analytics)                                                                 |
| Space upload deploy         | `frontend/features/spaces/create/components/DestinationSelector/Uploader/Modals/Loader/uploadMachine.ts` | deploying, deployed, failed; each of three steps todo, progress, success, error                       | the upload window, `Modals/Loader/index.tsx` beside it, which keeps what finished steps produced                                |
| World voice                 | `frontend/components/_3DExhibit-v2/context/hooks/voiceMachine.ts`                                        | disabled (remembering a request that expired or was withdrawn), pending, enabled                      | `hooks/useVoice.tsx` beside it, which owns the provider and the request's two-minute timer                                      |

The group trip and the lobby connection have their vocabulary in one place but
not yet a single transition function.

What a visitor is told about a connection is one of three states everywhere:
`ConnectionState` in `frontend/ui/components/ConnectionStatus.tsx` (connecting,
connected, offline). The lobby, spaces and embedded worlds each map their own state
onto it and show it with that component.

## Adding one

-   Extract first with behaviour unchanged: the existing tests for the hook or
    class must pass untouched. Fix defects the extraction exposes in a separate
    change.
-   Keep per-frame code allocation-free: in the 3D engine a derived mode should
    be a number or a string, not a new object.
-   Add a row to the index above.
-   If it renders UI, put `data-machine` and `data-state` on its root element.
