// @ts-check
/**
 * What a game's document may load, from the `network` list in its game.json.
 *
 * A game runs in a sandboxed frame with an opaque origin, which keeps it out
 * of the visitor's account but not off the network. This file turns the hosts
 * a game declared into the Content-Security-Policy its files are served with:
 * its own files plus those hosts, nothing else.
 *
 * Plain CommonJS with no imports, because three places share it: the site's
 * next.config.js (the header), scripts/games (the check) and the tests.
 */

/** The file a published build carries its declaration in, next to index.html. */
const NETWORK_FILE = "network.json";
const MAX_HOSTS = 16;
const MAX_INLINE_SCRIPTS = 8;
const SCRIPT_HASH = /^sha256-[A-Za-z0-9+/]{43}=$/;
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
// A DNS name of two or more labels, optionally any subdomain of it
// ("*.example.com"), optionally a port. Always reached over TLS.
const HOST = new RegExp(
    `^(\\*\\.)?${LABEL}(?:\\.${LABEL})+(?::([1-9][0-9]{0,4}))?$`
);

/**
 * Read a `network` declaration: a list of hosts. Anything else is reported
 * and dropped, so a malformed entry can only narrow what the game reaches.
 * @param {unknown} declared
 * @returns {{ hosts: string[], errors: string[] }}
 */
function readNetwork(declared) {
    /** @type {string[]} */
    const hosts = [];
    /** @type {string[]} */
    const errors = [];
    if (declared === undefined || declared === null) return { hosts, errors };
    if (!Array.isArray(declared))
        return { hosts, errors: ["network must be a list of hosts"] };
    if (declared.length > MAX_HOSTS)
        errors.push(`network lists more than ${MAX_HOSTS} hosts`);
    for (const entry of declared.slice(0, MAX_HOSTS)) {
        const label = typeof entry === "string" ? entry : JSON.stringify(entry);
        const match = typeof entry === "string" && HOST.exec(entry);
        if (!match || entry.length > 253) {
            errors.push(
                `network host ${label} must be a lowercase host name such as "cdn.example.com" or "*.example.com": no scheme, path, address or bare "*"`
            );
        } else if (match[2] && Number(match[2]) > 65535) {
            errors.push(`network host ${label} has no such port`);
        } else if (/(^|\.)[0-9]+(?::|$)/.test(entry)) {
            // A numeric last label is an address, not a name.
            errors.push(`network host ${label} must be a name, not an address`);
        } else if (!hosts.includes(entry)) {
            hosts.push(entry);
        }
    }
    return { hosts, errors };
}

/**
 * Whether a declaration covers a host. "*.example.com" covers its subdomains
 * and not example.com itself, as in a Content-Security-Policy.
 * @param {string[]} hosts
 * @param {string} host hostname, with ":port" unless it is 443
 */
function hostDeclared(hosts, host) {
    const name = String(host).toLowerCase().replace(/\.$/, "");
    return hosts.some((declared) =>
        declared.startsWith("*.")
            ? name.endsWith(declared.slice(1)) &&
              name.length > declared.length - 1
            : name === declared
    );
}

/**
 * The hashes of the inline scripts in a release's own HTML files, as the
 * check recorded them. Anything that is not a SHA-256 source is dropped.
 * @param {unknown} hashes
 * @returns {string[]}
 */
function readInlineScripts(hashes) {
    return Array.isArray(hashes)
        ? hashes
              .filter(
                  (hash) => typeof hash === "string" && SCRIPT_HASH.test(hash)
              )
              .slice(0, MAX_INLINE_SCRIPTS)
        : [];
}

/**
 * The policy for a game's documents.
 *
 * - Code is the release's own files only. Declared hosts serve data, images
 *   and media, never script, so a release stays the files that were checked.
 *   An inline script in the release's own HTML runs by its hash; one that
 *   was added later, or injected, does not.
 * - `data:` and `blob:` are bytes the game already holds (three.js loaders
 *   use both); they reach no server.
 * - 'wasm-unsafe-eval' compiles WebAssembly (texture and mesh decoders).
 *   It does not allow eval().
 * - Frames are the game's own files (a separate UI frame), which get this
 *   same policy.
 *
 * @param {string[]} hosts from readNetwork
 * @param {{ reportUri?: string, inlineScripts?: string[] }} [options]
 *   `inlineScripts` from readInlineScripts; the check collects violations
 *   at `reportUri`
 */
function gameContentSecurityPolicy(hosts, options = {}) {
    const inline = (options.inlineScripts ?? []).map((hash) => `'${hash}'`);
    const https = hosts.map((host) => `https://${host}`);
    const wss = hosts.map((host) => `wss://${host}`);
    const directives = [
        ["default-src", "'none'"],
        ["script-src", "'self'", "'wasm-unsafe-eval'", ...inline],
        ["worker-src", "'self'", "blob:"],
        ["connect-src", "'self'", "data:", "blob:", ...https, ...wss],
        ["img-src", "'self'", "data:", "blob:", ...https],
        ["media-src", "'self'", "data:", "blob:", ...https],
        ["font-src", "'self'", "data:"],
        ["style-src", "'self'", "'unsafe-inline'"],
        ["frame-src", "'self'"],
        ["base-uri", "'none'"],
        ["form-action", "'none'"],
    ];
    if (options.reportUri) directives.push(["report-uri", options.reportUri]);
    return directives.map((directive) => directive.join(" ")).join("; ");
}

/**
 * Header rules for next.config.js: every file of every published game gets a
 * policy. A game with no network.json (or a broken one) reaches only its own
 * files. `:path+` keeps the rule off the /games/<id> page itself.
 *
 * @param {string} gamesDir frontend/public/games
 * @param {{ existsSync: Function, readdirSync: Function, readFileSync: Function }} fs
 * @returns {{ source: string, headers: { key: string, value: string }[] }[]}
 */
function gameNetworkHeaders(gamesDir, fs) {
    const rule = (source, hosts, inlineScripts = []) => ({
        source,
        headers: [
            {
                key: "Content-Security-Policy",
                value: gameContentSecurityPolicy(hosts, { inlineScripts }),
            },
        ],
    });
    // Later rules win, so the per-game ones follow the default.
    const rules = [rule("/games/:id/:path+", [])];
    if (!fs.existsSync(gamesDir)) return rules;
    for (const entry of fs.readdirSync(gamesDir, { withFileTypes: true })) {
        if (
            !entry.isDirectory() ||
            !/^[a-z0-9][a-z0-9-]{0,62}$/.test(entry.name)
        )
            continue;
        let published = {};
        try {
            published = JSON.parse(
                fs.readFileSync(
                    `${gamesDir}/${entry.name}/${NETWORK_FILE}`,
                    "utf8"
                )
            );
        } catch {
            // No declaration published: own files only.
        }
        const { hosts, errors } = readNetwork(published?.hosts);
        rules.push(
            rule(
                `/games/${entry.name}/:path+`,
                errors.length ? [] : hosts,
                readInlineScripts(published?.inlineScripts)
            )
        );
    }
    return rules;
}

module.exports = {
    NETWORK_FILE,
    readNetwork,
    readInlineScripts,
    hostDeclared,
    gameContentSecurityPolicy,
    gameNetworkHeaders,
};
