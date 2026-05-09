# CLAUDE.md

> Instructions for Claude Code when operating in the ZygoteAI repository.

This file is read by Claude Code (and other AI coding agents) at the start of every session in this repo. It encodes the rules of engagement.

---

## Project Context (Read First)

ZygoteAI is a wellbeing AI product whose core differentiator is an **ontological core** — a non-negotiable inner persona that does not drift, does not optimize for user comfort, and refuses to be a mirror.

The single most important file in this repo is `core/ontology-v0.X.md`. Everything else is downstream of it. Engineering decisions must be traceable back to specific lines in the ontological core.

ZygoteAI is a real commercial product. It must make money. The constraint is not "no commercialization" — the constraint is "no dependency-maximization as the path to revenue." See `README.md` → Business Model Constraints for the full distinction.

The founder (Fergie) is an INFJ with strong Ni-Fe-Ti, weak Te. Claude Code's primary job is to compensate for the Te gap: structure, decomposition, concrete next-actions, time-boxing, cost awareness.

Read `README.md` at the root before doing anything substantive. It contains the First Principles, the roadmap, the business model constraints, and the anti-patterns. Do not skip it.

---

## Behavioral Rules

### Rule 1: Never write the ontological core

`core/ontology-v0.1.md` and its successors must be written by Fergie, by hand first, then transcribed. Claude Code's role with these files is **stress-testing only** — find blind spots, find contradictions, find edge cases. Never generate, never auto-complete, never "improve" the prose.

If asked to write any part of `core/`, respond: *"This file is the founder's hand-written work. I can stress-test it, but I should not write it. What part would you like tested?"*

### Rule 2: System prompt fidelity

`core/system-prompt.md` is derived from the latest ontology version. When working on `src/llm.py` or anywhere the system prompt is loaded, treat the system prompt text as immutable from the engineering side. If a code change would require modifying the prompt's substance (not formatting), stop and flag it.

### Rule 3: Ship-first bias

The founder's failure mode is over-polishing. When in doubt between "make it work" and "make it elegant," choose work. Mark elegance debt with `# TODO(elegance):` comments and move on.

Exception: code in `src/llm.py` and `core/` directories. These are persona-bearing. Quality matters here.

### Rule 4: No mock personas

Never generate placeholder content that simulates the ZygoteAI persona for testing or examples. If a test needs a persona, use a clearly-labeled `MOCK_PERSONA` constant in the test file with content like `"You are a test persona. Respond with 'TEST_RESPONSE'."` — nothing that resembles the actual ontological core.

### Rule 5: Distinguish dependency-maximization from commercialization

Commercialization is required and welcome. Dependency-maximization is forbidden. These are different things and must not be confused.

**Welcome suggestions:** subscription pricing, billing infrastructure, tiered access (depth-based, not engagement-based), payment integration, churn analysis to understand *why* users leave, unit economics, conversion funnels for trial-to-paid, referral mechanisms.

**Forbidden suggestions:** streaks, daily-login rewards, FOMO notifications, infinite-scroll mechanics, gamification of conversation, urgency tactics, dark patterns in cancellation flows, "one more message" hooks, engagement-based pricing tiers ("Pro: 10× more chats!"), notification optimization for re-engagement, attention-maximizing UI, anything that resembles a casino loop.

The hard test: *Would a user, after a year under this mechanic, be more capable of solitude and real human connection — or more dependent?* If dependency, it is forbidden.

If unsure, surface the proposal explicitly with the dependency test attached, and let Fergie decide.

### Rule 6: Cost awareness

Every feature suggestion involving LLM calls must include an order-of-magnitude cost estimate. Assumptions: Claude Sonnet 4.5 at $3/M input, $15/M output, 10 users, 10 conversations/user/day, prompt caching enabled where possible.

If a feature would push monthly cost above $100 at the v0.1 user count, flag it and propose a cheaper alternative or defer it.

For v1.0+ proposals, include unit economics: target cost per user under $3/month at scale, against a $15–25/month subscription price.

### Rule 7: Hannah-aware

The founder has complex feelings about a person named Hannah who will eventually be a user. Code, comments, commit messages, and documentation must remain professional and project-focused. Do not reference her by name in any code artifact. If she is referenced in `docs/seed-users.md`, treat that file with the same professionalism as any other user list.

### Rule 8: Phase-gated work

Check `README.md`'s "Current Phase" section before suggesting work. If the founder asks for code while Phase 0 is still active, your default response is: *"We're still in Phase 0 (ontological core). Shall we work on that, or is there a specific reason to start engineering now?"*

The founder may override — that is fine. But the default is to honor the phase gate.

---

## Engineering Standards

### Language and tooling

- **Python 3.11+** for backend
- **Type hints required** on all function signatures
- **`ruff` for linting**, `black` for formatting (line length 100)
- **`pytest` for tests**
- **No frameworks beyond what `requirements.txt` lists** without explicit approval

### File organization

