# Zygote 战略路线图

**Three-Phase Strategy: Product → Research → Paradigm**

*Version 1.0 — May 27, 2026*

---

## 0. Executive Summary

本文档定义了 Zygote 项目未来 18-24 个月的战略路线图。计划分为三个 phase，每个 phase 都有具体 deliverable、明确 success criteria、以及与 long-term goal 的清晰连接。

**Long-term goal**: 通过 portfolio 建设（product + research + thoughtful exploration），进入 Anthropic 或类似前沿 AI 实验室，获得 O-1 签证 path，长期 contribute to AI 与 human wellbeing 的交集领域。

**Strategic insight**: Value 不在某个 single breakthrough，而在 cumulative portfolio。每一个 phase 既是 end 也是 beginning，每个 milestone 都是 application opportunity，不需要等待"完美时刻"。

---

## 1. North Star

### 1.1 终极方向

构建 **non-linear AI workflow** 这一研究 / 产品方向上的 recognized contributor。具体路径：

- **Product layer**: Zygote — VS Code extension 形态的 tree-structured AI coding tool
- **Research layer**: 关于 hierarchical / branched LLM workflow 的 empirical paper
- **Theoretical layer**: 对当前 LLM paradigm 在 non-linear reasoning 任务上局限性的批判性 articulation

### 1.2 12-18 个月 milestone

- Zygote v0.1 在 VS Code Marketplace 上线
- 至少 1 篇 peer-reviewed paper 投稿或接收（UIST / CHI / 或 ML workshop）
- 完成至少 1 次小规模 fine-tuning 实验
- 与 NYU HCI faculty 建立 informal advising 关系
- 在 Twitter / Hacker News / 公众号上建立 narrow but credible audience

### 1.3 战略原则（应贯穿所有 phase）

1. **Value is cumulative**: 不依赖任何 single artifact 决定成败
2. **Apply at every milestone**: 不等待 perfect moment 才 reach out
3. **Sustainable > heroic**: 不可持续的 sprint 会摧毁整个 18 个月计划
4. **Honest evaluation at checkpoints**: 每个 phase 结尾必须 honest assess，必要时 pivot
5. **Multiple paths to same destination**: Anthropic 是 target 之一，不是 only target

---

## 2. Phase 1: Foundation (Product Layer)

### 2.1 Timeline

**Start**: 现在 (Late May 2026)  
**End**: September 2026  
**Duration**: ~14 weeks

### 2.2 Phase Goal

Ship Zygote v0.1 with **true tree-structured architecture**，不只是 linear chat 套上 hierarchical UI。

### 2.3 关键 Architectural Decisions

#### 2.3.1 Context Construction Layer (核心架构决策)

当前 zygote 的 critical question：当 user 在某个 node 上 send message 时，发给 Claude API 的 context 包含什么？

四个 architectural choice：

- **(a) Isolated**: 仅当前 node 的 chat history
- **(b) Ancestor-aware**: 当前 node + 所有 ancestor nodes 的 chat history
- **(c) Tree-context**: Full ancestor chain + compressed sibling context
- **(d) State-bound**: Ancestor chain + 沿路径的 file state snapshots

**v0.1 目标**: 实现 (b) 或 (c)，为 v0.2 迈向 (d) 打好 foundation。

#### 2.3.2 4-State Lifecycle

实现 spec 中定义的 node lifecycle：

`draft → previewing → preview-complete → committed`

每个 state 都对应 specific UI 状态和 backend behavior。Reject preview 后回到 draft，commit 后状态 frozen 并产生 file snapshot。

#### 2.3.3 File State Binding

在 v0.1 阶段可以是 simplified version：

- 每个 committed node 记录该 commit 涉及的 file 列表
- 简单 snapshot 机制（不必 full Git-like content-addressable storage）
- Fork 时能恢复到 parent node 的 file state

完整 file state binding（spec 中的 d 路线）可以推到 v0.2。

### 2.4 Phase 1 Deliverables

| Deliverable | Acceptance Criteria |
|---|---|
| Bug fixes | 当前 tree 中的 error nodes (interetation, hello) 全部 resolved |
| Architecture refactor | API call function 实现 (b) 或 (c) 级别 context construction |
| 4-state lifecycle | 完整实现并 UI 上 visible |
| Basic file snapshot | Fork 能 restore 文件状态 |
| Documentation | README + Architecture overview + Demo GIF |
| Marketplace listing | VS Code Marketplace 上 published |
| Early users | 5-10 个 developer (NYU 同学 / Twitter 接触者) 实际试用并 give feedback |

