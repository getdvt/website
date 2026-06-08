---
title: "Where dvt fits — and the skills that should ride alongside it"
description: "dvt is the visualization layer of the data stack, and nothing more. Here's why that narrowness is the point, and the companion skills AI-native data teams should build around it."
pubDate: 2026-06-07
author: "Collin Austad"
---

The modern data stack has world-class tools for getting data in and shaping it once it's there. dlt loads it. dbt models it. Both are code-native, version-controlled, and built for the way data teams already work. Then you get to the part where someone actually has to *see* the data — and the tooling falls off a cliff into point-and-click GUIs that no agent can author and no repo can review.

dvt exists to fill that gap. But the more useful thing to understand about dvt isn't what it does — it's what it deliberately refuses to do.

## dvt is a grammar of graphics, not an opinion about your data

In 1999 Leland Wilkinson wrote *The Grammar of Graphics*, and a decade later Hadley Wickham turned it into ggplot2: the idea that any statistical graphic decomposes into a small set of independent parts — data, encodings, scales, geometry, layout — and that if you name those parts cleanly, you can describe *any* chart declaratively instead of drawing it by hand.

That's the layer dvt occupies. A dvt dashboard is a versioned JSON spec: every visual property is a named parameter, authored by humans and AI agents against the same schema. It is one consistent, declarative way to say *what the visualization is* — and that's the whole job.

What dvt is **not** is an opinion about your data. It doesn't tell you what a metric means. It doesn't decide whether "churn" is logo churn or revenue churn. It doesn't own your semantics. It renders the spec; the meaning lives upstream, in your warehouse and your models, where it belongs.

## The line dvt won't cross

This is the part that's easy to get wrong, and it's where most tools overreach. The two hardest questions in analytics aren't visual:

- **What does this data actually mean?** — exploration grounded in *your* semantics.
- **Should this be a raw query, or should it be modeled out?** — the judgment call between a one-off `SELECT` against a table and a dbt model that codifies the logic for everyone.

Neither question has a general answer. They're irreducibly company-specific, because they depend on *your* modeling strategy, *your* naming conventions, *your* sense of which definitions are load-bearing. A tool that ships a confident, generic answer to "what does churn mean here" is wrong at every company except possibly the one it was built at. That's exactly why enterprises struggle to stretch a single tool across the modeling boundary — and why dvt doesn't try to.

dvt stays disciplined about this on purpose. The restraint isn't a missing feature; it's the reason the spec can become portable. A format that encoded opinions about your semantics couldn't travel between organizations. A format that only describes the visualization can. Portability is a guarantee of the spec's *narrowness*.

## How to use dvt best

The cleanest mental model:

1. **Keep your semantics and modeling in your layer.** dbt models, your warehouse, your metric definitions. That's where meaning is decided, reviewed, and governed.
2. **Let agents author dvt specs over the results.** Describe the dashboard you want; an agent emits the spec against your modeled tables. Every property stays editable, in a structured spec, reviewable like any other artifact.
3. **Let dvt consume rows, never own metrics.** dvt pushes the query down to your warehouse and renders what comes back. It never re-hosts your data and never asserts what the numbers mean.

Used this way, dvt is boring in the best sense: a single, consistent visualization layer that does its one job and gets out of the way of yours.

## The skills that should ride alongside it

This is where it matters most for AI-native data teams. The two company-specific questions above — *explore this data* and *should this be modeled out* — are exactly the judgment that benefits from a skill an agent carries into your environment. dvt won't answer them for you. But the team around dvt should have skills that do, bound to *your* semantics.

We don't ship these yet. What we want to publish are **lightweight starters** you fork and adapt:

- **An `explore-data` skill** — not a generic "describe this table" prompt, but a scaffold that reads *your* modeling layer, *your* naming conventions, *your* documented metric definitions, and explores grounded in them. The starter is the skeleton; your semantics are the muscle.
- **A `suggest-when-to-model` skill** — a starter that watches for the smell of a raw query doing work that should be a model: the same join copy-pasted across five dashboards, a metric computed three slightly different ways, logic that belongs in dbt and not in a one-off `SELECT`. It nudges; you decide.

The point of both is the same as the point of dvt itself: the value isn't in us asserting an opinion. It's in giving you a clean, adaptable layer and letting your semantics fill it in. A starter that binds to *your* models is worth more than a clever one that assumes someone else's.

## The long game

dvt's bet is that the spec format becomes the thing every AI agent emits when it builds a dashboard — the artifact that travels between tools and lands in your repo when it makes sense. That only works if the format stays narrow enough to be portable, which means dvt has to keep refusing to be your semantic layer, your modeling tool, or your source of truth about what the data means.

One consistent layer for the visualization. Your models for the meaning. Skills you own for the judgment in between.

[See the spec →](/spec)
