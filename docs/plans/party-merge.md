# One party or two: a merge plan

For the owner's decision; no code is changed. Written on 10 November 2026 from
a read of both systems on `claude/ui-review-fixes`. Anything marked
_(inference)_ was deduced, not read. The service that stores world parties is
not in this repository, so its rules are known only from the requests sent to
it and the messages shown for its errors.

## 1. What is true today

Oncyber has two unrelated features that both say "Party". A **lobby party** is
made in the lobby chat by anyone there, guests included. It has a name, a
private chat and trips that each member accepts, and it is gone when you reload
or close the tab. A **world party** belongs to your account. It is made in the
People panel, has a leader who invites friends and chooses the world, and it is
still there on your next visit. A signed-in visitor in the lobby sees both at
once, in two panels, under the same word and the same buttons, and can be in up
to four lobby parties and one world party with different people in each. The
two know nothing about each other and do not reach the same places: a lobby
party arrives together only in a classic gallery, and a world party can be
brought only to a hosted world. So "my party" has no single answer, and choosing
a world "for the party" can fail or invite the wrong people.

## 2. The two systems side by side

|                            | Lobby party                                                                                | World party                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Made where, by whom        | Lobby chat; anyone present, guests included                                                | People panel, in the lobby and in hosted worlds; signed-in accounts only                                                               |
| Who you are in it          | Your connection to the lobby, new after every reload                                       | Your account                                                                                                                        |
| Size                       | 8 people; you can be in 4 at once                                                          | 8 people; one at a time                                                                                                             |
| Lives until                | The last member leaves or disconnects                                                      | Its members leave _(inference; no time limit is visible from here)_                                                                 |
| Roles                      | The creator invites; any member proposes a trip                                            | The leader invites and chooses the world                                                                                            |
| Joining                    | Invitation to someone present (2 minutes) or a share link; each needs "Join party"         | The leader invites a friend, who accepts                                                                                            |
| Chat                       | Private party chat, last 24 messages                                                       | None of its own                                                                                                                     |
| Trip and consent           | Any member picks a world; each member answers "Join trip" or "Stay here" within 30 seconds | The leader presses "Bring party to this world"; a seat is reserved for every member, nobody is asked, each follows when they choose |
| Worlds it reaches together | Classic galleries, same room; hosted worlds refuse ("This world opens in its own page")       | hosted worlds only, and not those built as code projects                                                                               |
| Dropped connection         | Removed at once; on an accepted trip the place is kept 10 seconds                          | Nothing changes                                                                                                                     |
| Stored                     | Nothing; lobby server memory only _(inference: a server restart ends them all)_            | Party, members and invitations, in the account database                                                                             |
| How it talks               | Messages on the lobby's live connection                                                    | Web requests, read again every 4 to 5 seconds                                                                                       |
| How the lobby knows        | The lobby server runs it                                                                   | Asks for your world party every 5 seconds; matches members to avatars by a verified proof of sign-in                                |
| How the world knows        | A gallery gets a tag for the trip so travellers share a room                               | On entry you are placed in the world party's reserved room                                                                          |

**Where they already touch**

1. **Two panels, one word.** The lobby chat lists lobby parties; the People
   panel shows the world party. Nothing tells them apart.
2. **"Join party's world" can invite the wrong party.** Pressed in the lobby
   while a lobby party chat is selected, it proposes that hosted world as a lobby
   party trip, which is then cancelled for everyone. _(Read in the code, not
   run.)_
3. **The departure scene shows people who are not coming.** When you leave the
   lobby alone, world party members standing in the lobby are drawn beside you,
   but they are not moved.
4. **One proof of sign-in serves both.** Added to recognise world party
   members, it also gives a dropped lobby party traveller their place back.
5. **A link built but switched off.** Tested code lets a world party leader
   move the party from the lobby's Explore list. Nothing calls it.

## 3. What "one party" could mean

**A. One party on the account, shown in the lobby.** The world party becomes
the only party. It survives a reload, and the lobby shows it and runs its
trips. The lobby party keeps its trips and its chat, and loses its own
membership, share links and guests. The world party keeps its record, leader
and reserved rooms, and must gain a name, a chat and a way into classic
galleries.

**B. The lobby party becomes a world party on arrival.** You make a party in
the lobby as today. When a trip goes to a hosted world, its travellers are
enrolled in a world party with one reserved room. The lobby party keeps
everything; the world party keeps its storage and rooms and loses its controls
in the lobby. It needs hosted worlds to open inside the lobby, which they refuse
today.

**C. Two systems, one face.** Nothing merges underneath. The lobby shows one
party list, with the world party as one row in it and a tag on each row saying
which kind it is, and offers for each world only the trip that works there.
Both systems keep everything. A visitor can still be in two parties with
different people, but can see it.

|                   | A. One account party                                                                                                  | B. Lobby party becomes world party                                              | C. Two systems, one face                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Stored data       | None to move; lobby parties store nothing                                                                             | A new link between a lobby party and the world party made from it               | None                                                                 |
| Lobby messages    | Create, invite, join and leave retired; the lobby server must learn world party membership, which it never asks today | Unchanged, plus a hand-over at arrival and on return                            | Unchanged                                                            |
| Guests            | Lose parties unless the world party service accepts guests; it refuses signed-out callers today                       | Can form a lobby party but not take it to a hosted world                          | Unaffected                                                           |
| Limit of 8        | Same on both; being in four at once ends                                                                              | Same; a traveller already in another world party blocks the hand-over           | Same; four at once and one at a time stay different                  |
| Leader or consent | Choose one, or let a leader propose and members agree                                                                 | Proposer becomes leader _(inference)_; friends-only invitations are waived      | Both remain, each where it applies                                   |
| Size              | Large                                                                                                                 | Large                                                                           | Small; medium if choosing a world becomes aware of the kind of world |
| Main risk         | Depends on a service outside this repository; removes guest parties                                                   | Hand-over during travel, the most fragile moment; two records that can disagree | Stops at "looks like one"; the real merge is never done              |

