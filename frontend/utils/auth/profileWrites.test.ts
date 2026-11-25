/** @jest-environment node */
import {
    markProfileWritten,
    profileWrittenAt,
    PROFILE_WRITTEN_COOKIE,
} from "./profileWrites";

jest.mock("@utils/firestore/userProfiles", () => ({
    POSITIVE_PROFILE_TTL_MS: 2 * 60 * 60 * 1000,
}));

function response(existing?: string | string[]) {
    const headers: Record<string, any> = {};
    if (existing) headers["Set-Cookie"] = existing;
    return {
        headers,
        getHeader: (name: string) => headers[name],
        setHeader: (name: string, value: any) => {
            headers[name] = value;
        },
    };
}

test("a write leaves its time in the browser for as long as a copy can live", () => {
    const res = response();
    markProfileWritten(res, 1_700_000_000_000);
    expect(res.headers["Set-Cookie"]).toBe(
        `${PROFILE_WRITTEN_COOKIE}=1700000000000; Max-Age=7200; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
});

test("it keeps the cookies the response already sets", () => {
    const res = response("session=abc; Path=/");
    markProfileWritten(res, 5);
    expect(res.headers["Set-Cookie"]).toEqual([
        "session=abc; Path=/",
        expect.stringContaining(`${PROFILE_WRITTEN_COOKIE}=5;`),
    ]);
});

test("the mark is read back as a time, and ignored when it is not one", () => {
    const now = 1_700_000_000_000;
    const at = (value?: string) =>
        profileWrittenAt(
            value === undefined ? {} : { [PROFILE_WRITTEN_COOKIE]: value },
            now
        );
    expect(at(String(now - 5_000))).toBe(now - 5_000);
    expect(at()).toBeUndefined();
    expect(at("soon")).toBeUndefined();
    expect(at("-1")).toBeUndefined();
    // A time well in the future would shut every cached copy out.
    expect(at(String(now + 60 * 60 * 1000))).toBeUndefined();
    expect(profileWrittenAt(undefined, now)).toBeUndefined();
});
