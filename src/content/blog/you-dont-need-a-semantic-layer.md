---
title: "You don't need a semantic layer to build dashboards with dvt"
description: "Raw tables, dbt models, or governed semantic views — dvt works on top of whatever you have. There's no modeling prerequisite, because dvt is the visualization layer and nothing else."
pubDate: 2026-06-22
---

There's a quiet assumption behind a lot of BI adoption: before you can build good dashboards, you need a clean semantic layer first. A pristine set of dbt models. A governed metrics layer. Blessed semantic views that turn your raw warehouse into tidy, agreed-upon concepts. The worry that follows is predictable — *we're not there yet, so we can't use a tool like this.*

You can. dvt has no modeling prerequisite.

## What dvt actually needs

Nothing in particular. If you have semantic models or semantic views, dvt will happily build on them. If you have dbt models with good documentation, that works too. And if all you have is raw tables in Snowflake, that works as well. You don't need a dbt Cloud integration. You don't need a metrics layer. You don't need to have finished the modeling project that's been on your roadmap for two quarters.

The only thing that matters is what you give your agent access to.

## Two surfaces, not one

It's worth being precise about where dvt sits, because the confusion comes from collapsing two separate things into one.

The first surface is **your agent exploring your warehouse**. An AI agent — Claude, in our case — needs to understand the shape of your data: what tables exist, what the columns mean, how things join. That exploration happens through whatever access you already have. Point the agent at Snowflake through the `snowsql` CLI and it can browse tables directly. Give it your dbt docs and it reads your models and descriptions. Hand it a set of semantic views and it uses those. All three are valid; you choose based on what your stack already exposes.

The second surface is **dvt authoring the dashboard** — taking what the agent learned and turning it into a live, versioned [JSON spec](/spec) over the dvt MCP server. That spec is the dashboard: schema-validated, diffable, reviewable, rollback-able.

dvt owns the second surface. It is deliberately agnostic about the first. Whatever path got the agent to "I understand this data," dvt picks up from there.

## Why it's built this way

This isn't an accident or a gap we haven't gotten around to filling. It's the point. dvt is the visualization layer of the data stack, and [nothing more](/blog/where-dvt-fits). Data exploration and modeling belong to your warehouse and your agent — they're already good at it, and there's an entire ecosystem built around doing them well. Bolting a half-built semantic layer onto a viz tool would make dvt worse at the one thing it's supposed to be great at.

So we went the other way. We don't try to own how your data is modeled. We go deep on what happens after: the chart grammar, the layout system, the theming, the revision history, the render pipeline. The part that turns "I understand this data" into a dashboard you'd actually put in front of a stakeholder.

## The honest tradeoff

A good semantic model genuinely helps. When metric definitions live in one governed place, the agent has firmer ground to stand on — it doesn't have to infer what `revenue` means or guess which `amount` column is the right one, and two people asking the same question get the same number. If you have that layer, use it. dvt will be better for it.

But it's an accelerant, not a gate. Raw tables mean the agent — and you — carry more of the "what does this column actually mean" burden up front. dvt won't fix thin modeling; it visualizes what you point it at, faithfully, including the parts you haven't cleaned up yet. That's an honest limitation, and it's the right one: a viz tool that quietly invented its own metric definitions would be far more dangerous than one that renders exactly what you asked for.

## Bring your own access

The practical upshot is simple. You don't have to wait. Wherever you are in your modeling journey — raw tables, half-built dbt project, or a polished semantic layer — dvt meets you there. Give your agent a way to understand your data, and dvt turns that understanding into a dashboard worth keeping.

You bring the access. dvt owns the pixels.

[See the spec →](/spec), [read how the MCP authoring flow works →](/blog/talk-to-your-warehouse), or [try the quickstart →](/quickstart)
