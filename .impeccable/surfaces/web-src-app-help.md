---
version: 1
slug: "web-src-app-help"
primary_target: "web/src/app/help"
related_targets: []
---

## Scope

The help library: a public reference manual at `/help`, the same content served
pre-login on installed sites, and an in-app drawer keyed to the screen the
reader is on. Mode: Read.

## Audience and job

A service advisor at a counter with a customer in front of them, a mechanic on
a phone with dirty hands, an owner in their first hour, council IT looking for
who to ring. The question is never "tell me about MOTION" — it is "why can't I
void this?", "how do I take a deposit?", "what does taken-unused mean?".

At N$550/month with margins to hold above 90 %, support volume is the binding
constraint. Every answer found here is a call that does not happen. That is
what this surface is for.

## Constraints

Renders with no outward request: self-hosted fonts, no CDN, no analytics, no
embedded widgets. Installed sites have no inbound access and often no internet.

## Direction contract

THESIS: The manual a workshop keeps open beside the job — every topic visible
at once, so nobody has to already know the right word to search for. It refuses
the category default: a help centre that is a search box above six identical
icon-and-heading cards, hiding its own contents behind a query the reader
cannot yet phrase.

OWN-WORLD: MOTION's own, inherited whole. White ground, slate-900 ink,
slate-500 secondary, hairline slate-200 rules doing the work shadows do
elsewhere, teal-700 on anything actionable. Near-zero radius. 10px small-caps
tracked labels. Tabular numerals. Lucide icons at one stroke. Recognisable with
every word removed by the rules and the rail, never by ornament.

STORY: The reader understands MOTION is organised the way their work is, not
the way its menus are; believes the answer is short and already written; does
the task and closes the panel without having read a second page.

FIRST VIEWPORT: Desktop, three columns on white. A 240px topic rail at left,
every topic visible and grouped by the job — Getting started, The job, Money,
Parts, Reports, Settings — the current one carrying a 1px teal marker. A centre
column at 68ch: title at 30px/600, body at 15px/1.7. A 200px "on this page"
rail at right. Search sits in the sticky masthead, present on every page of
the manual — amended from "the head of the centre column" at the finish
review, which had left topic pages with no search at all even though a topic
page is where most readers land, from a link or a search engine. Putting it
above the index's contents also contradicted the thesis: the index leads with
everything it has, not with a box. On a phone the rail becomes one "Contents"
disclosure above the article, search takes its own masthead row, the right
rail is gone, and the article runs full width in a 16px gutter. Signature interaction: the in-app drawer opens over the current screen
carrying that screen's topic already selected, and closes back to the work.

FORM: The Reference Manual — seventh of seven on my ordered list, locked by the
user against The Question Index and The Screen Atlas. Seed key 009c9faf.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
