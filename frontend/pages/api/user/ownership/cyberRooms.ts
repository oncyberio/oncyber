import { nodeEnv } from "@env";
import config from "config";
import { BigNumber, ethers } from "ethers";
import maticFactoryContract from "config/mainnet/DiamondCyberDestinationUtilityFactory.json";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { RoomParameters } from "@uitypes/roomParameters";
import { getDestinationsByTag } from "@utils/firestore/destinations";

export async function getBatchBalance(
    owner: string,
    contractName: string,
    destinations: any[]
) {
    try {
        // if
        if (
            contractName === "factory" ||
            contractName === "curated" ||
            contractName === "rtfkt" ||
            contractName === "andfriends" ||
            contractName === "factory-polygon" ||
            contractName === "oncyber-ethereum-community"
        ) {
            let providerUrl: string;
            let balanceContract;

            if (contractName === "factory-polygon") {
                providerUrl = nodeEnv.POLYGON_RPC;
                balanceContract = maticFactoryContract;
            } else {
                providerUrl = nodeEnv.ETH_BALANCE_CHECKER_RPC;
                balanceContract = config[contractName].json;
            }

            const provider = new ethers.providers.JsonRpcProvider(providerUrl);

            const contract = new ethers.Contract(
                balanceContract.address,
                balanceContract.abi,
                provider
            );

            const addresses = new Array(destinations.length).fill(owner);

            const tokenIds = destinations.map((it) => +it.token_id);

            try {
                const balances: BigNumber[] = await contract.balanceOfBatch(
                    addresses,
                    tokenIds
                );

                balances.forEach((bn, i) => {
                    destinations[i].tmp_ownerBalance = bn.toNumber();
                });
            } catch (err) {
                console.error(
                    "balanceOdBatch",
                    balanceContract.address,
                    tokenIds.join(", ")
                );
                console.error(err);
            }
        } else if (contractName == "autograph") {
            const response = await fetch(
                `https://api.autograph.io/v1/api/nfts/6206e621c19ea3000e496f3f/public/count?address=${owner}`
            );
            const data = await response.json();

            let balance = isNaN(+data) ? 0 : +data;
            destinations[0].tmp_ownerBalance = balance;
        }
    } catch (e) {
        console.error(e);
    }
}

export async function getRoomsWithBalances(owner: string): Promise<any[]> {
    //
    const data = await getDestinationsByTag("active");

    let roomsById: Record<string, any[]> = {};

    const destinations: RoomParameters[] = data.map((it) => {
        const { params, ...rest } = it;

        return {
            ...rest,
            ...params,
        } as any;
    });

    console.log(destinations);

    destinations.forEach((it) => {
        //
        if (!it.nonFungible) return;

        const contractName = it.contractName;

        let tokenIds = roomsById[contractName];

        if (tokenIds == null) {
            tokenIds = roomsById[contractName] = [];
        }

        tokenIds.push(it);
    });

    await Promise.all(
        Object.keys(roomsById).map(async (key) => {
            //
            const destinations = roomsById[key];

            await getBatchBalance(owner, key, destinations);
        })
    );

    return destinations;
}

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        const rooms = await getRoomsWithBalances(
            //req.query.owner
            "0x76DB02500F7631d57BC2DcDCa9d4cf782b99E119"
        );

        return res.json({
            success: true,
            rooms,
        });
    } catch (e) {
        console.error(e);
        return res.json({
            success: false,
            error: e.message,
        });
    }
};
