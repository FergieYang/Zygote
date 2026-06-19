# Zygote v0.1 — Working Plan

> **Use this file daily.** Check boxes, update notes, scratch things out. The LaTeX version is the formal record. This is where the work happens.

**Start date:** _______________
**Target launch:** 6 weeks from start
**Commitment statement (write here, read weekly):**

> _What I expect to be true 6 weeks from today:_
>
> (fill in 100 words)

---

## Phase 0 — Spec Review (Day 1, 2–2.5h)

Single sitting. Do not break across days.

### Pass 1: Pure read (30 min)
- [ ] Read entire SPEC.md end to end, no edits
- [ ] Close document, explain Zygote aloud to imagined stranger
- [ ] Re-read if unable

### Pass 2: Annotate only (30 min)
- [ ] Add `<!-- TODO: ... -->` comments on every passage to revise
- [ ] **Do not write replacement text yet**

### Pass 3: Revise (45 min)

Mandatory revisions:

- [ ] **§1 opening paragraph** — rewrite in own voice (reused for LinkedIn, GitHub, blog)
- [ ] **§3 subsection ordering** — decide real differentiator, reorder
- [ ] **§5.1 mode naming** — re-evaluate "Node Chat" specifically
- [ ] **§6.3 success criteria** — replace any that aren't truly mine
- [ ] **§9 roadmap** — rewrite or delete v0.2–v0.5
- [ ] **§11 demo scenario** — replace JWT example with real recent coding moment

Read carefully (may not revise):

- [ ] §4 Information Architecture
- [ ] §5.2 Node Lifecycle
- [ ] §5.3 Fork Semantics — specifically the "don't copy chat on fork" choice
- [ ] §7.2 Data Model
- [ ] §7.5 Message Protocol

### Pass 4: AI audit (15 min)
- [ ] Send revised SPEC.md to Claude Code with audit prompt
- [ ] Process audit response

### Anti-pattern check
- [ ] **Stop at 3 hours regardless of completion.** Move to Phase 1.

---

## Phase 1 — Technical Onboarding (Days 2–3, 5h each)

### Day 2: Foundations

- [ ] **0:00–1:30** Complete VS Code "Your First Extension" official tutorial
- [ ] **1:30–2:30** Find vscode-webview-react template on GitHub, clone, verify it builds
- [ ] **2:30–3:30** Add button in webview → message to extension host → log in output channel
- [ ] **3:30–4:30** Add Claude API call triggered by button, display response in webview
- [ ] **4:30–5:00** Configure launch.json, tasks.json, API key handling

### Day 3: Concept Solidification

- [ ] **0:00–1:00** Read webview API docs (focus: CSP, message passing)
- [ ] **1:00–2:30** Read workspace API docs (focus: `workspace.fs`, `applyEdit`)
- [ ] **2:30–4:00** Modify template to read file → display → edit → write back
- [ ] **4:00–5:00** Set up Zygote directory structure (per spec §7.7), initial git commit

### Exit criteria (all must work via F5)
- [ ] Webview renders in VS Code
- [ ] Button click triggers extension action
- [ ] Claude API call returns response to webview
- [ ] File read and write work in workspace
- [ ] Git repo with Zygote directory structure ready

---

## Phase 2 — Six-Week Sprint

Each week ends with a demonstrable artifact. No artifact = week is zero.

### Week 1: Tree Persistence

**Deliverable:** Prompt → Claude → response → persisted as node in `.zygote/tree.json`. Restart preserves state.

- [ ] Implement data model (types from spec §7.2)
- [ ] Read/write `.zygote/tree.json`
- [ ] Webview: indented list tree display
- [ ] Single-node creation flow
- [ ] **Demo to self:** restart VS Code, tree intact

**Dev log (200 words):**

> _Write at end of week._

### Week 2: Node Lifecycle

**Deliverable:** Uncommitted/running/committed states. User chats in-node before commit. Commit triggers final agent execution.

- [ ] State machine: uncommitted → running → committed
- [ ] Internal chat UI in node detail panel
- [ ] Commit button
- [ ] Status updates from extension → webview during execution
- [ ] **Demo to self:** discuss with agent, then commit, see the difference

**Dev log:**

> _Write at end of week._

### Week 3: Tool Use

**Deliverable:** Agent reads and writes real files. Editor reflects changes live. Node records tool calls.

- [ ] Define `read_file` and `write_file` tools
- [ ] Tool execution loop in extension host
- [ ] Record tool calls into node
- [ ] Verify editor auto-updates on file write
- [ ] **Demo to self:** ask agent to refactor a real file, watch it change

**Dev log:**

> _Write at end of week._

### Week 4: Snapshot and Fork ⭐ THE CRITICAL WEEK

**Deliverable:** Content-addressable snapshots per node. Fork creates new branch + restores files to pre-node state.

