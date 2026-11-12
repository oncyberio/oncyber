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
