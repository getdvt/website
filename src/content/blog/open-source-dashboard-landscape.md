---
title: "The open-source dashboard landscape for analytics engineers"
description: "A fair buyer's guide to code-first, open-source BI tools — Lightdash, Evidence, Metabase, and dvt — with honest 'best when' recommendations for each."
pubDate: 2026-06-21
author: "Collin Austad"
---

If you're an analytics engineer evaluating open-source BI in 2026, the options are better than they've ever been — and different enough from each other that the "best tool" question has no general answer. Each tool makes a coherent set of tradeoffs. The tradeoffs that matter depend on your team's stack, workflow, and definition of "done."

This post maps the tools an analytics engineer is most likely to reach for: Lightdash, Evidence, Metabase, and dvt. The goal is a genuine buyer's guide. If a tool isn't the right fit for your situation, you should know that before you spend a week onboarding it.

## The question behind the question

Before comparing tools, it helps to name what you're actually optimizing for. Analytics engineers tend to have strong opinions about a few dimensions:

- **Where does the definition of a metric live?** In the dashboard? In a semantic layer? In your dbt models?
- **Who authors dashboards?** Analysts writing SQL? Non-technical stakeholders? AI agents?
- **How do dashboards change?** Through a GUI? A code review? A PR into the repo?
- **How locked in do you want to be?** To a specific renderer? To dbt? To a specific hosting provider?

The tools below make different bets on each of these. The right one for your team is the one whose bets align with yours.

---

## Lightdash

Lightdash markets itself as "Agentic BI" — a dbt-native semantic explorer that surfaces answers from your existing dbt project. If your team runs dbt, Lightdash reads your `dbt_project.yml`, your model definitions, and your metrics, and exposes them as a governed exploration layer. Analysts query metrics that mean what the data team says they mean, because the definitions come directly from the models.

It's moving toward natural-language exploration grounded in your dbt semantic layer. The governance is structural: metric definitions live in one place (your dbt project), and Lightdash surfaces them without allowing drift.

**The hard constraint:** Lightdash has an absolute dependency on a dbt project — without one, it cannot function, because there is no alternative connection path. This is a deliberate architectural choice, not a gap. The strength of the governed-metrics story comes directly from dbt being the single source of truth for what metrics mean. If your team runs dbt, that's a feature. If your team doesn't, Lightdash is not an option.

**Best when:** your entire data team runs dbt, you want metrics-layer-driven exploration (not arbitrary SQL), and you want the governance guarantee that "revenue" means the same thing in every dashboard because it's defined once in your dbt project.

---

## Evidence

Evidence takes a different view of what a BI artifact should be. In Evidence, reports are Markdown files with embedded SQL — you write your analysis as a document, reference queries inline, and Evidence renders the result as a polished data page. The whole thing lives in a repository, ships through a build step, and deploys like a static site.

This is genuinely version-controlled BI: the report is a text file, every change is a commit, and the full history is in git. For narrative-style reports — "here's what happened in Q3 and why" — Evidence's document-first model is a natural fit. The analyst writes the story; the data fills in as the queries run.

The tradeoff is the static/narrative assumption. Evidence is excellent for reports you plan and publish. It is less suited for dashboards that stakeholders explore interactively — where they want to filter by region, drill into a segment, or change the date range without asking for a new build. Interactivity is possible but bounded; the model is document-first, not exploration-first.

**Best when:** you want version-controlled BI as documents — reports with narrative structure, analysis that tells a story, content that ships through a code review. If your deliverable is a polished, reproducible report rather than an interactive exploration tool, Evidence's document-first model fits that better than any tool on this list.

---

## Metabase

Metabase is the broadest tool on this list and the one with the longest track record. It's GUI-first: connect a database, use the question editor or the notebook interface to build queries, and publish a dashboard. No SQL required for basic use. Non-technical users can ask questions without writing code. Self-hosting is well-documented and widely deployed.

The GUI-first model is Metabase's strength and its ceiling. For teams where non-technical stakeholders need to explore data without help from an analyst, Metabase's approachability is genuinely valuable — it lowers the floor for who can get an answer. The point-and-click question builder covers a wide range of common questions, and the sharing model (questions, dashboards, subscriptions) is mature.

