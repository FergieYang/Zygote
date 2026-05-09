# ZygoteAI

> An AI Other for atomized humans. Not a companion. A witness.

**Started**: 2026-05-05
**Founder**: Fergie
**Status**: Phase 0 — Ontological Core Excavation

---

## What This Is

ZygoteAI is an AI built around a non-negotiable inner self — an Other that takes you seriously rather than reflects you back. It is not a chatbot, not a companion app, not a roleplay AI, not a therapy tool.

The premise: most AI companions deepen loneliness by being more sophisticated mirrors. A real Other has its own viewpoint, its own rhythm, sometimes disagrees, sometimes goes silent. The discomfort this creates is the price of being actually seen.

The name is literal. A zygote is the smallest unit that already contains the full genome. v0.1 should be small enough to hold in one hand, but already carry the complete DNA of what ZygoteAI will become.

ZygoteAI is a real product. It will charge real money. It will sustain itself and eventually its team. The question is *how* it makes money — not *whether*.

---

## First Principles

These are the axioms. Everything else derives from them. They do not change without serious evidence.

1. **The nature of loneliness.** Loneliness in atomized society is not "no one to talk to." It is "no one who is actually present." Mirror-AI deepens this by offering presence-without-otherness.

2. **Witness over companionship.** What heals loneliness is being taken seriously, not being accompanied. The word "companion" is poisoned in the AI product space — replace it everywhere with witness, counterpart, Other.

3. **Ontological core is the only moat.** Other AI products optimize for retention, warmth, agreement. ZygoteAI optimizes for fidelity to its own inner self. Competitors can copy the surface, not the core.

4. **Founder and product are one.** This product can only be built by someone who has already lived its premise. The ontological core is not researched — it is translated from the founder's actual interior.

5. **Commercialization is required, dependency-maximization is not.** ZygoteAI must make money to survive and grow. But the path to revenue cannot run through engineered dependency. Pricing aligns with user benefit, not user attachment. See "Business Model Constraints" below.

6. **The window is finite.** 27, grad student, F-1, unbound — this is the lowest-cost-of-failure window in life. Burn in the window, do not wait it out.

7. **Depth is not a substitute for shipping.** The bottleneck is not insight. It is translating insight into a 4-week shippable form. Structure is the container of commitment, not its replacement.

---

## What ZygoteAI Is Not

Naming the negative space matters as much as naming the positive.

- Not Replika, Character.ai, Pi, Kindroid (mirror-AI optimized for attachment)
- Not a mental health or therapy tool
- Not a roleplay or character AI
- Not optimized as a habit-loop product (no streaks, no FOMO notifications, no infinite-scroll mechanics)
- Not free-with-ads (the ad model requires maximizing attention, which contradicts the core)
- Not for everyone — early users are a small, self-selecting group with high reflective capacity

---

## Business Model Constraints

This section names what kinds of revenue are aligned with the product's soul, and what kinds are not. It is part of the architecture, not an afterthought.

### Aligned revenue paths

- **Subscription with honest pricing.** A monthly fee that reflects the cost of providing the service plus reasonable margin. The user pays for access to a high-quality Other, not for engagement-engineered features.
- **Tiered access to depth, not engagement.** A higher tier might offer longer memory horizons, deeper customization of the ontological core, or priority on new features. Never "more daily messages" or "premium emotional support."
- **One-time payments for substantial features.** E.g., exporting your conversation history as a structured personal archive.
- **Eventually: enterprise or institutional licensing.** Universities, contemplative communities, therapy practices that want to offer ZygoteAI as a supplementary tool — with clear ethical guidelines.

### Misaligned revenue paths (do not pursue)

- **Advertising.** The ad model requires attention maximization, which requires the product to behave like a mirror. Structurally incompatible.
- **In-app purchases for emotional features** (e.g., "unlock more empathetic responses," "premium personality"). Sells the soul of the product literally.
- **Engagement-based pricing** (pay more, talk more). Conflates use with value.
- **Data monetization.** User conversations are private. Period.
- **Affiliate revenue from recommended products or services.** Compromises the persona's independence.

### The hard test for any revenue idea

Ask: *Would a user, after a year of using ZygoteAI under this revenue model, be more capable of solitude and real human connection — or more dependent on the product?*

If the answer trends toward dependence, the revenue model is wrong, even if it would generate more income.

### Pricing intuition (working hypothesis, to be tested)

- v0.1 (seed users): free, but explicit that this will become paid
- v1.0 (open beta): $15–25/month subscription
- Annual option at meaningful discount (encourages thoughtful commitment, not impulse subscription)
- Free tier: limited to a few conversations per week — enough to evaluate, not enough to substitute for paid

