# Capturing a flow

`scripts/browser.mjs` starts one browser that stays open between commands. Each command does
one thing and prints one line. The recording lands in the video folder: `flow.json` (the
actions) and `shots/` (the pictures).

## Open, sign in, close

```bash
node browser.mjs open --dir tutorials/invite --url https://app.example.com
node browser.mjs status
node browser.mjs close
```

| Flag | Default | What it does |
|---|---|---|
| `--dir` | required | The video folder. An existing capture there is continued, not replaced. |
| `--url` | none | The page to open first. |
| `--viewport` | `1440x900` | The size of the page. Keep it for the whole capture. |
| `--dsf` | `2` | Pixel density. 2 stays sharp when the camera zooms in. |
| `--profile` | `default` | Which saved profile to use. One per account you film. |
| `--headless` | off | No window. Only for apps that need no sign-in by a person. |

The profile lives in `~/.tutorial-video/profiles/<name>`. It is separate from the person's own
Chrome, so nothing in their daily browser is touched and their other sign-ins are not in the
frame. A sign-in made once in this window is still there the next time the same profile opens.

The person signs in themselves in the window. While they do, wait with
`node browser.mjs wait "text=Dashboard"` (any selector that only exists after sign-in).

## Look before you click

```bash
node browser.mjs look           # what is in the window
node browser.mjs look --all     # also what is further down the page
```

`look` prints every clickable thing with a number, its role, its name and its place, and saves
`look/look.png`, the page with the same numbers drawn on it. Read the picture when two things
have the same name. The numbers are valid until the page changes: after a click that redraws
the page, run `look` again.

## A target

Every action takes a target:

| Form | Example | Use it when |
|---|---|---|
| A number from `look` | `click 12` | You just ran `look`. |
| Text | `click "text=Save changes"` | The label is unique on the page. |
| Role and name | `click 'role=tab[name="Billing"]'` | Buttons, tabs, links with a clear name. |
| CSS | `type "#email" "anna@example.com"` | The element has a stable id or attribute. |
| A point | `click xy=640,320` | Nothing else works (a canvas, a map). |

## The actions

| Command | What is recorded |
|---|---|
| `click <target>` | The screen before, the hover state, the target's box and corner radius, the screen after, and whether a new page opened. |
| `type <target> <text>` | A click in the field, then one picture of the field per character, then the screen after. `--clear` empties the field first. `--secret` keeps the text out of `flow.json`. |
| `select <target> <option>` | A choice in a native `<select>`. A custom dropdown is two clicks instead. |
| `key <key>` | A key press: `Enter`, `Escape`, `Tab`, `ArrowDown`. |
| `hover <target>` | A hover that reveals something (a menu, a tooltip). |
| `scroll <target>` | A scroll that brings the target into view. |
| `scroll <pixels> [--in <panel>]` | A scroll of the window, or of one panel, by a number of pixels. |
| `ring <target>` | A highlight on something to read: a total, a status, a warning. No click. |

A target outside the window is scrolled into view first, and that scroll is recorded as its own
action, so the video shows it. Add `--label "Save"` to any action to name it yourself, and
`--no-record` to do it without recording.

## Keeping private things out of the picture

Set these before the first recorded action. They apply to every picture taken afterwards.

```bash
node browser.mjs mask "maria@realcompany.com" "anna@example.com"   # replace a text everywhere
node browser.mjs mask "Real Company AB" "Northwind Logistics"
node browser.mjs blur ".avatar, img[alt*=profile]"                 # blur by CSS selector
node browser.mjs hide "#cookie-banner, .intercom-launcher"         # remove from the picture
```

A mask replaces the exact text wherever it appears, in page text and in filled-in fields. It
does not change what the app stores. Pictures inside images, charts and canvases are not text:
blur those. The address bar in the video shows the host and the path only, never the query.
Change or shorten it with `url.replace` in `video.json`.

## Other commands

| Command | Use |
|---|---|
| `goto <url>` | Go to a page. Not recorded. |
| `wait <ms or target>` | Wait for a time or until something is visible. |
| `shot [name]` | Save a picture to `look/` for you to read. Not recorded. |
| `brand` | The page's button colours, background, font and icon, as a start for `brand` in `video.json`. |
| `eval "<js>"` | Run JavaScript in the page, for example to close a tour. Not recorded. |
| `record on` or `record off` | Switch recording. Explore with it off. |
| `undo` | Remove the last recorded action. The page itself is not rolled back. |
| `reset` | Empty the capture. Masks, blurs and hides are kept. |

## Traps

- **Every action is real.** A recorded click on "Delete" deletes. Rehearse with recording off,
  restore the account, then capture.
- **Start state.** The first recorded action's "before" picture is the opening screen of the
  video. Make sure the account is in the state a viewer starts from: no leftover data from the
  rehearsal.
- **Toasts and spinners.** The browser waits until the page has stopped changing before each
  picture. A toast that is still up is in the picture, which is usually what you want. If a
  page keeps moving (a live chart, a ticking clock), `hide` or `blur` the moving part.
- **Hover states.** The pointer stays where the last click was, as in the video. If a tooltip
  from the last target covers the next one, do an unrecorded `hover` on empty space first.
- **Pages inside frames.** `look` lists the main page only. Content in an embedded frame (some
  payment and sign-in widgets) is not listed. Click it with `xy=`, or film that part as a
  screenshot action written by hand.
- **New tabs.** When a click opens a new tab, the browser follows it. When that tab closes, it
  returns to the one before.
- **A native dropdown** opens a system menu that no screenshot can capture. `select` records
  the choice, and the video shows the field before and after.
- **Long text.** Typing more than 48 characters is recorded in fewer pictures, so it still
  types smoothly.
- **Same viewport.** A capture continued later must use the same `--viewport`.