The tradeoff is the code-review story. A Metabase dashboard is platform state: it lives in Metabase's database, and changes to it happen in the Metabase UI. There's no diff, no PR, no CI check for dashboard changes. Metabase has added some version-awareness over time, but the fundamental object model is not a reviewable code artifact. For teams that want to treat dashboards with the same rigor they apply to their dbt models, Metabase's architecture works against them.

**Best when:** non-technical users need ad-hoc question-asking without SQL, your team's primary BI consumer is a business stakeholder rather than an analyst, and you want a broadly capable self-hosted tool with a long track record and a large community.

---

## dvt

dvt starts from a premise the other tools don't share: a dashboard is a versioned JSON spec, and the spec is the product's native object model. Not GUI state that gets exported to JSON. Not a code layer bolted onto a GUI tool. The spec is what the renderer reads, what the API writes, and what AI agents author over MCP.

Every dvt dashboard is a JSON document validated against a published schema. It contains the queries (SQL pushed down to your warehouse at view time), the visual encoding for each panel, the layout, and interactive elements like filters. Every visual property is a named, editable parameter. You can diff two versions of a dashboard the same way you diff two versions of a dbt model. You can validate a spec in CI before it ships.

The sharpest differentiator is portability. The dvt spec is renderer-neutral at its core profile level — it describes what the visualization is, not how a specific rendering engine draws it. A spec that conforms to the Core profile is portable across compliant renderers. An ECharts escape hatch exists for teams that need to reach properties beyond what the Core profile exposes, at the cost of that renderer-neutrality. Two layers, two guarantees, clearly separated.

dvt does not require dbt. It connects to any warehouse directly — Snowflake, BigQuery, Postgres, and others. dbt integration is additive: if you run dbt, dvt can read your project metadata and use it. If you don't, dvt works without it. This is a deliberate architectural decision that separates dvt from Lightdash's dbt-dependency model.

The AI authorship story is architecturally different from any other tool on this list. Because the spec is a structured document with a schema, an AI agent writes it the same way a human does — by constructing a valid JSON document and posting it through the API or over MCP. There is no "AI generates UI clicks" indirection. The agent is an author of the artifact. [The MCP integration is documented here](/blog/talk-to-your-warehouse) if you want to see the workflow concretely.

**What you give up:** dvt's live editor exists and works, but if your primary use case is ad-hoc exploration by non-technical users, Metabase or Lightdash are more natural fits. dvt is optimized for dashboards you build, version, and maintain — not for "I have a quick question and I'll click around to find the answer." The spec-driven model adds structure that is overhead for one-off exploration.

**Best when:** you want a versioned, portable spec that humans and AI agents co-author — dashboards that live in git alongside your data models, change through code review, and connect to any warehouse without a dbt dependency. Also when you want the escape hatch of full ECharts customization without giving up the structured spec artifact.

---

## How to choose

The dimensions that matter most:

**Do you run dbt and want metrics governance?** Lightdash is purpose-built for this. Its absolute dbt dependency is the cost of its governance guarantee.

**Do you need non-technical users to ask ad-hoc questions?** Metabase is the most mature answer. Its GUI-first model is approachable in a way spec-driven tools are not.

**Do you want BI as narrative documents?** Evidence's Markdown-plus-SQL model is designed for this. Reports as code, published through a build.

**Do you want dashboards treated as code artifacts?** dvt. The spec is the object model; diffs are readable; CI validation is built in; AI agents are first-class authors. Works without dbt, connects to any warehouse, and runs either self-hosted (the free Community edition) or as a managed, hosted instance.

These categories don't fully overlap — a team that needs all four of these things may end up with more than one tool. That's fine. The modern data stack is already a collection of purpose-built tools; the BI layer doesn't have to be different.

---

One trend worth naming: as of 2026, every tool in this space is adding AI features of some kind. "Has AI" is no longer a distinguishing characteristic. What distinguishes is the architecture underneath — whether the AI is writing a structured, reviewable artifact or generating GUI state that only the platform can interpret. That architectural question will matter more as AI authorship becomes more common, not less.

[See the dvt spec →](/spec) or [read about where dvt fits in the data stack →](/blog/where-dvt-fits)
