// The browser the tools' own tests run their browser halves in.
//
// Playwright is not a dependency of this repository: the check finds the
// one installed on the machine (`npm i -g playwright`, with NODE_PATH set to
// `npm root -g`, then `npx playwright install chromium`). So a test that
// needs a browser asks here, and gets one of three answers:
//
//   - Playwright is there: `chromium` is Playwright's, `skip` is false.
//   - It is not, on a person's machine: `skip` says why, and each browser
//     test is reported as skipped with that reason.
//   - It is not, in CI (`CI` is set): the browser tests are skipped the same
//     way and the file fails, with one test that says what the workflow
//     must install (.github/workflows/games.yml does). A browser test that
//     quietly stops running in CI is coverage nobody knows is gone.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const HOW =
    "npm i -g playwright && npx playwright install chromium, with NODE_PATH set to `npm root -g`";

/**
 * What a test file gets when Playwright is, or is not, found. `problem` is
 * set where missing it must fail the run.
 */
export function browserAnswer(playwright, { ci = false } = {}) {
    if (playwright?.chromium)
        return { chromium: playwright.chromium, skip: false, problem: null };
    const skip = `Playwright is not installed (${HOW})`;
    return {
        chromium: null,
        skip,
        problem: ci
            ? `${skip}. In CI the browser tests must run, not be skipped.`
            : null,
    };
}

function findPlaywright() {
    try {
        return createRequire(import.meta.url)("playwright");
    } catch {
        return null;
    }
}

/** True in CI, where a test that cannot run fails and is never skipped. */
export const inCi = () => Boolean(process.env.CI);

/**
 * `{ chromium, skip }` for the test file that calls it: see the top of the
 * file. In CI without Playwright it also adds the file's failing test.
 */
export function browserForTests() {
    const { chromium, skip, problem } = browserAnswer(findPlaywright(), {
        ci: inCi(),
    });
    if (problem)
        test("the browser tests can run here", () => assert.fail(problem));
    return { chromium, skip };
}
