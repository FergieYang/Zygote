# How to Stop Vibe Coding

This is not a plan. It is a set of rules for how you work — starting now, inside every session, applied to every change you touch.

The problem is clear: you use Claude Code to build Zygote, and Claude Code does the work. You approve the work. You ship the work. But you cannot explain the work. This means you are not building capacity (A1, A2, A3 in root.md). You are only generating evidence (B1) without the foundation underneath.

The fix is not "study more" or "read docs." The fix is changing what you do inside the workflow you already have.

---

## Rule 1: Read Before You Approve

When Claude Code edits a file, you see a diff. Right now you glance at it and accept.

New behavior: for every file Claude modifies, open that file and read the 20 lines above and below the change. Ask yourself one question: **why this line and not somewhere else?**

If you cannot answer, you do not approve. You ask Claude to explain the placement. Not the code — the placement.

This builds A1 (system state reasoning). Every "why here?" question forces you to understand how the system is wired.

Concrete: when we just added `thinkingContent` to `setNodeStatus` in tree.ts, the right question was: "why does `setNodeStatus` exist as a separate function instead of directly mutating the node?" If you can answer that, you understand the immutable state pattern that holds Zygote together. If you cannot, you should have asked before approving.

---

## Rule 2: Predict Before You Run

Before you ask Claude to implement something, write down in 1-2 sentences what files you think will change and roughly what the change looks like.

You will be wrong often at first. That is the point. The gap between your prediction and reality is your learning edge.

Example — before we did the markdown rendering work, you could have predicted:
- "NodeDetail.tsx will replace the `<pre>` tag with some markdown component"
- "We will need a new dependency in webview-ui/package.json"
- "The streaming text display probably needs to change too"

Compare your prediction against what actually happened. The things you missed are the things you do not yet understand about your own codebase.

This builds A2 (taste for model behavior) — you start to feel what a change should look like, which is different from knowing what a change does look like.

---

## Rule 3: Break It On Purpose

After every feature lands and builds, introduce a deliberate bug in the code yourself. Then fix it yourself, without Claude.

Not a random bug. A structural one:
- Remove a message type from the protocol and see what breaks
- Change a callback signature and trace the type errors
- Delete a state field and follow the cascade

