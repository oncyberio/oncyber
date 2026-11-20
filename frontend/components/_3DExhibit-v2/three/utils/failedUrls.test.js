import { FailedUrls } from "./failedUrls";

test("remembers a failed URL for a while, then lets it be tried again", () => {
    let time = 0;
    const failed = new FailedUrls({ ttlMs: 1000, now: () => time });
    expect(failed.has("https://dead.example/a.png")).toBe(false);
    failed.add("https://dead.example/a.png");
    time = 999;
    expect(failed.has("https://dead.example/a.png")).toBe(true);
    expect(failed.has("https://dead.example/b.png")).toBe(false);
    time = 1000;
    expect(failed.has("https://dead.example/a.png")).toBe(false);
});
