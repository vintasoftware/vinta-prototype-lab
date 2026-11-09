# Changelog

All notable changes to this package are recorded here. Versions follow
[semver](https://semver.org/); each one is released from a `v`-prefixed tag such as `v0.1.0`.

## Unreleased

### Added

- **Versions**: a prototype declares its versions with `version-<id>` lines in `prototype.md`, and
  a picker after the prototype picker shows one at a time, or All. Screen states and comments take
  `since` and `until`; screens hide parts with `<Since>` and read the pick with `useVersion()`. The
  screen list, counters, canvas, arrows and comments follow the pick, which lives in `?v=`. All
  marks states and comments not in every version with a chip. A link outside the version shows a
  toast, and a deep link opens a placeholder. Unknown version ids are lines in Problems. Prototypes
  without versions are unchanged.
- **Canvas** (`v`): every screen state as a frame on one canvas you can pan and zoom, in a section
  per screen laid out in the flow's columns. Drag, Space and drag, or scroll to pan; Ctrl or Cmd and
  scroll, pinch, or `+` and `-` to zoom between 5% and 200%; `Shift+1` fits everything and
  `Shift+2` zooms to the picked frame. Tab and the arrow keys move between frames, and Enter or a
  double click opens one on the stage. Picking a frame opens that screen state, so the URL, the
  screen list and the panels follow the canvas. Comment pins sit on the frames and open their
  comment in the Comments panel.
- **Arranging the canvas**: drag a section by its name, or move it with the arrow keys, and
  **Reset layout** to go back to the flow's columns. The arrangement is saved to `canvas.json` in
  the prototype's folder through the dev server, and a section for a screen that is gone is a line
  in Problems. A built copy draws the saved arrangement read-only.
- **Live frames**: `L`, or a double click with **Live** on, makes one frame click through inside
  itself on its own history, with a **Back to** chip and `Esc` to stop.
- **Full-page frames**: a frame on the canvas shows its screen's whole page, its scrolling areas let
  out to fit what they hold, up to six device heights; a live frame is drawn at its device height
  again and scrolls.
- **Two viewports**: the canvas can draw every state in two sizes side by side; the choice is saved
  in `canvas.json`.
- **Dev tab**: the picked element's component, path, id, Storybook page and source line, with
  **Open in editor**; its colours, spacing, typography, radius and shadow read back to utility and
  token, flagging a value no token produces; its size in frame pixels; and **Measure** (Alt and
  hover, or `M` and the component tree) for the distances to another element. It works on the stage
  and in the picked frame of the canvas.
- **Accessibility, snippet**: the Dev tab gives the role and accessible name (via
  `dom-accessibility-api`), the text contrast against its background with pass or fail for AA, and
  whether the keyboard reaches the element; under the dev server it also shows the element's JSX as
  written, children collapsed, with a copy button.
- **Ready for dev**: mark a screen state ready from the canvas; the marks are saved in `canvas.json`.
- **PNG**: save the picked frame's screen as an image.
- New dependencies: `dom-accessibility-api` (MIT), and `html-to-image` (MIT), loaded only when a PNG
  is exported.
- The canvas draws only the frames in view, a couple at a time, and holds new ones back while a pan
  is moving; below 20% a frame is a card with its title. A generated 60-state fixture,
  `example/prototypes/canvas-sixty`, measures it (`node scripts/generate-canvas-fixture.mjs` writes it).
- Device presets, a resizable frame and a presenting mode on the stage (from the
  `feature/device-toolbar` branch this one builds on).

### Changed

- **The flow map is the canvas's arrow layer.** Arrows (`a` on the canvas) show where each control
  leads, as the flow map did; `f` opens the canvas with them on, fitted to the whole flow. The
  header's **Flow** button is now **Canvas**.
- Where the controls lead is read one screen state at a time, so a large prototype no longer holds
  the page while it is read, and the canvas says how far along it is.
- The header fits a 13-inch laptop: **Back** and **Restart** are icons with tooltips, the prototype
  picker is a little narrower, and the compact header starts below 1200px.
- The prototype picker opens on the prototype that is open now, highlighted, and scrolled to it once when it is out of view.
- The header shows Vinta's mark beside "Prototype Lab", on windows wide enough for the title.
- The side panels slide in and out over 200ms on the stage, and the prototype picker grows out of its
  button. Both are instant with reduced motion, and the panels stay instant on the canvas.
- Turning Inspect on opens the right panel on the Dev tab, unless a comment is being written, and
  turning it off closes the panel again if it is still on the Dev tab.

### Fixed

- The inspect outline of the element under the pointer stays on the stage. Drawing it changed the
  frame's DOM, which read the component tree again and cleared the hover that drew it.
- A viewer running against a linked checkout no longer goes blank when the package is rebuilt. A
  full build empties `dist/` and writes the stylesheet last, and the page reloaded in that gap, found
  no stylesheet and never started. The reload now waits until the output is complete, comes once
  per rebuild, and reaches the browser rather than only the server environment.

### Removed

- The `FlowMap` export. `CanvasView` takes its place.

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