## 4. Recommendation

Do **C now** and treat **A as the destination**, subject to your answers to
questions 1 to 3. The two systems reach different worlds, so retiring either
today removes something that works, and both real merges wait on slow work: A
on the world party service outside this repository, B on hosted worlds opening
inside the lobby. C removes the confusion with interface changes only, and
nothing in it has to be undone to reach A. A is a better end than B because an
hosted world opens in its own page, where the lobby connection and every lobby
party with it are gone _(inference: the lobby is part of the landing page)_,
so only a party kept on the account can follow a visitor there.

**First reversible step.** Show the world party in the lobby chat's party list
instead of the People panel, with a tag on each row: "this visit" or "saved to
your account". It changes no server, no messages and no stored data, so one
revert restores today's layout.

**Whatever you choose,** touch points 2 and 3 mislead visitors today and are
worth fixing.

## 5. Questions only you can answer

1. May a guest without an account be in a party? (Lobby party: yes. World
   party: no.)
2. Should a party survive a reload or a closed tab? (Lobby party: no. World
   party: yes.)
3. Does a leader decide where the party goes, does each member agree to each
   trip, or both?
4. One party at a time, or several? (Today: four lobby parties and one world
   party.)
5. Who may be invited: anyone in the lobby or with a link, or friends only?
6. Should a party have a name and its own chat everywhere, including inside
   hosted worlds?
7. Is opening hosted worlds from inside the lobby a priority? B is impossible
   without it.
8. Who looks after the world party service, and can its rules change? A cannot
   start without them.

## Appendix: files and endpoints

**Lobby party** (called "groups" in the code)

-   Rules, on the lobby server: `multiplayer/src/world/groups.ts`. Wiring:
    `multiplayer/src/world/server.ts`, `multiplayer/src/world/gateway.ts`. Only
    the newer lobby server has it; `multiplayer/src/rooms/crowd/` does not.
-   Messages: `multiplayer/protocol/lobby-groups.d.ts` and `.js`,
    `multiplayer/protocol/group-location.d.ts` and `.js`. The browser sends
    `lobby-group-action` (create, invite, respond-invite, join, leave, message,
    travel-propose, travel-respond, travel-ready, travel-launch, travel-cancel,
    travel-entered, active-world). The server sends `lobby-groups`,
    `lobby-group-result` and `lobby-group-position`.
-   Arriving in the same gallery room: `multiplayer/src/express/groupCohort.ts`,
    `POST /join` in `multiplayer/src/express/index.ts`,
    `multiplayer/src/rooms/cyber/index.ts`, `frontend/utils/lobbyGroupContext.ts`,
    `frontend/utils/arena/index.ts`,
    `frontend/components/_3DExhibit-v2/context/hooks/useRoom.tsx`.
-   Interface, all in `frontend/features/lobby/`: `Lobby.tsx`, `LobbyChat.tsx`,
    `LobbyGroupsModal.tsx`, `LobbyGroupNotices.tsx`, `useLobbyGroupJourney.ts`,
    `lobbyGroupValidation.ts`, `lobbyGroupPresence.ts`, `LobbyConnection.ts`,
    `useLobbySocial.ts`.
-   Tests: `multiplayer/test/WorldGroups_test.ts`, `NativeGroupCohort_test.ts`,
    `NativeGroupJoin_test.ts`; `frontend/features/lobby/LobbyGroups.test.tsx`,
    `LobbyGroupsClient.test.ts`, `useLobbyGroupJourney.test.tsx`.
-   Earlier notes: the trip statuses in `docs/state-machines.md`.

**World party**

-   Interface: `frontend/features/social/PartyPanel.tsx`, shown inside the
    lobby's People panel by `frontend/features/lobby/Lobby.tsx`.
-   Endpoints in this repository: `GET` and `POST /api/social/parties` (create,
    invite, respond, leave, move, member-state) in
    `frontend/pages/api/social/parties.ts`.
-   Server helpers: `frontend/utils/partiesServer.ts`,
    `frontend/utils/partyIdentityMerge.ts`,
    `frontend/utils/accountIdentity.ts`.
-   Outside this repository: the world service (`SOCIAL_SERVICE_URL`). This repository calls its
    `/internal/parties` (read, create, invite, respond, leave, member-state,
    begin-move, finish-move, session, invalidate-destination) and its
    `/internal/oncyber/party-allocation`. Records are kept in the database
    collections `<prefix>Parties`, `<prefix>PartyMemberships` and
    `<prefix>PartyInvitations` (`SOCIAL_COLLECTION_PREFIX`, see
    `frontend/utils/socialCollections.ts`).
-   Tests: `frontend/features/social/PartyPanel.test.tsx`,
    `frontend/utils/accountIdentity.test.ts`.

**Where the two meet**

-   `frontend/features/lobby/useLobbyTravelParty.ts`, which reads
    `/api/social/lobby-party` (`frontend/pages/api/social/lobby-party.ts`) and holds
    the unused `prepareTravel`.
-   The proof of sign-in: `POST /api/social/lobby-identity`
    (`frontend/pages/api/social/lobby-identity.ts`) and
    `multiplayer/src/identity/lobby.ts`. Described in
    `docs/lobby-party-identity.md`.
-   `selectDestination` in `frontend/features/lobby/Lobby.tsx` (touch point 2).
-   `frontend/features/lobby/createLobbyScene.tsx` and `travelPresentation.ts`
    (touch point 3).
-   `frontend/pages/_app.tsx`, where a hosted world refuses to be prepared from
    the lobby.
