# Dependency advisories

Snapshot of npm advisories against `pnpm-lock.yaml`, last updated 10 November 2026.

## Fixed before release

-   Next.js 13.1.1 to 15.5.29 (image optimizer RCE and the other Next advisories).
-   Direct dependencies: Zod 4, nanoid 5, jsonwebtoken 9, Nodemailer 10,
    Mongoose 6, Joi 17.13.9, body-parser 1.20.9, Cloudinary 2,
    `@solana/web3.js` 1.73.5. Swiper, `@types/mongoose` and
    `babel-plugin-import-to-require` were unused and are removed.
-   Transitive criticals pinned in the root `pnpm.overrides`: DOMPurify,
    Handlebars, shell-quote, proxy-addr, form-data and protobufjs.

## Removed or replaced (10 November 2026)

-   `web3` 1.x replaced by ethers v5 (already in use); it brought the `tar`
    critical and most high advisories.
-   The full `ipfs` node, `@alch/alchemy-web3`, Storybook 6, the webpack dev
    harness and `@solana/wallet-adapter-wallets` (every wallet's SDK) are
    gone. Solana wallets are found through the Wallet Standard plus
    Phantom's adapter.
-   `firebase` 12 and `firebase-admin` 13 in the frontend; `firebase-admin` 12
    with `firebase-functions` 5 in `cloud-functions/functions`.
-   The unused Express `server/` package and its dependencies.

Result: 0 critical and 1 high advisory in the frontend lockfile (from 1 and
166), none in the cloud functions.

## Still open

| Package                | Where                                        | Why it stays                                       | Fix                                                          |
| ---------------------- | -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `bigint-buffer` (high) | `@metaplex/js` → `@solana/web3.js`           | Only reads NFT metadata in `utils/solanaAssets.ts` | Read Solana NFTs through the DAS API and drop `@metaplex/js` |
| `zod` 3 (moderate)     | `@wagmi/core` 1 (WalletConnect)              | Validates wallet responses on the client           | Upgrade to wagmi 2                                           |
| `nanoid` 2 (high)      | `multiplayer/`, inside `@colyseus/core` 0.14 | Fixed-size ids; the bug needs a negative size      | Colyseus 0.18                                                |

Run the check again after each change:

```sh
python3 - <<'EOF' > /tmp/pkgs.json
import yaml, json
lock = yaml.safe_load(open("pnpm-lock.yaml"))
pkgs = {}
for key in lock["packages"]:
    name, version = key.rsplit("@", 1)
    pkgs.setdefault(name, []).append(version.split("(")[0])
print(json.dumps(pkgs))
EOF
curl -s -X POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk \
    -H 'content-type: application/json' --data @/tmp/pkgs.json
```