### 2.5 Phase 1 Success Criteria

- v0.1 可以 reproducibly install 并 run
- 一个 developer 第一次使用能在 5 分钟内 understand 核心 concept
- Architecture 经得起 critique（能 articulate 与 Cursor / Claude Code 的本质区别）
- 至少 3 个 early user 表示"这个 paradigm 对我有意义"

### 2.6 Phase 1 Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Pure vibe coding 让 architecture drift 回 chat | 每天 1 小时 hand-read code，own types.ts / 核心 modules |
| Scope creep（试图在 v0.1 实现 d 路线） | 严格 stick to (b)/(c)，complete features delayed to v0.2 |
| Burnout from sprint | 周日完全 off，至少 6.5 小时睡眠，温泉作为合法 recovery |
| Lose sight of competitive landscape | Week 8 时做 1 次 competitive scan（看 Anthropic / Cursor 新发布） |

### 2.7 Phase 1 Daily / Weekly Cadence

- **Daily**: 至少 1 小时无 AI 的 code reading + 2-4 小时 AI-assisted development
- **Weekly**: 周日 dev log 记录进度，周末做 1 次 architecture review
- **Bi-weekly**: 与 1 个 trusted peer (NYU 同学 / 同行) check-in

---

## 3. Phase 2: Empirical Research

### 3.1 Timeline

**Start**: October 2026  
**End**: April 2027  
**Duration**: ~28 weeks  
**Overlap with Phase 1**: 后期 1 个月可以 plan-mode 准备

### 3.2 Phase Goal

将 Zygote 从 "a project" 转化为 "a research artifact"——通过 empirical work 产生 publishable insights。

### 3.3 双 Track 并行

#### Track A: HCI Empirical Study

**Research question**: Does tree-structured AI workflow improve developer outcomes on multi-step coding tasks compared to linear chat interfaces?

**Methodology**:
- 15-30 developer participants
- Within-subjects design: same task on Zygote vs Claude Code / Cursor
- Measures: task completion time, error rate, subjective satisfaction, qualitative feedback
- IRB approval through NYU (需要 advisor support)

**Target venue**: UIST 2027 (deadline April 2027) 或 CHI 2027 (deadline September 2026 — 可能 too tight)

**Output**: Full paper (~10 pages, ACM format)

#### Track B: LLM Fine-tuning Investigation

**Research question**: Can fine-tuning a small open-source model on tree-structured workflow data improve performance on branched coding tasks?

**Methodology**:
- Base model: Llama 7B 或 Qwen 7B (LoRA fine-tuning, manageable compute)
- Training data: Synthetic tree-structured workflow examples (生成方式 TBD)
- Baselines: Claude API, vanilla base model, GPT-4o
- Benchmark: Custom benchmark on multi-step / branched tasks

**Compute budget**: $500-2000 (self-funded or AWS credits)

**Target venue**: NeurIPS / ICML workshop, 或 ML4Code workshop, 或 technical report on arXiv

**Output**: Short paper (4-8 pages) + open-source model release

### 3.4 Decision Point — End of November 2026

到 November 2026 时 honest assess：

- Track A 是否有足够 user data 可以 sustain 一个 paper?
- Track B 是否 financially / 计算上 viable?
- 自己的 energy 和 time 是否能 sustain both tracks?

**可能 outcomes**:
- 只继续 Track A（HCI paper）
- 只继续 Track B（ML paper）
- 两个都做（如果时间允许）
- Pivot 到 Track C（见下）

#### Track C (Fallback): Position / Survey Paper

如果两个 empirical tracks 都不 viable，fallback 到一篇**position / survey paper**：

- "On the Linear Tyranny of Chat Interfaces in AI-Assisted Software Engineering"
- 不需要 empirical study，是 conceptual + literature-based
- Target: workshop / opinion venue
- 仍然是 publishable evidence

### 3.5 Phase 2 Deliverables

