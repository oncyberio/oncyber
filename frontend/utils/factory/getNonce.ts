import { ethers } from "ethers";
import config from "../../config";

export default async function getNonce(contractName: string) {
    const providerSigner = new ethers.providers.Web3Provider(window.ethereum);

    const contractConfig = config[contractName];

    const provider = new ethers.providers.JsonRpcProvider(contractConfig.rpc);

    const minter = providerSigner.getSigner();
    const address = await minter.getAddress();

    const contract = new ethers.Contract(
        contractConfig.json.address,
        contractConfig.json.abi,
        provider
    );

    return (await contract.minterNonce(address)).toString();
}
