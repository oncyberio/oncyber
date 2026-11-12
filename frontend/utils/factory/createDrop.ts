import { ethers } from "ethers";
import config from "../../config";

function factoryContract(
    provider: ethers.providers.Web3Provider,
    contractName: string,
    address?: string
) {
    const contractConfig = config[contractName];

    return new ethers.Contract(
        contractConfig.json.address,
        contractConfig.json.abi,
        address ? provider.getSigner(address) : provider
    );
}

export default async function createDrop(
    provider: ethers.providers.Web3Provider,
    uri: string,
    amountCap: number,
    shareCyber: number,
    signatureDrop: string,
    contractName: string,
    startTime: number,
    endTime: number,
    price: ethers.BigNumberish,
    address: string
): Promise<string | null> {
    const contract = factoryContract(provider, contractName, address);
    const args = [
        uri,
        startTime,
        endTime,
        price,
        amountCap,
        shareCyber,
        signatureDrop,
    ];

    try {
        const estimation = await contract.estimateGas.createDrop(...args);

        // 50% over the estimate, so fluctuations don't fail the transaction.
        const tx = await contract.createDrop(...args, {
            gasLimit: estimation.mul(150).div(100),
        });
        const receipt = await tx.wait();

        const created = receipt.events?.find(
            (event) => event.event === "DropCreated"
        );
        const tokenId = created?.args?.tokenId?.toString();

        if (!tokenId) throw new Error("tokenId error");

        return tokenId;
    } catch (err) {
        console.error(err);
        return null;
    }
}

export const hasDrop = async (
    provider: ethers.providers.Web3Provider,
    token_id: number,
    contractName: string
) => {
    const drop = await factoryContract(provider, contractName).getDrop(
        token_id
    );

    return (
        Number(drop?.minted?.toString()) < Number(drop?.amountCap?.toString())
    );
};

export const getMinterNonce = async (
    provider: ethers.providers.Web3Provider,
    contractName: string,
    address: string
): Promise<string> => {
    const nonce = await factoryContract(provider, contractName).minterNonce(
        address
    );

    return nonce.toString();
};
