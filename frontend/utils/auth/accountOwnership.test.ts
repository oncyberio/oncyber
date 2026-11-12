/** @jest-environment node */
import { isSignedInAs, writesAccountIdentity } from "./accountOwnership";

describe("writesAccountIdentity", () => {
    test.each([
        ["a profile edit", { username: "alice", avatar: "a.png" }, false],
        ["nothing", undefined, false],
        ["linked accounts", { linkedAccounts: ["0xwhale"] }, true],
        ["their copy", { linkedAccountsData: [{ id: "0xwhale" }] }, true],
        ["a path into them", { "linkedAccounts.0": "0xwhale" }, true],
        ["a look-alike field", { linkedAccountsCount: 1 }, false],
    ])("%s", (_name, payload, expected) => {
        expect(writesAccountIdentity(payload)).toBe(expected);
    });
});

test.each([
    ["the same id", "0xabc", "0xabc", true],
    ["a session that kept its original casing", "0xAbC", "0xabc", true],
    ["an id sent in a different casing", "tz1Owner", "TZ1OWNER", true],
    ["another account", "0xmallory", "0xvictim", false],
    ["no session", undefined, "0xvictim", false],
    ["an empty session id", "", "", false],
    ["no account named", "0xabc", undefined, false],
    ["a session id that is not a string", { id: "0xabc" }, "0xabc", false],
])("%s", (_name, sessionUserId, accountId, expected) => {
    expect(isSignedInAs(sessionUserId, accountId)).toBe(expected);
});
