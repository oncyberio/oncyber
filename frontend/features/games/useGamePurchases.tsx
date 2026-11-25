import { useEffect, useRef, useState } from "react";
import GamePurchasesService from "@api/gamePurchases/_api";
import { ActionButton } from "@styles/brand";
import Icon from "@features/landing-carousel/components/Icon";
import {
    UtilityActions,
    UtilityButton,
    UtilityRow,
} from "@features/content-host/NativeVisitorPanel";
import { PurchasePanel, PurchaseSummary } from "./gamePurchaseStyles";
import { readGameMessage } from "./gameContract";
import { holdGamePause } from "./gamePause";
import {
    formatPrice,
    gameProducts,
    readPurchaseRequest,
    TEST_FUNDS,
    type Product,
    type PurchaseRefusal,
} from "./gamePurchases";
import type { WalletPaymentOutcome } from "./payWithWallet";
import {
    readWalletPaymentRequest,
    type WalletPaymentRequest,
} from "./walletPayment";

type Mode = "off" | "test" | "wallet";
interface Wallet {
    mode: Mode;
    cents: number;
    /** With the visitor's own wallet: where, and in what, they pay. */
    network?: string;
    token?: string;
}
/** The one purchase the visitor is being asked about. */
interface Ask {
    /** The game's id for its request; the answer carries it back. */
    request: string;
    product: Product;
    /** The page's id for this confirmation; a retry reuses it. */
    key: string;
    paying: boolean;
    note: string;
    /** An error to act on, or a step being waited for. */
    tone?: "error" | "info";
    /**
     * Paying from their own wallet: the transaction they sent for this
     * order. Once there is one, the order is only ever finished, never
     * paid for again.
     */
    proof?: string;
}

/** How long the page waits for a sent payment to show on the chain. */
export const PURCHASE_POLL = { ms: 3000, tries: 40 };

/**
 * What the sheet's one main button does, from what the page knows. Guests
 * sign in first; a wallet too small for the price is topped up first.
 */
export function purchaseAction(input: {
    signedIn: boolean;
    wallet: Wallet | null;
    cents: number;
}): "sign-in" | "wait" | "unavailable" | "add-funds" | "buy" {
    if (!input.signedIn) return "sign-in";
    if (!input.wallet) return "wait";
    if (input.wallet.mode === "off") return "unavailable";
    // Their own wallet holds the money; it says so itself if it is short.
    if (input.wallet.mode === "wallet") return "buy";
    return input.wallet.cents < input.cents ? "add-funds" : "buy";
}

