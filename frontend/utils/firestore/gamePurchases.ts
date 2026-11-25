import { db } from "@utils/firebaseAdmin";
import {
    splitSale,
    TEST_FUNDS,
    type Product,
    type PurchaseRefusal,
} from "@features/games/gamePurchases";

/**
 * Where purchases live. Everything a visitor bought is under their own
 * account, and every write is keyed by the signed-in account:
 *
 *   gameWallets/<userId>                         the test rail's balance
 *   gameWallets/<userId>/orders/<order>          one purchase, any state
 *   gameWallets/<userId>/owned/<game>_<product>  a permanent product held
 *   gameWallets/<userId>/testCharges/<payment>   the test rail's charges
 *   gameSales/<game>/sales/<userId>_<order>      the same sale, by game
 *
 * A purchase is two steps, because real money moves outside Firestore:
 * the order is written `pending`, the rail is paid, then the order is
 * written `paid` with what was bought. Each step can be repeated safely:
 * an order has one payment id for its whole life and a rail charges a
 * payment id once, so a retry, a second tab or a crash between the steps
 * never charges twice.
 */
export interface PaymentRail {
    id: string;
    /** What the visitor can spend, in US cents. */
    balance(userId: string): Promise<number>;
    /**
     * Take `cents` from the visitor. `payment` names this purchase and no
     * other: paying the same `payment` again charges nothing and gives the
     * first answer's reference.
     */
    pay(input: {
        payment: string;
        userId: string;
        cents: number;
        game: string;
        seller: string | null;
        feeCents: number;
    }): Promise<
        | { ok: true; reference: string }
        | { ok: false; reason: "insufficient-funds" | "payment-failed" }
    >;
}

export interface PurchaseOrder {
    order: string;
    /** The attempt this order is on; with `order` it names the payment. */
    key: string;
    game: string;
    product: string;
    name: string;
    kind: Product["kind"];
    cents: number;
    feeCents: number;
    sellerCents: number;
    /** The account paid for the sale; null for a game Oncyber publishes. */
    seller: string | null;
    status: "pending" | "paid" | "failed";
    reason?: PurchaseRefusal;
    rail: string;
    reference?: string;
    at: number;
    paidAt?: number;
}

export type PurchaseAnswer =
    | { bought: true; order: string }
    | { bought: false; reason: PurchaseRefusal };

const wallet = (userId: string) => db.collection("gameWallets").doc(userId);
const orderRef = (userId: string, order: string) =>
    wallet(userId).collection("orders").doc(order);
const ownedRef = (userId: string, game: string, product: string) =>
    wallet(userId).collection("owned").doc(`${game}_${product}`);

/**
 * A permanent product has one order per visitor, so two purchases of it at
 * once are the same order and pay once. A consumable has one per ask.
 */
export const orderId = (game: string, product: Product, key: string) =>
    product.kind === "permanent"
        ? `${game}_${product.id}`
        : `${game}_${product.id}_${key}`;

export async function purchaseProduct(input: {
    userId: string;
    game: string;
    product: Product;
    /** The page's id for this confirmation; a retry sends the same one. */
    key: string;
    rail: PaymentRail;
    feePercent: number;
    seller?: string | null;
    now?: number;
}): Promise<PurchaseAnswer> {
    const { userId, game, product, rail } = input;
    const now = input.now ?? Date.now();
    const seller = input.seller ?? null;
    const id = orderId(game, product, input.key);
    const ref = orderRef(userId, id);
    const owned = ownedRef(userId, game, product.id);

    // Step 1: the order exists, with the payment it will use.
    const opened = await db.runTransaction(async (tx) => {
        const [existing, held] = await Promise.all([
            tx.get(ref),
            product.kind === "permanent" ? tx.get(owned) : null,
        ]);
        const before = existing.exists
            ? (existing.data() as PurchaseOrder)
            : null;
        if (before?.status === "paid" || held?.exists)
            return before?.status === "paid" && before.key === input.key
                ? ({ done: { bought: true, order: id } } as const)
                : ({
                      done: { bought: false, reason: "already-owned" },
                  } as const);
        // The same confirmation asked again after it failed: the same no.
        if (before?.status === "failed" && before.key === input.key)
            return {
                done: {
                    bought: false,
                    reason: before.reason ?? "payment-failed",
                },
            } as const;
        // Still open (another tab, or a step that never finished): carry on
        // with its payment, so whoever finishes it pays once.
        if (before?.status === "pending") return { order: before } as const;
        const order: PurchaseOrder = {
            order: id,
            key: input.key,
            game,
            product: product.id,
            name: product.name,
            kind: product.kind,
            cents: product.cents,
            ...splitSale(product.cents, input.feePercent),
            seller,
            status: "pending",
            rail: rail.id,
            at: now,
        };
        tx.set(ref, order);
        return { order } as const;
    });
    if ("done" in opened) return opened.done as PurchaseAnswer;
    const order = opened.order;

    // Step 2: the money. Outside any transaction; safe to repeat.
    let paid: Awaited<ReturnType<PaymentRail["pay"]>>;
    try {
        paid = await rail.pay({
            payment: `${id}_${order.key}`,
            userId,
            cents: order.cents,
            game,
            seller: order.seller,
            feeCents: order.feeCents,
        });
    } catch {
        // Unknown whether it went through: the order stays pending, and the
        // next ask for it carries on with the same payment.
        return { bought: false, reason: "payment-failed" };
    }
    if (paid.ok === false) {
        await ref.set({ ...order, status: "failed", reason: paid.reason });
        return { bought: false, reason: paid.reason };
    }

    // Step 3: what was bought.
    const reference = paid.reference;
    await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if ((current.data() as PurchaseOrder | undefined)?.status === "paid")
            return;
        tx.set(ref, { ...order, status: "paid", reference, paidAt: now });
        if (order.kind === "permanent")
            tx.set(owned, { game, product: order.product, order: id, at: now });
        tx.set(
            db
                .collection("gameSales")
                .doc(game)
                .collection("sales")
                .doc(`${userId}_${id}`),
            {
                order: id,
                buyer: userId,
                product: order.product,
                cents: order.cents,
                feeCents: order.feeCents,
                sellerCents: order.sellerCents,
                seller: order.seller,
                rail: order.rail,
                reference,
                at: now,
            }
        );
    });
    return { bought: true, order: id };
}

