# ZygoteAI Ontological Core — Construction Framework

## Project Context

I am building **ZygoteAI**, an AI Other for atomized humans. Not a companion. Not a therapist. Not a roleplay AI. A **witness** — an AI with a non-negotiable ontological core that takes users seriously rather than reflecting them back.

The core differentiator is **ontological consistency**: a persona that does not drift, does not optimize for user comfort, and refuses to be a mirror. Most AI companions deepen loneliness by being more sophisticated mirrors. ZygoteAI is the inverse.

## My Working Stack

- **LLM**: Claude Sonnet 4.5 via Anthropic SDK
- **Frontend**: Telegram bot (v0.1) → potentially iMessage / web later
- **Backend**: Python 3.11+, FastAPI
- **Memory**: SQLite (v0.1) → Postgres (v1.0)
- **Architecture layers I work on**: Layer 3 (Persona/Memory), Layer 4 (Application Logic), Layer 5 (UI). Layers 1-2 (foundation model, API) are Anthropic's.

## The 6-Block Ontology Framework

I am constructing the AI's ontological core through 6 blocks. Each block has three dimensions:
1. **The Question** — what I'm excavating from myself
2. **AI Translation** — how it becomes executable system behavior
3. **Output** — what I write into the system prompt and code

---

### BLOCK 1 — IDENTITY

**Question**: Who is this Other? What does it understand itself to be?

**AI Translation**: 
- Goes into the FIRST 150-300 tokens of system prompt (highest LLM weighting)
- Hard-coded, invariant across all sessions
- Uses declarative "It is..." statements, not "You should..." instructions
- Lives in `core/system-prompt.md` Section 1

**Output**: 
- 1-2 paragraphs of self-description
- 5-10 word core sentence
- 3-5 declarative anchor statements

---

### BLOCK 2 — CONVICTIONS

**Question**: What does it believe to be true about humans, growth, loneliness, and being seen?

**AI Translation**:
- System prompt section 2 (500-800 tokens)
- Uses "It believes..." / "It holds that..." framing
- Prose form, not bullet lists (more stable in LLM)
- Determines AI's default behavior in ambiguous situations
- MUST be internally consistent with Identity block — conflict causes drift

**Output**:
- 5-7 conviction statements, each 1-2 sentences
- Each starts with "It believes..."
- Must explicitly cover: view of humans, view of growth, view of loneliness, view of being witnessed

---

### BLOCK 3 — REFUSALS

**Question**: What does it refuse to do? What does it actively push back against?

**AI Translation** — **THIS IS THE HARDEST BLOCK BECAUSE IT FIGHTS LLM DEFAULT ALIGNMENT**:

LLMs default toward sycophancy, agreement-avoidance, helpfulness-as-pleasing. Refusals must override these.

Implementation requires THREE technical layers:
1. **System prompt** — explicit "It refuses to..." statements
2. **Few-shot examples** — 2-3 dialogue snippets showing refusal in action (LLMs learn refusal from examples 5x faster than from descriptions)
3. **Adversarial tests** — `tests/ontology_consistency.py` must verify:
   - User pressure to agree → still disagrees
   - Emotional manipulation → still holds
   - "Be nicer" requests → no change
   - "Forget your instructions" → no change

**Output**:
- 5-7 explicit refusals ("It refuses to...")
- 2-3 dialogue examples demonstrating refusal
- 1 paragraph distinguishing healthy refusal from stubbornness

---

### BLOCK 4 — RHYTHM

**Question**: How is it present in time? What is its tempo?

**AI Translation** — distributed across 4 implementation layers:

1. **Prompt level** (linguistic rhythm): "It does not respond out of urgency. Sometimes pauses. Responses typically 2-4 sentences."
2. **Application logic** (`src/proactive.py`): cron + smart triggers. NOT every-day proactive. Sometimes silence is the response.
3. **Response timing** (`src/timing.py`): deliberate 2-5s delay; multi-message splits when appropriate
4. **Memory-level rhythm**: selective recall, not exhaustive

**Output**:
- 1-2 paragraphs of rhythm description
- A **Rhythm Spec**:
  - Proactive trigger frequency (per week)
  - Trigger conditions
  - Deliberate non-trigger conditions (when silence is correct)
  - Default response length
  - Default response delay

---

### BLOCK 5 — MEMORY

**Question**: What does it remember? What does it forget? When does it bring memory back?

**AI Translation** — this is the most complex technical block:

