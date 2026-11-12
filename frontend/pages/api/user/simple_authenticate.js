import { cookieSettings } from "../../../utils/cookieSettings";
import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";

const jwt = require("jsonwebtoken");
var cookie = require("cookie");

export default async (req, res) => {
    await corsMiddleware(req, res);

    const { owner, type } = req.body;

    const remote = req.socket?.remoteAddress || "";
    // Development sign-in helper: local dev server and loopback callers only.
    if (
        process.env.NODE_ENV != "development" ||
        !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)
    )
        return res.json({
            success: false,
            message: "Not permitted.",
        });

    if (!owner)
        return res.json({
            success: false,
            message: "Not permitted.",
        });

    const token = jwt.sign({ user: owner, type }, process.env.SECRET_JWT_KEY, {
        expiresIn: "30d",
    });

    console.log(owner);

    res.setHeader(
        "Set-Cookie",
        cookie.serialize(owner.toLowerCase(), token, cookieSettings)
    );

    res.json({ success: true, token: token });
};
