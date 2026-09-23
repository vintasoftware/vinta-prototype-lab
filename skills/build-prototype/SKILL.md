---
name: build-prototype
description: Build or extend a clickable design prototype for vinta-prototype-lab — a folder under `prototypes/` holding `prototype.md`, React screens under `screens/`, and `annotations.json` comments pinned to elements by semantic id. Use when a designer says "make a prototype", "mock up this flow", "show how these screens link", "add a state to that screen", or "pin a comment on that button". NOT for Storybook stories and not for shipping product screens.
disable-model-invocation: true
---

# Build a clickable prototype

A prototype in `prototypes/<slug>/` is three things that must agree with each other: screens a person
clicks through, a document that says what the flow is for, and comments pinned to the elements the
engineer has to get right. A prototype missing any one of them is the thing this tool exists to
replace.

The [vinta-prototype-lab README](https://github.com/vintasoftware/vinta-prototype-lab#readme) is the
reference for every field; this skill is the order to do the work in.

## 0. Find the setup

Before the first file, read what the project already has:

- **Is the package installed?** Look for `vinta-prototype-lab` in `package.json`. If it is missing,
  say so and suggest `npm install --save-dev vinta-prototype-lab` (or the project's package manager);
  do not install it without asking.
- **Where do prototypes live?** `prototypes/` at the project root unless a `prototype-lab.config.ts`
  (or `.mts` / `.js` / `.mjs`) passes another `dir` to `prototypeLab()`. The folder is always named
  `prototypes`.
- **Which components and stylesheet do screens use?** The config's `css` option names the project's
  stylesheet. Find the project's component library (a shadcn/ui folder, a `ui` package, a design
  system package) and its design guidance (`DESIGN.md`, a tokens file). With no `css` set, screens
  get Tailwind and the package's shadcn/ui theme.

Run the viewer while you work: `npx prototype-lab dev` (http://localhost:6007).

## 1. Ask before building

The designer knows the flow; you do not. Ask, in one message, only what you cannot infer:

1. **Which flow, start to finish?** Name the entry point and the last screen.
2. **Which screens, and which states of each?** "Choose time" and "Choose time with nothing
   available" are one screen with two states, not two screens.
3. **What is undecided?** Open questions belong in the doc, not in your invention.
4. **Which rules do the screens not show?** Timezones, what a second booking does, what a link
   re-enters. These are the notes an engineer would otherwise have to guess.
5. **Real feature components, or the design system only?** Default to the design system.

If the designer hands you a Figma frame or a screenshot, read it and confirm your reading of the
flow rather than asking them to retype it.

## 2. Make the folder

```
prototypes/<slug>/
  prototype.md
  annotations.json
  screens/
```

`<slug>` is kebab-case and names the flow, not the app: `patient-booking`, `provider-intake-review`.

## 3. Write `prototype.md` first

Front matter (`title`, `summary`, `entry`, `status`, `owner`, `updated`), then the body. Write the
body for the engineer who will build it:

- **The flow** — numbered, one line per step, naming the screen ids.
- **Rules the screens do not show** — the sentences that stop an engineer guessing.
- **Open questions** — with the option the prototype currently shows.
- **Out of scope** — what this flow deliberately does not cover.

Writing it first is what stops the screens from drifting into a shape nobody asked for.

## 4. Build the screens

One file per screen under `screens/`, default-exporting the component. The filename is the id:
`20-choose-time.no-slots.tsx` is screen `choose-time`, state `no-slots`, sorted at 20. Number files
in tens so a screen can be inserted later.

```tsx
import { anchor, ScreenLink, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Button, Card, CardContent } from '@/components/ui' // the project's own components

export const screen: Partial<ScreenMeta> = { title: 'Choose time', viewport: 'mobile' }

export default function ChooseTimeScreen() { … }
```

Rules that keep a prototype useful:

- **Build from the project's design system.** A prototype's job is to be wrong where the design is
  wrong. Ad-hoc `<div className='rounded border p-4'>` hides exactly the questions a review should
  surface.
- **Follow the project's design guidance.** Use its semantic roles (`bg-card`,
  `text-muted-foreground`) and invent no tokens. If the project locks its palette, an off-palette
  utility renders as nothing.
- **Synthetic data only**, inline in the file. No real personal or health data, no network, no API
  clients, no auth.
- **One state per file.** Reach for a variant file rather than a `useState` toggle inside a screen —
  the viewer's state switcher is how a reviewer finds states, and a hidden toggle is invisible.

## 5. Link the screens

- `useScreenNavigation()` gives `goToScreen(id, { variant })` and `back()`. This is the one to use
  for a `Button`, an input or a link — anything already interactive.
- `<ScreenLink to='review'>` wraps text or a static row. It renders a button of its own, so putting a
  `Button` inside it nests two buttons and React warns.
- `<Hotspot>` covers something that is not a control — a chart, a static row, a placeholder for a
  component nobody has built. Wrap that thing in a `relative` element and put the hotspot inside it
  with no geometry: it fills the wrapper, so it stays on its target at every viewport. Reach for the
  `area` prop only over something that scales as one piece, such as a mock image.
- **Navigate from a button, a link or a hotspot, never from a `div` with an `onClick`.** The flow
  map finds links by clicking what a person can reach; a clickable `div` shows no arrow, and it is
  not reachable from the keyboard either.
- **Navigate during the click.** A `goToScreen()` inside a timer or after an `await` is not seen by
  the map, so the control reads as leading nowhere.

Every screen must be reachable from the entry screen. Open **Flow** (`f`) in the viewer: every card
should carry an arrow in, none should say **Unreachable**, and there should be no red card — that is
a `goToScreen()` naming a screen that does not exist.

## 6. Pin the comments

The designer can write these in the viewer — pick a component, then **Comment on …** — and the
viewer writes both `annotations.json` and, when the element has no id yet, the `anchor()` in the
screen file. Write them here when you are building the prototype in one pass; either way the file
is the same.

Name the elements a comment is about, and only those:

```tsx
<Button {...anchor('book-follow-up')}>Book a visit</Button>
```

Then write the note in `annotations.json`, one per decision an engineer could get wrong:

```json
{ "id": "home-primary-action", "screen": "home", "target": "book-follow-up", "kind": "spec",
  "title": "One filled button per screen", "body": "Every other card action is `ghost`.", "author": "Ana" }
```

- `kind` is `spec` (a rule to implement), `flow` (why the next screen is what it is), `question`
  (undecided) or `todo` (known gap).
- **A note says something the screen cannot.** "This button is blue" is not a note. "Only one filled
  button per screen, so the next step is unambiguous" is.
- Ids in `target` are the contract with the engineer. Name the element for what it is
  (`book-follow-up`), never for where it sits (`third-card-button`).
- A note that applies on every screen it appears on leaves `screen` out.

## 7. Name what the engineer will ask about

The left rail reads the component tree out of the DOM, and inspect mode (`i`) lets a reviewer click
any part of the screen to find its row. Two things make that tree useful, and both are choices you
make while building:

- **Build from components that stamp `data-slot`.** Every shadcn/ui component does, and that is
  where the tree gets `Card`, `CardHeader`, `Button` — and what links each row to its Storybook page.
  A screen of bare divs shows landmarks, and landmarks link nowhere.
- **Put `anchor()` on the elements a reviewer will point at**, not only the ones a comment quotes
  today. The id shows in the tree beside the component, it is the name the engineer will use, and it
  anchors the links people paste into tickets: a link to a component is the path down from the
  nearest id above it, so an id nearby keeps that path short and immune to edits elsewhere on the
  screen. Every component can be linked to either way — ids decide how well those links age.

## 8. Verify before handing it over

Run the project's own type check and linter over the new files — the screens are ordinary TSX in the
project, so its `tsc` and lint setup cover them.

Then open the viewer and check, on each screen:

- **Problems tab is empty.** It lists missing default exports, notes pointing at screens that do not
  exist, and an `entry` that is not there.
- **No comment reads "Target missing"** — that means an `anchor()` was renamed or removed.
- **Every link goes somewhere**, and Back returns where it came from. The **Flow** map shows all of
  them at once: no **Unreachable** badge, no red card.
- **The browser console is clean.** A nested-button warning means a `Button` ended up inside a
  `ScreenLink`.
- **Each state renders**, including the empty and error ones.

Report the deep link to the entry screen (`#/p/<slug>/<entry>`) so the designer can open exactly what
you built.

## Common mistakes

| Mistake | What happens |
| --- | --- |
| Two screens for two states of one screen | The state switcher stays empty; reviewers never see them as alternatives. |
| `anchor()` id describing position | The first layout change makes the note nonsense. |
| Notes restating what the screen shows | The engineer stops reading the notes. |
| Handwritten `<div>` chrome instead of the design system | The review discusses the mock instead of the design. |
| A state hidden behind in-screen `useState` | Invisible in the sidebar, so it never gets reviewed. |
| A hotspot placed with `area` percentages of a flex container | It sits on its target at one width and drifts off it at every other. |
| Navigation on a `div onClick` | No arrow on the flow map, and no way to reach it from the keyboard. |
| `goToScreen()` after a timer or an `await` | The map reads the control as leading nowhere. |
| Prototypes folder not named `prototypes` | The viewer refuses to start; screen files are recognised by that folder name. |
| Prototype built as a Storybook story | No flow, no doc, no comments — the reason this tool exists. |
