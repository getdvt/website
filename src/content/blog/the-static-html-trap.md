---
title: "The static HTML trap: how we recognized the need for dvt"
description: "AI made everyone a dashboard author overnight. The output was a pile of static HTML files — stale on arrival, impossible to reproduce, and scattered across everyone's downloads folder. That gap is why dvt exists."
pubDate: 2026-06-16
---

The first time you ask Claude to turn a query result into a dashboard, the turnaround is startling. You paste in some numbers, describe what you want, and a few seconds later you have a polished HTML page — charts, KPIs, a tidy layout. No BI tool, no ticket, no waiting. Everyone on the data team figured this out at roughly the same moment, and for a few weeks the speed was enough.

Then the files started piling up, and the cracks showed. Not in the charts — the charts looked fine. In everything around them.

## Three cracks in the static HTML page

**It's stale the instant it's generated.** An HTML page is a photograph of the data at one moment. The numbers are baked in. The morning after you generate it, the dashboard is already lying — it shows yesterday's pipeline, last week's revenue, a snapshot frozen at the timestamp of whatever query you happened to run. There's no refresh button, because there's nothing behind it to refresh from. To get current numbers you regenerate the whole thing, which leads straight to the second crack.

**You can't faithfully reproduce it — not even if you wrote it.** Regenerating isn't re-running; it's re-rolling. LLMs are non-deterministic, so the same prompt against fresh data gives you a *different* dashboard: the axis is formatted differently, a chart you liked is gone, the color palette shifted, a metric is computed a slightly new way. The author can't reproduce their own work. There's no source artifact to diff, nothing to point at and say "keep this, change only that." Every update re-rolls the prompt, so you can't know in advance which properties shift — and you're staking the layout you spent an afternoon getting right.

**Sharing it is a mess.** A static page isn't anywhere — it's a file. So it travels the way files travel: dropped in Slack, attached to an email, parked in a shared drive with a name like `dashboard_final_v3_REAL.html`. Five people end up with five copies, each a different vintage, none of them canonical, and no way to tell which is current short of opening all of them. The thing you built to create clarity becomes one more pile of clutter nobody can navigate.

None of these are chart problems. They're artifact problems. The page renders beautifully and is worthless as a shared, living thing — because a frozen file was never the right output in the first place.

## What the AI got right, and what it was missing

The instinct behind all that HTML was correct. People reached for AI because describing a dashboard in a sentence is obviously better than clicking a GUI into submission, and because they wanted the output *now*. That part of the workflow is keeper. The AI wasn't the problem.

What was missing was somewhere durable for the output to live. The generation step was AI-native; the artifact was a dead end. You had the speed of describing a dashboard to an agent, and then the agent handed you the single least durable form that output could take — a snapshot in a file.

That's the gap we recognized. The fix isn't to slow down the AI or send people back to the point-and-click tools. It's to give the AI a better thing to emit, and a place to put it.

## What dvt does instead

dvt keeps the part that worked — you still describe the dashboard and an agent builds it — and replaces the part that didn't.

**The output is a spec, not a snapshot.** An agent emits a versioned [dashboard spec](/spec) against your modeled tables, not a page with the numbers baked in. The spec describes the queries; dvt runs them against your warehouse at view time, so the dashboard is current every time someone opens it. Stale-on-arrival stops being possible.

**It's reproducible because there's a real artifact.** The spec is the source of truth, with full revision history. Changing a dashboard is a diff against a structured document, not a re-roll of a prompt. You keep what you like and change one thing, deterministically — the non-determinism of the LLM is confined to authoring the spec, and once it exists, it's just data you can read and edit.

**It lives on a platform, not in a downloads folder.** A hosted dvt dashboard has one canonical home — a URL, a folder, a revision history — instead of five copies of an HTML file aging out across people's inboxes. Sharing is sending a link to the live thing, not mailing a frozen copy.

## Customized to you, down to the branding

The static-HTML era did have one real virtue worth keeping: when you generate a page from scratch, it can look like anything you want. We weren't willing to trade that for the safety of a platform.

So dvt is extensible at the authoring layer. Teams build their own Claude skills that drive *what* gets built and *how* it looks — your chart conventions, your layout patterns, your house style, your brand, down to the colors and type. The agent that authors your specs carries your taste into the work. You get the living-platform guarantees — current data, reproducibility, one canonical home — without flattening every dashboard into the same generic template. Highly customized output, authored by an agent carrying your conventions, that doesn't go stale and doesn't get lost.

That's the trade we set out to make: keep everything the AI got right about generating a dashboard, and fix everything the static HTML file got wrong about being one.

[See the spec →](/spec) or [try the quickstart →](/quickstart)
