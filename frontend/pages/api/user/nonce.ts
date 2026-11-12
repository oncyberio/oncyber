var cookie = require("cookie");

import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

import { randomStringForEntropy } from "@stablelib/random";

import { cookieSettings } from "../../../utils/cookieSettings";
import { sealNonce } from "@utils/auth/loginNonce";

const message =
    "Welcome to oncyber! Signing this message allows us to make your connection secure.";

export default async (req, res) => {
    await corsMiddleware(req, res);

    const id = randomStringForEntropy(96);

    const nonce = `${message}. (Session id: ${id})`;

    res.setHeader(
        "Set-Cookie",
        cookie.serialize("nonce", sealNonce(nonce), {
            ...cookieSettings,
            maxAge: 120,
        })
    );

    return res.json({ success: true, nonce });
};
