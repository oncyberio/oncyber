const jwt = require("jsonwebtoken");
var cookie = require("cookie");
import { URLSearchParams } from "url";
import { nodeEnv } from "../../env";
import { cookieSettings } from "../../utils/cookieSettings";
import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";
import { encodeNiftyUser } from "../../utils/niftyAssets";

// JSON inside <script>: escape so upstream text can never close the tag.
const safeJson = (data) =>
    JSON.stringify(data ?? null)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");

const html = (data) => `
<!DOCTYPE html>
<html lang="en">
    <body>
        <p>Authenticating&hellip;</p>
        <script>

            function broadcast(type, message) {
                localStorage.setItem(type, JSON.stringify(message));
                localStorage.removeItem(type);
            }

            broadcast("nifty-connect", ${safeJson(data)})
        </script>
    </body>
</html>
`;

let client_id = nodeEnv.NIFTYGATEWAY_CLIENT_ID;
let client_secret = process.env.NIFTYGATEWAY_CLIENT_SECRET;
let nifty_auth_token = nodeEnv.NIFTYGATEWAY_TOKEN_URL;
let redirect_uri = nodeEnv.NIFTYGATEWAY_REDIRECT_URI;
let nifty_api = nodeEnv.NIFTYGATEWAY_API_V1;

export default async (req, res) => {
    await corsMiddleware(req, res);

    res.setHeader("Content-Type", "text/html");

    if (req.query.code) {
        let postData = {
            grant_type: "authorization_code",
            code: req.query.code,
            redirect_uri,
            client_id,
            client_secret,
        };

        // const params = Object.keys(postData)
        //     .map((key) => `${key}=${encodeURIComponent(postData[key])}`)
        //     .join("&");

        let params = new URLSearchParams();
        Object.keys(postData).forEach((key) => {
            params.set(key, postData[key]);
        });

        try {
            console.log(params);
            let result = await fetch(nifty_auth_token, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params,
            }).then((response) => {
                if (response.ok) return response.json();
                else return response.text();
            });

            console.log("RESULT", result);

            if (result.error) {
                res.send(html({ error: "nifty-auth-failed" }));
                return;
            }

            let userData = await fetch(`${nifty_api}/me/`, {
                headers: {
                    Authorization: `Bearer ${result.access_token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            }).then((res) => res.json());

            let owner = encodeNiftyUser(userData.username);
            const token = jwt.sign(
                { user: owner, type: "niftygateway" },
                process.env.SECRET_JWT_KEY,
                {
                    expiresIn: "30d",
                }
            );

            res.setHeader(
                "Set-Cookie",
                cookie.serialize(owner.toLowerCase(), token, cookieSettings)
            );

            res.send(html({ ...userData, token, owner }));
        } catch (error) {
            console.error(error);
            res.send(html({ error: "nifty-auth-failed" }));
        }
    } else {
        res.send(html({ error: "no-token" }));
    }
};
