// @ts-nocheck
var __asyncValues =
    (this && this.__asyncValues) ||
    function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator],
            i;
        return m
            ? m.call(o)
            : ((o = typeof __values === "function" ? __values(o) : o[Symbol.iterator]()),
              (i = {}),
              verb("next"),
              verb("throw"),
              verb("return"),
              (i[Symbol.asyncIterator] = function () {
                  return this;
              }),
              i);
        function verb(n) {
            i[n] =
                o[n] &&
                function (v) {
                    return new Promise(function (resolve, reject) {
                        (v = o[n](v)), settle(resolve, reject, v.done, v.value);
                    });
                };
        }
        function settle(resolve, reject, d, v) {
            Promise.resolve(v).then(function (v) {
                resolve({ value: v, done: d });
            }, reject);
        }
    };

import { spawn as _spawn } from "child_process";
import _commandExists from "command-exists";
import CLITable from "cli-table3";
import { stringify } from "csv-stringify";
// Constants.
export const XMPContext = {
    dc: "http://purl.org/dc/elements/1.1/",
    model3d: "https://schema.khronos.org/model3d/xsd/1.0/",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    xmp: "http://ns.adobe.com/xap/1.0/",
    xmpRights: "http://ns.adobe.com/xap/1.0/rights/",
};
// Using 'micromatch' because 'contains: true' did not work as expected with
// minimatch. Need to ensure that '*' matches patterns like 'image/png'.
export const MICROMATCH_OPTIONS = { nocase: true, contains: true };
// Mocks for tests.
export let spawn = _spawn;
// See https://github.com/mathisonian/command-exists/issues/22
export let commandExists = (cmd) => _commandExists(cmd).catch(() => false);
export let waitExit = _waitExit;
export function mockSpawn(_spawn) {
    spawn = _spawn;
}
export function mockCommandExists(_commandExists) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    commandExists = _commandExists;
}
export function mockWaitExit(_waitExit) {
    waitExit = _waitExit;
}
export async function _waitExit(process) {
    var _a, e_1, _b, _c, _d, e_2, _e, _f;
    let stdout = "";
    if (process.stdout) {
        try {
            for (var _g = true, _h = __asyncValues(process.stdout), _j; (_j = await _h.next()), (_a = _j.done), !_a; ) {
                _c = _j.value;
                _g = false;
                try {
                    const chunk = _c;
                    stdout += chunk;
                } finally {
                    _g = true;
                }
            }
        } catch (e_1_1) {
            e_1 = { error: e_1_1 };
        } finally {
            try {
                if (!_g && !_a && (_b = _h.return)) await _b.call(_h);
            } finally {
                if (e_1) throw e_1.error;
            }
        }
    }
    let stderr = "";
    if (process.stderr) {
        try {
            for (var _k = true, _l = __asyncValues(process.stderr), _m; (_m = await _l.next()), (_d = _m.done), !_d; ) {
                _f = _m.value;
                _k = false;
                try {
                    const chunk = _f;
                    stderr += chunk;
                } finally {
                    _k = true;
                }
            }
        } catch (e_2_1) {
            e_2 = { error: e_2_1 };
        } finally {
            try {
                if (!_k && !_d && (_e = _l.return)) await _e.call(_l);
            } finally {
                if (e_2) throw e_2.error;
            }
        }
    }
    const status = await new Promise((resolve, _) => {
        process.on("close", resolve);
    });
    return [status, stdout, stderr];
}
// Formatting.
export function formatLong(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
export function formatParagraph(str) {
    return str
        .match(/.{1,80}(\s|$)/g)
        .map((line) => line.trim())
        .join("\n");
}
export function formatHeader(title) {
    return "" + "\n " + title.toUpperCase() + "\n ────────────────────────────────────────────";
}
export var TableFormat;
(function (TableFormat) {
    TableFormat["PRETTY"] = "pretty";
    TableFormat["CSV"] = "csv";
    TableFormat["MD"] = "md";
})(TableFormat || (TableFormat = {}));
const CLI_TABLE_MARKDOWN_CHARS = {
    top: "",
    "top-mid": "",
    "top-left": "",
    "top-right": "",
    bottom: "",
    "bottom-mid": "",
    "bottom-left": "",
    "bottom-right": "",
    left: "|",
    "left-mid": "",
    mid: "",
    "mid-mid": "",
    right: "|",
    "right-mid": "",
    middle: "|",
};
export async function formatTable(format, head, rows) {
    switch (format) {
        case TableFormat.PRETTY: {
            const table = new CLITable({ head });
            table.push(...rows);
            return table.toString();
        }
        case TableFormat.CSV:
            return new Promise((resolve, reject) => {
                stringify([head, ...rows], (err, output) => {
                    err ? reject(err) : resolve(output);
                });
            });
        case TableFormat.MD: {
            const table = new CLITable({ head, chars: CLI_TABLE_MARKDOWN_CHARS });
            table.push(new Array(rows[0].length).fill("---"));
            table.push(...rows);
            return table.toString();
        }
    }
}
export function formatXMP(value) {
    if (!value) {
        return "";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value.toString();
    }
    if (value["@list"]) {
        const list = value["@list"];
        const hasCommas = list.some((value) => value.indexOf(",") > 0);
        return list.join(hasCommas ? "; " : ", ");
    }
    if (value["@type"] === "rdf:Alt") {
        return value["rdf:_1"]["@value"];
    }
    return JSON.stringify(value);
}
export function underline(str) {
    return `\x1b[4m${str}\x1b[0m`;
}
export function dim(str) {
    return `\x1b[2m${str}\x1b[0m`;
}
