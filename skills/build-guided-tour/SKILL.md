---
name: build-guided-tour
description: Turn a project's vinta-prototype-lab prototypes into guided tours and build them into one offline HTML file to send a client: tours/*.json files of steps with captions, checked with #/check, built with `prototype-lab player`. Use when someone says "make a guided demo", "play prototype", "send the client a file to see the prototype", "a tour of the flows", or "build the tours file". NOT for building the prototype screens themselves (use build-prototype).
disable-model-invocation: true
---

# Build guided tours and the file to send

A guided tour plays a fixed path through a project's prototype screens for someone who will not
click around: usually the client's product owner, reviewing on their own. A cursor moves to the
element that matters and clicks it, the element gets a ring, and a panel beside the screen says
what the screen is for and what it fixes. `prototype-lab player` builds every tour into one HTML
file that opens with a double-click, offline, with no install.

The [vinta-prototype-lab README](https://github.com/vintasoftware/vinta-prototype-lab#guided-tours-the-player)
is the reference for the tour fields and the player; this skill is the order to do the work in.

## 0. Find the setup

- **Is the package installed, and does it have the player?** Look for `vinta-prototype-lab` in
  `package.json` and run `npx prototype-lab --help`: it must list `player`. If it does not, the
  project is on an older version; say so and suggest upgrading. Do not upgrade without asking.
- **Where do prototypes live?** `prototypes/` unless `prototype-lab.config.ts` passes another `dir`.
  Tours go in a `tours/` folder inside a prototype folder, beside `screens/`, or in
  `prototypes/tours/` for a tour across prototypes.
- **Read every prototype's `prototype.md`.** The flow section, the rules and the decisions are what
  the captions are written from. Read the project's discovery notes too (journey maps, story maps,
  the client's pain points), so the `fixes` lines use the client's own words.
- **Can the project build here?** If the repo sits on another machine (for example, a Mac folder
  reached from a Linux workspace), `node_modules` may hold native binaries for the other platform,
  and Vite will not start. Copy the repo instead (`GIT_OPTIONAL_LOCKS=0 git archive HEAD`, plus any
  uncommitted files you need), install with `pnpm install --frozen-lockfile --ignore-scripts`, work
  there, and copy the changed files back. Run git commands on the original with
  `GIT_OPTIONAL_LOCKS=0`, so a status check never leaves an `index.lock` behind.

## 1. Ask before writing

Ask, in one message, only what you cannot infer:

1. **Who opens the file, and how?** A client who double-clicks a file needs nothing more. If they
   would rather open a link, the same file can be hosted behind access control instead.
2. **Which tours?** Suggest a set from the prototypes: one end-to-end tour ("the whole practice in
   five minutes", 15 to 20 steps) and one per role or flow (8 to 15 steps each). Let them cut.
3. **What goes on the home page?** The client's name, the headline (default "The prototype, one flow
   at a time."), and the file name, such as `acme-tours.html`.
4. **Anything to leave out?** Later releases, screens still in debate, states that only exist for
   the review.

## 2. Map the screens and anchors

Steps point at screens, states and `anchor()` ids, so collect them before writing a step:

- Screen ids and states come from the file names under `screens/` (`30-review.empty.tsx` is screen
  `review`, state `empty`).
- Anchors: `grep -rhoE "anchor\('[^']+'\)" prototypes` lists them, but many sit inside shared
  components. The surest list comes from the rendered screens: run `npx prototype-lab dev`, open
  each state, and read the `data-proto-id` values in the page (a short Playwright script that visits
  every `#/p/<slug>/<screen>/<state>` and dumps the ids with their text works well for big
  projects).
- Note which controls navigate. A step's `click` must open the next step's screen through
  `goToScreen` or a `#/p/…` link; a click that only changes the screen's own state (opening a menu,
  accepting a suggestion) cannot be a `click`. When you are not sure, write the step without it and
  let the check tell you.

## 3. Write the tours

One JSON file per tour, named after its `id`. For each step:

- **`screen` and `variant`** name a state that exists. A tour only walks through screens and states
  the prototype already has; never add a state just for the demo.
- **`anchor`** rings the one element the caption is about. Prefer a specific element (a button, a
  banner, a card) over a whole page section. A tall element shows its top; an element inside a
  sheet or dialog is better ringed by the sheet itself.
- **`click`** names the control that leads to the next step's screen. Leave it out when nothing on
  the screen leads there; the player then just moves on.
- **`title`**: a few words, the point of the screen.
- **`caption`**: one or two sentences, plain language, for the client, not an engineer. Say what
  the screen is for and what changes from today. No jargon, no FHIR or code names, no em dashes.
  Use only the fixtures' invented names; never real patient data.
- **`fixes`**: optional, the pain the screen removes, in the client's words where you have them.
- Steps may cross prototypes (`"prototype": "billing/claims"`); the panel groups them by
  prototype, using its title with any leading "Name 2. " number dropped.

Order tours with `order`. Keep the end-to-end tour first.

## 4. Check every step

Build the file and open it with `#/check`:

```bash
npx prototype-lab player
open "prototype-lab-player/tours.html#/check"
```

The check renders every step, clicks each `click` for real, and lists each problem: a screen or
state that is gone, an anchor that is not drawn, a click that opens another screen than the next
step's, or a click that only changes its own screen. In a script, wait for
`<html data-tour-check="done">` and read `window.__TOUR_CHECK__`. Fix every problem before sending.
A click that only changes its own screen is fixed by removing the `click`, not by adding a state.

Then look at it the way the client will. Open a few steps of each tour (`#/tour/<id>/<step>`) at
1280 and 1440 pixels wide and check that the ring sits on the element, the cursor is on the control
it clicks, and nothing on screen contradicts the caption. Play one tour end to end.

## 5. Hand it over

- Send the file from `prototype-lab-player/`. It is a few MB; it works from email, a shared drive or
  a chat attachment. Tell the person to double-click it; no internet is needed.
- Say what is in it: the tours and their lengths, and anything left out on purpose.
- Ask the designer to read the captions before it goes out. They are the part most worth a second
  look.
- The source changes (tour files, config) stay uncommitted unless asked; say where they are.

## Common mistakes

- **A `click` on a control that only changes its own screen.** The check reports it; drop the click.
- **Captions written for the team.** "Opens the `ServiceRequest` sheet" means nothing to a surgeon.
  Write "The order goes to the facility with the authorization attached".
- **Steps that switch patients without saying so.** Fixtures often use one invented patient per
  flow. A caption can say "Later that day, another patient's visit…" when it matters.
- **Rings on whole pages.** A ring around everything points at nothing.
- **Promising what the screen does not show.** A caption describes the screen on stage. Anything
  the screen cannot show belongs in `prototype.md`, not in the tour.
- **Later-release items in a tour.** Leave them out; a tour shows the scope being agreed.
