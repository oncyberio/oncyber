import { nodeEnv } from "@env";

async function getBalance(owner, collection, contractName, token_id = 0) {
    if (!owner.startsWith("0x")) return 0;

    try {
        console.log(contractName, token_id);
        const { balance, success } = await (
            await fetch(
                `/api/user/assets/balance?walletId=${owner}&collection=${collection}&token_id=${token_id}&contractName=${contractName}`
            )
        ).json();
        console.log("BALANCE");
        return balance;
    } catch (e) {
        return 0;
    }
}

async function getBatchBalance(owner, contractAddresses, isAutograph) {
    if (!owner.startsWith("0x")) return 0;

    try {
        const { balance, success } = await (
            await fetch(
                nodeEnv.PUBLIC_API +
                    `/api/user/assets/batchBalance?walletId=${owner}&isAutograph=${isAutograph}`,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json, text/plain, */*",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contractAddresses: Object.keys(contractAddresses),
                    }),
                }
            )
        ).json();

        console.log("BALANCE");
        console.log(balance);

        return balance;
    } catch (e) {
        return {};
    }
}

export { getBalance, getBatchBalance };
