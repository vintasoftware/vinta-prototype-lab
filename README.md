# vinta-prototype-lab

[![npm](https://img.shields.io/npm/v/vinta-prototype-lab)](https://www.npmjs.com/package/vinta-prototype-lab)
[![CI](https://github.com/vintasoftware/vinta-prototype-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/vintasoftware/vinta-prototype-lab/actions/workflows/ci.yml)

**[vintasoftware.github.io/vinta-prototype-lab](https://vintasoftware.github.io/vinta-prototype-lab/)**

Clickable prototypes designers hand to engineers: real screens built from your project's own
components, the flow between them, the states each screen can be in, the document that explains the
intent, and the designer's comments pinned to the elements they are about.

Storybook shows a component. A prototype here shows a **decision**: what the user clicks, what they
see next, and what the engineer has to get right.

## Install

In a React 19 project:

```bash
npm install --save-dev vinta-prototype-lab
```

Then add a `prototypes/` folder (see [A prototype is a folder](#a-prototype-is-a-folder)) and run the
viewer:

```bash
npx prototype-lab dev   # http://localhost:6007
```

The viewer runs on Vite, which comes with the package; your project does not need to use Vite. The
page is served from memory, so an `index.html` the project already has is left alone.

## Commands

| Command                       | What it does                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `prototype-lab dev`           | Runs the viewer. Comments and element names are written back to the files.    |
| `prototype-lab build`         | Writes a static, read-only copy to `prototype-lab-dist/` to hand to someone.   |
| `prototype-lab preview`       | Serves that copy.                                                              |
| `prototype-lab install-skill` | Copies the [build-prototype](#the-build-prototype-agent-skill) skill in.       |

`dev`, `build` and `preview` take `--dir`, `--css` (repeat it for several files), `--storybook <url>`,
`--no-storybook`, `--no-viewport-switcher`, `--port`, `--host`, `--open` and `--out-dir`. `prototype-lab --help` lists them all.
Add `prototype-lab-dist/` to `.gitignore`.

The copy from `build` can be deployed to any static host as it is. It keeps what only makes sense
on your own machine out: it shows comments without offering to write them, offers no element names,
and links to Storybook only when the config names a deployed one (see
[Storybook links](#storybook-links)).

## Configuration

Flags cover a project whose screens work with the defaults. When they need more — the project's
stylesheet, its path aliases, a Vite plugin its components rely on — add a
`prototype-lab.config.ts`. It is a Vite config, and the CLI uses it in place of the flags:

```ts
// prototype-lab.config.ts
import path from 'node:path'
import { defineConfig } from 'vite'
import { prototypeLab } from 'vinta-prototype-lab/vite'

export default defineConfig({
  plugins: [
    prototypeLab({
      css: './src/styles.css',
      storybook: { url: 'http://localhost:6006', marker: 'Design System' },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
```

| Option      | Default          | Meaning                                                                                  |
| ----------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `dir`       | `prototypes`     | Where the prototype folders live, from the root. The folder must be named `prototypes`.   |
| `css`       | package default  | The project's stylesheets, loaded after the viewer's. See [Styles](#styles).              |
| `storybook` | `{}`             | `url` of the project's Storybook and an optional `marker` section; `false` turns links off. |
| `viewportSwitcher` | `true`    | Shows the Mobile / Tablet / Desktop switcher. `false` hides it for a single form factor, and every screen draws in its own `viewport`. |
| `title`     | `Prototype Lab`  | The page title.                                                                           |
| `root`      | current folder   | The project root the paths are relative to. Set it when the config sets Vite's `root`.   |
| `react`     | `true`           | Adds `@vitejs/plugin-react`. Pass `false` when the config already adds it.                |
| `tailwind`  | `true`           | Adds `@tailwindcss/vite`. Pass `false` when the config already adds it.                   |

The plugin works in any Vite config, not only this file — `prototype-lab.config.ts` exists so the
viewer stays out of the project's own app config.

## Styles

The viewer's chrome ships compiled, so it needs nothing from the project. Screens are styled by the
project:

- **With `css`**, the viewer loads those stylesheets after its own. A Tailwind v4 stylesheet finds
  the classes the screens use by scanning the project, the same as for the app. If it defines the
  shadcn/ui tokens (`--primary`, `--card`, `--radius`, …), the chrome takes them on too.
- **Without it**, screens get Tailwind with the package's shadcn/ui theme. The same theme is
  importable on its own: `@import 'tailwindcss'; @import 'vinta-prototype-lab/theme.css';`.

## A prototype is a folder

```
prototypes/patient-booking/
  prototype.md            the story: the flow, the rules, the open questions
  annotations.json        comments, each pinned to an element by its semantic id
  canvas.json             how the canvas is arranged (written by the viewer; optional)
  screens/
    10-home.tsx           one screen, one file, default-exported
    20-choose-time.tsx
    20-choose-time.no-slots.tsx    another state of the same screen
    30-review.tsx
    40-confirmed.tsx
```

Add the folder and the viewer picks it up — there is no registry to edit.

### Grouping prototypes in folders

Put prototypes in folders to group them. A folder with no `prototype.md`, `annotations.json` or
`screens/` of its own is a group, and groups can hold other groups:

```
prototypes/
  patient-booking/            a prototype, at #/p/patient-booking
  billing/                    a group
    invoice-list/             a prototype, at #/p/billing/invoice-list
    refunds/                  a group inside a group
      partial-refund/         a prototype, at #/p/billing/refunds/partial-refund
```

The prototype picker in the header shows each group under its own heading ("Billing / Refunds"),
and its search matches titles, summaries and folder names. A prototype's folder path is its slug,
so it appears in the prototype's links. Moving a prototype into a group changes its links, and
links already shared stop reaching it. Keep one prototype out of another prototype's folder: the
viewer lists both, and reports the inner one as a problem. A screen that imports by relative path
needs one more `../` for each group folder it moves into.
[example/prototypes/billing](example/prototypes/billing) shows a group with a group inside it.

Copy
[example/prototypes/patient-booking](example/prototypes/patient-booking) to start from a worked
example, or ask your coding agent with the [build-prototype](#the-build-prototype-agent-skill) skill.

## The build-prototype agent skill

[skills/build-prototype](skills/build-prototype/SKILL.md) walks a coding agent through building a
prototype in the right order: ask the designer what it cannot infer, write the doc first, build one
file per screen state, link them, pin the comments, check the arrows on the canvas. Install it either way:

```bash
npx prototype-lab install-skill                         # into .claude/skills
npx prototype-lab install-skill --target .agents/skills # for other agents
npx skills add vintasoftware/vinta-prototype-lab        # with the skills CLI
```

`install-skill` leaves a copy that is already there alone; `--force` replaces it, and `--global`
installs into `~/.claude/skills`. The skill runs only when a person asks for it
(`/build-prototype`); it is not picked up on its own.

## prototype.md

Front matter, then markdown. The viewer shows it in the Doc panel next to the screen.

| Field     | Meaning                                                       |
| --------- | ------------------------------------------------------------- |
| `title`   | Name in the prototype picker. Defaults to the folder name.    |
| `summary` | One line under the title.                                     |
| `entry`   | Screen id the prototype opens on. Defaults to the first one.  |
| `status`  | Free text, e.g. `In review`. Shown as a chip.                 |
| `owner`   | Who to ask. Shown as a chip.                                  |
| `updated` | Free text date. Shown as a chip.                              |
| `version-<id>` | One line per version, in order, e.g. `version-v1: 'V1: Send claims'`. See [Versions](#versions). |

Write the body for the engineer who will build it: the flow step by step, the rules the screens
cannot show (what happens on a second booking, which timezone the times are in), the open questions,
and what is out of scope.

## Screens

One file per screen, default-exporting a React component. The filename carries the rest:

| Filename                     | Screen id     | State      | Sorts at |
| ---------------------------- | ------------- | ---------- | -------- |
| `home.tsx`                   | `home`        | `default`  | last     |
| `10-home.tsx`                | `home`        | `default`  | 10       |
| `20-choose-time.no-slots.tsx`| `choose-time` | `no-slots` | 20       |

States of one screen are grouped under it in the sidebar, so a designer flips between "filled",
"empty" and "error" without leaving the screen. Override anything the filename cannot say:

```tsx
import type { ScreenMeta } from 'vinta-prototype-lab'

export const screen: Partial<ScreenMeta> = { title: 'Choose time', variantLabel: 'No availability', viewport: 'mobile' }
```

`viewport` is `mobile`, `tablet` or `desktop`; it sets the frame the screen opens in, and the viewer's
switcher or device toolbar overrides it while you look.

Build screens out of the project's own components — the prototype should be wrong in the ways the
design is wrong, not in the ways a mock is wrong. A screen may import a real feature module too;
import its stylesheet in the screen file when it has one. Screens are ordinary TSX in the project, so
its own type check and linter cover them.

## Linking screens

```tsx
import { anchor, Hotspot, ScreenLink, useScreenNavigation } from 'vinta-prototype-lab'

// A Button, an input, a link — give it the navigation directly.
const { goToScreen, back } = useScreenNavigation()
<Button onClick={() => goToScreen('choose-time', { variant: 'no-slots' })}>Next week</Button>

// Text or a static row — wrap it. ScreenLink is a button, so its children must not be one.
<ScreenLink to='home'>Back to home</ScreenLink>

// Or cover something that is not a control at all: wrap it, and the hotspot fills the wrapper.
<div className='relative'>
  <ChevronRight />
  <Hotspot to='choose-time' variant='no-slots' label='Next week' />
</div>
```

A hotspot is invisible until the viewer's **Hotspots** toggle reveals it, so a static mock reads as a
static mock and still clicks through.

**A hotspot covers its parent**, which is what keeps it on its target at every viewport — wrap the
thing you are making clickable in a `relative` element and put the hotspot inside it. The `area` prop
(`{ top, left, width, height }` as percentages) is for one case only: a region of something that
scales as a single piece, such as a mock image. Percentages of a flex container drift away from the
content as the frame grows.

## Versions

A prototype can show what ships when. Declare the versions in `prototype.md`, one line each, in
order:

```yaml
version-v1: 'V1: Send claims'
version-v2: 'V2: Resolve denials'
version-later: 'Later: Money in'
```

The header then shows a version picker after the prototype picker, with each version and **All**
(the default). The pick is in the URL (`#/p/billing/claims/work-queue?v=v1`) and stays as you change
screens. A prototype with no `version-` lines shows no picker and works as before.

Versions are cumulative: V2 shows V1 plus what V2 adds. Tag a screen state with the first version it
exists in, or the last:

```tsx
export const screen: Partial<ScreenMeta> = { title: 'Claim detail', variantLabel: 'Denied', since: 'v2' }
```

`until: 'v1'` is for a state replaced after V1. Hide parts of a screen the same way:

```tsx
import { Since, useVersion } from 'vinta-prototype-lab'

<Since version='v2'><MoneyFlowCard /></Since>
<Since until='v1'><RecordLetterButton /></Since>

const version = useVersion() // { id, label, isAll, atLeast(id), atMost(id), includes(since, until) }
const rows = allRows.filter(row => version.includes(row.since, row.until))
```

With a version picked, the screen list, its counters, the canvas, the arrows and the comments show
only that version. **All** renders like the last version and lists every state and comment, with a
chip ("V2", "Until V1") on those not in every version. A link to a state outside the version shows a
toast instead of opening, and a URL to one opens a placeholder with buttons to switch. Nothing about
the version is drawn on a screen or in a PNG export. A comment takes `since` and `until` in
`annotations.json` like a state, and an id no `version-` line declares is a line in Problems.

Outside the viewer (Storybook, a test), `useVersion()` acts as **All**.

## Comments pinned to the UI

**Write them in the viewer.** Pick a component — click its row, or turn on Inspect and click it on
the screen — then **Comment on …** in the Comments panel. Editing, resolving and deleting are on
each comment. Everything is written straight to `annotations.json`, in the same shape a person
hand-writes, so comments are reviewed in the pull request with the rest of the change.

**A comment can go on anything, named or not.** If the element carries no `anchor()` id, the
composer offers one — taken from what the element is and what it says — and saving writes
`{...anchor('view-medication')}` into the screen file for you. The comment then points at a name the
screen keeps, rather than at where the element happens to sit. Clear the name field to pin the
comment by position instead.

**Name this element** in the Components panel does the same on its own, for when you want the name
without a comment: to link to the element, or to give the engineer a handle before a review. The
picked component gets the id, the URL moves to it, and nothing is written to `annotations.json`.

This needs the dev server, so it works under `prototype-lab dev`. A copy from `prototype-lab build`
has no server behind it and shows comments without offering to change them. The dev server only
takes writes from the viewer it serves: a request must carry JSON and come from one of the server's
own addresses.

Two things worth knowing:

- **Naming an element edits its screen file**, which reloads the page. The URL carries the screen
  and the picked component, so you land back where you were. Saving a comment doesn't reload:
  the viewer already shows it. Editing `annotations.json` by hand does, and shows the edit.
- **Deleting a comment leaves the `anchor()` in place.** The element keeps its name; only the
  comment goes. Remove the `anchor()` by hand if you want the name gone too.

Hand-writing still works, and is still how you read what is there:

```tsx
<Button {...anchor('book-follow-up')}>Book a visit</Button>
```

```json
{
  "notes": [
    {
      "id": "home-primary-action",
      "screen": "home",
      "target": "book-follow-up",
      "kind": "spec",
      "title": "One filled button per screen",
      "body": "Every other card action is `ghost`, so the next step is unambiguous.",
      "author": "Ana"
    }
  ]
}
```

| Field    | Required | Meaning                                                                          |
| -------- | -------- | -------------------------------------------------------------------------------- |
| `id`     | yes      | Unique in the file. Referring to it in review beats "the pink one".               |
| `target` | yes      | The `anchor()` name. The viewer rings that element and pins a number to it.       |
| `screen` | no       | Screen id. Leave it out for a note that applies wherever the target is rendered.  |
| `kind`   | no       | `spec`, `flow`, `question` or `todo`. Defaults to `spec`; it sets the pin colour. |
| `title`  | yes      | The one line an engineer reads first.                                             |
| `body`   | no       | Markdown. The detail behind it.                                                   |
| `author` | no       | Who wrote it.                                                                     |
| `status` | no       | `open` or `resolved`. Defaults to `open`.                                         |

Ids are the contract. `anchor('book-follow-up')` survives the markup around it changing, which is
what keeps a comment attached to the thing it is about. A comment written in the viewer targets one
of these, because the viewer writes the id for you when the element has none. A note whose target is not on the screen
right now is listed as **Target missing** rather than dropped — that flag is how you find out a
screen moved out from under a comment.

`anchor()` spreads onto any component that forwards DOM props, which every shadcn/ui component
does. For plain text or a component that does not, wrap it: `<Anchor id='task-count'>…</Anchor>`.

## The component tree and inspect mode

The left rail lists the components of the screen on stage, read from the live DOM: every
shadcn/ui component stamps a `data-slot`, so the tree shows the names an engineer will type —
`Card > CardHeader > CardTitle` — with any semantic id beside it as `#book-follow-up`. Nothing has
to be declared for a screen to have a tree. Layout wrappers earn no row; their components move up to
the row above, so the tree stays about components rather than divs.

It works both ways:

- **Click a row** — the component is outlined on the screen and named under it.
- **Turn on Inspect (`i`) and click the screen** — the tree selects what you clicked, scrolling to
  it and opening anything collapsed above it. Clicking the label inside a button picks the button,
  which is the row you meant.

### Linking to one component

Pick a component and its link is in the URL. The copy icon sits in two places — beside the name on
the outline drawn around the component, and on its row in the tree — so you can grab the link from
wherever you are looking. That link is the unit of feedback on a ticket: it reopens the prototype on
the right screen with the right component picked, outlined on the screen and highlighted in the
tree, so "this button" means one button rather than a paragraph of directions.

**Every component can be linked to, whether or not the designer gave it an id.** A link names the
component the most durable way the screen allows:

```
?component=book-follow-up                       a component with a semantic id
?component=follow-up-card/CardContent/Button    the path down from the nearest id above it
?component=/Card~1/CardHeader/CardTitle         the path down from the screen, when no id is above
```

Reading the middle one: *the Button in the CardContent of the component named `follow-up-card`*. The
id pins the top of the path, so everything outside that card can change and the link still lands. A
step carries a number only when its siblings share its name — `Card~1` is the second `Card` — so
inserting a paragraph, a badge, a wrapper, or a whole card above changes nothing. Only inserting a
same-named sibling ahead of a step moves it.

The leading `/` on the third one means "start at the screen", and it is what keeps a name from being
read as an id: a screen may hold both a `<header>` element and a card the designer named `header`.

That is why **naming elements with `anchor()` still pays**: an id ends the path, and a path that
starts at an id is immune to everything outside it. Without one, the path runs to the screen root
and more of the screen can move it.

A link whose component the screen does not have is reported in the Components panel rather than
opening on nothing — the same way a comment whose target is gone reads as **Target missing**. That
is how you find out a screen moved out from under a ticket.

### Storybook links

With the project's Storybook running (the `storybook.url` option, `http://localhost:6006` by
default), each component row carries a book icon that opens the page documenting it. The viewer
reads Storybook's own index, so the links follow the stories as they change. A project without
Storybook sets `storybook: false` (or passes `--no-storybook`), and the rows carry no links.

**A built copy links only to a deployed Storybook.** The people opening it have no Storybook on
their `localhost`, so a copy from `prototype-lab build` looks for one only when `storybook.url` (or
`--storybook`) names an address everyone can reach, such as `https://storybook.example.com`. With the
default, or any `localhost` URL, the rows carry no links and the panel says nothing about it.

**Another project's Storybook may hold the port.** A stranger's index answers a fetch as happily as
yours, so set `storybook.marker` to a root section your Storybook always has — `Design System`, say.
The viewer then checks the index for it, and says so in the Components panel when it is missing.
Point the viewer elsewhere without editing anything:

```
http://localhost:6007/?storybook=http://localhost:6010
```

The URL is remembered for later visits. The panel also names where it looked when nothing answers
at all.

A component with no page of its own falls back to its family — `CardHeader` opens the `Card` story,
which is the page a person wants when they ask about one. Rows for plain elements (`header`, `h1`)
carry no link: a tag is not a component, and a story that happens to share the word is not about it.
The row's tooltip names the page it opens, so a fallback is never silent.

While inspecting, a click picks instead of navigating: inspecting the button that starts a flow must
not start the flow. Comment pins stay clickable. Turn Inspect off and the prototype clicks through
as before.

## The canvas

**Canvas** (`v`) replaces the stage with every screen state of the prototype as a frame on one large
canvas, the way a design tool lays out its frames. Pan and zoom around it to review a whole
prototype at once instead of flipping through the screen list one state at a time. Each frame is the
real screen at its real size, built from the project's own components; the canvas never edits one.

- **A section per screen.** The states of one screen sit side by side under the screen's name, in
  the order of the screen list. Sections are laid out in the flow's columns: the entry screen first,
  then what it leads to, and so on.
- **The frame's title** names the screen and state, with **Entry**, **Unreachable** and the open
  comment count beside it.
- **Comment pins.** With comments on (`c`), each frame carries its numbered pins, as on the stage.
  Click one to open the comment in the Comments panel.
- **One size for every frame.** The device toolbar sets the frame size; with "Screen default" each
  screen keeps its own viewport.
- **The whole page.** A frame is as wide as its device and as tall as its page, as a full-page
  screenshot is, so content below the fold shows without scrolling. A page that keeps growing stops
  at six device heights.
- **One link everywhere.** Picking a frame opens that screen state in the viewer, so the URL names
  it, and the screen list, the Doc and Comments panels and a copied link all follow the canvas.

It opens centred on the screen you came from, or fitted to everything when opened with `f`.

### Moving around

| Action | Pointer | Keyboard |
| --- | --- | --- |
| Pan | Drag on empty canvas, Space and drag anywhere, two-finger scroll | Arrow keys, with the canvas focused and no frame |
| Zoom | Ctrl or Cmd and the wheel, pinch | `+` and `-` |
| Fit everything | Toolbar button | `Shift+1` |
| Zoom to the picked frame | Toolbar button | `Shift+2` |
| Pick a frame | Click | Tab through the frames in reading order; arrow keys move to the nearest frame that way |
| Open it on the stage | Double-click (with **Live** off), or the toolbar's **Open** | `Enter` |
| Make it live | Double-click with **Live** on | `L` |
| Stop the live frame | Its X, or a press anywhere else | `Esc` |
| Back to the canvas | The **Canvas** button | `v` |

Zoom runs from 5% to 200%, holding still the point under the pointer, or the picked frame from the
keyboard. Below 20% a frame is a card with its title only.

### Live frames

Frames are inert: nothing in them clicks, so a click picks the frame. To try one, make it **live**:
focus it and press `L`, or turn **Live** on in the canvas toolbar and double-click it. A live frame
clicks through inside itself, on a history of its own, without moving the screen the viewer has
open. When it moves on, its title offers **Back to** the state it belongs to. `Esc`, the X on its
title, or a press anywhere else on the canvas makes it inert again, back on its own state.

One frame is live at a time. With **Live** off, a double click opens the frame on the stage instead.
A live frame goes back to its device height and scrolls its own screen with the wheel, as the
screen does on the stage; Ctrl or Cmd and the wheel still zoom the canvas.
Dialogs, popovers and menus a live screen opens are drawn over the canvas, at the size of the page
rather than of the frame.

### Two viewports

**Viewports** in the canvas toolbar draws every state in two sizes side by side, desktop and tablet
for example, so a layout that breaks at one size shows without switching. The arrows and the rows
belong to the first frame of each pair. "One size" goes back to a single frame per state, sized by
the device toolbar or the screen's own viewport. The choice is saved in `canvas.json` under the dev
server; a built copy keeps it for the page only.

### Ready for dev, and PNG

**Ready for dev** in the canvas toolbar marks the picked screen state as ready for an engineer to
build; its frame says so on its title. The marks are saved in `canvas.json` next to the layout
(`"ready": ["home/default"]`), so they are reviewed in the pull request too, and a mark for a state
that no longer exists is dropped with a line in Problems. A built copy shows the marks.

**PNG** saves the picked frame's screen as an image at twice its size, named after the prototype,
screen and state. It works in a built copy too.

### Arranging it

Under `prototype-lab dev` you can arrange the canvas your own way:

- **Drag a section by its name** to move it, frames and all. Or focus the name (Tab) and move it with
  the arrow keys: 40 px a press, 400 px with Shift.
- **Reset layout** in the canvas toolbar puts every section back in the flow's columns.

The arrangement is saved to `canvas.json` in the prototype's folder, beside `annotations.json`, and
is reviewed in the pull request with the rest of the change. It is a view: it never changes a
screen.

```json
{
  "version": 1,
  "sections": [
    { "screen": "choose-time", "x": 0, "y": 0 },
    { "screen": "review", "x": 2400, "y": 0 }
  ],
  "viewports": ["desktop"]
}
```

A section for a screen that no longer exists is dropped, with a line in Problems saying so, and the
next save writes the file without it. A new screen with no saved place is laid out by the canvas to
the right of the rest. Editing the file by hand reloads the page, the way editing a screen does;
saving from the canvas does not. A copy from `prototype-lab build` draws the saved arrangement and
offers no way to change it.

### The arrows

**Arrows** (`a`, on the canvas) draw where each control leads, from the control to the screen it
opens. `f` opens the canvas with them on, fitted to the whole flow, and closes it again. They are
found at run time, not declared. When the canvas opens, the viewer renders each screen out of sight
inside a runtime whose `goToScreen` and `back` record instead of navigating, clicks every control,
and notes what each click did. So a `Button` with its own `onClick`, a `ScreenLink` and a `Hotspot`
all show up the same way, and a link the code no longer makes disappears on the next open.

What the arrows show:

- **One arrow per destination.** Six slot buttons that all open the review screen are one arrow, and
  every control that leads there is outlined. The rows under the frame list them:
  `9:00 AM, 9:30 AM +4 → Review`.
- **Dashed arrows go back** to a frame further left, like a "Back to home" link from the last screen.
- **Controls that call `back()`** are listed on their frame as `Previous screen`, with no arrow,
  since where they lead depends on where the person came from.
- **Entry** marks the screen the prototype opens on; **Unreachable** marks a screen no control
  leads to, a state a reviewer would never find by clicking through.
- **A red card** in a section of its own stands in for a screen id that a control opens but no file
  defines. That is a typo in a `goToScreen()` call, and the canvas is where it shows.

Two things the arrows cannot see. A control that navigates later, from a timer or after an `await`,
is read as leading nowhere, because only what happens during the click counts. And a `div` with an
`onClick` is not clicked at all: the probe clicks what a person can reach (buttons, links, and
elements with an interactive role), so a clickable `div` shows no arrow, which is also the
accessibility bug it is.

### Large prototypes

Every frame is a real render of its screen, so the canvas draws only the frames in view, a couple at
a time, and holds new ones back while a pan is moving. A frame out of view, or below 20%, is a card
with its title. Animations and transitions inside a frame that is not live are switched off: the
frame is a picture, and a running animation keeps the browser recompositing the whole canvas. With 60 desktop states the canvas is usable in about half a second and pans at the
display's frame rate.

### Screens on the canvas: media queries follow the window

A frame changes a screen's width, but CSS media queries keep reading the browser window, on the
canvas and on the stage alike. Container queries read the frame. For anything in a screen that must
respond to the frame it is drawn in, prefer container queries (Tailwind's `@container` and `@md:`
variants) over `md:` and other media query variants.

## Dev tools

The **Dev** tab of the right panel says how the picked element is built, on the stage and on the
canvas. Turn on Inspect (`i`, the crosshair in the header, or the **Inspect** button in the Dev tab)
and click an element, or pick its row in the component tree. Turning Inspect on opens the right
panel on the Dev tab, unless a comment is being written; turning it off closes the panel again if
it is still on the Dev tab. On
the canvas, Inspect works in the picked frame: its screen takes the pointer while Inspect is on.

- **Element**: the component's name and path, as the tree shows them, its semantic id, its
  Storybook page, and where it was written, `screens/10-home.tsx:34`. **Open in editor** opens that
  line through the dev server's own open-in-editor support. An element written inside a component
  says so, with the line of the component in the screen.
- **Styles as tokens**: background, text and border colour, padding, margin and gap, font size,
  line height, weight and family, radius and shadow. Each is read back to the utility class that set
  it (`bg-muted`), the token behind it (`--color-muted`, or `--muted` for a theme declared with
  `@theme inline`), and the value the browser resolved. A spacing step reads `--spacing × 3`. A value
  no utility set is matched against the page's tokens, and every token of that value is named;
  a value no token produces is flagged **not a token**. A token is never guessed.
- **Size** in the frame's own pixels, whatever the zoom.
- **Snippet**: the element's JSX as written in the screen file, its tag and props with the children
  collapsed, read through the dev server, with a copy button. An element inside a component shows the
  component's JSX in the screen.
- **Accessibility**: the role and accessible name, computed the way assistive technology computes
  them (with `dom-accessibility-api`); the text's contrast against the background it sits on, with
  pass or fail for WCAG AA (4.5:1, or 3:1 for large text); and whether the keyboard reaches it, or
  why not: out of the Tab order, not focusable, inside an `inert` region, or hidden. Background images
  and gradients are not read, and a colour in a form the viewer cannot read makes the contrast
  "unknown" rather than a guess.
- **Measure**: hold Alt and point at another element to see the distances to it, as design tools
  draw them, in the frame's own pixels. With nothing picked, Alt shows an element's padding and
  margin. From the keyboard, turn Measure on (`M`) and move through the component tree: each row in
  focus is measured against the picked element. The tab lists the distances, and the picked element's
  padding and margin by side.

Under `prototype-lab build` the tab still reads components, tokens, sizes and accessibility; there
is no source to open and no snippet, since the dev server is what records where each element was
written.

## Using the viewer

- **Doc / Comments / Problems** panels on the right. Problems lists everything wrong with the
  folder — a missing default export, a note pointing at a screen that does not exist, an entry
  screen that is not there. The viewer never fails to start over a broken prototype.
- **Either side closes.** The icon beside the title closes the screens rail; the one at the far
  right closes the doc panel. With both shut, the screen or the canvas has the window to
  itself, which is what you want when presenting or reading a wide desktop screen.
- **Deep links.** The URL carries the screen: `#/p/patient-booking/choose-time/no-slots`, and the
  picked component with it. Paste it into a ticket. In-prototype **Back** is the flow's own back, so
  the URL is replaced rather than pushed.
- **Device toolbar.** Beside the viewport switcher: device presets, width and height, rotate, and
  zoom. The browser remembers the choice.
- **Resizing the frame.** Drag its edges, or use the arrow keys on a focused handle. A double click
  resets it. `@media` queries still follow the browser window, not the frame.
- **Presenting.** `p`, the header button, or `?present` in the URL shows only the screen, at the
  size chosen in the viewer, scaled down if the window is smaller. `?present=fill` fills the window
  instead: start the server with `--host` and open that on a phone or tablet. `Esc` exits.
- **Keys.** `c` toggles comments, `h` toggles hotspots, `i` toggles inspect mode, `v` toggles the
  canvas, `a` its arrows, `f` opens it with the arrows on, `m` turns measuring on, `[` and `]` close
  the panels either side, `p` starts presenting, `Esc` clears the open note and the picked
  component, or stops presenting. The canvas has its own keys, listed under
  [Moving around](#moving-around).

## What this is not

Prototypes are synthetic — no real personal or health data, no network, no API clients, no auth.
Nothing here ships to a product. When a prototype is agreed, the engineer builds the real screen in
the app; the prototype folder stays as the record of what was agreed.

## Developing this package

```bash
pnpm install
pnpm dev          # the viewer over example/prototypes, from source (http://localhost:6007)
pnpm test         # unit tests
pnpm validate     # Biome, TypeScript, tests, build, publint
node scripts/smoke-test.mjs   # installs the packed package into a throwaway project and runs the CLI
```

| Path                  | What lives there                                                              |
| --------------------- | ----------------------------------------------------------------------------- |
| `src/lib`             | Reading a folder: front matter, screen filenames, annotations, markdown. The flow graph and the probe that reads links out of a screen. |
| `src/components`      | What a prototype screen imports: `anchor`, `ScreenLink`, `Hotspot`, the frame; the thumbnail the map draws. |
| `src/hooks`           | Session state, inspect mode, the flow links, and the measuring the overlays need. |
| `src/viewer`          | The viewer's own chrome, the canvas included, and `mountViewer`.                |
| `src/ui`              | The shadcn/ui components the chrome is built from, vendored.                  |
| `src/dev`             | The dev-server plugins: stamping where each element was written, and writing comments and names back. |
| `src/node`            | The Vite plugin, the CLI, and the skill installer.                            |
| `skills/`             | The agent skills the package ships.                                           |
| `example/prototypes/` | The worked example `pnpm dev` shows.                                          |
| `test/consumer/`      | The fixture the smoke test builds from the packed package.                    |

### Releasing

Versions follow [semver](https://semver.org/), and a GitHub release publishes one to npm.

1. Bump `version` in `package.json` on `main` (e.g. `0.2.0`, or `0.2.0-rc.1` for a prerelease) and
   add its entry to [CHANGELOG.md](CHANGELOG.md).
2. Create a GitHub release whose tag is that version with a `v` prefix — `v0.2.0` — targeting `main`.
   Mark it **pre-release** for a prerelease version.
3. The [publish workflow](.github/workflows/publish.yml) runs CI again, checks that the tag is valid
   semver, matches `package.json`, and points at a commit on `main`, then publishes through npm
   trusted publishing (OIDC, no token) from the `npm` environment. A stable version goes out as
   `latest`; a prerelease under its id (`rc`, `beta`, …).

## License

[MIT](LICENSE)
