const ETH_RPC =
    process.env.NEXT_PUBLIC_ETH_MAINNET_RPC ||
    "https://ethereum-rpc.publicnode.com";

// Firebase browser config always comes from the environment, so a fork never
// talks to Oncyber's projects by accident. next.config.js fails production
// builds when the required values are missing.
const firebaseConfig = {
    FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    FIREBASE_MESSAGING_SENDER_ID:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Local Firebase emulators (`pnpm dev:local`). Set, the browser talks to these
// hosts instead of Firebase; the server reads the unprefixed variables that
// firebase-admin already understands (FIRESTORE_EMULATOR_HOST, ...).
export const firebaseEmulators = {
    auth: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
    firestore: process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST,
    database: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_EMULATOR_HOST,
};

export const nodeEnv = {
    POLAR_SAMA: "/api/proxyv2?url=",
    DEV_FORCED_OWNERSHIP_WALLET:
        process.env.NODE_ENV === "development"
            ? process.env.NEXT_PUBLIC_DEV_FORCED_OWNERSHIP_WALLET?.toLowerCase()
            : null,

    ROOM_SUFFIX: process.env.NODE_ENV === "development" ? "nakama" : "nakama-0",
    // Default eth chain
    DEFAULT_CHAIN: "default" as const,
    DEFAULT_ETH_CHAIN: "default" as const, // "default" for OpenSea
    RESERVOIR_API:
        process.env.NODE_ENV === "development"
            ? "https://api.reservoir.tools"
            : "https://api.reservoir.tools",

    // Solana RPC. Owned/created NFT listings need an RPC with the Metaplex DAS
    // API (for example Helius or Triton); the public endpoint only covers
    // basic account reads.
    SOLANA_NETWORK:
        process.env.NEXT_PUBLIC_SOLANA_RPC ||
        "https://api.mainnet-beta.solana.com",
    OPENSEA_API:
        process.env.NODE_ENV === "development"
            ? // ? "https://testnets-api.opensea.io/api"
              "https://api.opensea.io/api/v2" // should move to rinkeby one day
            : "https://api.opensea.io/api/v2",

    XCHAIN_API: "https://xchain.io/api",
    OPENSEA_ORDERBOOK_API:
        process.env.NODE_ENV === "development"
            ? // ? "https://testnets-api.opensea.io/wyvern/v1"
              "https://api.opensea.io/wyvern/v1" // should move to rinkeby one day
            : "https://api.opensea.io/wyvern/v1",

    BASE_RPC: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
    SHAPE_RPC:
        process.env.NEXT_PUBLIC_SHAPE_RPC || "https://mainnet.shape.network",
    ETH_RPC,
    POLYGON_RPC:
        process.env.NEXT_PUBLIC_POLYGON_RPC || "https://polygon-rpc.com",

    ETH_BALANCE_CHECKER_RPC: ETH_RPC,
    ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    WETH_ADDRESS:
        process.env.NODE_ENV === "development"
            ? // ? "0xc778417e063141139fce010982780140aa0cd5ab"  <- weth on rinkeby
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
            : "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    // The API routes ship with this app, so the browser calls its own origin.
    // A fixed host breaks previews, localhost on another port and any domain
    // that isn't the hardcoded one: the cross-origin request fails CORS (for
    // example, opening a template could not fetch the room's parameters).
    PUBLIC_API:
        typeof window !== "undefined" && window.location?.origin
            ? window.location.origin
            : process.env.NODE_ENV === "development"
            ? process.env.NEXT_PUBLIC_API || "http://localhost:3000"
            : process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
            ? // On the server: the production domain, from next.config.js.
              process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://www.oncyber.com"
            : process.env.NEXT_PUBLIC_DEV_API ||
              `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`,
    GIT_BRANCH_PREVIEW_URL:
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
            ? null
            : `https://cyber-art-git-${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF}-oncyber.vercel.app`,

    // firebase
    ...firebaseConfig,

    OPENSEA_X_API_KEY: process.env.OPENSEA_X_API_KEY,
    RESERVOIR_API_KEY: process.env.NEXT_PUBLIC_RESERVOIR_API_KEY,
    YOUTUBE_API_KEY_SEARCH: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
    YOUTUBE_API_KEY_GET: process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
    // Server-only: never expose a Pinata JWT with a NEXT_PUBLIC_ prefix.
    PINATA_JWT_KEY: process.env.PINATA_JWT_KEY,
    // The origin native worlds are served from, in a frame, when it is a
    // second host of this app (docs/plans/framed-worlds.md). Unset: worlds
    // run in the page. Read through WORLD_FRAME in features/worlds.
    WORLD_ORIGIN: process.env.NEXT_PUBLIC_WORLD_ORIGIN,
    // Server-only. Who may publish a game from outside the repository
    // (docs/games/publishing.md): unset is off (open on the development
    // server), "open", or a comma list of account ids. Read through
    // publishingGate() in features/games/publishedGames.ts.
    GAMES_PUBLISHING: process.env.GAMES_PUBLISHING,
    // Server-only. How purchases in games are paid for
    // (docs/games/purchases.md): unset is off (the test rail on the
    // development server); "test" is play money; "wallet" is the visitor's
    // own wallet, with the chain settings below. Read through
    // purchasesMode() in features/games/gamePurchases.ts.
    GAMES_PURCHASES: process.env.GAMES_PURCHASES,
    // Server-only. The chain the "wallet" rail is paid on: its id and name,
    // the node the server reads transfers from, the dollar token's contract
    // and symbol (USDC when unset), the address paid, and how many blocks a
    // transfer needs (1 when unset). Read through walletPaymentConfig() in
    // features/games/walletPayment.ts; with any of them missing the rail
    // is off.
    GAMES_PURCHASE_CHAIN_ID: process.env.GAMES_PURCHASE_CHAIN_ID,
    GAMES_PURCHASE_CHAIN_NAME: process.env.GAMES_PURCHASE_CHAIN_NAME,
    GAMES_PURCHASE_RPC_URL: process.env.GAMES_PURCHASE_RPC_URL,
    GAMES_PURCHASE_TOKEN: process.env.GAMES_PURCHASE_TOKEN,
    GAMES_PURCHASE_TOKEN_SYMBOL: process.env.GAMES_PURCHASE_TOKEN_SYMBOL,
    GAMES_PURCHASE_RECIPIENT: process.env.GAMES_PURCHASE_RECIPIENT,
    GAMES_PURCHASE_CONFIRMATIONS: process.env.GAMES_PURCHASE_CONFIRMATIONS,
    // Server-only. Oncyber's share of a sale, in whole percent; unset is 0.
    GAMES_PURCHASE_FEE_PERCENT: process.env.GAMES_PURCHASE_FEE_PERCENT,
    // Server-only. Upload mode `storage` of that publishing: releases kept
    // in a private Firebase Storage bucket, for a host with no disk. Unset
    // uses the bucket where there is no local releases folder; "on" uses
    // it even where there is one; "off" never. Read through
    // releaseBucketConfig() in features/games/releaseBucket.ts.
    GAMES_PUBLISHING_STORAGE: process.env.GAMES_PUBLISHING_STORAGE,
    // Server-only. The bucket for it; unset is the Firebase project's
    // bucket (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).
    GAMES_STORAGE_BUCKET: process.env.GAMES_STORAGE_BUCKET,
    ONESIGNAL_APP_ID:
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
            ? "d6060c2b-bd28-4af2-9887-a8e1738ab4dc"
            : "fac2d6c5-52b8-49c3-b128-777c08b9f5b4",
    ONESIGNAL_SAFARI_WEB_ID:
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
            ? "web.onesignal.auto.31ba082c-c81b-42a5-be17-ec59d526e60e"
            : "web.onesignal.auto.184c7445-8c69-4a83-85c0-51cef14a5d89",
    EVENTS_SCHEDULE_TEMPLATE_ID:
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
            ? "47a5554a-e76f-4b89-8dea-c4e1985c852f" //! NEED CHANGE
            : "e7dd67a2-50af-4f93-9b73-923853a99b0e",
    VISIT_TEMPLATE_ID:
        process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
            ? "0347286a-7f02-42a5-8c79-0883b7429feb"
            : "e7dd67a2-50af-4f93-9b73-923853a99b0e",
    PINATA_BASE_UPLOAD: "https://cyber.mypinata.cloud/ipfs/",
};
