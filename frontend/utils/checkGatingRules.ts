import { isCollectionOwner } from "@dapp/ownership/collections";
import { nodeEnv } from "@env";
import { Experience } from "@uitypes/experience";
import { ethers } from "ethers";
import { isTezosEns, isValidAddress } from "./getAddrType";
import { Failure, postJSON, Result, Success } from "./js";
import { getProxyWallets } from "@utils/auth/proxyWallets";
import { UserState } from "@uitypes/user";
import { getLinkedWalletsUserProxyObject } from "@features/studio/utils";
import { hasWorldPassword } from "@utils/worldPassword/publicGating";

export type GatingCheckResult =
    // `proof`: for a password-gated world, the signed world access proof the
    // multiplayer room join accepts (utils/worldPassword/proof.ts).
    | { type: "success"; proof?: string }
    | { type: "start-time-error" }
    | { type: "end-time-error" }
    | { type: "whitelist-error" }
    | { type: "nft-owner-error" }
    | { type: "no-anonymous-error" }
    | { type: "room-capacity-error" }
    | { type: "password-error" }
    // Too many wrong passwords for this world lately; try again later.
    | { type: "too-many-attempts-error" }
    | { type: "other-error"; error: string };

export type GatingErrorType = Exclude<GatingCheckResult["type"], "success">;

/**
 * The password step: whether the visitor proved the world's password. It is
 * checked on the server against a hash (utils/worldPassword/server.ts); the
 * password is never in the exhibit a client reads. Without one, a world
 * that has a password answers "password-error".
 */
export type PasswordCheck = () => Promise<boolean>;

export async function checkGating(
    exhibit: Experience,
    user: UserState,
    nbPlayers: number,
    checkPassword?: PasswordCheck
): Promise<GatingCheckResult> {
    //
    const isOwner =
        user &&
        (exhibit.editors?.some(
            (it) => it?.toLowerCase?.() === user?.id?.toLowerCase?.()
        ) ||
            user?.linkedAccounts?.some?.((it) =>
                exhibit.editors?.some(
                    (y) => y?.toLowerCase?.() === it?.accountId?.toLowerCase?.()
                )
            ));

    if (!isOwner && exhibit.gating) {
        //
        const { roomCapacity, ...rest } = exhibit.gating;

        return checkGatingRules(rest, user, nbPlayers, checkPassword);
    }

    return { type: "success" };
}