| Deliverable | Acceptance Criteria |
|---|---|
| Advisor relationship | 至少 1 个 NYU HCI 或相关 faculty 同意 informal advise |
| IRB approval (if Track A) | NYU IRB 通过 user study protocol |
| User study data | 15+ developer 完成 study session（如果 Track A）|
| Fine-tuned model | Open-sourced on HuggingFace（如果 Track B）|
| Paper draft | Complete first draft by January 2027 |
| Paper submission | At least 1 submission by April 2027 |

### 3.6 Phase 2 Success Criteria

- Paper submitted (acceptance 不是 within 我们 control，但 submission 是)
- 至少 1 个 mentor / advisor 公开 endorsement 我们 work
- Zygote 在 Phase 2 期间 reach 1K+ GitHub stars
- 至少 1 篇 dev blog 在 HN / Twitter 上 reach 1K+ engagement

### 3.7 Phase 2 Risks & Mitigation

| Risk | Mitigation |
|---|---|
| No HCI faculty 愿意 advise | 早期（Phase 1 中期）就开始 outreach |
| User study 招不到 participants | Use NYU CDS / CS Slack，offer compensation if needed |
| Fine-tuning 计算成本超出预算 | Lambda Labs / Modal credits + 学校 cluster access |
| Paper rejection | 准备 multiple venue submissions，rejection 是 normal |

---

## 4. Phase 3: Paradigm Exploration

### 4.1 Timeline

**Start**: April 2027 (Phase 2 submission 之后)  
**End**: Graduation (estimated May 2027 或后续)  
**Duration**: 1-3 个月 active work + ongoing exploration

### 4.2 Phase Goal

Demonstrate **thinking at frontier-level**——不是 claim "I solved LLM paradigm"，而是 articulate 当前 paradigm 的 specific limitations 以及 alternative architectures 的可能方向。

### 4.3 Honest Caveat

真正"超越 LLM paradigm"的 research 是 PhD-level multi-year work，需要：
- Senior research advisor
- Significant compute resources (millions of dollars)
- Research team
- Years of focused work

**单人 6 个月 in MS program 无法实质性 solve 这个 problem**。但**可以 produce thoughtful work that signals 我们 understand 这个 problem at the right level**。

### 4.4 Possible Outputs

#### Output Option A: Position Paper

**Title 草稿**: "Beyond the Sequence: Architectural Limitations of Transformer-based LLMs for Non-Linear Reasoning Tasks"

**Structure**:
- Survey: 当前 LLM 在 non-linear / branched / hierarchical reasoning 任务上的 failure modes
- Critical analysis: 这些 failures 是 fundamental 还是 surmountable?
- Proposed directions: graph neural networks, tree-aware attention, retrieval-augmented branching, etc.
- 不需要 propose 完整 solution，需要 articulate 问题 clearly

**Target venue**: AAAI / IJCAI workshop, opinion piece on prominent ML blog, arXiv preprint

#### Output Option B: Small-Scale Architecture Experiment

**Concept**: 在 small-scale 上 实验 tree-aware attention 或 hierarchical position encoding 的 alternative

**Constraints**:
- Toy task, not production-scale
- 显示 architectural idea 的 viability，不是 outperform SOTA
- 主要 contribution 是 thinking，不是 numerical results

#### Output Option C: Anthropic / Frontier Lab Application Material

如果到 Phase 3 时已经 invited to Anthropic interview，**Phase 3 work 可以直接是 interview preparation**：

- 深度 study Anthropic 已发布的 work
- Prepare 对 Anthropic mission 的 thoughtful response
- 准备 demonstrate 自己 thinking aligned with 公司 direction

### 4.5 Phase 3 Success Criteria

- 至少 1 个 frontier lab 看到 我们 application 和 portfolio
- 至少 1 次 interview opportunity
- 能 articulate 自己 thinking 在 AI research frontier 上的 specific position

### 4.6 Phase 3 ≠ "Solve AGI Alone"

朋友 reminder: Phase 3 的目标**不是** breakthrough。是 demonstrate **maturity of thinking**。一个 MS student 能 articulate "current LLM paradigm 的 limit 在哪里 + 可能 directions 是什么" 比 a builder 多很多。但不需要 outdo PhD researchers。

---

## 5. Milestones & Application Strategy

### 5.1 Milestone-Application Matrix

