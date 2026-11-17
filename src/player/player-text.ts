/** The words on the tours home. Set them per client in `prototypeLab({ player: { … } })`. */
export interface PlayerText {
  /** Who the tours are for, shown top right. Leave it out to show nothing there. */
  client?: string
  /** The small line over the headline. */
  eyebrow?: string
  /** The headline, in the text colour. */
  headline?: string
  /** The end of the headline, in Vinta blue. */
  accent?: string
  /** The paragraph under the headline. */
  intro?: string
  /** The line in the footer. */
  footer?: string
}

export const DEFAULT_PLAYER_TEXT: Required<PlayerText> = {
  client: '',
  eyebrow: 'Guided prototype tours',
  headline: 'The prototype,',
  accent: 'one flow at a time.',
  intro:
    'Pick a tour and press Play. Each one walks through the screens step by step, with a short note on what the screen is for and what it changes from today. You can jump to any step from the list beside the screen.',
  footer: 'Prepared by Vinta. Every patient, name and number in these screens is invented.',
}

/** The defaults with what the project set on top. An empty string leaves that line out. */
export function playerText(text: PlayerText = {}): Required<PlayerText> {
  return {
    ...DEFAULT_PLAYER_TEXT,
    ...Object.fromEntries(Object.entries(text).filter(([, value]) => value !== undefined)),
  }
}
