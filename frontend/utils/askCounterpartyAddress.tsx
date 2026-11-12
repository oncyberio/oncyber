import { showPrompt } from "@components/Dialogs";
import {
    encodeCounterpartyUser,
    isValidBTCAddress,
} from "@utils/counterpartyAssets";

export const INVALID_COUNTERPARTY_ADDRESS =
    "That isn’t a Counterparty address. Check it and try again.";
export const COUNTERPARTY_ADDRESS_ADDED = "This wallet is already in the list.";

/**
 * Asks for a Counterparty (XCP) address in a dialog. A mistake is explained
 * under the field and the dialog stays open so the visitor can correct it
 * (docs/feedback.md). Resolves to the address as typed, or null when the
 * visitor cancels.
 *
 * `isListed` gets the address and its encoded account, and says whether that
 * wallet is already in the visitor's list.
 */
export async function askCounterpartyAddress(
    isListed: (address: string, account: string) => boolean
): Promise<string | null> {
    const address = await showPrompt({
        type: "text",
        message: "Enter a Counterparty address",
        onSubmit: (value) => {
            if (!isValidBTCAddress(value)) {
                throw new Error(INVALID_COUNTERPARTY_ADDRESS);
            }
            if (isListed(value, encodeCounterpartyUser(value))) {
                throw new Error(COUNTERPARTY_ADDRESS_ADDED);
            }
        },
    });
    return address || null;
}
