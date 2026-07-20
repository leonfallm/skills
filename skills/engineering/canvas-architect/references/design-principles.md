# Design principles — why architecture diagrams read as "designed" vs "wireframed"

The difference between a diagram that looks professional and one that looks like a
first-draft wireframe is almost never the information — it's the layout discipline. These
are the rules distilled from iterating a real diagram from cramped to clean.

## 0. Density is the enemy — and the canvas is infinite

The failure mode is *cramming*, not node count. A 47-node diagram isn't bad because it has 47
nodes — it's bad when they're packed into a small area with edges crossing each other. The
same 47 nodes, spread out with real spacing and clean routing, read fine. So the rule is
**scale the layout to the content, never the content to a fixed frame** — show everything the
system actually has, and give each node room.

- **Spread out; never drop detail to "fit".** The canvas is infinite and `commit()`
  zoom-to-fits, so there's no penalty for a large diagram — only for a *dense* one. If it
  feels tight, the answer is more space, not fewer nodes.
- **Generous gaps (~80px+), short labels, one clear spine.** These make a big diagram read as
  easily as a small one. (Detail lives in container titles, edge labels, the legend — §3b.)
- **Clean routing, not short edges.** Longer connectors are fine as the diagram grows — just
  never let one cross *other nodes*. Align related nodes so their edge is a straight shot;
  route secondary / identity / write edges along the margins with a gentle arc.
- **Split into multiple pages only when the *relationships* genuinely tangle** (à la C4's
  context → container → component levels) — as a tool for managing crossing complexity, never
  as a cap on how much you're allowed to show. One spacious page is the default; richness is
  welcome, cramming is not.

## 1. Whitespace and rhythm

- **Vertical gaps of ~80px** between stacked nodes (tighter only for tight sub-groups). Too
  little and the connecting arrows hide between flush edges, so the flow reads as one blob.
  Air lets the eye segment the pipeline into steps.
- **Consistent gaps.** A varying rhythm looks accidental. Pick one gap value and reuse it.
- Don't fear a large canvas. On an infinite canvas, generous margins cost nothing and make
  routing (especially bypass arcs) clean. `commit()` zoom-to-fits your page anyway.

## 2. Containers and grouping

- A dashed group box says "these belong together." Its contents must be **inset** so they
  never touch the wall — 40px side padding is a good default (the `container()` helper does
  this). Boxes touching the container border is the #1 wireframe tell.
- Give the group a **filled, titled header strip** at the top (`fill:'semi'`), not a bare
  text label sitting on the border line. The strip reads as a caption; a floating label
  reads as a mistake.
- Leave a gap (~28px) between the header strip and the first node inside.

## 3. Typography

- **Use the `sans` font.** tldraw's default `draw` font is charming for whiteboard
  sketches but undercuts a serious architecture doc. All helpers default to sans.
- **Hierarchy:** one `xl` page title; a `s` grey subtitle for the one-line thesis; node
  labels at `s`. Within a node, a name line + **≤2** concise detail lines. Bullet-dense
  boxes ("· a · b · c · d · e") are fine as one line, but a five-line paragraph is not —
  cut it or move the detail to a caption.
- Prefer `·` separators over commas for compact attribute lists; they read cleaner centred.

## 3b. Restraint — the difference between "designed" and "flowchart"

The single biggest ugliness trap is **over-labelling into a grid of identical rectangles**.
A diagram where every node is the same-size box packed with 4–5 lines reads as a wireframe,
even with perfect spacing. Fixes, in order of impact:

- **Push detail out of the nodes.** A node should carry a name + at most one short
  qualifier. Everything else belongs in the container's title strip, the page caption/
  subtitle, or the legend. (A pipeline container titled "re-verify → dedup → merge →
  reweave → prune" lets each node be just its name — five terse nodes read far better than
  five paragraphs.)
- **Never repeat what colour already encodes.** If green means AUTO, don't also stamp
  "[AUTO]" in every green box — it's noise. Put the colour key in the legend once.
- **Vary shape by role, not decoration.** People/roles → `actor()` glyphs; datastores →
  `oval` pills; processes → rectangles; the odd-one-out (an external system, the engine) →
  a distinct fill or shape. A little shape variety makes roles legible at a glance; too
  much (five different shapes) is busy — aim for 2–3 meaningful shape classes.
- When in doubt, **cut a line and add whitespace.** Sparse + hand-drawn (`sketch` theme)
  almost always reads as more considered than dense + rigid.

## 4. Connectors

