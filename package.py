"""
package.py — Annotated reference for package.json
This file does NOT affect Zygote. VS Code only reads package.json.
Delete this file anytime — it's purely for learning.
"""

package_json = {

    # ============================================================
    # IDENTITY — How VS Code Marketplace identifies this extension
    # ============================================================
    "name": "zygote",            # npm package name (lowercase, no spaces)
    "displayName": "Zygote",     # Human-readable name shown in VS Code UI
    "description": "A tree-based working surface for AI coding agents.",
    "version": "0.1.0",          # Semver: major.minor.patch — bump for releases
    "publisher": "zygoteai",     # Your VS Code Marketplace publisher ID

    # ============================================================
    # ENGINE — Minimum VS Code version required to install
    # ============================================================
    "engines": {
        "vscode": "^1.100.0"    # ^ means "1.100.0 or higher"
    },

    "categories": ["Other"],     # Marketplace category. Could also use "AI", "Machine Learning", etc.

    # ============================================================
    # ACTIVATION EVENTS — When does VS Code load this extension?
    #
    # RIGHT NOW: Only loads when user runs the "zygote.open" command.
    # The extension sits dormant until then — saves memory.
    #
    # ALTERNATIVES you could use instead or in addition:
    #
    #   "*"
    #       Activate immediately on VS Code startup. Always on.
    #       This is what Cursor/Copilot-style extensions do.
    #       Downside: slower VS Code startup, uses memory even if unused.
    #
    #   "onStartupFinished"
    #       Activate after VS Code finishes loading (not blocking startup).
    #       Good middle ground — always on but doesn't slow the boot.
    #       Best choice if you want Zygote panel to auto-appear.
    #
    #   "onView:zygote.mainView"
    #       Activate when a specific webview/panel becomes visible.
    #       Useful if Zygote has a sidebar panel that VS Code shows automatically.
    #
    #   "onLanguage:python"  /  "onLanguage:typescript"
    #       Activate when user opens a file of that language.
    #       Used by linters, formatters, language servers.
    #
    #   "onUri"
    #       Activate when a URI like vscode://zygoteai.zygote/... is opened.
    #       Used for deep links, OAuth callbacks.
    #
    #   "workspaceContains:**/.zygote"
    #       Activate when workspace has a matching file/folder.
    #       Example: auto-activate if project has a .zygote config.
    #
    # You can combine multiple:
    #   ["onStartupFinished", "onCommand:zygote.open"]
    # This means: activate on startup OR if command is run (whichever first).
    # ============================================================
    "activationEvents": [
        "onCommand:zygote.open"
    ],

    # ============================================================
    # ENTRY POINT — The compiled JS file VS Code runs on activation
    #
    # This file MUST export an activate() function.
    # Points to dist/ because TypeScript source (.ts) gets compiled
    # into JavaScript (.js) in the dist/ folder.
    # ============================================================
    "main": "./dist/extension.js",

    # ============================================================
    # CONTRIBUTES — What this extension adds to VS Code's UI
    # ============================================================
    "contributes": {
        # COMMANDS — These appear in the Command Palette (Cmd+Shift+P)
        # Each "command" string must match what your code registers
        # via vscode.commands.registerCommand(...)
        "commands": [
            {
                "command": "zygote.open",
                "title": "Open Zygote"                     # What user sees in palette
            },
            {
                "command": "zygote.captureSnapshot",
                "title": "Zygote: Capture Debug Snapshot"
            },
            {
                "command": "zygote.dumpTree",
                "title": "Zygote: Dump Tree Context"
            }
        ],

        # CONFIGURATION — Creates settings in VS Code's Settings UI
        # (Preferences > Settings > search "Zygote")
        # Read in code: vscode.workspace.getConfiguration("zygote").get("backend")
        "configuration": {
            "title": "Zygote",
            "properties": {
                "zygote.backend": {
                    "type": "string",
                    "enum": ["auto", "sdk", "cli"],        # Dropdown choices
                    "default": "auto",
                    "description": (
                        "Which backend to use. "
                        "'sdk' = Anthropic API key (for shipping). "
                        "'cli' = Claude Code CLI (free for dev). "
                        "'auto' = SDK if API key exists, otherwise CLI."
                    )
                }
            }
        }
    },

    # ============================================================
    # SCRIPTS — Build commands you run via `npm run <name>`
    #
    # These are NOT runtime commands. They don't "sustain" the webview.
    # They COMPILE your source code into the files that VS Code runs.
    #
    # Think of it like cooking:
    #   - Scripts = the recipe steps (prep work before serving)
    #   - VS Code = the restaurant that serves the finished dish
    #   - You run scripts ONCE to build, then VS Code runs the result
    #
    # During development, you typically:
    #   1. Run `npm run watch` in one terminal (auto-recompiles on save)
    #   2. Press F5 to launch the Extension Development Host
    #   3. The dev host runs the compiled files from dist/
    # ============================================================
    "scripts": {
        # "compile" — Run TypeScript compiler ONCE
        # Reads .ts files, outputs .js files into dist/
        # tsc = TypeScript Compiler, -p ./ = use tsconfig.json in current dir
        "compile": "tsc -p ./",

        # "watch" — Same as compile but WATCHES for changes
        # Every time you save a .ts file, it auto-recompiles
        # Use this during development so you don't manually recompile
        "watch": "tsc -watch -p ./",

        # "build:webview" — Build the webview panel UI
        # cd into webview-ui/ folder, then run Vite bundler
        # Vite takes your React/HTML/CSS and bundles it into static files
        # These static files become the panel content you see in VS Code
        "build:webview": "cd webview-ui && npx vite build",

        # "build" — Full build: compile extension THEN build webview
        # && means "run second command only if first succeeds"
        # Use before packaging or testing a complete build
        "build": "npm run compile && npm run build:webview",

        # "package" — Bundle into a .vsix file for distribution
        # .vsix = the installer file users download from Marketplace
        # or install manually via `code --install-extension zygote-0.1.0.vsix`
        "package": "vsce package"
    },

    # ============================================================
    # DEPENDENCIES — Libraries SHIPPED with the extension
    #
    # When a user installs Zygote, these get bundled in.
    # Your extension code can `import` from these at runtime.
    # The ^ means "this version or newer compatible version"
    # ============================================================
    "dependencies": {
        "@anthropic-ai/claude-agent-sdk": "^0.3.148",  # Claude Agent SDK — runs AI agents
        "@anthropic-ai/sdk": "^0.98.0",                # Anthropic API client — direct Claude calls
        "uuid": "^11.1.0"                              # Generates unique IDs for nodes/sessions
    },

    # ============================================================
    # DEV DEPENDENCIES — Only needed during DEVELOPMENT
    #
    # NOT shipped with the extension. Only used for:
    # - Type checking (the @types/ packages)
    # - Compiling TypeScript
    # - Packaging the .vsix
    # ============================================================
    "devDependencies": {
        "@types/node": "^22.15.0",     # TypeScript types for Node.js APIs
        "@types/uuid": "^10.0.0",      # TypeScript types for uuid library
        "@types/vscode": "^1.100.0",   # TypeScript types for VS Code extension API
        "@vscode/vsce": "^3.3.0",      # Tool that creates .vsix packages
        "typescript": "^5.8.0"         # The TypeScript compiler itself
    }
}