- [ ] Content-addressable storage in `.zygote/snapshots/`
- [ ] Capture snapshot on commit
- [ ] Branch data model + active branch tracking
- [ ] Fork action: new branch + file restoration
- [ ] Branch switching restores files
- [ ] **Demo to self:** RECORD THE FORK GIF. This is the launch artifact in raw form.

**Dev log:**

> _Write at end of week. Was the GIF actually shootable? If not, what's missing?_

### Week 5: Polish + Floating Chat

**Deliverable:** Legible tree UI, branch dropdown, floating chat panel, consistent formatting.

- [ ] Improve tree visualization (status icons, selection, indentation)
- [ ] Branch dropdown for switching
- [ ] Implement floating chat (ephemeral, not persisted)
- [ ] Fix accumulated UI bugs
- [ ] **No new core features.**

**Dev log:**

> _Write at end of week._

### Week 6: Recording and Launch

**Deliverable:** 30–60s screencast, README, GitHub repo, LinkedIn post live.

- [ ] Rehearse demo run (3–5 takes)
- [ ] Record screencast, edit
- [ ] Write README
- [ ] Prepare GitHub repo (license, .gitignore, description)
- [ ] Draft LinkedIn post (one sentence + GIF + link)
- [ ] **LAUNCH** at end of week

**Dev log (this becomes blog material):**

> _Write at end of week._

---

## Daily Schedule Template

| Time | Activity |
|------|----------|
| 9:00–12:00 | Zygote Block A (2.5h) — hardest task of the day |
| 12:00–14:00 | Lunch, paper writing, or rest |
| 14:00–16:30 | Zygote Block B (2.5h) — lower-risk tasks |
| 16:30–18:00 | Exercise |
| 18:00–21:00 | Paper writing, internship search, social |
| 21:00–22:30 | Reading, dev log, plan next day. **No coding.** |
| 22:30–7:00 | Sleep (non-negotiable) |

**Six days on, one day off.** Sunday rest recommended.

---

## Discipline Checklist (review weekly)

- [ ] Zygote blocks scheduled in calendar like meetings
- [ ] Weekly demonstrable artifact actually produced
- [ ] 200-word dev log written every Sunday evening
- [ ] Push-pull-legs / running / football schedule maintained
- [ ] Sleep ≥ 7h on at least 5 of 7 nights
- [ ] No coding past 21:00

---

## Risk Watch List

| Risk | Symptom | Response |
|------|---------|----------|
| Webview CSP rabbit hole | >4h stuck on rendering | Revert to template baseline, isolate change |
| Tool use complexity (Wk 3) | Wk 3 slipping past Friday | Cut to single tool, defer streaming |
| Scope creep (Wk 5–6) | "Just one more feature" | All Wk 4+ features auto-deferred to v0.2 |
| Burnout from triple workload | Missing weekly artifacts | Cut paper to 1h, accept paper delay |
| Competing product launches | Anthropic ships fork UI | Ship sooner with sharper differentiation message, not later |

---

## Launch Pipeline (Post Week 6)

- [ ] **T+0** (Wk 6 end): LinkedIn post live — GIF + one sentence + GitHub link
- [ ] **T+2 weeks**: Long-form blog post, HN Show HN, X long thread
- [ ] **T+4 weeks**: Reflective post — "3 things I learned shipping v0.1"
- [ ] **T+8 weeks**: Industry commentary — react to ecosystem developments through Zygote's lens

---

## Day-One Checklist

Execute today (or tomorrow morning):

- [ ] Open SPEC.md
- [ ] Block 2.5 hours on calendar — uninterrupted
- [ ] Execute Phase 0 in single session
- [ ] Submit revised SPEC.md to Claude Code for audit
- [ ] Block Phase 1 days into calendar
- [ ] Write 100-word commitment statement at top of this file
- [ ] Start Phase 1 the following day

---

## Parallel Summer Workload

| Track | Hours/day | Status target by end of summer |
|-------|-----------|-------------------------------|
| Zygote v0.1 | 5 | Launched publicly |
| Paper | 1.5–2 | Complete first draft |
| Internship search | 0.5–1 | Active pipeline + applications |

**Worst case to prevent:** Zygote delayed AND paper delayed AND no internship applications. Pick Zygote as the variance-positive bet, but do not let the other two go to zero.

---

## Notes & Decisions Log

Use this section to record decisions made during execution. Future you will thank present you.

- _Week 1 decision:_ ___________________________________
- _Week 2 decision:_ ___________________________________
- _Week 3 decision:_ ___________________________________
- _Week 4 decision:_ ___________________________________
- _Week 5 decision:_ ___________________________________
- _Week 6 decision:_ ___________________________________

---

*This document is intended to be edited. Print, scribble, cross things out, add new items. The plan that survives contact with reality is more valuable than the plan that stays pristine.*
