import { ethers } from "ethers";
import config from "../../config";

export default async function mint(
    provider: ethers.providers.Web3Provider,
    signatureMint: string,
    contractName: string,
    tokenId: number,
    quantity: number,
    price: number,
    address: string
) {
    const contractConfig = config[contractName];

    const contract = new ethers.Contract(
        contractConfig.json.address,
        contractConfig.json.abi,
        provider.getSigner(address)
    );

    try {
        const priceQte = price * quantity;

        const value = ethers.utils.parseEther(priceQte.toString());

        const nonce = await getDropMintCounter(address, contract, tokenId);

        if (nonce != 0) return { minted: false, err: "HN" };

        const estimation = await contract.estimateGas.mint(
            tokenId,
            quantity,
            signatureMint,
            { value }
        );

        // 10% over the estimate, so small fluctuations don't fail the mint.
        const tx = await contract.mint(tokenId, quantity, signatureMint, {
            value,
            gasLimit: estimation.mul(110).div(100),
        });
        await tx.wait();

        return { minted: true };
    } catch (e) {
        const err =
            e?.message || e?.error?.message?.split?.(": ")?.[1] || e?.reason;

        return { minted: false, err };
    }
}

export const getDropMintCounter = async (
    address: string,
    contract: ethers.Contract,
    tokenId: number
): Promise<number> => {
    const nonce = await contract.dropMintCounter(tokenId, address);
    return Number(nonce.toString());
};
