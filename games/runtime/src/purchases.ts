/**
 * Purchases: how a game sells something. A game declares its products in
 * game.json (`products`) and asks the page to sell one with `buy()`. The
 * page, never the game, shows the price and takes the visitor's yes or no,
 * pays from the visitor's Oncyber wallet and answers with the outcome. A
 * game never sees a balance, an address or a payment detail.
 *
 * No imports: the page, the server and the check load this file as is.
 * See docs/games/purchases.md.
 */

/** `permanent` is bought once and kept; `consumable` can be bought again. */
export type ProductKind = "permanent" | "consumable";

/** One entry of game.json's `products`. */
export interface ProductDeclaration {
    name: string;
    /** US dollars as text, "0.99" or "5": never a number, so no rounding. */
    price: string;
    kind: ProductKind;
}
export interface Product {
    id: string;
    name: string;
    /** The price in US cents. */
    cents: number;
    kind: ProductKind;
}
export type Products = Record<string, Product>;

export const PURCHASE_LIMITS = {
    product: /^[a-z][a-z0-9-]{0,31}$/,
    request: /^[A-Za-z0-9_-]{6,64}$/,
    price: /^(\d{1,3})(?:\.(\d{1,2}))?$/,
    maxProducts: 32,
    nameLength: 40,
    minCents: 10,
    maxCents: 100_00,
} as const;
const KINDS: readonly string[] = ["permanent", "consumable"];

const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);

/** "2.50" to 250. Null for anything that is not a price in range. */
export function readPrice(value: unknown): number | null {
    if (typeof value !== "string") return null;
    const match = PURCHASE_LIMITS.price.exec(value);
    if (!match) return null;
    const cents =
        Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    return cents >= PURCHASE_LIMITS.minCents &&
        cents <= PURCHASE_LIMITS.maxCents
        ? cents
        : null;
}

/** 250 to "$2.50". */
export function formatPrice(cents: number): string {
    const whole = Math.trunc(cents / 100);
    return `$${whole}.${String(Math.abs(cents % 100)).padStart(2, "0")}`;
}

export type ProductsRead =
    | { ok: true; products: Products }
    | { ok: false; error: string; findings: string[] };

/**
 * The one definition of a valid `products` block. A game with nothing to
 * sell leaves it out (`undefined` reads as no products).
 */
export function readProducts(value: unknown): ProductsRead {
    if (value === undefined || value === null)
        return { ok: true, products: {} };
    const findings: string[] = [];
    const products: Products = {};
    if (!isObject(value))
        return {
            ok: false,
            error: "PRODUCTS_INVALID",
            findings: ["products must be an object of product ids"],
        };
    const ids = Object.keys(value);
    if (ids.length > PURCHASE_LIMITS.maxProducts)
        findings.push(
            `products lists ${ids.length}; at most ${PURCHASE_LIMITS.maxProducts}`
        );
    for (const id of ids) {
        const raw = value[id];
        if (!PURCHASE_LIMITS.product.test(id)) {
            findings.push(
                `product id "${id}" must be lowercase letters, digits and dashes, starting with a letter, 32 characters at most`
            );
            continue;
        }
        if (!isObject(raw)) {
            findings.push(`products.${id} must be an object`);
            continue;
        }
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!name || name.length > PURCHASE_LIMITS.nameLength)
            findings.push(
                `products.${id}.name must be 1 to ${PURCHASE_LIMITS.nameLength} characters`
            );
        const cents = readPrice(raw.price);
        if (cents === null)
            findings.push(
                `products.${id}.price must be US dollars as text, "0.10" to "100.00"`
            );
        if (typeof raw.kind !== "string" || !KINDS.includes(raw.kind))
            findings.push(
                `products.${id}.kind must be "permanent" or "consumable"`
            );
        if (name && cents !== null && KINDS.includes(raw.kind as string))
            products[id] = {
                id,
                name: name.slice(0, PURCHASE_LIMITS.nameLength),
                cents,
                kind: raw.kind as ProductKind,
            };
    }
    return findings.length
        ? { ok: false, error: "PRODUCTS_INVALID", findings }
        : { ok: true, products };
}

/** What the game sends: `purchase` with `{ request, product }`. */
export interface PurchaseRequest {
    /** The game's id for this ask; the answer carries it back. */
    request: string;
    product: string;
}
export function readPurchaseRequest(value: unknown): PurchaseRequest | null {
    if (!isObject(value)) return null;
    const { request, product } = value;
    return typeof request === "string" &&
        PURCHASE_LIMITS.request.test(request) &&
        typeof product === "string" &&
        PURCHASE_LIMITS.product.test(product)
        ? { request, product }
        : null;
}

/**
 * Why a purchase did not happen. `cancelled` is the visitor's no; the rest
 * are refusals a game shows as "couldn't buy" and never retries by itself.
 */
export const PURCHASE_REFUSALS = [
    "cancelled", // the visitor said no, or closed the sheet
    "undeclared", // the product is not in game.json
    "invalid", // a malformed request
    "busy", // another purchase is already being confirmed
    "sign-in-required", // the visitor is a guest and did not sign in
    "already-owned", // a permanent product this visitor has
    "insufficient-funds", // the wallet holds less than the price
    "payment-failed", // the payment was tried and did not go through
    "unavailable", // purchases are off here, or the page did not answer
] as const;
export type PurchaseRefusal = (typeof PURCHASE_REFUSALS)[number];

