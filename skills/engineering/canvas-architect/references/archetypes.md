# Layout archetypes

Start from the skeleton closest to the diagram you need, then adapt. All use the
`scripts/helpers.js` primitives. Coordinates are illustrative — keep the *proportions*
(gaps, paddings, alignment) and move the whole thing wherever.

## 1. Layered flow (client → edge → service → stores)

The default for "how a request flows through the system." Vertical spine of tiers; the
data stores live in a titled container at the bottom; secondary paths (cache-aside, async)
arc out into a margin. See `scripts/example-layered.js` for a full runnable version.

```
title (xl) + subtitle (s, grey)
[ Client ]        column centre cx, nodes 300 wide, ~56px gaps
   ↓
[ API gateway ]
   ↓
[ Service ]
   ↓
container "Data stores"  (dashed, titled strip, 40px pad)
   [ Postgres ]  [ Redis ] ...
```

## 2. C4 layers (context / container / component)

C4 zooms from system context → containers → components. Model each level as a titled
container; actors (people / external systems) sit outside as `actor()` glyphs with a
solid arrow into the boundary; a labelled "zoom in" arrow links one level's box to the
next level's container.

```
actor("user", …)  ──▶  container "System context"
                            [ Our system ]  ──▶ [ External API ]
        │ zoom in ▼
                        container "Containers"
                            [ Web app ] [ API ] [ Worker ] [ DB ]
        │ zoom in ▼
                        container "Components (API)"
                            [ Controller ] [ Service ] [ Repository ]
```

Tips: one container per level, stacked with a big gap; keep the same left edge so the
"zoom" reads as a descent. Put audiences/actors consistently on one side. Use `light-*`
fills for boundaries and saturated fills for the focused element.

## 3. Sequence / interaction (payload-labelled edges)

For "what messages flow between these systems." Actors/systems as a header row of boxes;
a vertical lifeline (a thin tall rectangle or just implied by column x) under each; edges
are horizontal arrows between lifelines carrying **payload labels** on the arrow itself.

```
[ CLI ]        [ Server ]        [ Cloudflare ]
  │  ── createTunnel { appId } ──▶   │
  │                │  ── port ──▶    │
  │   ◀── { tunnelId, token } ──────  │
```

Use `arrow(..., { label: "{ tunnelId, token }" })`. Order edges top-to-bottom by time;
keep vertical gaps even. Group a system's sub-steps (createTunnel / attachLogger /
receiveLog) as stacked boxes under its column, like the Cloudflare-tunnel reference.

## 4. Side-by-side comparison (option A vs option B)

For deciding between designs. Two columns with **aligned rows** (equivalent nodes at the
same Y), a coloured header banner per option (green = chosen, red = rejected), a `VS` and a
`legend()` in the centre gap. The shared front-end is drawn in both columns so each reads
standalone; the difference is what changes down the stack.

```
[ OPTION A ✓ ]                    VS                    [ OPTION B ✗ ]
[ Client ]                                              [ Client ]
[ Gateway ]                     LEGEND box              [ Gateway ]
[ Service ]                                             [ Service ]
container "sources"                                     container "sources"
  [ A-specific … ]                                        [ B-specific … ]
```

This is exactly `references/example-comparison.js` — read it for the full treatment
(bypass arcs, aligned Ys, centre legend). It's the canonical quality bar.

## Choosing

- "How does a request flow / what's the pipeline" → **layered flow**.
- "Show the system at different zoom levels / C4 / context diagram" → **C4 layers**.
- "What messages/calls go between services / protocol / API interaction" → **sequence**.
- "Which option should we pick / A vs B / trade-offs" → **comparison**.
- Topology ("what talks to what", no strong ordering) → a free layout: cluster related
  nodes, route edges with labels, keep consistent anchors and colour semantics.