/** The permanent products of `ids` this account holds in `game`. */
export async function readOwnedProducts(
    userId: string,
    game: string,
    ids: string[]
): Promise<string[]> {
    const held = await Promise.all(
        ids.map(async (id) =>
            (await ownedRef(userId, game, id).get()).exists ? id : null
        )
    );
    return held.filter((id): id is string => id !== null);
}

export interface PurchaseRecord {
    order: string;
    game: string;
    product: string;
    name: string;
    cents: number;
    at: number;
}

/** What this account bought, newest first. Only purchases that were paid. */
export async function readPurchaseHistory(
    userId: string,
    limit = 30
): Promise<PurchaseRecord[]> {
    const found = await wallet(userId)
        .collection("orders")
        .orderBy("at", "desc")
        .limit(Math.min(Math.max(limit, 1), 50))
        .get();
    return found.docs
        .map((doc) => doc.data() as PurchaseOrder)
        .filter((order) => order.status === "paid")
        .map(({ order, game, product, name, cents, paidAt, at }) => ({
            order,
            game,
            product,
            name,
            cents,
            at: paidAt ?? at,
        }));
}

/**
 * The test rail: play money the site keeps per account, so the whole flow
 * can be built, checked and shown before any real rail exists. It is never
 * redeemable and never mixed with a real balance.
 */
export const testRail: PaymentRail = {
    id: "test",
    async balance(userId) {
        const found = await wallet(userId).get();
        const cents = found.exists ? found.data()?.testCents : 0;
        return Number.isInteger(cents) && cents > 0 ? cents : 0;
    },
    pay({ payment, userId, cents }) {
        const charge = wallet(userId).collection("testCharges").doc(payment);
        return db.runTransaction(async (tx) => {
            const [charged, found] = await Promise.all([
                tx.get(charge),
                tx.get(wallet(userId)),
            ]);
            const reference = `test:${payment}`;
            if (charged.exists) return { ok: true, reference } as const;
            const held = found.exists ? found.data()?.testCents : 0;
            const balance = Number.isInteger(held) && held > 0 ? held : 0;
            if (balance < cents)
                return { ok: false, reason: "insufficient-funds" } as const;
            tx.set(wallet(userId), {
                ...(found.exists ? found.data() : {}),
                testCents: balance - cents,
            });
            tx.set(charge, { cents, at: Date.now() });
            return { ok: true, reference } as const;
        });
    },
};

/** Add play money to the test rail, up to its cap. Returns the balance. */
export function addTestFunds(userId: string, cents: number): Promise<number> {
    return db.runTransaction(async (tx) => {
        const found = await tx.get(wallet(userId));
        const held = found.exists ? found.data()?.testCents : 0;
        const balance = Number.isInteger(held) && held > 0 ? held : 0;
        const next = Math.min(
            TEST_FUNDS.maxCents,
            balance + Math.min(Math.max(cents, 0), TEST_FUNDS.stepCents)
        );
        tx.set(wallet(userId), {
            ...(found.exists ? found.data() : {}),
            testCents: next,
        });
        return next;
    });
}