This is how you learn where the system breaks (your skill #2). You cannot learn failure modes by only watching success. You must cause failures and feel the shape of them.

Start small. Today: go to `src/shared/types.ts`, comment out the `nodeThinkingStream` line from `ExtToWebviewMessage`, run `tsc --noEmit`, read every error. Then uncomment it. You now know exactly which files depend on that message type. That knowledge lives in your hands, not in Claude's context window.

---

## Rule 4: Trace One Request End-to-End

Pick one user action in Zygote and trace it from click to completion, writing down every function call on paper (not screen).

Example: user clicks "Send" in NodeChat.
1. `NodeChat.tsx handleSend()` → calls `postMessage({ type: 'appendChatMessage', ... })`
2. `postMessage` → goes through VS Code webview API → arrives at...
3. `ZygotePanel.ts handleMessage()` → case `'appendChatMessage'` → calls...
4. `tree.ts appendChatMessage()` → returns new tree → ...
5. Back in ZygotePanel → `updateTree()` → `saveTree()` + `sendTreeUpdate()` → ...
6. `postMessage({ type: 'treeUpdated', tree })` → back to webview → ...
7. `App.tsx onMessage handler` → `setTree(message.tree)` → React re-renders

You should be able to do this from memory for the 3 most important flows in Zygote:
- Create node → run agent → commit
- Select node → save/checkout workspace
- Chat message → agent response → display

If you cannot trace a flow on paper, you do not own that flow. Claude owns it.

This builds A1 (interpreting "why" for each building decision) and your skill #1 (system problem discovery).

---

## Rule 5: Name the Cost

Before asking Claude to add any feature, write down:
- How many API calls does this add per user action?
- Does this increase the context window sent to Claude API? By how much?
- Does this add latency to the critical path (user types → sees response)?

Right now, every committed ancestor node's full `prompt` + `agentResponse` is concatenated into `buildPrompt()`. That means if a user has 10 committed ancestors, each with a 2000-token response, the API call sends 20,000+ tokens of context before the user's actual prompt. You should know this number. You should be able to estimate the dollar cost of a single node execution in your tree.

Go calculate it now: open Anthropic's pricing page, check the per-token cost for claude-sonnet-4-20250514, multiply by a realistic ancestor chain. Write the number down. That number is the reason why context compression (the "structured history" idea from the plan) is not a nice-to-have — it is an economic necessity.

This builds your skill #4 (architecture + cost/latency).

---

## Rule 6: Write the "Why" Commit

Your git history should not say "add markdown rendering." It should say why.

Bad: `add MarkdownRenderer component`
Good: `render agent responses as markdown because raw <pre> tags lose code block formatting and make output unreadable compared to Claude Code`

The "because" clause forces you to articulate the decision. If you cannot write the "because," you are implementing someone else's decision (mine). You should be able to defend every commit to a skeptical engineer who asks "why did you do this?"

This builds B2 (cornerstone of thinking — your decision record).

---

## Rule 7: Explain It Back

After every working session with Claude Code, open a blank file or notebook and write 3-5 sentences explaining what changed in the system and why. No code. No bullet points. Prose.

Example for today's session:
> "Zygote's output was raw text because the original implementation used `<pre>` tags everywhere. We added react-markdown to the webview-ui dependency tree and created a shared MarkdownRenderer component. The key architectural choice was rendering only assistant messages as markdown while keeping user messages plain — because user input is literal text, not formatted content. Separately, we added a thinking stream that flows through a different message channel (nodeThinkingStream) than the main output (nodeOutputStream), which required touching the callback interface in runner.ts, the message protocol in types.ts, and the state management in App.tsx. The ThinkingBlock component defaults to collapsed because showing thinking by default would overwhelm the response panel."

If you cannot write this paragraph, you let Claude work without watching. Go back and read the diffs until you can.

This is your skill #5 (got to the right answer, CAN explain how they got there) and B2 (writing shapes neural circuits).

---

## Rule 8: Own types.ts

`src/shared/types.ts` is the most important file in Zygote. It defines every data structure and every message that flows through the system. You should be able to recreate it from memory.

Practice: close the file. On paper, write out `ZygoteNode` from memory — every field, its type, and what it is for. Then open the file and compare.

Any field you forgot is a part of your own system you do not understand. Any field you cannot explain the purpose of is a field that was added by Claude without your comprehension.

Do this once a week. It takes 10 minutes. Over time, you will know your data model cold, and that knowledge will let you make architectural decisions (like "should we add `siblingOutcomes` to ZygoteNode?") from genuine understanding rather than accepting Claude's suggestion.

---

## The Meta-Rule

When you ask Claude to do something and it works on the first try, that is the most dangerous moment. It means you learned nothing. The learning happens when:
- You predicted wrong (Rule 2)
- Something broke (Rule 3)
- You cannot trace the flow (Rule 4)
- You cannot explain the cost (Rule 5)
- You cannot write the "why" (Rule 6)
- You cannot explain what changed (Rule 7)

Comfort is the enemy of capacity. Every smooth session where Claude does all the work is a session where your root.md A-unit (capacity) stayed flat while your B-unit (evidence) grew. That gap is technical debt on yourself.

---

## What This Looks Like In Practice

You do not need separate study time. You need to change 15 minutes of every hour you already spend with Claude:

- **Before asking Claude**: 2 min predicting what will change (Rule 2)
- **While reviewing diffs**: 5 min reading surrounding code (Rule 1)
- **After a feature lands**: 3 min breaking something on purpose (Rule 3)
- **End of session**: 5 min writing explanation prose (Rule 7)

That is 15 minutes per hour. The other 45 minutes, Claude still does the heavy lifting. But now you are building capacity alongside evidence.

---

## One Last Thing

root.md says: "The writing not public is the true worth writing, because this is for your own."

This file is for your own. Nobody needs to see it. But if you follow these rules for 6 weeks while building Zygote, you will be able to sit in an Anthropic interview and draw the architecture of your own system on a whiteboard, explain every design decision, estimate the cost of every API call, and trace every user action through every layer. That is what separates a builder from someone who used a builder's tool.