const newKey = () => {
    const bytes = new Uint8Array(12);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * A payment the visitor's wallet sent is remembered in this browser until
 * the order it pays for is finished, so closing the tab between sending
 * and the chain showing it never costs them the item: the next time the
 * product is asked for, that same payment is finished instead of a new
 * one being asked for. The server still decides; this only keeps the hash.
 */
const sentKey = (account: string, game: string, product: string) =>
    `oncyber:purchase:${account}:${game}:${product}`;
function readSent(account: string | null, game: string, product: string) {
    if (!account) return null;
    try {
        const found = JSON.parse(
            window.localStorage.getItem(sentKey(account, game, product)) ?? ""
        );
        return typeof found?.key === "string" &&
            typeof found?.proof === "string"
            ? { key: found.key as string, proof: found.proof as string }
            : null;
    } catch {
        return null;
    }
}
function writeSent(
    account: string | null,
    game: string,
    product: string,
    sent: { key: string; proof: string } | null
) {
    if (!account) return;
    try {
        const name = sentKey(account, game, product);
        if (sent) window.localStorage.setItem(name, JSON.stringify(sent));
        else window.localStorage.removeItem(name);
    } catch {
        /* Storage is blocked: the payment is finished while the page stays. */
    }
}

const REFUSED: Partial<Record<PurchaseRefusal, string>> = {
    "insufficient-funds": "Your wallet doesn't hold enough for this.",
    "already-owned": "You already own this.",
    "payment-failed": "The payment didn't go through. Try again.",
    unavailable: "Purchases aren't available here.",
    undeclared: "This game doesn't sell that.",
};

/**
 * The page's side of purchases (docs/games/purchases.md). A game asks with
 * `purchase`; the page opens its payment sidebar on the right with the
 * declared name and price, takes the visitor's answer, pays through the
 * signed-in account's wallet and tells the game with `purchase-result`.
 * The game never draws this and never learns the balance. `owned` is
 * answered with the permanent products the visitor holds.
 *
 * The wallet itself (balance, topping up, what was bought) is part of
 * the visitor's profile, the left sidebar; this one links to it.
 */
export function useGamePurchases(options: {
    game: string;
    title: string;
    /** True for a message that came from this game's frame. */
    fromGame: (event: MessageEvent) => boolean;
    /** GamePage's sender: takes `<id>:kind` and translates it for the game. */
    send: (message: object) => void;
    /** The signed-in account id, or null for a guest. */
    account: () => string | null;
    /** Opens the site's sign-in; calls back once the visitor is signed in. */
    signIn?: (done: () => void) => void;
    /**
     * Sends a payment from the visitor's own wallet; `payWithWallet` when
     * left out.
     */
    pay?: (
        request: WalletPaymentRequest,
        userId?: string
    ) => Promise<WalletPaymentOutcome>;
    /**
     * Opens the wallet, which is part of the visitor's profile (the left
     * sidebar); resolves when it closes, so the balance shown here is read
     * again.
     */
    openWallet?: () => Promise<unknown> | void;
    /** Called when the sidebar closes, to give the game its focus. */
    onClose?: () => void;
}) {
    const { game } = options;
    const live = useRef(options);
    live.current = options;
    const products = useRef(gameProducts(game));
    const sells = Object.keys(products.current).length > 0;
    const [ask, setAsk] = useState<Ask | null>(null);
    const asking = useRef<Ask | null>(null);
    asking.current = ask;
    const [wallet, setWallet] = useState<Wallet | null>(null);
    // The profile is open over the sidebar.
    const inWallet = useRef(false);
    const [funding, setFunding] = useState(false);
    const signedIn = !!options.account();

    const answer = (
        request: string,
        outcome:
            | { bought: true; order: string }
            | { bought: false; reason: PurchaseRefusal }
    ) =>
        live.current.send({
            type: `${game}:purchase-result`,
            request,
            ...outcome,
        });

    const refreshWallet = async () => {
        if (!live.current.account()) return setWallet(null);
        try {
            setWallet(await GamePurchasesService.wallet({}));
        } catch {
            setWallet({ mode: "off", cents: 0 });
        }
    };

    // The wallet is the account's: read again whenever who is signed in changes.
    const account = options.account();
    useEffect(() => {
        if (asking.current) void refreshWallet();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account]);

    useEffect(() => {
        const receive = async (event: MessageEvent) => {
            if (!live.current.fromGame(event)) return;
            const kind = readGameMessage(event.data?.type, game)?.kind;
            if (kind === "owned") {
                const request =
                    typeof event.data.request === "string"
                        ? event.data.request.slice(0, 64)
                        : "";
                let owned: string[] = [];
                if (live.current.account() && sells)
                    try {
                        owned = (await GamePurchasesService.owned({ game }))
                            .products;
                    } catch {
                        /* Nothing is known to be owned. */
                    }
                live.current.send({
                    type: `${game}:owned-result`,
                    request,
                    products: owned,
                });
                return;
            }
            if (kind !== "purchase") return;
            const read = readPurchaseRequest(event.data);
            if (!read) {
                const request = event.data?.request;
                if (typeof request === "string")
                    answer(request.slice(0, 64), {
                        bought: false,
                        reason: "invalid",
                    });
                return;
            }
            const product = products.current[read.product];
            if (!product)
                return answer(read.request, {
                    bought: false,
                    reason: "undeclared",
                });
            // One question at a time: the visitor is never asked twice at once.
            if (asking.current)
                return answer(read.request, { bought: false, reason: "busy" });
            document.exitPointerLock?.();
            // A payment already sent for this product is finished first.
            const sent = readSent(live.current.account(), game, product.id);
            const next: Ask = sent
                ? {
                      request: read.request,
                      product,
                      ...sent,
                      paying: false,
                      note: "You already sent a payment for this. Finish the purchase to get it.",
                      tone: "info",
                  }
                : {
                      request: read.request,
                      product,
                      key: newKey(),
                      paying: false,
                      note: "",
                  };
            asking.current = next;
            setAsk(next);
            void refreshWallet();
        };
        window.addEventListener("message", receive);
        return () => {
            window.removeEventListener("message", receive);
            // The page is leaving: an open question was never answered yes.
            if (asking.current)
                answer(asking.current.request, {
                    bought: false,
                    reason: "cancelled",
                });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game]);

    const close = (reason: PurchaseRefusal = "cancelled") => {
        const open = asking.current;
        if (!open || open.paying) return;
        asking.current = null;
        setAsk(null);
        answer(open.request, { bought: false, reason });
        live.current.onClose?.();
    };

    const addFunds = async () => {
        if (funding || wallet?.mode !== "test") return;
        setFunding(true);
        try {
            const { cents } = await GamePurchasesService.addTestFunds({});
            setWallet({ mode: "test", cents });
        } catch {
            /* The balance shown stays as it was. */
        } finally {
            setFunding(false);
        }
    };

    const buy = async () => {
        let open = asking.current;
        if (!open || open.paying) return;
        const request = open.request;
        const stillOpen = () => asking.current?.request === request;
        // The sidebar while a step is under way, and when it stops short.
        const step = (note: string, more: Partial<Ask> = {}) => {
            open = { ...open!, ...more, paying: true, note, tone: "info" };
            asking.current = open;
            setAsk(open);
        };
        const stop = (more: Partial<Ask>) => {
            open = { ...open!, tone: "error", ...more, paying: false };
            asking.current = open;
            setAsk(open);
        };
        // Null is no answer at all: whether it was paid is unknown.
        const send = async (proof?: string) => {
            try {
                return await GamePurchasesService.buy({
                    game,
                    product: open!.product.id,
                    key: open!.key,
                    ...(proof ? { proof } : {}),
                });
            } catch {
                return null;
            }
        };
        const account = live.current.account();
        step("");
        let proof = open.proof;
        let outcome = await send(proof);
        if (!stillOpen()) return;

        // Their own wallet pays: send what the server asked for.
        if (
            outcome &&
            outcome.bought === false &&
            outcome.reason === "payment-required"
        ) {
            const asked = readWalletPaymentRequest(outcome.payment);
            if (!asked) return stop({ note: REFUSED["payment-failed"] });
            step("Confirm the payment in your wallet.");
            const pay =
                live.current.pay ??
                (async (wanted, userId) =>
                    (await import("./payWithWallet")).payWithWallet(wanted, {
                        userId,
                    }));
            const paid = await pay(asked, account ?? undefined).catch(
                (): WalletPaymentOutcome => ({
                    paid: false,
                    reason: "failed",
                    message: "The payment wasn’t sent. Try again.",
                })
            );
            if (!stillOpen()) return;
            if (paid.paid === false)
                return stop(
                    paid.reason === "cancelled"
                        ? { note: "", tone: undefined }
                        : { note: paid.message }
                );
            proof = paid.proof;
            writeSent(account, game, open.product.id, { key: open.key, proof });
            step("Waiting for the payment to arrive…", { proof });
            outcome = await send(proof);
            if (!stillOpen()) return;
        }
        // Sent and on its way: ask until the chain shows it.
        for (
            let tries = 0;
            proof &&
            outcome &&
            outcome.bought === false &&
            outcome.reason === "payment-pending" &&
            tries < PURCHASE_POLL.tries;
            tries++
        ) {
            if (tries === 0) step("Waiting for the payment to arrive…");
            await new Promise((done) => setTimeout(done, PURCHASE_POLL.ms));
            if (!stillOpen()) return;
            outcome = await send(proof);
            if (!stillOpen()) return;
        }
        void refreshWallet();

        if (
            !outcome ||
            (outcome.bought === false &&
                (outcome.reason === "payment-pending" ||
                    outcome.reason === "payment-required"))
        )
            // Nothing settled. The key (and a sent payment) are kept, so
            // trying again finishes this same purchase and never pays twice.
            return stop({
                note: proof
                    ? "The payment hasn’t arrived yet. Try again in a moment; you won’t pay twice."
                    : REFUSED["payment-failed"],
            });
        if (
            outcome.bought === false &&
            (outcome.reason === "payment-failed" ||
                outcome.reason === "insufficient-funds")
        ) {
            // The visitor can top up or try again without the game asking
            // anew. A payment the chain refused is forgotten, but its order
            // stays: paying again is for that same order. A refusal with
            // nothing sent is settled, so trying again is a new one.
            if (proof) writeSent(account, game, open.product.id, null);
            return stop({
                key: proof ? open.key : newKey(),
                proof: undefined,
                note: REFUSED[outcome.reason] ?? "",
            });
        }
        writeSent(account, game, open.product.id, null);
        asking.current = null;
        setAsk(null);
        // Settled: bought, or a refusal the game is told.
        answer(
            request,
            outcome as
                | { bought: true; order: string }
                | { bought: false; reason: PurchaseRefusal }
        );
        live.current.onClose?.();
    };

    const openSignIn = () => live.current.signIn?.(() => void refreshWallet());

    const openWallet = async () => {
        if (inWallet.current) return;
        inWallet.current = true;
        try {
            await live.current.openWallet?.();
        } catch {
            /* The dashboard could not open; the sidebar is as it was. */
        } finally {
            inWallet.current = false;
            // Funds may have been added there.
            void refreshWallet();
        }
    };

    // The sidebar holds the page's pause, and Escape closes it without also
    // opening the world menu.
    const covering = !!ask;
    useEffect(() => {
        if (!covering) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            // Something opened over the sidebar (the sign-in sheet, the
            // profile): Escape is its, and the question stays.
            if (
                inWallet.current ||
                document.querySelector('[role="dialog"][aria-modal="true"]')
            )
                return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };
        window.addEventListener("keydown", onKey, true);
        const resume = holdGamePause();
        return () => {
            window.removeEventListener("keydown", onKey, true);
            resume();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [covering]);

    const test = wallet?.mode === "test";
    const own = wallet?.mode === "wallet";
    const held = signedIn && test ? formatPrice(wallet.cents) : "";
    const action = ask
        ? purchaseAction({ signedIn, wallet, cents: ask.product.cents })
        : null;
    // The payment sidebar: the lobby's utility panel, docked right. The
    // game is a frame, so a click on it never reaches this page; the
    // sidebar closes by Cancel, its close button or Escape, each a no.
    const sidebar = ask && (
        <PurchasePanel
            title={`Buy ${ask.product.name}`}
            onClose={() => close()}
            closeOnClickAway={false}
        >
            <PurchaseSummary data-game-overlay="purchase">
                <p>
                    {live.current.title}
                    {ask.product.kind === "permanent" ? " · yours to keep" : ""}
                </p>
                <dl>
                    <dt>Price</dt>
                    <dd>{formatPrice(ask.product.cents)}</dd>
                    {held && (
                        <>
                            <dt>Test balance</dt>
                            <dd>{held}</dd>
                        </>
                    )}
                    {signedIn && own && (
                        <>
                            <dt>Paid with</dt>
                            <dd>
                                {wallet.token} on {wallet.network}
                            </dd>
                        </>
                    )}
                </dl>
                <p
                    className="purchase-status"
                    role="status"
                    data-tone={
                        ask.note && ask.tone !== "info" ? "error" : undefined
                    }
                >
                    {ask.note ||
                        (action === "sign-in"
                            ? "Sign in to buy this with your Oncyber wallet."
                            : action === "unavailable"
                            ? REFUSED.unavailable
                            : action === "add-funds"
                            ? `Add funds to buy this.${
                                  test ? " No real money is used." : ""
                              }`
                            : test
                            ? "No real money is used."
                            : own
                            ? "You confirm the payment in your own wallet."
                            : "")}
                </p>
                {action === "sign-in" && (
                    <ActionButton $variant="blue" onClick={openSignIn}>
                        Sign in to buy
                    </ActionButton>
                )}
                <UtilityActions>
                    <UtilityButton
                        type="button"
                        disabled={ask.paying}
                        onClick={() => close()}
                    >
                        Cancel
                    </UtilityButton>
                    {action === "add-funds" && test && (
                        <UtilityButton
                            $primary
                            type="button"
                            disabled={funding}
                            onClick={() => void addFunds()}
                        >
                            Add {formatPrice(TEST_FUNDS.stepCents)} test funds
                        </UtilityButton>
                    )}
                    {(action === "buy" || action === "wait") && (
                        <UtilityButton
                            $primary
                            type="button"
                            disabled={ask.paying || action === "wait"}
                            onClick={() => void buy()}
                        >
                            {ask.paying
                                ? "Paying…"
                                : action === "wait"
                                ? "Loading wallet…"
                                : ask.proof
                                ? "Finish purchase"
                                : own
                                ? `Pay ${formatPrice(ask.product.cents)}`
                                : `Buy for ${formatPrice(ask.product.cents)}`}
                        </UtilityButton>
                    )}
                </UtilityActions>
                {signedIn && live.current.openWallet && (
                    <UtilityRow
                        type="button"
                        disabled={ask.paying}
                        onClick={() => void openWallet()}
                    >
                        <Icon name="wallet" size={16} />
                        <span>
                            Wallet
                            <small>In your profile</small>
                        </span>
                    </UtilityRow>
                )}
            </PurchaseSummary>
        </PurchasePanel>
    );

    return { element: sidebar || null };
}
