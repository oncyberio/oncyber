import { logger } from "firebase-functions/v1";
import jwt from "jsonwebtoken";

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY;

export default async function auth(req, res, next) {
    //
    let token = req.headers["x-token"];

    try {
        // logger.info("auth middleware", req.cookies);
        req.user = await verify(token);
        next();
    } catch (err) {
        res.status(401).json({ error: "Unauthorized Access" });
    }
}

export function verify(token): Promise<string> {
    return new Promise((resolve, reject) => {
        jwt.verify(token, SECRET_JWT_KEY, function (err, decoded) {
            if (err) {
                reject("Failed to authenticate token.");
            } else {
                return resolve(decoded.user);
            }
        });
    });
}
