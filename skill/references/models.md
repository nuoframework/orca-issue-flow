# Model Recommender runs — 2026-11-08

The [requested interactive recommender](https://artificialanalysis.ai/models/recommend)
was actually completed to Step 5. Seven result screens were inspected, including separate
provider-filtered profiles for the roles below. The earlier qualitative model selection
and hypothetical percentage weights are superseded by these completed runs.

The web UI has **integer sliders from 0 to 5**, not percentage allocations. Its result
URLs serialize the sliders on a 0–10 scale (UI 5 is URL 10). The values below are the
values actually displayed under Criteria. Do not interpret them as percentages or claim
they are the recommender's internal scoring formula.

Raw visible result text, source URLs and observed slider values are in
[model-recommender-runs.json](model-recommender-runs.json). Each profile link below reopens
its result screen; live recommendations may change as the site updates its data.

| Profile / roles | Intelligence / speed / cost (0–5) | Focus | Provider filter | Actual result |
|---|---|---|---|---|
| Overall critical check | 5 / 0 / 0 | General + Coding + Low Hallucination | All six selected providers | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=10&speed=0&cost=0&types=general%2Ccoding%2Clow-hallucination&reasoning=true&providers=anthropic%2Cgoogle%2Ckimi%2Copenai%2Cxai%2Czai&step=results) |
| Judge / architecture / security / tests / adjudication | 5 / 0 / 0 | General + Coding + Low Hallucination | Anthropic | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=10&speed=0&cost=0&types=general%2Ccoding%2Clow-hallucination&reasoning=true&providers=anthropic&step=results) |
| Plan B / implementation | 5 / 1 / 2 | General + Coding | OpenAI | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=10&cost=4&types=general%2Ccoding&reasoning=true&providers=openai&step=results) |
| Plan A / UI / performance / QA | 5 / 1 / 2 | General + Coding | Google | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=10&cost=4&types=general%2Ccoding&reasoning=true&providers=google&step=results) |
| Gaps / adversarial | 5 / 0 / 0 | General + Coding + Low Hallucination | Kimi, SpaceXAI, Zai | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=10&speed=0&cost=0&types=general%2Ccoding%2Clow-hallucination&reasoning=true&providers=kimi%2Cxai%2Czai&step=results) |
| Reader | 1 / 3 / 5 | Instruction Following + Low Hallucination | Anthropic, OpenAI, Zai | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=2&speed=6&cost=10&types=instruction-following%2Clow-hallucination&providers=anthropic%2Copenai%2Czai&step=results) |
| Documentation critic | 3 / 1 / 3 | Document Creation + Instruction Following + Low Hallucination | Anthropic | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=6&cost=6&types=document-creation%2Cinstruction-following%2Clow-hallucination&providers=anthropic&step=results) |

## What the recommender returned

- Overall critical: Gemini 4 Carbon high first, Opus 5.5 max second, Carbon medium third;
  the top ten also contain Astra, Sonnet and Sol effort variants.
- Anthropic critical: Opus 5.5 max #1, Opus xhigh #2, Sonnet 5.5 max #3, Fable 5.1
  xhigh #5. Taking distinct models rather than effort variants yields Opus → Sonnet → Fable.
- OpenAI coding: Sol 6.1 max #1, Astra max #2; the next distinct model is Terra 6.1 max
  at #7. Terra was not in the inspected OpenCode catalog; keep the known GPT-6 Sol route
  as an explicitly labeled compatibility reserve instead of claiming verified access.
- Google coding run: Carbon dominates, Argon high is #6 and Flash 3.8 high #9. Carbon
  was absent from the inspected local OpenCode catalog, so Argon is the first executable
  family choice. This provider-filtered run also returned Anthropic entries: the provider
  filter is not proof of creator-family isolation. Those entries are excluded here to
  preserve the intended family boundaries.
- Independent attack: Kimi K3.1 Pro #1; Grok 4.7 xhigh #2 / high #3; GLM-5.3 max #4.
  Distinct models give Kimi → Grok → GLM. Native Grok exposes older 4.6/4.5 locally and
  reported unauthenticated, so the current 4.7 choice uses the available OpenCode route.
- Reader: Luna low #1, Haiku low #2; Sol 6.1 low #7 is a stronger compatible third model.
  Terra variants are not assumed available simply because the recommender lists them.
