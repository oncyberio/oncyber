# Trusted party avatars in lobby travel

The lobby renderer receives current connection IDs for self and authenticated party members. It does not match display names, wallet IDs, browser-selected `userId`, or arbitrary participant IDs. The mapping is presentation metadata; it grants no room admission and makes no privacy claim about the lobby's chat or voice.

## Deployment

Set the same server-only `LOBBY_IDENTITY_SECRET` (a cryptographically random value of at least 32 characters) on the Oncyber frontend server and every dedicated v1/v2 lobby service. Do not use a `NEXT_PUBLIC_` variable or send the secret to browsers. Set `SOCIAL_SERVICE_URL` and `SOCIAL_SERVICE_SECRET` for durable parties and actual destination admission. Configure the lobby endpoint's `protocol` explicitly as `1` or `2` in the deployment-owned `NEXT_PUBLIC_LOBBY_REGIONS` configuration.

`POST /api/social/lobby-identity` authenticates the existing account, follows canonical account redirects, requires the host origin and issues a two-minute proof. It contains only an HMAC-derived lobby-scoped pseudonym and timing/audience claims. A dedicated lobby join verifies that proof and stamps `partyIdentity` on the server-owned profile. Profile updates cannot change that stamp. The signed proof, canonical account ID and account login token are never included in the roster. The dedicated v1/v2 join no longer sends the account login token; it sends only the scoped proof. Legacy lobby connections retain their existing transport contract and are not treated as verified party identities.

The browser renews the proof on each actual join or replacement ticket request. Lookup is bounded to two seconds. Missing configuration, expired/invalid proof or an unavailable BFF leaves party identity unknown while ordinary guest lobby presentation remains available. Rotation requires connected clients to rejoin before the new pseudonyms match. No secrets or deployed services were changed by this implementation.

`GET /api/social/lobby-party` authenticates the canonical caller and reads their durable party. It returns only scoped member pseudonyms, the caller's leader flag, an opaque party ID and the current destination. It does not expose invitations, raw account IDs or the global graph. Party membership is refreshed every five seconds; failures and account changes clear previously approved avatar matches.

## Host contract

```ts
const group = useLobbyTravelParty({
    enabled: authenticated && !isAnonymous,
    players: social.players,
    identityKey: user?.id,
});
// group.partyIds are trusted current participant.id values, including self.
// Normal Explore remains a per-visitor preview/entry.
await group.refresh().catch(() => {});
journey.select(selectedDestination);
```

The hook retains one current avatar per matched party member. It always retains self. It never invents remote avatars for absent members, and members outside the server's visible roster remain absent. Account changes, late responses and conflicting refresh generations cannot initiate a move under a new account. This visual selection is host-owned and is not exported to embedded builder code.

Normal Explore remains a per-visitor preview and entry, including when that visitor belongs to a party. The cinematic retains avatars matched to the current authenticated group as local presentation only. It does not signal those peers to travel, reserve a place for them in a native gallery, or establish that they arrived. Each visitor follows the destination's existing admission path. A party member can separately choose the party panel's explicit follow action for an already allocated canonical destination. The panel keeps create/invite/accept/leave/follow controls and hides its current-world move button because the lobby has no selected current experience.

The exported `prepareTravel` helper is retained and tested for a future explicit group-move action, rather than normal Explore. That helper passes solo selections through, allows members to follow the existing allocated destination and requires a leader move to reserve a new group destination before preparation. It rejects unsupported group destinations; normal Explore does not call it.

Group allocation for native galleries and embedded content is not available yet; the allocator returns an explicit error and return an explicit error before reserving seats. A destination must also support the lobby's preparation/entry handshake to complete a cinematic group transfer. The identity mapping does not pretend that an unsupported destination or an unconnected member has joined. The lobby should remain available until actual destination entry is acknowledged.

## Verification

Targeted tests cover canonical actor derivation, host-origin checks, proof expiry/tampering, no raw account IDs in private membership responses, forged profile fields, account-switch races, stale membership failure, exact group destination selection and bounded proof lookup. Retained real WebSocket tests cover v1 and both single-port and cross-worker v2 identity stamping and immutable profile identity. Signed-in two-account travel against deployed services remains an acceptance step; this work does not claim that a visual isolation preview establishes multiplayer connectivity or private chat.
