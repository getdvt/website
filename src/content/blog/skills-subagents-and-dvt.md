---
title: "Skills, subagents, and dvt: make the agent work like your team"
description: "Claude Code and Codex can already build dvt dashboards over MCP. Skills and subagents teach them to build *your* dashboards — and dvt's org skills give those conventions a distribution channel."
pubDate: 2026-07-16
author: "Collin Austad"
---

Connect Claude Code to dvt's MCP server and it can do real analytical work out of the box: query your warehouse, author a dashboard spec, validate it against the schema, preview the result, and apply it. We've written about [the authorship flow](/blog/talk-to-your-warehouse) and [why a versioned spec makes agent output reviewable](/blog/dashboards-as-code). This post is about the next layer: making the agent work the way *your team* works.

The interesting property of agents like Claude Code and OpenAI's Codex is that they're not fixed products. They're extensible harnesses. You can hand them instructions, package those instructions as reusable skills, and define subagents with their own briefs and standards. dvt is built to work inside exactly that world — a set of composable tools and a documented spec, rather than a chat window bolted onto a BI tool. Which means the extensibility of the agent becomes extensibility of dvt.

## Out of the box, the agent doesn't know your team

A stock agent connected to dvt knows how to write SQL and author a valid spec. It doesn't know that "ARR" at your company is computed from `mrr_monthly` and never from raw invoices. It doesn't know your fiscal year starts in February, that the 30-day active-user view is deprecated, or that your team puts the KPI row first and never ships a chart titled "revenue by month" when it could say "revenue up 12% QoQ."

Ask a generic agent for a revenue dashboard and you get a generically correct one. The gap between that and a dashboard your team would actually ship isn't intelligence — it's context. And context is exactly what agent extensibility is for.

## Skills: teach the agent your definitions

A skill, in Claude Code, is a markdown file. That's the whole mechanism: a named document with a description of when to use it, loaded when it's relevant. Here's one that encodes a finance team's conventions:

```markdown
---
name: finance-metrics
description: House definitions for revenue metrics. Use when querying
  or charting revenue, ARR, or churn through dvt.
---

- "ARR" = `sum(mrr) * 12` from `analytics.finance.mrr_monthly`,
  current month only. Never compute it from raw invoices.
- "Active customer" = ≥1 successful login in the trailing 28 days
  (`analytics.product.active_customers_28d`). The 30-day view is
  deprecated — do not use it.
- Fiscal year starts February 1. Chart quarter labels follow fiscal
  quarters.
- Fully qualify every table (`database.schema.table`) — the Snowflake
  service role has no default schema.
- Format dollars as $1.2M, never $1,200,000.
```

With that file in place, every query the agent pushes through `dvt_data_query` is written your way, and every spec it authors inherits your definitions. Nothing here is dvt-specific machinery — it's plain markdown that any teammate can read, review, and version in git. Codex has the same shape of mechanism through its instruction files (`AGENTS.md`): the conventions travel with the repo, and the agent reads them before it touches your data.

This matters more for BI than for most agent work, because in BI the failure mode is silent. A wrong-but-plausible ARR number doesn't throw an exception. The skill file is where "what our metrics actually mean" stops living in one analyst's head and starts being an artifact.

## Subagents: give the agent a review bar

Skills change how the agent writes. Subagents change how it checks its work. A subagent in Claude Code is another markdown file — a named role with its own brief:

```markdown
---
name: dashboard-reviewer
description: Reviews a dvt dashboard spec against house standards
  before it is applied. Use after generating or editing any spec.
---

You review dvt dashboard specs. For the spec you are given:

1. Run `dvt_spec_validate` — reject on any schema error or
   contrast warning.
2. Check every metric against the finance-metrics skill.
3. Check ordering: KPI row first, trends second, breakdowns last.
4. Titles must state the takeaway ("ARR up 12% QoQ"), not the
   column name ("ARR by quarter").

Return PASS or a list of specific fixes. Never apply the spec
yourself.
```

Now the workflow becomes: the main agent drafts a spec, the reviewer subagent audits it, and only a spec that passes gets applied. dvt's tool design makes this loop safe to run: `dvt_spec_validate` checks a spec without persisting anything, and `dvt_dashboard_apply_spec` defaults to a dry-run preview — the write only happens when you explicitly say so. The agent gets a full generate → critique → revise cycle before a single stakeholder sees a pixel.

