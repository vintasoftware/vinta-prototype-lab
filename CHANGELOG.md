# Changelog

All notable changes to this package are recorded here. Versions follow
[semver](https://semver.org/); each one is released from a `v`-prefixed tag such as `v0.1.0`.

## [Unreleased]

### Added

- **Guided tours**: `prototype-lab player` builds the prototypes' tours into one HTML file that opens
  offline with a double-click. A tour is a `tours/<id>.json` file of steps; each step opens a
  screen state, rings an anchor, and has a caption and an optional `fixes` line, and the cursor
  clicks the step's `click` anchor to move on. The home page lists the tours as cards in Vinta's
  look, with its words set in `prototypeLab({ player })`. While a tour plays, a panel beside the
  screen lists every step, with Play, Back, Next, speed and Tours home; `#/tour/<id>/<step>` opens
  one step. `#/check` checks every step and every click and lists the problems.
- **Tours button**: once `prototype-lab player` has written its file, the viewer's header links to
  it. `dev` serves the file beside the viewer and `build` copies it into the static copy. Set the
  folder with `player.outDir` (default `prototype-lab-player`).
- **build-guided-tour skill**: writes a project's tours from its prototypes, checks them and builds
  the file to send.
- A canvas (`v`) that shows every screen state as a frame you can pan and zoom, laid out in the
  flow's columns. Picking a frame opens that state, and double-clicking opens it on the stage.
- Sections on the canvas can be dragged, and Reset layout puts them back. The layout is saved to
  `canvas.json` in the prototype's folder.
- Live frames (`L`) that click through inside the canvas, full-page frames, and two viewports side
  by side.
- Ready for dev marks on screen states, saved to `canvas.json`, and PNG export of the picked frame.
- A Dev tab for the picked element: component, source line with Open in editor, styles read back
  to tokens, size, Measure (`m` or Alt and hover), accessibility, and a JSX snippet.
- Versions: `version-<id>` lines in `prototype.md` add a version picker. Screen states and comments
  take `since` and `until`, screens use `<Since>` and `useVersion()`, and `?v=` keeps the pick.
- Dependencies `dom-accessibility-api` (MIT) and `html-to-image` (MIT, loaded only for PNG export).

### Changed

- The flow map is the canvas's arrow layer (`a`), and `f` opens the canvas with the arrows on. The
  header's Flow button is now Canvas.
- Where each control leads is read one screen state at a time, so a large prototype no longer
  freezes the page.
- The header stays on one row on a 13-inch laptop.
- The side panels slide in and out, and the prototype picker opens scrolled to the open prototype.
- Turning Inspect on opens the Dev tab.

### Fixed

- The inspect outline under the pointer no longer disappears.
- A viewer linked to a local checkout no longer goes blank while the package rebuilds.

### Removed

- The `FlowMap` export. `CanvasView` replaces it.

## [0.3.2] - 2026-11-05

### Added

- A device toolbar beside the viewport switcher: device presets, width and height fields, rotate,
  and zoom. The browser remembers the choice.
- The frame resizes by dragging its edges or with the arrow keys, and a double click resets it.
- Present mode (`p`, the header button or `?present`) shows only the screen, at the size chosen in
  the viewer and scaled down to fit the window. `?present=fill` fills the window instead, for a
  phone or tablet. `Esc` exits.

### Fixed

- On a tablet, the page no longer scrolls behind the viewer.
- The landing page's folder tree and code blocks keep their colours in light mode.

## [0.3.1] - 2026-11-04

### Added

- The viewer header carries the Vinta wordmark before the title.
- A landing page at [vintasoftware.github.io/vinta-prototype-lab](https://vintasoftware.github.io/vinta-prototype-lab/),
  deployed from `docs/` by GitHub Pages.

### Fixed

- The header's Flow / Inspect / Hotspots / Comments row wraps in a narrow window instead of widening
  the page.

## [0.3.0] - 2026-10-02

### Added

- A `viewportSwitcher` option (and a `--no-viewport-switcher` flag) hides the Mobile / Tablet /
  Desktop switcher, for a project that targets one form factor. Every screen then draws in the
  `viewport` its file sets, desktop by default.

## [0.2.0] - 2026-10-01

### Changed

- A copy from `prototype-lab build` no longer looks for Storybook on `localhost`, so a deployed copy
  shows no "Nothing is serving Storybook" note and makes no request to the visitor's machine. It
  links to Storybook only when `storybook.url` names a deployed one. `prototype-lab dev` is
  unchanged.

## [0.1.2] - 2026-09-23

### Fixed

- A comment on a component with no name of its own saves when the name field is cleared, as the
  README says it should: it is pinned to the component by position and the screen file is left
  alone. It used to fail with "That request is not one this endpoint takes." and save nothing. A
  name of only spaces counts as cleared too, and the composer's heading shows what the comment will
  point at.
- Saving or deleting a comment changes only that note in `annotations.json`. Every other note is
  written back as the file had it, so one new comment no longer shows in review as a change to
  every note: notes that left `status` or `kind` out no longer gain them, and their fields keep
  their order.

## [0.1.1] - 2026-09-23

### Added

- Group folders under `prototypes/`: a prototype can sit in `prototypes/billing/refunds/`, and its
  slug and links take the whole path. The header's prototype picker is now a searchable list with
  a heading for each group.

### Fixed

- Saving a comment in the viewer no longer reloads the page, so the open comment, the picked
  component and the scroll position stay put. This holds for a prototype's first comment and for
  prototypes inside group folders. Editing an `annotations.json` by hand still reloads the page and
  shows the edit. A project config needs no `server.watch.ignored` entry for these files, and one
  copied from this repo's config should be removed: it keeps hand edits from showing until the dev
  server restarts.

## [0.1.0] - 2026-09-23

First release as a standalone package, moved out of Vinta's Building Blocks monorepo with its
history.

### Added

- `prototype-lab` CLI: `dev`, `build`, `preview`, and `install-skill`.
- `vinta-prototype-lab/vite`: the `prototypeLab()` Vite plugin, for a `prototype-lab.config.ts` or
  any Vite config. Options: `dir`, `css`, `storybook`, `title`, `root`, `react`, `tailwind`.
- `mountViewer()`, which starts the viewer over a set of prototype files.
- The `build-prototype` agent skill, installable with `prototype-lab install-skill` or
  `npx skills add vintasoftware/vinta-prototype-lab`.
- `vinta-prototype-lab/theme.css` and `vinta-prototype-lab/default.css`: the shadcn/ui theme, and the
  Tailwind stylesheet screens get when the project names none.

### Changed

- The viewer's chrome ships as compiled CSS and uses vendored shadcn/ui components, so it depends on
  no Vinta design-system package.
- Storybook linking is configurable: its URL, an optional marker section to recognise the project's
  Storybook by, or `false` to turn it off.
