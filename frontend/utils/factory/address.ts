import { getAddress } from "ethers/lib/utils";

export function getAddressCatch(address) {
    let addressParsed: string | boolean = false;

    try {
        addressParsed = getAddress(address);
    } catch (error) {
        console.error("address invalid", { error, address });
    }

    return addressParsed;
}
