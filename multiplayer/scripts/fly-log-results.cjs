function probeResults(logs) {
    const results = [];
    // fly logs --json emits pretty-printed objects, not necessarily JSONL.
    for (const block of logs.split(/\r?\n(?=\{)/)) {
        try {
            const log = JSON.parse(block),
                message = log.message || "";
            const marker = message.indexOf("LOBBY_PROBE_RESULT ");
            if (marker < 0) continue;
            results.push(JSON.parse(message.slice(marker + "LOBBY_PROBE_RESULT ".length)));
        } catch {}
    }
    return results;
}
module.exports = { probeResults };