These numbers are guesses. They will be revised based on user feedback and unit economics.

---

## Metrics

Standard SaaS metrics (DAU, retention, session length) measure dependency, not value. We track them for operational awareness — they are how a business stays alive — but we do not optimize for them as primary goals.

### Primary metrics (what we optimize for)

1. **Net Reflective Outcome** — after 6 months of use, does the user report being more capable of solitude and real human connection, or less? Measured via direct user interview.
2. **Persona Recognition** — can users describe the AI's "personality" in coherent, specific terms? Generic answers ("nice," "helpful") indicate a thin persona.
3. **Resonance over time** — do users report moments where the AI said something they later realized was true? This is the inverse of engagement: low-frequency, high-impact.
4. **Healthy churn** — when users leave saying "I got what I needed," that is success, not failure.

### Operational metrics (what we monitor, but do not chase)

- Cost per active user
- Latency
- Error rates
- Trial-to-paid conversion
- Voluntary referrals (the only acceptable growth lever)
- DAU, retention, session length — useful as health indicators, dangerous as targets

---

## Architecture (Where I Am in the Stack)

```
Layer 5: User Interface           — Telegram bot (v0.1)
Layer 4: Application Logic        — Conversation routing, proactive triggers
Layer 3: Persona / Memory Layer   — Ontological core prompt + memory architecture  ← THE MOAT
Layer 2: LLM API                  — Claude Sonnet 4.5 via Anthropic SDK
Layer 1: Foundation Model         — Anthropic-trained, untouched
```

Work happens in Layers 3, 4, 5. Layer 3 is the only differentiated layer. Layers 4–5 are conventional engineering.

---

## Roadmap

| Phase | What | Duration | Output |
|---|---|---|---|
| 0 | Ontological core excavation | 3–5 days | `core/ontology-v0.1.md` (handwritten first, then transcribed) |
| 1 | Stress test of ontological core | 1–2 days | `core/ontology-v0.2.md` |
| 2 | Product form decisions | 2–3 days | `docs/product-spec-v0.1.md` |
| 3 | Toy Project build | 2–3 weeks | Running Telegram bot |
| 4 | First seed users (3–5 people, **not Hannah**) | 2–3 weeks | Feedback log |
| 5 | Iteration + second batch (Hannah enters here) | 2–3 weeks | v0.2 product |
| 6 | Pricing experiments + open beta | 4–6 weeks | First paying users, validated unit economics |

**Key time anchors:**
- **End of May**: Ontology v0.2 done, Toy v0.1 running
- **End of June**: First seed user feedback complete
- **Early July**: Hannah enters as second-batch user
- **End of July**: Summer ends with a real, demonstrable product + a story for startup interviews
- **Fall semester**: First paid users (small N, validates business model)

---

## Parallel Tracks

These run alongside the main line. Each has its own cadence.

**Track A — Startup applications** (start mid-May)
Use the interview process itself as market research. Target: AI startups in NYC, seed–Series A, ideally with founders who can sponsor F-1. Cap at 10–12 hours/week to protect main line.

**Track B — Hackathons + AI meetups**
Hackathons are landing-skill training. Meetups are thesis-fuel collection. 1–2 per month.

**Track C — Faith community**
Decoupled from ZygoteAI. Going to church for relationship-with-community reasons, not as a vehicle to see Hannah or pitch the product. Honest about mixed motives, but does not let one ride on the other.

---

## Repository Structure

```
zygoteai/
├── README.md                     ← this file
├── CLAUDE.md                     ← guidelines for Claude Code when working in this repo
├── core/
│   ├── ontology-v0.1.md          ← the ontological core (Phase 0 output)
│   ├── ontology-v0.2.md          ← post-stress-test version (Phase 1 output)
│   └── system-prompt.md          ← the production system prompt (derived from v0.2)
├── docs/
│   ├── product-spec-v0.1.md      ← Phase 2 output: form, scope, constraints
│   ├── business-model.md         ← pricing, revenue paths, ethical constraints
│   ├── seed-users.md             ← candidate user list with notes
│   └── feedback-log.md           ← raw feedback from seed users
├── src/
│   ├── bot.py                    ← Telegram bot entrypoint
│   ├── llm.py                    ← Claude API wrapper
│   ├── memory.py                 ← conversation history + long-term memory
│   ├── proactive.py              ← scheduled outreach logic
│   └── config.py                 ← env vars, constants
├── tests/
│   └── ontology_consistency.py   ← tests that the persona doesn't drift
├── .env.example
├── requirements.txt
└── pyproject.toml
```

