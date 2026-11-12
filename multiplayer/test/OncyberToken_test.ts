import assert from "assert";
import { createHmac } from "crypto";
import { provesUser, verifyOncyberToken } from "../src/identity/oncyberToken";

const b64 = (v: any) => Buffer.from(JSON.stringify(v)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function sign(claims: any, secret: string, alg = "HS256") {
    const head = b64({ alg, typ: "JWT" }), body = b64(claims);
    const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${head}.${body}.${sig}`;
}

describe("Oncyber session tokens", () => {
    const secret = "s".repeat(40);
    before(() => { process.env.SECRET_JWT_KEY = secret; });

    it("verifies the issued account", () => {
        const token = sign({ user: "0xAbC", exp: Math.floor(Date.now() / 1000) + 60 }, secret);
        assert.equal(verifyOncyberToken(token), "0xAbC");
        assert.equal(provesUser("0xabc", token), true);
        assert.equal(provesUser("0xother", token), false);
    });

    it("rejects forged, expired or none-alg tokens", () => {
        assert.equal(verifyOncyberToken(sign({ user: "a" }, "wrong-secret")), undefined);
        assert.equal(verifyOncyberToken(sign({ user: "a", exp: 1 }, secret)), undefined);
        assert.equal(verifyOncyberToken(sign({ user: "a" }, secret, "none")), undefined);
        assert.equal(provesUser("a", undefined), false);
    });
});
