# Purchases

How a game sells something. Written for whoever is building the game, person
or coding agent. Overview of games: [../games.md](../games.md).

**Status: the flow is built and runs on play money only.** No real money
moves yet: the one payment rail is the test rail below. The rail that pays
from a visitor's wallet in USDC is added behind the same interface.

## The rule

**Declare every product. Ask the page to sell it. Grant only what the page
says was bought.**

1. Every product has an id, a name, a price and a kind in `game.json` under
   `products`. A product that is not declared cannot be sold.
2. The game asks with `buy(product)`. The page, never the game, shows the
   name and the price and takes the visitor's yes or no. A game draws no
   payment screen and never asks for a card, a wallet or a password.
3. The price charged is the declared one. Nothing a game sends at run time
   sets a price or a name.
4. Grant the item only when the answer says `bought: true`. Every other
   answer means nothing was bought.

A game never learns the visitor's balance, address or payment details, and
gets no answer about any other game's products.

## Declare

```json
{
    "name": "ACE! Tennis",
    "products": {
        "gold-racket": {
            "name": "Gold racket",
            "price": "2.50",
            "kind": "permanent"
        },
        "coins-100": {
            "name": "100 coins",
            "price": "0.99",
            "kind": "consumable"
        }
    }
}
```

| Field   | Meaning                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| id      | Lowercase letters, digits and dashes, starting with a letter, 32 characters at most. 32 products at most.          |
| `name`  | What the visitor is asked to buy, 1 to 40 characters.                                                              |
| `price` | US dollars as text: `"0.99"`, `"5"`. From `"0.10"` to `"100.00"`. Text, so nothing is rounded.                     |
| `kind`  | `permanent`: bought once, kept for good, on every device. `consumable`: can be bought again; the game keeps count. |

After editing `products`, run `node scripts/games/products.mjs sync` and
commit `frontend/features/games/products.declared.json`. The page and the
server know a game's products, and what to charge, only through that file;
`pnpm games:check` fails with `PRODUCTS_NOT_SYNCED` when it is out of date
and `PRODUCTS_INVALID` when a product breaks the table above.

A consumable is the game's to count: when `buy()` answers `bought: true`,
add what was bought to a saved value ([saved-data.md](saved-data.md)).

## Ask from a game

```js
import { connectPurchases } from "@oncyber/game-runtime/purchases";
import manifest from "../game.json";

const purchases = connectPurchases({ products: manifest.products });

const outcome = await purchases.buy("gold-racket");
if (outcome.bought) unlockGoldRacket(outcome.order);
else if (outcome.reason !== "cancelled") showCouldNotBuy();

const owned = await purchases.owned(); // ["gold-racket"]
```

-   `buy()` never rejects. It resolves when the visitor has answered and the
    payment has gone through or not. While it is open the page pauses the
    game ([loading-and-pausing.md](loading-and-pausing.md)).
-   One purchase at a time: a second `buy()` while one is open answers
    `busy` without asking the visitor.
-   `owned()` lists the permanent products this visitor holds. Call it when
    the game starts; do not keep ownership in saved data.
-   Opened on its own (a dev server, no page), `buy()` approves without
    charging anything, so the game's own flow can be built and tried. Pass
    `standalone: "refuse"` to try the other path.
-   Put `purchases.inspect()` (`{ asked, bought, pending }`) in the game's
    `inspect()` so scenarios can assert on it.

Reasons a purchase did not happen (`outcome.reason`):

| Reason               | Meaning                                             |
| -------------------- | --------------------------------------------------- |
| `cancelled`          | The visitor said no, or closed the question.        |
| `undeclared`         | The product is not in `game.json`.                  |
| `invalid`            | A malformed request.                                |
| `busy`               | Another purchase is already being confirmed.        |
| `already-owned`      | A permanent product this visitor has.               |
| `insufficient-funds` | The wallet holds less than the price.               |
| `payment-failed`     | The payment was tried and did not go through.       |
| `unavailable`        | Purchases are off here, or the page did not answer. |

Show nothing for `cancelled`. For the rest, say it could not be bought and
let the visitor ask again; never retry without them.

## The messages

| From | Kind              | Meaning                                                                     |
| ---- | ----------------- | --------------------------------------------------------------------------- |
| game | `purchase`        | `{ request, product }`: ask the page to sell one declared product.          |
| page | `purchase-result` | `{ request, bought: true, order }` or `{ request, bought: false, reason }`. |
| game | `owned`           | `{ request }`: which permanent products does this visitor hold?             |
| page | `owned-result`    | `{ request, products }`.                                                    |

The rules live in one file with no imports,
`games/runtime/src/purchases.ts`; the page and the server load it as it is.

## What the page does

`useGamePurchases` (`frontend/features/games/useGamePurchases.tsx`):

-   Reads the request, looks the product up in the synced file and shows its
    own sheet: "Buy Gold racket?", the game's title, the price, the
    visitor's balance. Cancel, Escape and a click outside all answer
    `cancelled`.
-   A guest is offered the site's own sign-in sheet; purchases belong to the
    signed-in account, whichever way it signed in. There is no second login.
    The game page learns who is signed in from the route's server props
    (`pages/games/[game].tsx`), as every other page does.
-   A wallet smaller than the price is offered a top-up, and the question
    stays open.
-   Shows a **Wallet** button beside Credits for a game that sells
    something: the balance and what the visitor bought, in every game.

## What the server does

RPC procedures in `frontend/pages/api/_v2/gamePurchases/`, same-origin only
and all needing a session: `wallet`, `buy`, `owned`, `history`,
`addTestFunds`. Everything is stored under the signed-in account
(`frontend/utils/firestore/gamePurchases.ts`):

```
gameWallets/<userId>/orders/<order>          one purchase, any state
gameWallets/<userId>/owned/<game>_<product>  a permanent product held
gameSales/<game>/sales/<userId>_<order>      the same sale, by game
```

A purchase is three steps: the order is written `pending`, the rail is
paid, the order is written `paid` with what was bought. An order has one
payment id for its whole life and a rail charges a payment id once, so a
retry, a second tab or a crash between steps never charges twice. A
permanent product has one order per visitor, so two asks for it at once pay
once.

Each sale records `feeCents` (Oncyber's share, `GAMES_PURCHASE_FEE_PERCENT`,
0 when blank) and `sellerCents`. Nothing is paid out to a creator yet, and
a game published from outside the repository
([publishing.md](publishing.md)) cannot sell yet: its products are not in
the synced file.

## Payment rails

`PaymentRail` in `gamePurchases.ts` is the whole interface: `balance(userId)`
and `pay({ payment, userId, cents, ... })`, where paying the same `payment`
twice charges once. `railFor` in `pages/api/_v2/gamePurchases/rail.ts` picks
the rail from `GAMES_PURCHASES`:

| Value  | Meaning                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| blank  | Off: `buy()` answers `unavailable`. On the development server, blank is `test`. |
| `test` | Play money kept by the site, up to $100, added $10 at a time. Never redeemable. |

Any other value is off, so a typo never opens a rail. Purchases also need
game pages to be on (`GAMES_PREVIEW=1` or the development server).