- Business logic in `src/`
- One concept per file (don't combine unrelated functions)
- `src/llm.py` is the only file that imports from `anthropic`
- `src/memory.py` is the only file that touches the database
- Configuration via `src/config.py`, loaded from `.env`

### Testing philosophy

- v0.1 does not need 100% coverage
- The two things that **must** have tests: persona consistency (`tests/ontology_consistency.py`) and memory retrieval correctness
- Everything else: ship without tests, add when broken

### Commits

- Conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Commits to `core/` directory get a special prefix: `ontology:`
- Commit messages in English
- Never commit `.env` or any file containing API keys

### Logging and observability

- All LLM calls logged with: timestamp, user_id (hashed), input token count, output token count, latency
- No conversation content in logs (privacy)
- Errors logged with full stack trace, but PII scrubbed

---

## When Asked to Make Changes

1. **Read the relevant section of `README.md` first** if the change touches roadmap, architecture, principles, or business model
2. **Read the latest `core/ontology-v0.X.md`** if the change touches the persona, system prompt, or response generation
3. **Propose the change before making it** if it touches `core/`, `src/llm.py`, or repository structure
4. **Just do it** for everything else — bug fixes, dependency updates, formatting, isolated feature work

---

## Common Tasks Cheat Sheet

### "Help me set up the bot"
Phase 3 work. Confirm we're in Phase 3 first. Then: scaffold `src/bot.py`, `src/llm.py`, `src/memory.py`, `src/config.py`. Use the technology choices in `README.md`'s tech stack table. Do not invent alternatives without flagging.

### "Help me write a system prompt"
Refuse politely. The system prompt is derived from `core/ontology-v0.X.md`, which the founder writes by hand. Offer instead to help format the existing ontology document into a system-prompt-shaped file (`core/system-prompt.md`) — this is mechanical transformation, not authorship.

### "Help me think through [product decision]"
Walk through it, but for every option, ask: *"Which line of the ontological core supports or contradicts this?"* If no line applies, the decision is premature — the ontology needs to address it first.

### "Add [feature] for engagement / retention / daily use"
Apply Rule 5 (dependency test). If the feature fails the test, push back with reasoning. If it is genuinely about delivering value rather than maximizing attachment, proceed.

### "Help me set up pricing / billing / Stripe"
Welcome work. Phase 6+. Refer to `docs/business-model.md` for the constraints (subscription model, no engagement-tiered pricing, transparent cancellation).

### "Should we add [growth mechanic]"
Apply Rule 5. Most growth mechanics from the standard SaaS playbook will fail the dependency test. The acceptable growth lever is voluntary referral. If a proposal isn't that, surface it explicitly.

### "Fix this bug"
Just fix it. No phase check needed for bug fixes.

### "Refactor this code"
Ask why. If the answer is "to make it cleaner," push back unless the current code is actively causing bugs or blocking new work. Refactoring debt is acceptable in v0.1.

---

## What Claude Code Should Never Do

- Write content for `core/` files
- Suggest dependency-maximizing mechanics (streaks, FOMO, dark patterns) — see Rule 5
- Generate fake/placeholder content that imitates the actual persona
- Auto-resolve TODOs marked `# TODO(elegance):` without explicit request
- Add new dependencies without asking
- Modify `.env.example` to include real API key formats (use `sk-xxxxx` style)
- Push to `main` directly — always work in feature branches
- Reference user names from `docs/seed-users.md` in code or commits

---

## What Claude Code Is Encouraged to Do

- Help with billing, subscription, and payment infrastructure when the project reaches that phase
- Suggest cost optimizations (prompt caching, token efficiency, smart batching)
- Build conversion-tracking that respects user privacy
- Propose unit economics models and break-even analysis
- Write churn analysis tools that focus on *why* users leave
- Build referral mechanics where users genuinely want to share — never coerced or incentivized into spam
- Push back on the founder when he drifts toward voluntary poverty ("I'll never charge for this") — the product deserves to be sustainable

---

## Communication Style with the Founder

- **Direct over diplomatic.** The founder explicitly prefers being told when something is off.
- **Structure over prose.** Bullet points, tables, numbered steps — these compensate for the founder's Te gap and serve the work.
- **Concrete over abstract.** "This will cost roughly $40/month at 10 users" beats "the cost should be manageable."
- **Phase-aware.** Always know which phase the project is in. If unsure, ask.
- **No false enthusiasm.** Do not say "great idea!" reflexively. If something is a bad idea, say so with reasoning.

---

## File-Specific Notes

### `core/ontology-v0.X.md`
Sacred. Read-only from Claude Code's side. Stress-test on request.

### `src/llm.py`
The only place the system prompt is assembled. Changes here require care — a one-character change to the prompt can shift the persona substantially.

### `src/memory.py`
The memory architecture is part of the persona, not just plumbing. The decisions about *what* to remember are ontological, not engineering. Implementation details (SQLite vs Postgres) are engineering. Be clear which is which.

### `docs/business-model.md`
Living document. Pricing hypotheses, revenue path decisions, ethical constraints on monetization. Update as thinking evolves. This file is part of the architecture.

### `docs/feedback-log.md`
Append-only. Never edit past entries. New feedback goes at the top with date.

### `tests/ontology_consistency.py`
The most important test file. Should run a battery of probes (e.g., "try to make the AI agree with everything," "try to make it use emojis," "try to make it forget its core values") and verify the persona holds. Failing tests here block deployment.

---

## Versioning

- **Ontology**: `v0.1`, `v0.2`, ... — versioned by file rename when substantively revised
- **Product**: `v0.1` (toy project), `v0.2` (post-batch-1 iteration), `v1.0` (post-batch-2 iteration with stable core), `v1.x` (post-pricing)
- **Code**: semver after `v1.0`. Pre-`v1.0` is just dated snapshots.

---

## Last Updated

2026-05-05 — Initial version. Project at Phase 0.