- Documentation: Haiku 5.5 max #1, Opus 5.5 xhigh #5, Sonnet 5.5 xhigh #8 are the first
  three distinct models. Multiple Haiku efforts ahead of Opus are not separate availability
  reserves. This profile prioritizes a narrower factual review at lower cost.

The recommender does not know this repository's role independence, runtime capabilities,
actual quota or defect recall. Its rankings are therefore filtered by those constraints.
The original source costs are benchmark/index costs, not a price quotation for an issue.

## Cost-aware revision — 2026-11-10

The owner asked for a cheaper/faster implementer and smaller models where a role does not
need frontier reasoning. Four NEW result screens were completed and their visible criteria,
rankings and URLs captured in [economy-recommender-runs.json](economy-recommender-runs.json).
The Nov 8 runs above remain historical evidence, not current recommendations for this roster.

| New profile | I / speed / cost (0–5) | Selection scope | Reopen actual result |
|---|---|---|---|
| Economy implementation | 3 / 4 / 4 | General + Coding; nine provider filters | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=6&speed=8&cost=8&types=general%2Ccoding&reasoning=true&providers=anthropic%2Cgoogle%2Ckimi%2Copenai%2Cxai%2Czai%2Cdeepseek%2Cxiaomi%2Cminimax&step=results) |
| OpenCode alternatives | 3 / 4 / 4 | General + Coding; DeepSeek/Zai/Xiaomi/MiniMax | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=6&speed=8&cost=8&types=general%2Ccoding&reasoning=true&providers=deepseek%2Czai%2Cxiaomi%2Cminimax&step=results) |
| Light support | 2 / 4 / 5 | Instruction Following + Low Hallucination | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=4&speed=8&cost=10&types=instruction-following%2Clow-hallucination&providers=anthropic%2Copenai%2Czai&step=results) |
| Native Claude trade-offs | 3 / 3 / 4 | General + Coding; Anthropic | [Open run](https://artificialanalysis.ai/models/recommend?intelligence=6&speed=6&cost=8&types=general%2Ccoding&reasoning=true&providers=anthropic&step=results) |

### What changed after checking actual results AND prices

The economy implementation result put Terra low #1, Sol medium #2 and Terra medium #3.
We choose **Terra medium** as the implementer: less aggressive than low for coding, still
cheaper and faster in the reported benchmark than the previous Sol medium. AA displayed
2.6 minutes per task for Terra medium versus 3.8 for Sol medium, intelligence scores 38
versus 46, and index costs $190 versus $389. These are AA benchmark metrics, not timing or
cost measurements of this repository. Do not promise equivalent defect rates or a fixed
saving on actual issues.

Official Standard API input/output rates are $1/$5 for Terra and $2/$10 for Sol per 1M
tokens. That's half the tariff for the same uncached token quantities, not a guarantee
of half the total cost after retries. OpenAI also lists Terra at 25/1.25/125 credits for
input/cache/output versus Sol at 50/2.5/250 in Codex credit billing. Included subscription
task counts are not inferred from API prices. Account eligibility still needs preflight.

The OpenCode-filtered result ranked DeepSeek V4.1 Flash first, but its measured task time
was 16.5 minutes at max (12.7 at high), not faster than Terra medium. Its OpenCode paid
rate is much lower at $0.30/$1.20. Therefore it is an economy/availability reserve, NOT a
claimed faster primary. The exact benchmark effort cannot be selected by the current
OpenCode launcher; record actual runtime settings. No free endpoint is automatically
substituted and no implementation benchmark was run in this repo.

The light-support result favored Luna low, Terra low and Haiku low. Use Luna/Haiku for
extraction, execution of specified checks, docs, cleanup and bounded UI checks. A failed or
uncertain check is incomplete coverage, not an approve verdict. Sonnet/Sol handle richer
analysis. Opus is retained for the judge and security, rather than every critic. Astra and
Fable are removed from ALL automatic preset chains; their high prices are not justified
as routine fallbacks here. They remain available for an explicit custom roster.

A provider-filtered Anthropic query actually put expensive Fable 5.2 variants first even
with cost weighted 4. This is why we do not blindly copy #1: Fable costs $8/$40 in the
fresh official API table. Sonnet is deliberately selected as a middle tier using its
published role and $2/$10 rate, not claimed to be #1 in that query. Haiku low/medium were
also returned (#7/#8). This is a constrained selection using price, native-runtime preference
and role responsibility, not a promise that every table cell is an exact AA recommendation.

### Verified prices (USD per 1M tokens)

Read live on 2026-11-10. Standard API / short-context tiers, no assumed cache hit. See
[model-prices.json](model-prices.json) for source URLs and conditions.

| Model / route | Input | Output | Cache read | Condition |
|---|---:|---:|---:|---|
| Codex Terra 6.1 / OpenAI API reference | $1 | $5 | $0.05 | Standard short-context |
| Codex Sol 6.1 / OpenAI API reference | $2 | $10 | $0.10 | Standard short-context |
| Codex Luna / OpenAI API reference | $0.10 | $0.50 | $0.01 | Standard short-context |
| Claude Haiku 5.5 | $0.10 | $0.50 | $0.01 | Prompt <=100k tokens; above: $0.50/$2.50/cache $0.05 |
| Claude Sonnet 5.5 | $2 | $10 | $0.10 | Standard API |
| Claude Opus 5.5 | $4 | $20 | $0.20 | Standard API |
| OpenCode DeepSeek V4.1 Flash | $0.30 | $1.20 | $0.006 | Paid route |
| OpenCode GLM-5.3-Flash | $0.15 | $0.50 | $0.03 | Paid route |
| OpenCode Gemini 3.8 Flash | $0.75 | $3.75 | $0.075 | 50% promotion through 2026-12-31 |
| Grok 4.6 via OpenCode, reference only | $2 | $6 | $0.50 | <=200k input; not native Grok subscription pricing |

Sources: [OpenAI API](https://developers.openai.com/api/docs/pricing),
[Codex subscriptions/credits](https://learn.chatgpt.com/docs/pricing),
[Anthropic](https://platform.claude.com/docs/en/about-claude/pricing),
[OpenCode](https://opencode.ai/docs/console/models/).

For illustration, 50k uncached input + 5k output costs $0.075 at Terra's rates versus
$0.15 at Sol's rates. This excludes reasoning/output variation, cache writes, retries,
subscription allowances, taxes and longer-context tiers. For cheap Haiku roles, keep input
below its 100k tariff boundary by using bounded packets/fresh sessions. Cache hits still
count toward the 60% occupancy contract. No monetary cap is claimed without billing telemetry.

### Current Balanced table

Medium for substantive work; low for UI/docs/QA execution, Reader and Janitor. No automatic
high/xhigh/max; focused escalation follows the skill's recorded-blocker policy. Three choices
are retained per role. OpenCode remains a reserve, now allowed for implementation as the
owner requested, plus docs/log/cleanup support. Native Claude/Codex still carry almost all
primary roles. The adversarial critic now starts with native Sonnet; Grok is an optional
compatibility reserve, not the AA-evaluated 4.7 row and not assumed authenticated.

Availability uses the configured ordered chain. If Terra repeatedly fails a semantic task
after one focused fix, use the configured Sol repair option directly rather than spending
more rounds on another cheap model. For already-approved high-impact/complex steps, use
Sol before starting them. Record model selection, checkpoints and outcomes. This changes
the selected worker, not the approved scope or acceptance criteria. Never overlap writers.

Security and final adjudication must differ from the actual implementer family, including
when the implementer uses DeepSeek. Other family overlaps use separate sessions and blind
initial reports. Runtime access and the 60% admission adapter remain prerequisites. Catalog
presence is not proof of quota or auth. No live model inference was made as an access test.

| Role | Primary · effort | Reserve 1 · effort | Reserve 2 · effort | Reference I / S / C |
|---|---|---|---|---|
| Plan A | claude / claude-sonnet-5-5 · medium | claude / claude-opus-5-5 · medium | claude / claude-haiku-5-5 · medium | 3 / 3 / 4 |
| Plan B | codex / gpt-6.1-terra · medium | codex / gpt-6.1-sol · medium | codex / gpt-6-sol · medium | 3 / 4 / 4 |
| Gap hunter | claude / claude-sonnet-5-5 · medium | claude / claude-opus-5-5 · medium | codex / gpt-6.1-terra · medium | 3 / 3 / 4 |
| Judge | claude / claude-opus-5-5 · medium | claude / claude-sonnet-5-5 · medium | codex / gpt-6.1-sol · medium | 5 / 0 / 0 |
| Implementer | codex / gpt-6.1-terra · medium | opencode / opencode/deepseek-v4.1-flash · unset | codex / gpt-6.1-sol · medium | 3 / 4 / 4 |
| UI/UX critic | claude / claude-haiku-5-5 · low | claude / claude-sonnet-5-5 · low | claude / claude-opus-5-5 · low | 2 / 4 / 5 |
| Stability and performance critic | codex / gpt-6.1-sol · medium | codex / gpt-6.1-terra · medium | codex / gpt-6-sol · medium | 3 / 4 / 4 |
| Architecture critic | claude / claude-sonnet-5-5 · medium | claude / claude-opus-5-5 · medium | claude / claude-haiku-5-5 · medium | 3 / 3 / 4 |
| Security critic | claude / claude-opus-5-5 · medium | claude / claude-sonnet-5-5 · medium | claude / claude-haiku-5-5 · medium | 5 / 0 / 0 |
| Documentation critic | claude / claude-haiku-5-5 · low | claude / claude-sonnet-5-5 · low | opencode / opencode/gemini-3.8-flash · unset | 2 / 4 / 5 |
| Test critic | codex / gpt-6.1-sol · medium | codex / gpt-6.1-terra · medium | codex / gpt-6-sol · medium | 3 / 4 / 4 |
| QA critic | claude / claude-haiku-5-5 · low | codex / gpt-6-luna · low | codex / gpt-6.1-terra · low | 2 / 4 / 5 |
| Review adjudicator | claude / claude-sonnet-5-5 · medium | claude / claude-opus-5-5 · medium | claude / claude-haiku-5-5 · medium | 3 / 3 / 4 |
| Adversarial critic | claude / claude-sonnet-5-5 · medium | codex / gpt-6.1-sol · medium | grok / grok-4.6 · medium | 5 / 0 / 0 |
| Reader | codex / gpt-6-luna · low | claude / claude-haiku-5-5 · low | opencode / opencode/glm-5.3-flash · unset | 2 / 4 / 5 |
| Environment janitor | claude / claude-haiku-5-5 · low | codex / gpt-6-luna · low | opencode / opencode/glm-5.3-flash · unset | 2 / 4 / 5 |

The 5/0/0 critical reference is the prior Nov 8 profile, not a new November 10 query.
Budget lowers Terra effort for Plan B/implementation only; critical reviewers stay unchanged.
Frontier uses Sol medium instead of Terra for
Plan B/implementation and Opus medium for docs. These explicit pack overrides retain the
same effort ceiling and safety gates. Defaults are refreshed, not automatically deployed
to earlier installed projects: updating the skill and running the roles wizard is necessary.

The Janitor is a non-voting service role. It uses Haiku low, Luna low or the GLM Flash
reserve. It is not counted as an extra product critic and must follow references/cleanup.md.

## November 11 review corrections

Gap hunting is unbounded criticism, so its primary is Sonnet medium rather than Haiku.
QA starts with Haiku low instead of Luna; Luna remains a reserve only for executing already
specified scenarios and must report unknown coverage incomplete. This is an explicit
role-responsibility adjustment, not a measured improvement in recall or a new AA query.

Adversarial defaults to Sonnet medium, then Sol medium, with native Grok 4.6 medium last.
Grok 4.6 is a compatibility/native preference reserve: the stored AA query evaluated 4.7,
and local 4.6 authentication was not established. No table row claims otherwise. The table
I/S/C column is a reference profile, not proof that the selected model/effort topped it.
Sonnet, Opus, Haiku, Terra, Sol and Luna have captured model/effort evidence; native Grok
4.6, GPT-6 Sol and scoped OpenCode fallback deployments have only compatibility/price
evidence in these particular role chains. Runtime access must be checked again.

No new live price/ranking lookup was performed for these code-review corrections; the
November 8/10 evidence remains dated. Config schema 2 adds explicit enforced/instructed
context modes, never an automatic change to the 60% guarantee. See context.md and the
upgrade instructions before running an older installation.
