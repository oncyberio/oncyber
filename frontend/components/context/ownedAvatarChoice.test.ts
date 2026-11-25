import { adoptsOwnedAvatar } from "./ownedAvatarChoice";

test("a wallet avatar is put on only when it is the one wanted now", () => {
    // The saved avatar, found in the wallet while another is on show.
    expect(adoptsOwnedAvatar("dickbutt", "dickbutt", "sunshine")).toBe(true);
    // Already on show.
    expect(adoptsOwnedAvatar("dickbutt", "dickbutt", "dickbutt")).toBe(false);
    // The visitor picked another one since: the wallet's stays in the list.
    expect(adoptsOwnedAvatar("dickbutt", "sunshine", "sunshine")).toBe(false);
    // Nothing wanted, or nothing found.
    expect(adoptsOwnedAvatar("dickbutt", null, "sunshine")).toBe(false);
    expect(adoptsOwnedAvatar(undefined, undefined, undefined)).toBe(false);
});