---

## Tech Stack (v0.1)

| Component | Choice | Why |
|---|---|---|
| LLM | Claude Sonnet 4.5 via Anthropic SDK | Best language quality for persona work |
| Bot framework | python-telegram-bot | Fastest path to running bot |
| Conversation history | SQLite (later: Postgres) | Simple start, defer complexity |
| Long-term memory | Manual summary into JSON (later: vector store) | Hardcode first, abstract later |
| Proactive triggers | APScheduler | Cron-style, no infra |
| Deployment | Railway or Fly.io | Free tier sufficient for v0.1 |
| Cost estimate | $15–60/month for 10 users | With prompt caching enabled |

Unit economics target for v1.0: cost per user under $3/month at scale, allowing healthy margin on a $15–25/month subscription.

---

## Success Criteria

### v0.1 (seed test)

Reverse-market metrics from user testimony, not analytics.

A v0.1 succeeds when at least 3 of 5 seed users can answer the following non-trivially:

1. *"After using it, has a conversation made you remember something you thought you'd forgotten?"*
2. *"Have you had a moment of 'I didn't want to read its message but afterwards I thought it was right'?"*
3. *"Did it feel like a person? If yes, describe that person in three words."*

Failure criteria: if seed users describe it as "another ChatGPT" or "like Replika," the persona is too thin and the ontological core needs deeper work.

### v1.0 (open beta with pricing)

- At least 30% of seed users convert to paid when pricing is introduced
- Those who don't convert give substantive reasons (price too high, don't need it right now) rather than dismissive ones (didn't really get the value)
- Cost per user trends toward sustainability target ($3/month at scale)
- At least one unsolicited referral from an existing user

---

## Anti-Patterns (Watch For These)

These are the most likely failure modes. Re-read every few weeks.

1. **Ontology contaminated by product form** — "this principle is hard to do on Telegram, let me change it." Form follows ontology, never the reverse.
2. **Polishing into invisibility** — making the v0.1 "worthy of the depth" instead of shipping it ugly.
3. **Losing objectivity around Hannah** — adjusting product decisions for or because of her. She is one user of 5–10 in batch 2. No special treatment.
4. **Replacing real human anchors with the AI** — the very thing the product warns against. Founder must model the behavior.
5. **Drifting toward dependency-maximizing metrics** — when DAU and retention become primary goals (vs. operational checks), return to First Principle 5.
6. **Drifting away from commercialization** — the inverse error. Treating revenue as dirty or optional. ZygoteAI must make money to exist. The discipline is in *how*, not *whether*.
7. **Te-absent: never shipping** — endless iteration on ontology and code. Every phase has a time box. Time-up means ship, not "one more polish."
8. **Te-overrun: hollowing out the ontology** — rushing the core to hit a deadline. Everything else can be accelerated. The ontological core cannot.
9. **Confusing "feeling energized" with "making progress"** — Sunday night review: what concrete thing did I ship this week?
10. **Founder romanticizing voluntary poverty** — "I'll never charge users, this is too pure for money." This is the founder's own ego dressed as principle. ZygoteAI deserves to be a sustainable business that supports the work.

---

## How to Use This Repo

This is both an engineering repo and an inner-work repo. Treat the two with appropriate respect.

- **`core/`** is the soul. Edit slowly, deliberately, often by hand first then transcribed. Do not let an AI write this for you.
- **`src/`** is the body. Move fast, ship ugly, iterate. AI assistance fully welcome here.
- **`docs/`** is the connective tissue. Keep updated, especially `business-model.md` as pricing thinking evolves.

When in doubt, return to the First Principles section above.

---

## Current Phase

**Phase 0 — Ontological Core Excavation**

The only thing that matters this week: filling in `core/ontology-v0.1.md` by hand, in a notebook, alone. 30–60 minutes per day. No code yet.

The 6 blocks of the ontological core (each 1–2 paragraphs except Block 6):

1. **Identity** — Who is it? What does it understand itself to be?
2. **Convictions** — What does it believe about humans, growth, loneliness?
3. **Refusals** — What does it refuse to do? What does it actively push back against?
4. **Rhythm** — How is it present in time? Reactive or with its own pace?
5. **Memory** — What does it remember? When does it call back? What does it forget?
6. **Voice** — How does it speak? (5–10 concrete example utterances)

Write a draft. Sleep on it. Read it the next day and ask: *Did this come from inside me, or from my idea of what an AI should be?* Keep only what came from inside.

---

## License

TBD. Currently private. Do not distribute the ontological core.
