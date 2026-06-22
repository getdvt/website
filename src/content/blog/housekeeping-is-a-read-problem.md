---
title: "Housekeeping is a read problem"
description: "“Read all the dashboards and come up with folders to organize them into.” One sentence, and an agent reorganized our entire internal org. The interesting part isn't that dvt can write dashboards — it's that an MCP server can read every one of them at once."
pubDate: 2026-06-21
---

Last week I typed a single sentence into a chat window — *read all the dashboards and come up with folders to organize them into* — and a few seconds later an agent had read every dashboard in our live internal org, grouped them by what they were actually about, and proposed a folder structure. Not a mockup. The real thing, against production, ready to apply.

The part worth dwelling on isn't that dvt can author a dashboard. We talk about that plenty. It's the quieter half of the loop: an agent that can *read* the whole portfolio at once, reason across it, and tell you what's wrong with it. Most of the pain in BI isn't authoring a chart — it's everything that accumulates around the charts after they're built. And almost all of that pain is a read problem.

## Why nobody audits their dashboards

Every data team has the same junk drawer. Dashboards nobody has opened in a year that nobody dares delete. Two sales dashboards living in two different folders because the people who built them never found each other's. A metric defined one way here and a slightly different way three folders over, both quietly feeding decisions.

The reason this sprawl never gets cleaned up isn't laziness. It's that auditing it means a human clicking through hundreds of dashboards, holding all of them in their head at once, and noticing the overlaps. Nobody has that afternoon, and even if they did, the tooling fights them: in a point-and-click BI tool the metadata that would let you compare dashboards — titles, descriptions, the SQL behind each panel, where each one lives — is locked behind a UI. It's not addressable. There's no surface an agent can reach in to read.

So the junk drawer wins. Not because the cleanup is hard, but because the cleanup was never something you could *ask for*.

## What changes when the metadata is addressable

dvt makes two bets that, taken together, turn housekeeping into a query.

The first is that a dashboard is **data, not a drawing** — a versioned JSON spec with a real schema. The title, the description, every panel's SQL, the folder it sits in: all of it is structured, inspectable metadata, not pixels.

The second is that the [MCP](/spec) surface over that data is a first-class read surface, not an afterthought. There are tools to search every dashboard, pull any one's full spec, read its documentation and the queries behind it, list the folder tree, and move dashboards between folders. An agent can call those in a loop, pull the entire portfolio into context, and reason about it the way a human would if a human could read four hundred dashboards in ten seconds.

That's the whole trick behind the one-sentence reorg. *Read all the dashboards* is a `search` plus a fan-out of `get` calls. *Come up with folders* is the model grouping the descriptions it just read. *Organize them* is a series of `move` calls. None of it is magic. It's that the metadata was finally somewhere an agent could reach.

## Three jobs this actually unlocks

**Organization.** The folder reorg is the obvious one. Give the agent the descriptions and it groups by what dashboards are *about*, not by who happened to build them or what they got named at 5pm on a Friday.

**Consolidation.** Once an agent has read everything, duplicates stop hiding. Two sales dashboards in two locations aren't two search results a human has to stumble across separately — they're two specs in the same context window, and the overlap is obvious. The agent can tell you *these three are the same dashboard wearing different titles*, and you can merge them down to one.

**Competing definitions.** This is the one I care about most. The same agent that reads descriptions can read the SQL behind each panel. When "active users" is computed one way in the growth dashboard and another way in the board deck, that's not a styling nit — it's two numbers claiming to be the same number. An agent reading across the portfolio surfaces those collisions, and surfacing them is the first step to picking one and making it the source of truth. The disagreement was always there; it just lived in places no one read together.

## The half of the loop everyone skips

The conversation about AI and dashboards is almost entirely about *writing* — describe what you want, get a chart. Fine. But the write side is a one-time act, and the read side compounds. Every dashboard you author is one more thing to organize, dedup, and keep honest later. An agent that can only write makes the junk drawer fill faster. An agent that can also read is what keeps it from becoming a junk drawer at all.

Governance, in most companies, is a project: a quarter-long initiative to "rationalize the BI estate" that everyone dreads and nobody finishes. When your dashboards are data and there's a clean read surface over them, governance stops being a project and becomes a question you ask in passing. *Which dashboards define revenue differently? What hasn't been touched in six months? Where do we have two of the same thing?* Each of those is one sentence now.

We didn't set out to build a housekeeping tool. We set out to make dashboards portable, reviewable data with an honest contract over them. The housekeeping fell out for free — because once the metadata is readable, asking an agent to tidy up is the same shape as asking it to build.

[See the spec →](/spec)
