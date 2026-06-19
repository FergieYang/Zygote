"""
tsconfig.py — Annotated reference for tsconfig.json
This file does NOT affect Zygote. TypeScript only reads tsconfig.json.
Delete anytime — purely for learning.

WHAT IS tsconfig.json?
It tells the TypeScript compiler (tsc) HOW to compile your .ts files into .js files.
When you run `npm run compile` or `npm run watch`, tsc reads this file
to know: what JS version to output, where to find source files, where to put output,
and how strict to be about type checking.
"""

tsconfig_json = {

    "compilerOptions": {

        # ============================================================
        # OUTPUT TARGET — What version of JavaScript to compile DOWN to
        # ============================================================

        # TypeScript is a superset of JavaScript. The compiler converts
        # modern TS into plain JS that a runtime (Node.js) can execute.
        # "ES2022" means: output JS using features available in ES2022.
        # VS Code's extension host runs on Node.js 18+, which supports ES2022.
        # If you set this to "ES5", it would compile down to older JS (unnecessary here).
        "target": "ES2022",

        # ============================================================
        # MODULE SYSTEM — How imports/exports are structured in output
        # ============================================================

        # "Node16" = use Node.js 16+ module resolution rules.
        # This means: CommonJS by default (require/module.exports),
        # but supports ES modules if package.json has "type": "module".
        # VS Code extensions use CommonJS, so this is the right choice.
        "module": "Node16",

        # How tsc finds imported modules (node_modules, relative paths, etc.)
        # "Node16" matches the module setting above — they should stay in sync.
        "moduleResolution": "Node16",

        # ============================================================
        # DIRECTORIES — Where source lives, where output goes
        # ============================================================

        # Where compiled .js files are written to.
        # Your src/extension.ts compiles to dist/extension.js
        # This is why package.json has "main": "./dist/extension.js"
        "outDir": "./dist",

        # Where your TypeScript source files live.
        # tsc uses this to mirror the folder structure in outDir.
        # src/agents/foo.ts  -->  dist/agents/foo.js
        "rootDir": "./src",

        # ============================================================
        # STRICTNESS — How picky the type checker is
        # ============================================================

        # Enables ALL strict type-checking options at once:
        #   - noImplicitAny: can't use variables without a type
        #   - strictNullChecks: null/undefined must be handled explicitly
        #   - strictFunctionTypes: function parameter types checked strictly
        #   - and several more
        # This catches more bugs at compile time. Recommended for any serious project.
        "strict": True,

        # ============================================================
        # INTEROP — Compatibility between module systems
        # ============================================================

        # Allows `import x from "module"` syntax even when the module
        # uses CommonJS (module.exports). Without this, you'd need
        # `import * as x from "module"` for CommonJS packages.
        # Almost always set to true in modern projects.
        "esModuleInterop": True,

        # ============================================================
        # MISC SAFETY
        # ============================================================

        # Skip type checking of .d.ts files in node_modules.
        # Speeds up compilation significantly. The library authors
        # already type-checked their code — no need to re-check.
        "skipLibCheck": True,

        # Enforce consistent casing in import paths.
        # On Mac, "File.ts" and "file.ts" resolve to the same file (case-insensitive).
        # On Linux, they DON'T. This flag catches casing bugs that would
        # break on Linux/CI even though they work on your Mac.
        "forceConsistentCasingInFileNames": True,

        # Allow importing .json files with `import data from "./file.json"`.
        # The JSON content becomes a typed object. Useful for config files.
        "resolveJsonModule": True,

        # ============================================================
        # OUTPUT FILES — What extra files tsc generates besides .js
        # ============================================================

        # Generate .d.ts files (type declaration files).
        # These describe the types of your compiled JS — useful if
        # other TypeScript code needs to import from your extension.
        "declaration": True,

        # Generate .d.ts.map files — maps declaration files back to
        # original .ts source. Lets "Go to Definition" in VS Code
        # jump to your actual TypeScript instead of the .d.ts file.
        "declarationMap": True,

        # Generate .js.map files — maps compiled JS back to .ts source.
        # Enables debugging: when you set breakpoints in .ts files,
        # the debugger knows which line of .js corresponds to which .ts line.
        "sourceMap": True,
    },

    # ============================================================
    # INCLUDE — Which files to compile
    # ============================================================
    # "src/**/*.ts" means: all .ts files in src/ and any subfolder.
    # The ** is a glob wildcard meaning "any depth of subfolders".
    # So src/extension.ts, src/agents/claudeAgent.ts, etc. all get compiled.
    "include": [
        "src/**/*.ts"
    ],

    # ============================================================
    # EXCLUDE — Which folders to SKIP (even if they contain .ts files)
    # ============================================================
    "exclude": [
        "node_modules",   # Third-party packages — never compile these
        "dist",           # Output folder — don't recompile your own output
        "webview-ui"      # The React webview has its OWN build process (Vite)
                          # It has its own tsconfig. Compiling it with tsc would conflict.
    ]
}
