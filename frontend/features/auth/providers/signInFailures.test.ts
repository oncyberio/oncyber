/** @jest-environment jsdom */
import { handleFirebaseAuthErrors } from "./index";
import { web3_signIn } from "./web3";
import { signEthereum } from "./web3/sign";
import { describeSignInError } from "../signInErrors";

jest.mock("firebase/auth", () => ({ getAuth: () => ({}) }));
jest.mock("@utils/firebase", () => ({ firebaseApp: {} }));
jest.mock("@api/accounts/_api", () => ({}), { virtual: true });
jest.mock("@utils/autographAssets", () => ({ isAutographUser: jest.fn() }));
jest.mock("./web3/sign", () => ({
    signEthereum: jest.fn(),
    signSolana: jest.fn(),
    tezosLoginPayload: (nonce: string) => nonce,
}));

const sign = signEthereum as jest.Mock;
const nonce = jest.fn();
const wallet: any = { type: "ethereum", provider: "metamask", walletId: "0x1" };
const signIn = (connection = wallet) =>
    web3_signIn({ walletId: connection.walletId, connection });
/** What the visitor reads when the wallet sign-in throws. */
const failure = async (connection = wallet) => {
    const error = await signIn(connection).then(
        () => null,
        (thrown) => thrown
    );
    return error && describeSignInError(error);
};

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    sign.mockReset();
    nonce.mockReset().mockResolvedValue({ success: true, nonce: "n-1" });
    (global as any).fetch = jest.fn(() => Promise.resolve({ json: nonce }));
});
afterEach(() => jest.restoreAllMocks());

describe("signing in with a wallet", () => {
    test("a signed nonce is returned as before", async () => {
        sign.mockResolvedValue({ type: "ethereum", sig: "0xsig" });
        await expect(signIn()).resolves.toEqual({
            success: true,
            providerId: "ethereum",
            payload: {
                connection: wallet,
                sig: { type: "ethereum", sig: "0xsig" },
                accountId: "0x1",
            },
        });
        expect(sign).toHaveBeenCalledWith("0x1", "n-1", wallet);
    });

    test("closing the signature request is a cancellation, named as such", async () => {
        sign.mockRejectedValue({
            code: 4001,
            message:
                "MetaMask Message Signature: User denied message signature.",
        });
        expect(await failure()).toEqual({
            code: "wallet/signature-rejected",
            message: "You closed the signature request.",
            cancelled: true,
            canRetry: false,
        });
    });

    test("a wallet that fails to sign is a failure that can be retried", async () => {
        sign.mockRejectedValue(new Error("Internal JSON-RPC error."));
        expect(await failure()).toMatchObject({
            code: "wallet/signature-failed",
            message: "Your wallet couldn’t sign the message. Try again.",
            cancelled: false,
            canRetry: true,
        });
    });

    test.each([
        [
            "the nonce is refused",
            () => nonce.mockResolvedValue({ success: false }),
        ],
        [
            "the nonce cannot be fetched",
            () => nonce.mockRejectedValue(new Error("Failed to fetch")),
        ],
    ])(
        "%s: the sign-in could not start, and no signature is asked for",
        async (_name, arrange) => {
            arrange();
            expect(await failure()).toMatchObject({
                code: "sign-in/unavailable",
                message:
                    "Couldn’t start signing you in. Check your connection and try again.",
                canRetry: true,
            });
            expect(sign).not.toHaveBeenCalled();
        }
    );

    test("a Tezos wallet that cannot sign is told to choose another wallet", async () => {
        const tezos = { type: "tezos", provider: "tezos", walletId: "tz1" };
        expect(await failure(tezos)).toMatchObject({
            code: "wallet/cannot-sign",
            cancelled: false,
            canRetry: false,
        });
    });
});

describe("handleFirebaseAuthErrors", () => {
    const thrownBy = (error: any) => {
        try {
            handleFirebaseAuthErrors(error);
        } catch (thrown) {
            return thrown;
        }
    };

    test("always throws, with the sentence for the error’s code", () => {
        expect(thrownBy({ code: "auth/popup-closed-by-user" })).toMatchObject({
            message: "You closed the sign-in window.",
            code: "auth/popup-closed-by-user",
            signInFailure: { cancelled: true, canRetry: false },
        });
        expect(thrownBy({ code: "auth/expired-action-code" }).message).toBe(
            "This link has expired. Ask for a new one."
        );
        expect(thrownBy(new Error("boom"))).toBeInstanceOf(Error);
        expect(thrownBy(undefined)).toBeInstanceOf(Error);
    });

    test("a wallet error passes through with its own case", async () => {
        sign.mockRejectedValue({ code: 4001 });
        const walletError = await signIn().catch((thrown) => thrown);
        expect(thrownBy(walletError).message).toBe(
            "You closed the signature request."
        );
    });

    test("an error nobody mapped is general, never “Something went wrong” alone", () => {
        expect(thrownBy({ code: "auth/internal-error" }).message).toBe(
            "Couldn’t sign you in. Try again, or choose another way to sign in. (auth/internal-error)"
        );
    });
});