- **Consistent anchors.** Structural flow arrows exit the bottom-centre and enter the
  top-centre (vertical flow), or right/left-centre (horizontal). Uniform anchors make the
  diagram look laid-out rather than sprayed.
- **Bypass / secondary edges** — an arrow that skips the main path (a write that avoids the
  read layer, a cache-aside, an async side-channel) — should **arc out into a clear margin**
  using `bend`, and be **visually distinct** (a different colour + `dash:'dashed'`). Never
  let it cut a straight diagonal across other boxes; that's the second-biggest wireframe tell.
- Put the target node the bypass points at **first** in its group, so the arc lands cleanly
  without crossing its siblings.
- The `bend` sign is not predictable from the number alone — draw it, screenshot, flip the
  sign if it bows the wrong way.

## 5. Colour semantics — spend it, don't spray it

This is the easiest thing to get wrong, and colourful ≠ good. Follow three rules:

1. **Colour encodes ONE variable per diagram.** Decide the single axis colour represents
   — trust disposition, or tier, or chosen-vs-rejected — and never overload it. Using
   `green` for both "a datastore" and "an auto step" in the same picture is the classic
   mistake: the reader can't tell which meaning applies. If you need to show two things
   (role *and* disposition), let **shape** carry one (○ actor, pill datastore, rectangle
   process) and colour the other.
2. **Default everything to neutral (`grey`), and spend colour only on the 1–2 categories
   that actually matter.** A near-monochrome diagram with one amber accent on "needs a
   human" reads as far more considered than a rainbow — and matches the hand-drawn
   reference aesthetic. If a box's colour isn't doing semantic work, make it grey.
3. **If you can't state in the legend what a colour means, it shouldn't be coloured.**
   Every colour used must appear in the legend with its meaning. No decorative colour.

Only *after* you've chosen your one axis, a role-coding palette can help — e.g. tiers as
`light-blue`/`blue`, compute `violet`, the highlighted/chosen thing `green`, rejected/cost
`red`, a secondary source `orange`. But that table is a menu for one consistent axis, not a
licence to colour every box differently.

## 6. Legends and annotations

- If edges have more than one meaning (solid vs dashed, colour coding), explain them in a
  **bordered legend box** (`legend()` helper), placed in dead space (e.g. the centre gap of
  a comparison). Scattering the same explanation as inline arrow labels is noisy.
- Keep inline edge labels for genuinely per-edge information (a payload, a protocol, a
  cardinality) — see the sequence archetype.

## 7. Alignment and symmetry

- Share **column centres** and **row Ys**. In a side-by-side comparison, keep equivalent
  rows (both "gateway" boxes, both "Foundry" boxes) at the same Y so the eye compares
  across cleanly. Asymmetry that isn't meaningful reads as sloppiness.
- Centre a `VS` marker and the legend in the gap between compared columns.

## 8. Name the structure — label every container and relationship

Terse *nodes* (§3b) do not mean a terse *diagram*. The structure around the nodes should
be labelled as fully as possible — this is where an architecture diagram earns its keep,
and it's the C4 rule: **every element has a name, every relationship has a description.**

- **Every container / boundary gets a name.** A dashed box drawn around other boxes with
  no title forces the reader to guess what the grouping *is* (a trust boundary? a
  deployment unit? a phase?). The `container()` helper makes this the default — it always
  renders a titled header strip; never draw a bare grouping rectangle instead. Nested
  boundaries each get their own label (C4 context → container → component are all named).
- **Label relationships with what flows or why**, especially edges that **cross a
  boundary** (into or out of a container) or whose meaning isn't obvious from position:
  "reads", "publishes events to", "calls over gRPC", "on-behalf-of token". A diagram of
  named boxes joined by anonymous arrows is only half a diagram.
- **The clean exception:** a plain linear sequence — a numbered pipeline, or A → B → C
  where "next" is the only relationship — doesn't need a verb on every arrow; position
  already carries it. Spend arrow labels where they add information, not where they'd
  restate the obvious.

So the labelling budget flows *outward*: cut words inside nodes, spend them naming the
containers, the boundaries, and the relationships. Detail that made a node a wall of text
usually belongs on the container title or the edge into it.

## The meta-rule

You are laying out a 2D composition, and you cannot do that blind. **Screenshot after every
draw and look at it.** Every principle above is really just a thing to check for in that
screenshot: gaps, padding, overflow, hidden arrows, diagonal crossings, floating labels,
misalignment. Two or three refine passes to get there is normal, not a failure.
