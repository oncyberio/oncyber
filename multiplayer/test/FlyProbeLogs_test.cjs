const { test } = require("node:test");
const assert = require("node:assert/strict");
const { probeResults } = require("../scripts/fly-log-results.cjs");
test("collects pretty-printed Fly log objects as well as JSON lines", () => {
    const records = [{ message: "Starting machine" }, { message: 'LOBBY_PROBE_RESULT {"region":"cdg","passed":true}' }, { message: 'LOBBY_PROBE_RESULT {"region":"sin","passed":false}' }];
    for (const indent of [undefined, 4])
        assert.deepEqual(probeResults(records.map((r) => JSON.stringify(r, null, indent)).join("\n")), [
            { region: "cdg", passed: true },
            { region: "sin", passed: false },
        ]);
});
test("ignores malformed and unrelated output without manufacturing a pass", () => {
    assert.deepEqual(probeResults("noise\n" + JSON.stringify({ message: "LOBBY_PROBE_RESULT broken" })), []);
});
