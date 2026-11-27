#!/usr/bin/env node
import { main } from "../lib/cli.mjs";

main(process.argv.slice(2)).then(
    (code) => process.exit(code ?? 0),
    (error) => {
        console.error(`oncyber: ${error?.message ?? error}`);
        process.exit(1);
    }
);
