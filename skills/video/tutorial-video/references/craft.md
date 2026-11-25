# What makes a tutorial video good

These come from feedback on real tutorial videos. Check the sheets from `render.mjs check`
against them before every render.

## The story

- **Follow the viewer from their real starting point to the last thing they do.** Include the
  prerequisite they would otherwise be sent back for, and the page of the other provider they
  land on at the end. If two routes lead to the goal, show the shortest and say in a note that
  the other exists, when its button is visible in the frame.
- **One video, one task.** "Invite a colleague" is a video. "Manage your team" is five.
- **More steps is not longer.** Tighten the pace before cutting a step the viewer needs.
- **Start the account empty.** A demo account that already has the thing the video creates
  hides the very step the viewer is stuck on.

## The words

- Step titles are actions in a few words: "Add invoice details", "Choose the seats".
- A note says one thing the screen does not: a condition ("Required before a payment."), a
  consequence ("Unticked seats are deleted after the payment.") or what to check ("Check the
  amount charged today.").
- Chips repeat the labels on the buttons exactly as the product writes them.
- Sentence case. No exclamation marks. No claims the product does not make.
- Write in the language of the viewer. The screens stay in the language the app was in when
  captured, so switch the app's language before capturing if they should match.

## The picture

- **Every press lands on its target.** In the check sheet the pointer's tip sits inside the
  button at each "(press)" frame, and the button shows its hover state.
- **A ring belongs to the thing about to be pressed, or to a figure to read.** A ring that
  sits on a neighbour while the pointer goes elsewhere is the mistake people notice first.
- **The pointer does not cover what matters.** While text is typed it waits below the field.
  If it rests on a number the viewer should read, add a `ring` action on that number: the
  pointer steps aside for it.
- **Text on the screen is readable** at the moment it matters. If a press frame shows tiny
  text, raise `zoom` for that action.
- **No half-loaded frames.** A "(after)" frame with a spinner or a skeleton means the capture
  was taken too early. Capture that action again after `wait`.
- **Every frame can be posted.** Look at the page-change and step-change frames too, not only
  the settled ones.
- **Nothing private.** Names, e-mail addresses, amounts, avatars, the address bar, the
  account menu in the corner.

## The sound

- One soft click per press, silence otherwise. No music, bells or whooshes in a tutorial.
- You cannot hear the result. Say so, and ask the person to listen once.

## The truth

- Show the product as it is today. If the video shows something that is not released yet, say
  so in the hand-over and do not call it available.
- Do not show a result you did not reach. If the flow could not be run to the end (a real
  payment, a real e-mail), end the video where the capture ends and tell the person.
- Demo data is fine: a made-up company, a test card from the payment provider's own
  documentation. Invented numbers presented as results are not.
