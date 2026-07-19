---
title: "The two things dvt actually promises"
description: "Faster dashboard dev cycles, and always knowing what's published. What dashboards-as-code buys you after the authoring is done."
pubDate: 2026-06-09
---

Ask a data team what's wrong with their BI and they rarely complain about chart quality. They complain about the stuff around the charts: dashboards nobody has opened in a year but nobody dares delete, metric definitions buried in a filter pane somewhere, five teams who each built their own version of the same revenue dashboard because none of them could find the others'.

These look like three separate problems: dead dashboards, governance, discovery. They're actually one problem. In every incumbent BI tool, a dashboard is an opaque artifact: a pile of GUI state that only the rendering engine can interpret. Nothing can read it, so nothing can reason about it, so the catalog rots.

dvt's bet is that if you make the dashboard a versioned JSON spec, code that humans and AI agents author against the same schema, two promises follow. The first one is the obvious sales pitch. The second one is the bigger deal.

## Promise 1: faster dev cycles

This is the one everybody gets immediately. You describe the dashboard you want; an agent emits the spec against your modeled tables. There's no learning which sub-menu hides the axis formatting in this quarter's version of the UI, no screenshot-driven tickets to the one person who knows the tool. Every visual property is a named parameter in a structured spec, so a change is a diff, and a diff is reviewable like any other code.

The practical effect isn't just speed: it's where the time goes. Analysts stop spending afternoons clicking a BI platform into pixel-perfect submission and spend them on the work that actually moves the needle: data quality, modeling decisions, the insight itself. Formatting becomes a sentence to an agent instead of a session in a GUI.

## Promise 2: you always know what's published

This is the promise nobody puts on a landing page, and it's the one that compounds.

**Definitions become legible.** The industry's current answer to governance is a standalone semantic layer: a second place to define every metric, maintained in parallel with the dashboards that use it. In practice, definitions end up embedded in dashboards anyway, despite everyone's best intentions. dvt doesn't fight that gravity. Because a dvt dashboard is code, the definitions that land in it are *readable*: an agent can open the spec and see exactly which queries define which numbers, and how someone combined them into a view of a topic. To be clear, this isn't dvt becoming your semantic layer. [It still refuses to own what your metrics mean](/blog/where-dvt-fits). Meaning stays upstream in your models. What changes is legibility: the definitions you were going to embed anyway stop being trapped in GUI state.

**Discovery becomes an agent's job.** When an agent authors a dashboard, it can write the documentation into the spec as part of the same act: a description of what the dashboard answers, written by the thing that just wrote the queries. That turns your BI catalog into something an agent can navigate: list the folders, list the dashboards in them, read the descriptions it wrote earlier. We've found slugs plus good descriptions get you remarkably far before you need anything fancier; embeddings-backed semantic search is on the hosted roadmap for when catalogs outgrow that. Either way, "where do I find the sales number" and "who owns this dashboard" stop being questions you ask in Slack. And when five teams *have* built the same dashboard, consolidation becomes a read-the-code problem: an agent can diff the specs and tell you they're the same dashboard wearing different titles.

**Dead dashboards stop being scary.** Every dvt spec is a versioned data record with a full revision history (per element, per page, per dashboard), and restore is built in today. Deleting a dashboard isn't a leap of faith anymore; if it turns out someone needed it, it comes back from the changelog. The half of this that's still ahead of us is detection: the hosted product sits in the serving path, so it sees usage, and recommending "this dashboard hasn't been opened in six months: archive it" is exactly where we're taking it. Safe deletion is shipped; confident deletion is the roadmap.

## One artifact, both promises

Neither promise requires a new discipline from your team. No second definition layer to maintain, no cataloging ritual, no quarterly dashboard-cleanup sprint. Both fall out of a single design decision: the dashboard is a spec, and a spec can be read.

Fast to author, impossible to lose track of. That's the trade dvt is offering.

[See the spec →](/spec)
