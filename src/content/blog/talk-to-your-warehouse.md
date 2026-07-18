---
title: "Build dashboards with an AI agent: how dvt's MCP integration works"
description: "Why most AI dashboards dead-end as screenshots — and how dvt's MCP surface lets an agent author a live, versioned dashboard spec instead."
pubDate: 2026-06-20
author: "Collin Austad"
---

Most "AI dashboards" are dead ends. You describe what you want, the tool generates a visualization, and you get a chart — or a static page, or a screenshot embedded in a report. It looks good. Then you need to change something, or connect it to live data, or share it with a colleague who needs a different slice. And you find there is nothing behind the chart to change. The AI produced an image of an answer, not an answer.

dvt takes a different path. Because a dvt dashboard is a [spec](/spec) — a versioned JSON document that describes queries and visual encodings — an AI agent can author and revise it the same way a human does. The spec is the artifact. The agent writes the spec. You get a live, editable, warehouse-connected dashboard, not a screenshot.

## What MCP is and why it matters here

MCP (Model Context Protocol) is an open protocol for AI agents to interact with external tools and services. Instead of an AI assistant that's aware of only what's in its context window, MCP lets a model invoke tools — read a file, query a database, call an API — as part of generating a response.

dvt exposes its full API as an MCP tool surface. The tools are derived directly from dvt's OpenAPI contract ([not hand-written wrappers](/blog/dashboards-as-code)); when the API gains a capability, the MCP surface inherits it. An MCP-capable agent — Claude, for instance — can invoke those tools to create dashboards, update specs, validate changes, and preview results, all in the same session where you're describing what you want.

The practical effect: you have a conversation, and a real dashboard comes out the other end. Not a mockup. Not a generated image. A spec that runs against your warehouse, renders live data, carries a revision history, and is editable by anyone who has access to it.

## A concrete example

Say your orders table in Snowflake has columns for `order_date`, `customer_id`, `revenue`, `region`, and `aov`. You open a Claude session with the dvt MCP tools connected and type:

> Build me a revenue dashboard from the orders table. I want monthly trend, top 10 customers by revenue, and AOV by region.

The agent queries the table schema, writes SQL for each panel against your warehouse, constructs a valid dvt spec with the queries and visual encodings for all three panels, calls `dvt_spec_validate` to confirm the spec is well-formed, runs a preview, and posts the result to your dvt instance — schema introspection, authoring, validation, and preview in one pass.

The dashboard is immediately live. Every time someone opens it, dvt pushes the SQL to your warehouse and renders the result — current data, not a snapshot. The spec is in your revision history. If you want to change "top 10 customers" to "top 20," you describe the change; the agent edits the one panel, validates, previews, and applies. The rest of the spec is unchanged.

This is what separates a spec-driven approach from NL-to-chart tools. The agent is editing a structured document. Changes are surgical, legible, and reversible.

## SQL pushdown: dvt never hosts your data

When the dashboard renders, dvt pushes the SQL to your warehouse — Snowflake, BigQuery, Postgres, or whichever source the dashboard connects to. Only the result rows come back. dvt never stores your data, never copies it to a dvt-managed database, and never re-bills your warehouse compute. The computation runs where the data lives.

This architecture has a practical implication for AI authorship: the agent writes SQL that runs in your warehouse, against your tables, under your permissions. It doesn't have any access path to your data that you don't. If a query is expensive, it's expensive in your warehouse, which you can observe and govern with your existing tools. There is no hidden second query engine.

The agent inherits the key owner's warehouse permissions. It can query the tables the connection credentials are authorized to query. It cannot see tables or schemas outside that scope — not because dvt enforces a separate permission layer, but because the SQL simply fails at the warehouse if the credentials don't cover it.

## Why "AI-native by architecture" is a meaningful distinction

As of mid-2026, most major BI tools have added AI features — chat interfaces, NL-to-SQL bars, recommendation engines. Some have added MCP servers. Having an MCP server is no longer a differentiator.

What differentiates is what the MCP server reaches. When a BI tool exposes its MCP tools as a wrapper around the same REST API that drives its GUI — "create dashboard," "add widget," "set chart type" — the agent is operating the product's UI programmatically. The underlying object model is the same GUI-state blob it always was; it's just being clicked by an API call instead of a human hand.

dvt's MCP tools operate on the spec. The agent writes a JSON document, validates it against a schema, previews it, and diffs it. There is no GUI state to wrap. The spec is the product's native object model, designed for direct authorship — by humans typing JSON, by the live editor, or by an agent over MCP. All three paths produce the same artifact.

That architectural difference is why AI authorship in dvt is reviewable and reversible. A diff between two spec versions is human-readable. You can see exactly what the agent changed. You can revert it. You can add it to a PR if the spec lives in your repo. None of that is possible when the underlying artifact is a vendor-database blob.

## The honest caveat

AI authorship is not autonomous. An agent that builds a dashboard doesn't know what the numbers mean. It doesn't know that "churn" at your company is logo churn, not revenue churn. It doesn't know that one specific `order_status` value means a return and should be excluded. It writes the SQL and the visual encoding; it doesn't understand your semantics.

That semantic layer belongs upstream — in your dbt models, your metric definitions, your warehouse documentation. The agent's output is as good as the signal it has access to. If you give it a well-documented dbt model with clear column descriptions and a clear metric definition, it builds a much better dashboard than if you point it at a raw table with cryptic column names.

[dvt deliberately doesn't try to own your semantics](/blog/where-dvt-fits). That's not a gap in the product — it's a design decision. The spec describes the visualization; the meaning lives in your data layer. An AI agent that can read your dbt project docs before it writes the spec produces better output than one that can't. That integration is the next layer to build, and it belongs in a skill you own, bound to your conventions — not a generic "describe this table" prompt.

## Getting started with the MCP integration

The dvt MCP server is documented at [developer.dvt.dev/mcp/](https://developer.dvt.dev/mcp/). If you self-host the Community edition, the MCP server runs alongside the API. On a hosted instance, the MCP endpoint is available at your workspace URL.

The tools you'll use most often are `dvt_dashboard_apply_spec` (create or update a dashboard from a spec), `dvt_spec_validate` (validate a spec against the schema), and `dvt_dashboard_get` (retrieve an existing spec for the agent to read and modify). The full tool surface is derived from the OpenAPI contract — the developer docs have a complete reference.

Connect the MCP server to Claude, describe the dashboard you want, and iterate. The workflow is the same whether you're building from scratch or editing an existing spec. The agent can read the current spec, make a targeted change, validate the result, and apply it — or you can describe a new dashboard and have the agent build the spec from the table up.

---

A static snapshot is the wrong output when you need live data, iteration, and a revision history. A versioned spec connected to a live warehouse is the right one. [Read more about why](/blog/the-static-html-trap) — and then connect the MCP server and try it.

[Read the spec →](/spec) or [try the quickstart →](/quickstart)
