const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
    const source = fs.readFileSync(file, "utf8");
    const compiled = ts.transpileModule(source, {
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true,
        },
    });
    module._compile(compiled.outputText, file);
};