export type PurchaseOutcome =
    | {
          bought: true;
          product: string;
          /** The page's id for the purchase, for the game's own records. */
          order: string;
      }
    | { bought: false; product: string; reason: PurchaseRefusal };

/** The page's answer as the game may trust it: anything odd is `unavailable`. */
export function readPurchaseOutcome(
    value: unknown,
    product: string
): PurchaseOutcome {
    if (
        isObject(value) &&
        value.bought === true &&
        typeof value.order === "string" &&
        PURCHASE_LIMITS.request.test(value.order)
    )
        return { bought: true, product, order: value.order };
    const reason = isObject(value) ? value.reason : null;
    return {
        bought: false,
        product,
        reason: (PURCHASE_REFUSALS as readonly unknown[]).includes(reason)
            ? (reason as PurchaseRefusal)
            : "unavailable",
    };
}

export interface Purchases {
    /**
     * Ask the page to sell `product` to the visitor. Resolves once the
     * visitor has answered and the payment has gone through or not; it
     * never rejects. Grant the item only when `bought` is true.
     */
    buy(product: string): Promise<PurchaseOutcome>;
    /** The permanent products this visitor owns in this game. */
    owned(): Promise<string[]>;
    /** For a game's `inspect()`. */
    inspect(): { asked: number; bought: number; pending: number };
}

/** How a request reaches the page. Must not reject. */
export type PurchaseTransport = {
    buy(request: PurchaseRequest): Promise<unknown>;
    owned(request: string): Promise<unknown>;
};

/**
 * The game's side, over any transport. One purchase at a time: a second
 * `buy()` while the first is open answers `busy` without asking the page.
 */
export function createPurchases(
    transport: PurchaseTransport,
    products: Products
): Purchases {
    let open = false;
    let asked = 0;
    let bought = 0;
    const newId = () => {
        const bytes = new Uint8Array(12);
        globalThis.crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
            ""
        );
    };
    return {
        async buy(product) {
            const refuse = (reason: PurchaseRefusal): PurchaseOutcome => ({
                bought: false,
                product: String(product).slice(0, 32),
                reason,
            });
            if (
                typeof product !== "string" ||
                !Object.hasOwn(products, product)
            )
                return refuse("undeclared");
            if (open) return refuse("busy");
            open = true;
            asked++;
            try {
                const outcome = readPurchaseOutcome(
                    await transport
                        .buy({ request: newId(), product })
                        .catch(() => null),
                    product
                );
                if (outcome.bought) bought++;
                return outcome;
            } finally {
                open = false;
            }
        },
        async owned() {
            const answer = await transport.owned(newId()).catch(() => null);
            const list = isObject(answer) ? answer.products : null;
            return Array.isArray(list)
                ? [
                      ...new Set(
                          list.filter(
                              (id): id is string =>
                                  typeof id === "string" &&
                                  Object.hasOwn(products, id)
                          )
                      ),
                  ]
                : [];
        },
        inspect: () => ({ asked, bought, pending: open ? 1 : 0 }),
    };
}

/**
 * Purchases in a browser frame. Embedded in the Oncyber page it asks the
 * page (`purchase` and `owned`, answered by `purchase-result` and
 * `owned-result`). Opened on its own (a dev server) there is no page and no
 * wallet: `standalone` decides what `buy()` answers, so a game's own flow
 * can be built and tried ("approve" by default; nothing is charged).
 */
export function connectPurchases(options: {
    /** game.json's `products`, as declared. */
    products: unknown;
    /** A game on the contract leaves this out and speaks `oncyber:game:`. */
    prefix?: string;
    standalone?: "approve" | "refuse";
    /** For tests: the window to talk through. */
    window?: Window;
}): Purchases & { dispose(): void } {
    const win = options.window ?? window;
    const prefix = options.prefix ?? "oncyber:game:";
    const embedded = win.parent !== win;
    const read = readProducts(options.products);
    const products = read.ok ? read.products : {};
    const pending = new Map<string, (answer: unknown) => void>();
    const owned = new Set<string>();
    const onMessage = (event: MessageEvent) => {
        if (event.source !== win.parent) return;
        const data = event.data;
        if (
            data?.type !== `${prefix}purchase-result` &&
            data?.type !== `${prefix}owned-result`
        )
            return;
        const done = pending.get(data.request);
        if (!done) return;
        pending.delete(data.request);
        done(data);
    };
    const ask = (kind: string, request: string, data: object) =>
        new Promise<unknown>((resolve) => {
            pending.set(request, resolve);
            win.parent.postMessage(
                { type: prefix + kind, request, ...data },
                "*"
            );
        });
    const transport: PurchaseTransport = embedded
        ? {
              buy: ({ request, product }) =>
                  ask("purchase", request, { product }),
              owned: (request) => ask("owned", request, {}),
          }
        : {
              async buy({ request, product }) {
                  if (options.standalone === "refuse")
                      return { bought: false, reason: "unavailable" };
                  if (products[product]?.kind === "permanent") {
                      if (owned.has(product))
                          return { bought: false, reason: "already-owned" };
                      owned.add(product);
                  }
                  return {
                      bought: true,
                      order: `test-${request}`.slice(0, 64),
                  };
              },
              owned: async () => ({ products: [...owned] }),
          };
    if (embedded) win.addEventListener("message", onMessage);
    return Object.assign(createPurchases(transport, products), {
        dispose() {
            win.removeEventListener("message", onMessage);
            // The page is gone: nothing was bought.
            for (const done of pending.values()) done(null);
            pending.clear();
        },
    });
}