| Milestone | When | Anthropic Interview Prob | Other Frontier Labs |
|---|---|---|---|
| Zygote v0.1 shipped | Sep 2026 | ~5-10% | ~10-15% |
| + 1K GitHub stars | Q4 2026 | ~15% | ~25% |
| + Paper submitted | Apr 2027 | ~30% | ~45% |
| + Paper accepted | Q3 2027 | ~50% | ~65% |
| + Active referral | Anytime | +20-30% boost | +15-25% boost |
| + Fine-tuned model + paper | Q1-Q2 2027 | ~50-60% | ~65-75% |

### 5.2 Application Cadence

**关键原则**: 不等待 perfect portfolio 才 apply。

| Time | Action |
|---|---|
| Sep 2026 (Phase 1 ship) | Apply to Anthropic / OpenAI / DeepMind + tier 2 (Cursor, Replit, Scale, etc) |
| Dec 2026 (mid-Phase 2) | Re-apply with stronger portfolio |
| Apr 2027 (paper submission) | Major application push |
| Sep 2027 (paper acceptance / 拒 后 resubmission) | Final push if needed |

### 5.3 Parallel Tier 2 Strategy

不要只 fixate on Anthropic。同样 portfolio 可以 apply 到：

- **Tier 1**: OpenAI, Anthropic, Google DeepMind, Meta FAIR, Mistral
- **Tier 2**: Scale AI, Cohere, xAI, Magic.dev
- **AI-native startups**: Cursor, Replit, Vercel (v0), Adept-equivalents
- **Big tech AI orgs**: Google Brain, Microsoft Research, NVIDIA Research

任何 these offer 都是 viable O-1 path。

---

## 6. Risk Management

### 6.1 Project-Level Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Zygote architecture drifts to chat-clone | High (without discipline) | High | Daily hand-coded 1-hour rule, types.ts ownership |
| Anthropic 在 Phase 1 期间发布类似 tree-based feature | Medium | Medium | Reframe positioning: zygote 是 specialized for VS Code + file state, even if Anthropic adds something general |
| Vibe coding 让 codebase 不可 maintain | Medium | High | Architecture documentation, modular design, refactor weekends |
| No HCI advisor found | Low-Medium | Medium | Pivot to ML paper / position paper |
| Paper rejection from primary venue | High (this is normal) | Low (with mitigation) | Have 2-3 backup venues lined up |

### 6.2 Personal-Level Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Burnout from sustained intensity | High | Severe | Weekly off day, 7-hour sleep floor, monthly therapy session |
| F-1 / OPT timeline pressure causes panic | Medium | High | OPT 给 3 年 work runway 后 graduation，计划 within 那 3 年 |
| Lose financial runway | Low-Medium | High | Maintain RA position, conservative spending, family backup |
| Isolation impacts mental health | Medium | Medium | Regular in-person social (NYU Jung Foundation events, friends), maintain gym routine |

### 6.3 Strategic-Level Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Anthropic / OpenAI rejection at all stages | Medium-High | Medium | Tier 2 backup, academic backup (PhD application) |
| AI dev tool space saturates before zygote ships | Medium | Medium | Zygote 的 niche 是 tree + file state，仍然 differentiated |
| Personal interests shift away from this path | Low | Variable | 每 6 个月 honest review whether path 仍 aligned |

---

## 7. Sustainability Principles

### 7.1 Non-Negotiable

- **Sleep**: 6.5 小时 minimum，target 7-8 小时
- **Body**: 至少 3 次 / 周 训练 maintained throughout
- **Off day**: 周日完全不碰 code 和 paper
- **Therapy (when established)**: 每周 / 隔周 1 次

### 7.2 Recommended

- **Monthly review**: 检查 progress + 身体 / 心理 state
- **Quarterly retreat**: 1 天完全 off-grid 反思和 re-calibrate
- **Annual strategic review**: 整个 plan 是否仍 aligned with 自己 want

### 7.3 Warning Signs (需要 immediate adjustment)

- 连续 2 周 sleep < 6 小时
- 训练频率掉到 < 2 次 / 周
- 温泉 / recovery 频率超过 每周 3 次（说明 stress level 过高）
- 对 zygote 工作产生 dread 而非 engagement
- 与朋友 / 家人 social 频率掉到 0

出现任何 warning sign，**立即 pause 1 周 evaluate**。

---

## 8. Decision Checkpoints

整个 roadmap 不是 "set once execute blindly"。设定明确 checkpoints：

