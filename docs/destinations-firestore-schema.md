# Firestore `destinations` Collection Schema

> This document describes the Firestore collection that replaces the MongoDB `Destination` model.

## Collection path

```
/destinations/{destinationId}
```

## Document fields

| Field | Type | Required | Indexed | Notes |
|-------|------|----------|---------|-------|
| `slug` | `string` | Yes | Single-field (unique by convention) | URL identifier — must be unique across all docs |
| `name` | `string` | Yes | No | Display name |
| `description` | `string` | Yes | No | |
| `status` | `string` | Yes | Single-field | One of: `tested`, `submitted`, `rejected`, `verified`, `active` |
| `tag` | `array<string>` | Yes | array-contains | Tag values: `featured`, `curated`, `factory`, `free`, `collectibles`, `uploaded`, `andfriends`, `factory-polygon`, `active` |
| `userId` | `string` | Yes | Composite (see indexes) | Denormalized from `author.userId` for efficient user queries |
| `author` | `map` | Yes | No | `{ id, userId, email?, username?, name?, twitter? }` |
| `params` | `map` | No | No | Room/scene configuration object |
| `path` | `string` | No | No | Main 3D model path |
| `path_low` | `string` | No | No | Low-quality model path |
| `path_mid` | `string` | No | No | Mid-quality model path |
| `original_path` | `string` | No | No | Original uploaded path |
| `paths` | `map` | No | No | `{ low, mid, high }` |
| `spline` | `string` | No | No | |
| `animation_url` | `string` | No | No | |
| `image` | `string` | No | No | |
| `thumbnail` | `string` | No | No | |
| `openSeaUrl` | `string` | No | No | |
| `destHash` | `string` | No | No | |
| `animationHash` | `string` | No | No | |
| `thumbHash` | `string` | No | No | |
| `ipfsHashMetadata` | `string` | No | No | |
| `contractName` | `string` | No | No | |
| `contract_address` | `string` | No | No | |
| `token_id` | `string` | No | Single-field | |
| `nonFungible` | `boolean` | No | No | |
| `quantity` | `number` | No | No | |
| `preMinted` | `boolean` | No | No | |
| `personalMinted` | `boolean` | No | No | |
| `price` | `string` | No | No | |
| `max_number_of_tokens` | `number` | No | No | |
| `numberOfEditions` | `number` | No | No | |
| `distributionType` | `string` | No | No | |
| `collectionName` | `string` | No | No | |
| `isClaimActive` | `boolean` | No | Composite (see indexes) | |
| `whitelist_url` | `string` | No | No | |
| `shareCyber` | `number` | No | No | |
| `startTime` | `string` | No | No | ISO 8601 |
| `endTime` | `string` | No | Composite (see indexes) | ISO 8601 |
| `nbElements` | `number` | No | No | |
| `created_at` | `timestamp` | Yes | Composite (see indexes) | Auto-set on creation |
| `updated_at` | `timestamp` | Yes | No | Auto-set on creation and update |

## How tall avatars stand (`params.avatarSize`)

A destination says how tall avatars stand in it, in its own units: a size
from 0 to 1 across the 1 to 4.5 units an avatar can stand
(`components/_3DExhibit-v2/three/utils/avatarHeight.ts`). A space may set
its own and wins. A destination that sets none stands avatars with their
eyes at its `params.user_height`.

**The height has to fit the world's doors.** A destination is rarely
modelled at one unit to the metre, and the eye height a builder chose for
the camera does not say how big the houses are. Measure what a person
stands next to (doors first, then windowsills, furniture, lamps) and set
the height so an avatar is about three quarters of a typical door.

```sh
pnpm world destination avatar-height <slug>            # what it is now, and why
pnpm world destination avatar-height <slug> <height>   # in the world's units
pnpm world destination avatar-height <slug> unset
```

The destination's owner may set it, and so may Oncyber's site admins
(`destinations.setAvatarHeight`, which writes that one number and nothing
else of the settings). Every space built on the destination follows on its
next load, on every deployment that reads this database.

Worked case, the Starry Night dome (`thestarrynight_skydome`): its eye
height of 2.3 stood avatars 2.47 units tall, about half the height of its
doors. Its 83 doors have a median height of 5.3 units, its easel is 4.4
tall and a street lamp 11.7: about 2.3 times life size. Avatars stand 4.0
there.

## Required composite indexes

See `firestore.indexes.json` for the full configuration. Key composites:

1. **userId + created_at desc** — user's spaces, sorted newest first
2. **tag (array-contains) + created_at desc** — browse by tag
3. **isClaimActive + endTime asc** — upcoming events
4. **status + created_at desc** — filter by review status

## Uniqueness constraints

Firestore does not natively enforce unique fields. Slug uniqueness is
enforced in application code via a check-then-write pattern (query for
existing slug before creating).

## Migration from MongoDB

The Firestore document ID replaces MongoDB's `_id`. When returning data
to the frontend, the helper functions attach `_id: doc.id` to maintain
backward compatibility with existing UI code that references `_id`.
