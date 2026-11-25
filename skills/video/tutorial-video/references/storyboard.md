# The storyboard: video.json

`render.mjs <video-folder> init` writes a starter with every captured action in one step. You
split it into steps and write the words. The player works out the timing.

```json
{
  "name": "invite-a-colleague",
  "eyebrow": "Harbor",
  "title": "Invite a *colleague*",
  "subtitle": "Three steps, under a minute.",
  "railLabel": "Team",
  "brand": { "accent": "#0E7C66", "accent2": "#17A98B" },
  "url": { "replace": [["^file://.*app\\.html#?", "harbor.example"]] },
  "steps": [
    { "title": "Open the team page", "note": "You need the Owner or Admin role.",
      "actions": [ { "use": "a1", "chip": "Team" }, { "use": "a2", "chip": "Invite a colleague" } ] },
    { "title": "Fill in who it is", "text": "Name, work e-mail and role.",
      "actions": [ { "use": "a3", "chip": "Name" }, { "use": "a4", "chip": "E-mail" }, { "use": "a5", "chip": "Role" }, "a6" ] },
    { "title": "Send the invitation", "note": "The link in the e-mail works for seven days.",
      "actions": [ { "use": "a7", "chip": "Send invitation" }, "a8" ] }
  ],
  "outro": { "title": "Invitation *sent*.", "tag": "They join with one click.", "small": "harbor.example/team" }
}
```

## The fields

| Field | What it is |
|---|---|
| `name` | The file name of the result. |
| `eyebrow` | The product's name, small above the title and on the outro. |
| `title` | The opening title. Put `*` around the one word to highlight. At most seven words. |
| `subtitle` | One line under the title: what it takes or what the viewer gets. |
| `railLabel` | A small label above the steps (the area of the product). Optional. |
| `brand` | Colours, font and logo. See below. |
| `url.replace` | Pairs of a pattern and a replacement for the address bar. The first pattern that matches wins. |
| `steps[].title` | The step's name, an action in a few words: "Add invoice details". |
| `steps[].text` | An optional sentence under the title. |
| `steps[].note` | An optional smaller line: a condition or a consequence. A line break is `\n`. |
| `steps[].actions` | The captured actions of the step, in order. |
| `outro` | `title` (with a `*highlight*`), `tag` and `small` (a web address). |
| `poster` | The second whose frame becomes the poster and frame 0. Default: the title card. |
| `audio` | `false` for a silent video. |
| `fps` | Frames a second. Default 30. |

Three to six steps read well. More than seven do not fit the rail.

## An action in a step

Write the id alone (`"a6"`), or an object that adds to or overrides what was captured:

| Key | Effect |
|---|---|
| `use` | The id of the captured action. |
| `chip` | A word on the rail that lights up when the action happens. Use it for the two to four clicks that carry the step, not for every action. |
| `pace` | `"fast"` for a run of the same small action (ticking six boxes): short travel, no ring. |
| `ring` | `false` to drop the ring before a click, `true` to force one. |
| `hold` | Extra seconds after the action, to let the viewer look at the result. |
| `lead` | Seconds before the pointer starts to move. |
| `zoom` | The camera's zoom for this action (1 shows the whole page, 1.5 is close). |
| `aim` | `[x, y]` in page pixels: where the camera centres. |
| `camera` | `"wide"` to show the whole page for this action. |
| `label` | The name of the action in check sheets, and for a `ring` the text whose length sets how long the ring stays. |

Leave an action out of every step and it is not in the video. The order in `video.json` is the
order on screen, so it must match the order of the capture.

## What the player decides

- **Pace.** The pointer's travel time follows the distance. A typed text takes its length. A
  new page gets a moment wide before the next target. A step stays open at least 0.3 s for
  every word on the rail. Run `render.mjs <video-folder> timeline` to see the result.
- **Camera.** Wide when a page arrives, then close on the target. Targets that sit together
  on one screen (the fields of a form) share one framing, so the camera does not pan from field
  to field. It moves only when the next target is out of view.
- **Rings.** One on each click target just before the press, and one on each `ring` action.
- **Sound.** One soft click per press, made by the renderer. Typing and scrolling are silent.

If the pace is wrong, change the words or the actions first (fewer words, `pace: "fast"`, a
`hold`), not the player.

## Brand

```json
"brand": {
  "accent": "#0E7C66", "accent2": "#17A98B",
  "ring": "#E8590C",
  "ground": "#F5F3EE", "ink": "#15161A", "muted": "#63646C",
  "dark": "#131418", "onDark": "#F5F3EE",
  "font": "\"Archivo\", Arial, sans-serif",
  "fontFiles": [{ "family": "Archivo", "src": "fonts/archivo.woff2", "weight": "100 900" }],
  "logo": "logo-dark-on-light.png", "logoDark": "logo-light-on-dark.png"
}
```

Every key is optional. `accent` and `accent2` make the gradient on the highlighted word, the
active step and the rule. `ring` is the highlight ring's colour: keep it clearly different from
the product's own buttons, or the ring disappears on them. `ground` and `ink` are the stage and
its text, `dark` and `onDark` the outro. Paths are relative to the video folder. `browser.mjs
brand` prints the product's own colours and font as a starting point.

Use a logo only when the person gave you the file or it is theirs to use. Never retype a
wordmark as text and call it the logo.

## Actions written by hand

When there is no access to the app, a video can be made from screenshots alone. Put the images
in the video folder and write the actions in the step instead of `use`:

```json
{ "type": "click", "label": "Pay", "url": "https://pay.example.com/checkout",
  "before": "screens/card-filled.png", "after": "screens/paid.png",
  "box": { "x": 584, "y": 598, "w": 432, "h": 52 }, "radius": 8, "nav": true }
```

`box` is the target in page pixels, measured in the image at the capture size. Types: `click`,
`type` (give `text`, `before` and `after`), `ring` (give `box` and `before`), and `view` (just
`before`, held for `hold` seconds). All images must have the proportions of `viewport` in
`flow.json` and show the page only, without the browser's own bars. With no capture at all,
write `flow.json` yourself:
`{ "viewport": { "w": 1440, "h": 900, "dsf": 2 }, "actions": [] }`.

Boxes read off an image are less exact than captured ones: check every press in the check
sheets.