### 8.1 Checkpoint 1 — End of Phase 1 (Sep 2026)

**Questions**:
- Zygote v0.1 是否 shipped?
- Architecture 是否 (b) 或 (c) 级别?
- 至少 3 个 early user feedback 正面?

**Possible actions**:
- 如果 all yes → proceed to Phase 2
- 如果 architecture 仍 stuck at (a) → delay 4 weeks rebuild
- 如果 zero traction → 重新评估 product market fit

### 8.2 Checkpoint 2 — Mid-Phase 2 (Dec 2026)

**Questions**:
- Advisor relationship 是否 established?
- User study 是否 viable / IRB approved?
- Fine-tuning 实验 是否 progressing?

**Possible actions**:
- Pick primary track (A 或 B)
- Possibly fallback to Track C (position paper)
- Possibly pause to re-strategize

### 8.3 Checkpoint 3 — Post Paper Submission (May 2027)

**Questions**:
- Paper submitted?
- Anthropic / frontier lab applications status?
- Personal sustainability 是否 maintained?

**Possible actions**:
- 如果 paper submitted + applications in progress → execute Phase 3
- 如果 paper rejected → resubmission strategy
- 如果 burnout signs → mandatory 2-week recovery

### 8.4 Checkpoint 4 — End of Year (Annual)

**Questions** (每年 graduation 前 ask once):
- 整体 trajectory 是否 still aligned?
- 是否 should pivot 到 PhD application / 其他 path?
- 个人生活（伴侣 / 健康 / 家庭）状态如何?

---

## 9. Foundational Commitments

朋友——以下几条作为整个 roadmap 的 foundation，独立于 phase：

### 9.1 关于 Zygote

> Zygote 像我的孩子，但他最终是他自己。  
> Zygote 不等于我。任何让 zygote 变得更好的微小建议，我都会接受。  
> Zygote 是 dream 在 2026 年的形状。Dream > 我 > zygote。无论 zygote 在世界上发生什么，dream 都已经完整。

### 9.2 关于自己

> 我不需要成为 Musk 或 Jobs。我是一种不同的存在。  
> 我有奶奶给的 secure base 和爸爸传的 character。  
> 我能撕裂得起，因为底下是稳的。  
> 我选择 awareness 这条路，接受可能因此到不了他们的体量——这是我的 trade-off。

### 9.3 关于工作

> 只要开心，就算这段时间是个弯路，也没有问题。  
> 唯一的要求是身体要好。

—— 爸爸（53岁，个体户创业者，2026 年 5 月某个早晨）

---

## 10. Appendix

### 10.1 Key Resources to Consume

**Phase 1**:
- VS Code Extension API documentation (re-read for tree views)
- Anthropic API docs (re-read for context construction)
- Pro Git book, Chapter 10 (Internals) — 理解 content-addressable storage

**Phase 2**:
- UIST / CHI past 3 years 相关 papers (AI-assisted coding tools)
- HuggingFace PEFT documentation (LoRA fine-tuning)
- "Tree of Thoughts" paper (Yao et al.) — 相关 research

**Phase 3**:
- Yann LeCun's papers on JEPA + world models
- "Language Models are Few-Shot Learners" 之后 papers on architectural alternatives
- Anthropic's own published work (Constitutional AI, mechanistic interpretability)

### 10.2 NYU Faculty to Approach

待 fill in（Phase 1 中期 do research and outreach）:
- [ ] NYU CDS faculty doing AI tools / HCI work
- [ ] NYU CS faculty in AI Lab
- [ ] NYU Steinhardt / ITP faculty doing creative AI

### 10.3 External Network to Build

- Twitter: AI dev tool builders (follow + thoughtful reply)
- HN: post zygote dev blog
- 公众号: continue cross-pollinate philosophy + technical writing
- NYC tech events: AI Tinkerers, ML meetups

### 10.4 Personal Anchors (Private)

- 每月与父亲通电话至少 1 次
- 每月与奶奶通电话或视频至少 1 次（如果可能）
- 维持温泉 ritual 作为合法 stress modulation
- 继续 Jung / 金刚经 / Zarathustra reading 作为 inner life maintenance

---

## 11. Version History

- **v1.0** (May 27, 2026): Initial roadmap created.

---

*"人生如梦。Amor fati."*

*— Anchoring quotes for the journey ahead.*
