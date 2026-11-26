// What a browser test gets when Playwright is, or is not, on the machine.
import assert from "node:assert/strict";
import test from "node:test";
import { browserAnswer } from "./browser.mjs";

test("with Playwright the browser tests run", () => {
    const chromium = { launch() {} };
    for (const ci of [false, true])
        assert.deepEqual(browserAnswer({ chromium }, { ci }), {
            chromium,
            skip: false,
            problem: null,
        });
});

test("without it they are skipped on a person's machine, and say why", () => {
    const answer = browserAnswer(null);
    assert.equal(answer.chromium, null);
    assert.match(answer.skip, /Playwright is not installed \(npm i -g/);
    assert.equal(answer.problem, null);
});

test("without it in CI the run fails: a skipped browser test is not silent", () => {
    const answer = browserAnswer(null, { ci: true });
    assert.match(answer.skip, /Playwright is not installed/);
    assert.match(answer.problem, /In CI the browser tests must run/);
});
