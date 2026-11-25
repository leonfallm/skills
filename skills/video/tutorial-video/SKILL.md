---
name: tutorial-video
description: >-
  Make a polished step-by-step tutorial video (MP4) of a real web app, including pages behind a
  login. You drive a signed-in Chrome one click at a time, the skill records every screen, hover
  state and click target, and then renders the flow with a step rail, a zooming browser window,
  an animated pointer that lands on each target, highlight rings and one soft click sound per
  click. Use whenever someone asks for a tutorial, how-to, walkthrough, onboarding or "show how
  to do X in <app>" video, a short product demo of a web flow, or wants screenshots of a flow
  turned into a video, even when they do not say "tutorial". Brand-neutral by default: colours,
  font and logo come from one JSON file.
---

# tutorial-video

You make the whole video yourself: you click through the real flow in a browser, write the
words, and render. The result is a 20 to 45 second MP4, 1920×1080, that shows real screens.
Nothing on screen is drawn by hand, so every label, colour and number is the product's own.

```
<skill>/scripts/doctor.mjs     check or install what is needed (Node, Playwright, a browser, ffmpeg)
<skill>/scripts/browser.mjs    the capture browser: open, look, click, type, scroll, ring, mask ...
<skill>/scripts/render.mjs     init, timeline, check, still, render
<skill>/references/            capture.md, storyboard.md, craft.md (read when you reach that stage)
<skill>/examples/demo/         a made-up web app and a storyboard to try the whole chain on
```

One video lives in one folder, the **video folder** (for example `tutorials/invite-a-colleague/`).
It holds `flow.json` and `shots/` (the capture), `video.json` (the storyboard you write) and
`out/` (the result).

## Before you start

1. Run `node <skill>/scripts/doctor.mjs`. If a line says MISS, run it again with `--install`
   (it installs Playwright into `~/.tutorial-video` and, when the machine has no Chrome or Edge,
   downloads Chromium). ffmpeg is installed with the system's package manager.
2. Settle four things with the person, and ask only for what you cannot work out yourself:
   - **The whole chain.** Where does the viewer really start, and what is the last thing they
     do? Include prerequisites (a setting that must be filled in first) and the pages of other
     providers (a payment page, a consent screen). A tutorial that starts halfway sends people
     back.
   - **An account that is safe to film.** A demo organisation is best. In a real account, decide
     what must be masked (names, e-mail addresses, amounts) before the first picture is taken.
   - **Which actions are real.** Everything you click really happens. Agree where to stop
     before anything that sends, pays, deletes or invites.
   - **Language and brand:** the language of the words on the rail, and the product's accent
     colour and logo if the video should carry them.

## The workflow

1. **Open the browser and let the person sign in.**
   `node <skill>/scripts/browser.mjs open --dir <video-folder> --url <start url>`
   A browser window opens with its own profile. The person signs in there themselves,
   including any two-step code. Never ask for a password and never type one, unless it is a demo
   account they hand you. The profile keeps the sign-in for next time.
2. **Explore first, without recording.** `record off`, then `look`, click around, find the
   flow and its traps (confirm dialogs, fields that validate, pages that load slowly). Put the
   account back in its starting state, then `reset` and `record on`.
3. **Mask, then capture the flow in order.** `mask`, `blur` and `hide` apply to every picture
   taken after them, so set them first. Then one command per thing the viewer does: `click`,
   `type`, `select`, `key`, `hover`, `scroll`, and `ring` for a figure the viewer should read.
   Commands and traps: `references/capture.md`.
4. **Write the storyboard.** `node <skill>/scripts/render.mjs <video-folder> init` writes a
   starter `video.json`. Split the actions into three to six steps and write the title, the
   step names, the chips and the notes. Fields and timing: `references/storyboard.md`.
5. **Check before you render.** `render.mjs <video-folder> check` renders a still at every
   press, page change and step change and tiles them into `check/sheet-*.jpg`. Look at every
   sheet. Fix what is wrong (rules in `references/craft.md`) and check again.
6. **Render.** `render.mjs <video-folder> render` writes `out/<name>.mp4` and a poster image.
   It takes well under a minute.
7. **Hand over.** Say where the file is, what the video shows from start to end, what was
   masked or is illustrative, and anything you could not verify. You cannot hear: ask the
   person to listen once with the sound on.

## Rules that hold every time

- **Real screens only.** Do not draw or edit a screen. If a page cannot be captured (another
  provider's page that needs a real payment, say), tell the person and offer two choices: a
  screenshot they take themselves, added as a hand-written action, or leaving it out. If you
  must draw one, say so in the hand-over and name what is unverified.
- **Nothing private in the frame.** Look at the check sheets for names, e-mail addresses,
  amounts, avatars and the address bar. Mask and capture again if anything slipped through.
- **Do not cross the agreed line.** Stop before an action that sends, pays, deletes or
  invites unless the person said to go through with it in this account.
- **Every press lands on its target**, and every ring sits on the thing about to be pressed
  or on a figure to read, never on a neighbour. The check sheets show each press.
- **Text is readable.** The player holds each step long enough to read (0.3 s a word). Keep
  step titles to a few words and notes to one sentence, or the video grows long.
- **Clicks only.** A tutorial has one soft click per click and silence otherwise. No music.
- **Say what you did not verify.** A flow you could not run to the end, a page you did not
  see: name it. Do not describe a step you have not watched happen.

## When something is in the way

- `No browser is open`: the browser was closed. Open it again; the sign-in is kept.
- A number from `look` "is not on the page any more": the page re-rendered. Run `look`
  again, or use a selector such as `text=Save` or `role=button[name="Save"]`.
- The sign-in page refuses an automated browser (some identity providers do): ask the person
  to sign in with a different method in that window, or to film a demo account with a
  password. Do not try to get around the provider's check.
- A pop-up, cookie banner or chat bubble is in every picture: `hide <css selector>`.
- Only screenshots exist, no access to the app: write the actions by hand in `video.json`
  (see "Actions written by hand" in `references/storyboard.md`).
