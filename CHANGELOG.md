# Changelog

All notable changes to this package are recorded here. Versions follow
[semver](https://semver.org/); each one is released from a `v`-prefixed tag such as `v0.1.0`.

## [Unreleased]

### Added

- A device toolbar beside the Mobile / Tablet / Desktop switcher: a device list of twelve phones,
  tablets and desktops, plus Responsive and the viewport's default size; width and height fields;
  rotate; and zoom (Fit, 100%, 75%, 50%). The browser remembers the device and zoom under
  `vinta-prototype-lab:device` in `localStorage`. Picking a viewport in the switcher goes back to
  its default size. `viewportSwitcher: false` still hides only the switcher.
- The frame resizes by dragging its right edge, bottom edge or corner, snapping the width to 640,
  768, 1024 and 1280 px, or with the arrow keys on a focused handle. A double click goes back to the
  default size, and a caption above the frame gives its size, device and zoom. A turned device is
  named with its orientation, e.g. `iPad Air landscape`.
- Presenting (`p`, the header button, or `?present` in the address): only the screen, filling the
  window at its own size, with links between screens working and comments, hotspots and inspect off.
  `Esc` or the corner button goes back.

### Fixed

- Comment pins and inspect outlines stay on their elements when the frame is zoomed out.
- On a tablet the viewer fills only the visible part of the page and the page itself no longer
  scrolls, so browser bars and the on-screen keyboard no longer make the screen scroll twice, and Fit
  keeps its zoom while the keyboard is open.

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
