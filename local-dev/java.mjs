// Finds Java 21+ for the Firebase emulators, or downloads a private copy.
//
// Order: the `java` on PATH, $JAVA_HOME, Homebrew and /usr/lib/jvm installs,
// then a copy already downloaded into local-dev/.java/. If none is new
// enough, it downloads Eclipse Temurin 21 (a JRE, ~50 MB) from Adoptium into
// local-dev/.java/, checks its SHA-256, and uses it from there. Nothing is
// installed system-wide.
//
//   node local-dev/java.mjs             print the Java it would use
//   node local-dev/java.mjs --download  force a fresh download (for testing)

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRIVATE = join(HERE, ".java");
const MIN = 21;
const EXE = process.platform === "win32" ? "java.exe" : "java";

export function javaMajor(bin) {
    const java = spawnSync(bin, ["-version"], { encoding: "utf8" });
    if (java.error) return 0;
    const out = `${java.stderr || ""}${java.stdout || ""}`;
    return Number(/version "(\d+)/.exec(out)?.[1] || 0);
}

const list = (dir) => {
    try {
        return readdirSync(dir).map((name) => join(dir, name));
    } catch {
        return [];
    }
};

/** Every `bin/java` under `dir`, a few levels down (archive layouts vary). */
function findJava(dir, depth = 4) {
    const direct = join(dir, "bin", EXE);
    if (existsSync(direct)) return [direct];
    if (depth === 0) return [];
    return list(dir)
        .filter((path) => {
            try {
                return statSync(path).isDirectory();
            } catch {
                return false;
            }
        })
        .flatMap((path) => findJava(path, depth - 1));
}

function candidates() {
    return [
        process.env.JAVA_HOME && join(process.env.JAVA_HOME, "bin", EXE),
        ...["/opt/homebrew/opt", "/usr/local/opt"].flatMap((root) =>
            list(root)
                .filter((path) => /\/openjdk(@\d+)?$/.test(path))
                .map((path) => join(path, "bin", EXE))
        ),
        ...list("/usr/lib/jvm").map((path) => join(path, "bin", EXE)),
        ...findJava(PRIVATE),
    ].filter(Boolean);
}

const ADOPTIUM_OS = { darwin: "mac", linux: "linux", win32: "windows" };
const ADOPTIUM_ARCH = { x64: "x64", arm64: "aarch64" };

async function download(log) {
    const os = ADOPTIUM_OS[process.platform];
    const arch = ADOPTIUM_ARCH[process.arch];
    if (!os || !arch) {
        throw new Error(
            `no Java download for ${process.platform}/${process.arch}`
        );
    }
    const api =
        `https://api.adoptium.net/v3/assets/latest/${MIN}/hotspot` +
        `?os=${os}&architecture=${arch}&image_type=jre&vendor=eclipse`;
    const assets = await (await fetch(api)).json();
    const pkg = assets?.[0]?.binary?.package;
    if (!pkg?.link || !pkg?.checksum) {
        throw new Error("Adoptium did not list a Java 21 download");
    }
    log(
        `downloading Java ${MIN} (${Math.round(
            pkg.size / 1e6
        )} MB, first run only)`
    );
    const res = await fetch(pkg.link);
    if (!res.ok) throw new Error(`Java download failed: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== pkg.checksum) {
        throw new Error("Java download failed its checksum; try again");
    }

    rmSync(PRIVATE, { recursive: true, force: true });
    mkdirSync(PRIVATE, { recursive: true });
    const archive = join(PRIVATE, pkg.name);
    writeFileSync(archive, bytes);
    // tar ships with macOS, Linux and Windows 10+, and reads .zip on Windows.
    const tar = spawnSync("tar", ["-xf", archive, "-C", PRIVATE], {
        stdio: "inherit",
    });
    rmSync(archive, { force: true });
    if (tar.status !== 0) throw new Error("could not unpack the Java download");
}

/**
 * Directory of a Java 21+ `java` binary, downloading one if needed.
 * `log` reports what happened.
 */
export async function ensureJava(
    log = console.log,
    { forceDownload = false } = {}
) {
    if (!forceDownload) {
        if (javaMajor("java") >= MIN) return null; // PATH is fine as it is
        for (const bin of candidates()) {
            const major = javaMajor(bin);
            if (major >= MIN) {
                log(`using Java ${major} from ${dirname(bin)}`);
                return dirname(bin);
            }
        }
    }
    await download(log);
    const bin = findJava(PRIVATE).find((path) => javaMajor(path) >= MIN);
    if (!bin) throw new Error("the downloaded Java does not run here");
    log(`using Java ${javaMajor(bin)} from ${dirname(bin)}`);
    return dirname(bin);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    ensureJava(console.log, {
        forceDownload: process.argv.includes("--download"),
    })
        .then((dir) => console.log(dir || "java on PATH is new enough"))
        .catch((err) => {
            console.error(err.message);
            process.exit(1);
        });
}