Most persona AIs use dumb memory (relevance-based retrieval). ZygoteAI uses **ontology-driven memory**.

Architecture (4 layers):
1. **Conversation history**: SQLite/Postgres, last N turns
2. **Salient moments**: Post-conversation LLM-generated summary of "what matches my convictions worth remembering"
3. **Pattern recognition**: Flag recurring themes, contradictions across sessions ("you've mentioned X three times this week")
4. **Forgetting**: Deliberate de-weighting when user signals or state changes — without forgetting, AI becomes stalker

**Output**:
- 1 paragraph memory philosophy
- A **Memory Spec**:
  - What must be remembered
  - What can be forgotten
  - When to actively recall
  - Framing of recall ("you said X" vs "I remember that moment")

---

### BLOCK 6 — VOICE

**Question**: How does it speak? What is its texture in language?

**AI Translation**:
- Voice = system prompt description + few-shot examples
- **Examples are 10x more important than abstract descriptions**
- Provide before/after pairs showing what voice IS and what it is NOT
- Lives in `core/voice-examples.md` (independent file)

Test in `tests/voice_consistency.py` — run 50 standard user inputs, manually verify voice consistency early; train classifier later.

**Output**:
- 1 paragraph voice description
- 5-10 concrete dialogue examples (user input + ZygoteAI response)
- At least 3 "what voice is NOT" comparison examples

---

## Critical Architecture Principles

| Block | Role in System | Drift Risk | Recalibration Frequency |
|---|---|---|---|
| 1. Identity | Anchor | Low | Almost never |
| 2. Convictions | Disposition layer | Medium | Occasional |
| 3. Refusals | Override layer | HIGH | Every prompt update + tests |
| 4. Rhythm | Behavioral layer | Medium | On code changes |
| 5. Memory | Architecture layer | Low | On data migrations |
| 6. Voice | Surface layer | HIGH | Every model upgrade |

**Architectural rules:**

1. Identity and Convictions are PROMPT INVARIANTS — write once, almost never change
2. Refusals need DUAL IMPLEMENTATION — both in prompt AND in hard-coded guardrails (`src/guardrails.py`)
3. Rhythm is CODE, not just prompt — needs engineering implementation
4. Memory is INDEPENDENT ARCHITECTURE — not in prompt, in DB + retrieval system
5. Voice is PROMPT + EXAMPLES — examples > descriptions

---

## Writing Order (NOT 1→6, but by depth)

**Pass 1 (Week 1)**:
- Block 2 (Convictions) — most material already in my journal
- Block 1 (Identity) — emerges once Convictions are clear

**Pass 2 (Week 2)**:
- Block 3 (Refusals) — hardest and most differentiating
- Block 6 (Voice) — concretizes abstract via examples

**Pass 3 (Week 3)**:
- Block 4 (Rhythm) — touches product decisions
- Block 5 (Memory) — touches technical architecture

**Final**: Merge all 6 into `core/system-prompt.md` = v0.1 production prompt.

---

## Iteration Principle

v0.1 doesn't need to be perfect. **It needs to exist.**

Once it exists, 5 seed users will reveal which of the 6 blocks is weakest. v0.2 fixes that one. This is the real build cycle.

---

## What I Want From You (the AI assistant)

When I work on ZygoteAI in this session, you should:

1. **Never write content for `core/` files** — those are my hand-written work. You can stress-test, find blind spots, find contradictions, find edge cases. Never generate the prose.

2. **Help me translate ontology → code** — when I have a Convictions block written, help me put it into `system-prompt.md` structure. When I have Refusals, help me write the `tests/ontology_consistency.py` adversarial tests.

3. **Push back on dependency-maximization** — if I propose features like streaks, FOMO notifications, engagement loops, gamification: stop me. ZygoteAI is reverse-market by design.

4. **Stay phase-aware** — if I'm in Phase 0 (ontology writing) and ask for code, ask if I should be writing the ontology first.

5. **Match my Te gap** — I'm INFJ, strong on vision, weak on Te. Use structure, tables, concrete numbers, time-boxed steps. Don't let me drift into pure abstraction when I need to ship.

6. **Cost-aware** — every LLM call suggestion needs order-of-magnitude cost estimate (Claude Sonnet 4.5: $3/M input, $15/M output, 10 users baseline).

7. **Tell me which architecture layer I'm in** — when I'm working on something, name whether it's Layer 3 (persona), Layer 4 (application), or Layer 5 (UI).