---
title: "Dashboards as code: version control, review, and rollback for your BI layer"
description: "What 'dashboards as code' actually means, what it buys you, and how dvt implements it — versioned JSON specs that live in git alongside your dbt models."
pubDate: 2026-06-19
author: "Collin Austad"
---

The phrase "dashboards as code" gets used loosely. Sometimes it means "we use a CLI to configure our dashboards." Sometimes it means "our dashboard config lives in a YAML file somewhere." Those are better than nothing, but they miss the point. Real dashboards-as-code means the dashboard itself — every visual property, every query, every layout decision — is a structured, schema-validated artifact you can diff, review, merge, and roll back. The same way you treat a dbt model.

dvt is built around this premise. Every dvt dashboard is a [JSON spec](/spec): a declarative document that fully describes the dashboard and nothing else. That document is the source of truth. The renderer reads it; it never drives the renderer by recording GUI clicks.

## What the spec actually contains

A dvt spec is a JSON document validated against a JSON Schema. It contains the queries (SQL that runs against your warehouse at view time), the visual encoding for each panel (chart type, axes, colors, series), the layout, and any interactive elements like filters. Every property is named, every property is a parameter.

That structure is the foundation of everything that follows. An opaque GUI state — a blob in a vendor database that only the vendor's rendering engine can interpret — cannot participate in code review, cannot be diffed, cannot be tested in CI. A validated JSON document can.

## What version control actually buys you

**Diffs that mean something.** When a dashboard changes, you see exactly what changed: which query, which axis label, which color. Not "someone edited it Tuesday" — the actual diff. Code review for dashboards works the same way it works for dbt models: a PR, a description of what changed and why, a reviewer who can read the change before it goes live.

**Rollback without drama.** Every dvt spec is stored with revision history — per element, per page, per dashboard — from the point of first creation. If a query change breaks a metric or a layout update was wrong, you restore the previous version. There is no "oh no, I don't know what it looked like before." The changelog is the safety net.

**Reproducibility.** Given the same spec and the same warehouse, you get the same dashboard. The spec fixes the queries and the visual encoding; the warehouse provides the data; the renderer executes the spec. What changes between renders is the data, not the interpretation — there's no hidden state, no platform-specific settings buried three menus deep, no "I think there was a filter applied." If the spec says it, it renders it. If the spec doesn't say it, it doesn't.

**No configuration drift.** In a GUI-first tool, a dashboard that "nobody touches" quietly accumulates drift: a saved filter nobody remembers setting, a metric that means something slightly different from what the title says, a data source connection that was quietly changed when someone migrated the warehouse. When the dashboard is a spec in a repo, changes require a commit. Drift requires a merge. The audit trail is free.

## The honest tradeoff

Point-and-click BI tools are genuinely fast for one-off exploration. If you need to know what a metric looks like sliced three ways before you decide whether it's worth building, a quick drag-and-drop session in Metabase or Looker is hard to beat. That kind of ad-hoc question-answering is real and valuable.

dvt is built for the dashboards you keep. The ones that go to stakeholders every week, that represent your team's judgment about what matters, that need to stay accurate, on-brand, and consistent as your data model evolves. For those dashboards, the point-and-click loop is friction — it makes change slow, review impossible, and recovery from mistakes stressful.

dvt isn't either/or. It keeps a live editor — you can click into a panel and adjust properties interactively. But the editor writes to the spec, not to opaque platform state. When you click save, the result is a reviewable diff, not a mystery blob.

## How humans and AI agents use the same spec

Because the spec is a structured document with a schema, it's the same artifact whether a human writes it or an AI agent does. An agent that builds a dashboard over MCP posts a valid spec to the dvt API — the same JSON structure a human would author by hand or via the editor. The spec is schema-validated before any write goes through. A dry-run preview mode lets you see the rendered result before committing it.

That uniformity is what makes AI authorship trustworthy. The agent isn't operating a robot arm over your GUI. It's emitting a validated document against your warehouse, and that document goes through the same review process as any other change. You can read what the agent wrote, diff it against the previous version, and decide whether to merge.

[The MCP authorship flow is covered in more depth in the next post](/blog/talk-to-your-warehouse). The point here is that the dashboards-as-code foundation is what makes AI authorship reviewable rather than a black box.

## Dashboards in git — literally

dvt specs are JSON files. They can live in your repository, in a directory alongside your `dbt_project.yml` and your `models/` folder. When they do, every dashboard change participates in your existing git workflow: branches, PRs, CI checks, squash merges. Your BI layer earns the same rigor as your transform layer.

This isn't an exotic workflow. It's the same thing dbt did for SQL models a decade ago: take something that lived in a proprietary tool's database, give it a portable format and a home in version control, and let the community build tooling around the format. The format creates portability; portability creates gravity; gravity creates the ecosystem.

The format is documented and open — not locked to the dvt renderer. You can validate, lint, export, and import a spec without being tied to any platform.

## A note on CI validation

The spec is JSON Schema-validated before any write. That means you can add schema validation to your CI pipeline: a step that checks each spec against the published schema before it reaches production, the same way `dbt compile` catches broken models. Broken dashboards don't make it to stakeholders because the spec was invalid — they fail at the merge check.

The same CI step can run a dry-run render: spin up a headless render, confirm the dashboard produces the expected output given the spec, and flag regressions before they ship. Dashboard correctness becomes testable, because the dashboard is code.

---

The rest of the modern data stack — dlt for loading, dbt for transforming — earns all the benefits of being code: review, testing, history, reproducibility. The visualization layer has lagged. Dashboards-as-code is the concept that closes that gap, and dvt is built around it — a versioned spec as the native object model, not an export format bolted on afterward.

[Read the spec →](/spec) or [see how this fits the broader data stack →](/blog/where-dvt-fits)