You can go further in the same pattern: a warehouse-analyst subagent that explores data through `dvt_data_query` and reports what's worth charting, a layout auditor, a narrative critic. We use this pattern on our own dashboards — a layout- and narrative-review pass runs before we publish them.

None of this required a dvt plugin API, an extension marketplace SDK, or a vendor-approved integration. It works because dvt's surface is tools plus a published JSON Schema, and modern agents know how to compose tools and self-correct against a schema.

## The distribution problem — and where dvt's org skills come in

Skill files in a repo have one real weakness: distribution. The finance team's definitions live in the finance team's repo. The new analyst hasn't cloned it. The ops team wrote their own, slightly different version. Conventions that should be organizational become tribal again — just tribal-in-git instead of tribal-in-heads.

This is the part dvt builds in. **Org skills** are the same kind of document — markdown conventions for agents — but authored and stored in dvt itself: org-scoped, versioned, and shareable (private, shared with specific people, or public to the org). Any agent connected to your dvt workspace discovers them through the `dvt_skill_list` tool, which returns each skill's name, description, and when-to-use guidance, and reads the full body on demand at `dvt://skill/org/{slug}`.

The practical difference is who gets the context. A repo skill helps the person who cloned the repo. An org skill helps everyone with a dvt API key, on whatever MCP host they use — Claude Code, Claude Desktop, Codex, Cursor, VS Code. The new analyst connects their key on day one and their agent already knows what ARR means here. Update the definition once and every teammate's agent picks up the new version. It's a distribution channel for your team's analytical conventions — a marketplace with one very opinionated vendor: your own data team.

dvt uses the same mechanism for its own guidance: the canonical spec-authoring skill — the document that teaches an agent how to write good dvt specs — ships as an MCP resource at `dvt://skill/spec-authoring`. Your org skills sit alongside it, layering your rules on top of the spec's rules.

## The honest limits

Skills and subagents encode judgment; they don't create it. A metrics skill is only as accurate as the person maintaining it — if your ARR definition changes and the document doesn't, the agent will confidently apply the stale one, and nothing in the system detects that drift for you. A reviewer subagent enforces the checklist its author wrote, no more: it's a consistently applied review bar, not a proof of correctness. And org skills are deliberately reference material, not authoritative instructions — where one conflicts with the canonical spec-authoring skill, the canonical skill wins, so a badly written org skill can't talk an agent into producing an invalid spec. The mechanism distributes your conventions; keeping them true is still your team's job.

## Why this works

None of this is a feature we bolted on for the AI moment. It falls out of decisions that were load-bearing from the start:

- **Dashboards are data.** A dashboard is a versioned JSON spec with a published schema, so an agent can generate one, validate it, and be corrected by the schema — the same artifact a human authors.
- **The tools are workflow-shaped.** dvt's MCP tools map to the jobs an agent actually does — search, query, validate, preview, apply, diff, render — with the REST API's OpenAPI contract underneath as the source of truth.
- **Preview before persist.** Validation and dry-run application are first-class, so an agent (or its reviewer subagent) can iterate without touching production state.
- **Your warehouse stays the boundary.** `dvt_data_query` pushes SQL down to your warehouse under your connection's role; only result rows come back. An agent operating through dvt has exactly the access you granted, nowhere more.

The result is a system where the vendor's job and the customer's job separate cleanly. We ship the primitives and the canonical authoring guidance. You ship the judgment: what metrics mean, what good looks like, what the review bar is. The agent composes both.

## Getting started

Connecting Claude Code takes one command, with a key from Settings → API keys:

```bash
claude mcp add --transport http --scope user dvt \
  https://mcp.dvt.dev/mcp \
  --header "Authorization: Bearer <your key>"
```

Codex CLI and other MCP hosts point at the same endpoint — `https://mcp.dvt.dev/mcp` with a bearer key — via their own config; the API-keys page generates the exact snippet for each host.

Then start small. Write one skill file with your team's three most-misunderstood metric definitions. Add a reviewer subagent with your non-negotiables. When the conventions stabilize, promote them to org skills in dvt so the whole team's agents inherit them. Each step is a markdown file — which is the point. The customization layer for your BI is documents, not vendor tickets.

---

The agent harnesses are extensible. The dashboards are data. dvt's job is to make sure those two facts compose — so the tool works exactly the way your team decides it should.

[Read the spec →](/spec) or [see how agents author dashboards over MCP →](/blog/talk-to-your-warehouse)