export async function checkGatingRules(
    gating: Experience["gating"],
    user: UserState,
    nbPlayers: number,
    checkPassword?: PasswordCheck
): Promise<GatingCheckResult> {
    //
    if (gating == null) return { type: "success" };

    if (gating.date) {
        const { start, end } = gating.date;

        const now = Date.now();

        if (start && now < start) {
            return { type: "start-time-error" };
        }
        if (end && now > end) {
            return { type: "end-time-error" };
        }
    }

    if (gating.roomCapacity) {
        if (gating.roomCapacity <= nbPlayers) {
            return { type: "room-capacity-error" };
        }
    }

    let userWalletsObject = {};

    let proxyWallets = {};

    if (user) {
        userWalletsObject = getLinkedWalletsUserProxyObject(user);
        // let userWalletObject = {};
        // userWalletObject[user] = { walletId: user, type: "ethereum" };
        proxyWallets = await getProxyWallets(userWalletsObject);
    }

    const wallets: Array<{
        walletId: string;
    }> = Object.values(userWalletsObject);

    // For improved error messages we show gating errors from the `most to least severe ones`
    // 1- whitelist : because the user can do nothing about it
    // 2- nft       : user can buy the nft to join the space,s
    // 3- no-anon   : user can login
    // 4- password   : user can enter the password

    if (gating.whitelist?.length) {
        //
        if (!user) {
            return { type: "whitelist-error" };
        }

        // Before resolving ens names, check if the user is already in the
        // whitelisted 0x.. addresses, it'll spare us some network requests

        let isWhitelisted = gating.whitelist.some(
            (it) =>
                it?.toLowerCase?.() === user?.id?.toLowerCase?.() ||
                user?.linkedAccounts?.some?.(
                    (y) => y?.accountId?.toLowerCase?.() == it?.toLowerCase?.()
                ) ||
                Object.entries(proxyWallets).some(
                    ([x, y]) =>
                        y?.walletId?.toLowerCase?.() == it?.toLowerCase?.()
                )
        );

        //Checking

        if (!isWhitelisted) {
            // not in 0x.. addresses, check resolved ens names if any
            let ensNames = gating.whitelist.filter((it) => !isValidAddress(it));

            if (ensNames.length) {
                //

                let addresses = await Promise.all(
                    //
                    ensNames.map(async (it) => {
                        try {
                            let address = it;

                            if (isTezosEns(it)) {
                                address = await resolveTezosEns(it);
                            } else {
                                address = await resolveEthEns(it);
                            }

                            return address;
                        } catch (err) {
                            console.error(err);
                            return it;
                        }
                    })
                );

                isWhitelisted = addresses.some(
                    (it) =>
                        it?.toLowerCase?.() === user?.id?.toLowerCase?.() ||
                        wallets
                            .concat(Object.values(proxyWallets))
                            .some(
                                (y) =>
                                    y?.walletId?.toLowerCase?.() ==
                                    it?.toLowerCase?.()
                            )
                );

                if (!isWhitelisted) {
                    return { type: "whitelist-error" };
                }
            } else {
                return { type: "whitelist-error" };
            }
        }
    }

    if (gating.nftOwnership?.length) {
        if (!user) {
            return { type: "nft-owner-error" };
        }

        const ps = [];
        gating.nftOwnership.map((nftGating) => {
            // ps.push(isCollectionOwner(user?.id, nftGating));
            wallets
                .concat(Object.values(proxyWallets))
                .map((y) => ps.push(isCollectionOwner(y?.walletId, nftGating)));
        });

        const result = await firstSuccess(ps);

        if (result.success === true) {
            if (!result.value) {
                return { type: "nft-owner-error" };
            }
        } else {
            return {
                type: "other-error",
                error: result.error.toString(),
            };
        }
    }

    if (gating.noAnonymous) {
        if (!user) {
            return { type: "no-anonymous-error" };
        }
    }

    if (hasWorldPassword(gating)) {
        //
        if (!checkPassword || !(await checkPassword())) {
            //
            return { type: "password-error" };
        }
    }

    return { type: "success" };
}

function firstSuccess(
    promises: Array<Promise<Result<boolean>>>
): Promise<Result<boolean>> {
    return new Promise((resolve, _) => {
        //
        let wasSettled = false;
        let results = new Array<Result<boolean>>(promises.length);
        let nbSettled = 0;

        function onResult(index: number, result: Result<boolean>) {
            if (wasSettled) return;

            if (result.success && result.value) {
                wasSettled = true;
                resolve(result);
                return;
            }

            nbSettled++;
            results[index] = result;

            if (nbSettled === promises.length) {
                const failure = results.find((it) => !it.success);

                if (failure) {
                    resolve(failure);
                } else {
                    resolve(Success(false));
                }
            }
        }

        promises.forEach((p, index) => {
            p.then(
                (result) => onResult(index, result),
                (err) => onResult(index, Failure(err))
            );
        });
    });
}

let provider: ethers.providers.JsonRpcProvider;

function resolveEthEns(name: string) {
    //
    if (provider == null) {
        provider = new ethers.providers.JsonRpcProvider(nodeEnv.ETH_RPC);
    }

    return provider.resolveName(name);
}

async function resolveTezosEns(name: string) {
    //
    const query = `query getDomain($name: String!)  {
        domain(name: $name) {
          address
        }
      }`;

    const variables = { name };

    let result = await postJSON("https://api.tezos.domains/graphql", {
        query,
        variables,
    });

    return result?.data?.domain?.address || name;
}
