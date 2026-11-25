# Purchases

How a game sells something. Written for whoever is building the game, person
or coding agent. Overview of games: [../games.md](../games.md).

**Status: built, and off by default.** Two payment rails exist: play money
for development (`test`), and the visitor's own wallet sending a dollar
token, which the server reads back from the chain (`wallet`). The wallet
rail has been run against a stand-in node, not yet against a real chain
with a real wallet.

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

`useGamePurchases` (`frontend/features/games/useGamePurchases.tsx`) opens
the **payment sidebar**: the lobby's glass utility panel, docked to the
right edge on a wide screen so the game stays in view, and a bottom sheet
on a phone (`gamePurchaseStyles.tsx`, built from the design system).

-   It reads the request, looks the product up in the synced file and
    shows the name, the game's title, the price and the visitor's balance.
    Cancel, the close button and Escape all answer `cancelled`. The game is
    a frame, so a click on it never reaches the page and does not close
    the sidebar.
-   A guest is offered the site's own sign-in sheet; purchases belong to the
    signed-in account, whichever way it signed in. There is no second login.
    The game page learns who is signed in from the route's server props
    (`pages/games/[game].tsx`), as every other page does.
-   A wallet smaller than the price is offered a top-up, and the question
    stays open.

**The wallet is part of the account, not of the game page.** The balance,
adding funds and everything the visitor bought, in every game, are the
Wallet step of the account dashboard
(`components/modals/AccountDashboard/Wallet`), shown where purchases are
on. The sidebar links to it and reads the balance again when it closes
(`openWalletDashboard.tsx`). A game page draws no wallet button.

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

`PaymentRail` in `frontend/utils/firestore/gamePurchases.ts` is the whole
interface, and `railFor` in `pages/api/_v2/gamePurchases/rail.ts` picks the
rail from `GAMES_PURCHASES`:

| Value    | Meaning                                                                                |
| -------- | -------------------------------------------------------------------------------------- |
| blank    | Off: `buy()` answers `unavailable`. On the development server, blank is `test`.        |
| `test`   | Play money kept by the site, up to $100, added $10 at a time. Never redeemable.        |
| `wallet` | The visitor's own wallet pays. Needs every chain setting below; with one missing, off. |

Any other value is off, so a typo never opens a rail. Purchases also need
game pages to be on (`GAMES_PREVIEW=1` or the development server).

A rail is one of two kinds. One holds the visitor's money and takes it
(`balance`, `pay`): the test rail. The other the visitor pays themselves
(`request`, `verify`): the wallet rail.

### Paying from your own wallet

No balance is kept and no wallet is created: the visitor pays each purchase
from a wallet they already have, chosen for that payment only
(`dApp/paymentWallet.tsx`; paying never changes who is signed in).

1. The page asks to buy. The server opens the order and answers
   `payment-required` with the one transfer that pays for it: the token
   contract, the amount, and the transaction's exact data.
2. The visitor's wallet sends it (`features/games/payWithWallet.ts`): it is
   switched to the right network, checked for enough of the token (said in
   dollars if not), and asked to send. Refusing in the wallet leaves the
   question open with nothing sent.
3. The page shows the transaction's hash to the server, which reads it from
   the chain (`frontend/utils/purchaseChain.ts`). `payment-pending` means
   not there or not confirmed yet, and the page asks again for up to two
   minutes.
4. Once the chain shows it, the order is paid and the game is told.

The transaction is an ordinary token `transfer(recipient, amount)` with 32
more bytes after its arguments: the order's reference, which only that
account's order has. A token ignores the extra bytes. The server accepts a
transaction only when it was sent to the token contract with exactly that
data, succeeded with the confirmations asked for, and the token logged that
transfer. So a transfer made by someone else, for another order or for a
cheaper product can never be claimed, and the paying wallet does not have
to be linked to the account.

A sent payment is remembered in the browser until its order is finished
(the hash only). Closing the tab between sending and the chain showing it
does not cost the item: the next time the product is asked for, the sidebar
says a payment was already sent and finishes that one.

Settings (`frontend/.env.example`; read by `walletPaymentConfig` in
`features/games/walletPayment.ts`):

| Variable                       | Meaning                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `GAMES_PURCHASE_CHAIN_ID`      | The chain's id.                                                 |
| `GAMES_PURCHASE_CHAIN_NAME`    | Its name as visitors read it.                                   |
| `GAMES_PURCHASE_RPC_URL`       | An https node the server reads from. Never sent to a browser.   |
| `GAMES_PURCHASE_TOKEN`         | The dollar token's contract (six decimals, as USDC has).        |
| `GAMES_PURCHASE_TOKEN_SYMBOL`  | What visitors call it. Blank is USDC.                           |
| `GAMES_PURCHASE_RECIPIENT`     | The address every purchase is paid to. An address, never a key. |
| `GAMES_PURCHASE_CONFIRMATIONS` | Blocks on top of a transfer before it counts. Blank is 1.       |

Known limits, on purpose for a first version:

-   Any EVM chain, one at a time. A wallet that does not know the chain is
    told to switch to it by name; it is not added for them.
-   Wallets that send from their own address. A contract wallet that wraps
    the call sends different data and is refused.
-   Every purchase is paid to one address. Each sale records Oncyber's share
    and the seller's (`feeCents`, `sellerCents`); nothing is paid on to a
    creator yet.
-   No refunds from the site: a refund is a transfer back, made by hand.

A wallet made for the visitor inside the site, with card top-ups, is a
later rail behind the same interface.
