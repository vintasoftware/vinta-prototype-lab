/**
 * Whether the viewer runs under the dev server (`prototype-lab dev`) rather than from a built copy.
 *
 * Everything that needs a person's own machine hangs off this: writing comments back to the files,
 * naming elements in a screen, and reaching a Storybook on `localhost`. A built copy — handed to
 * someone or deployed — has none of that behind it, so it shows what the files hold and offers no
 * more. Vite replaces the flag when it builds, so the dev-only code drops out of the bundle.
 */
export function isDevServer(): boolean {
  return import.meta.env.DEV
}
