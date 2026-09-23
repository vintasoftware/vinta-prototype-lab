import { Markdown } from '../lib/markdown'

const GETTING_STARTED = `
## No prototypes yet

Create a folder under the project's \`prototypes/\` directory and the viewer picks it up:

\`\`\`
prototypes/my-flow/
  prototype.md          the story, the flow, the open questions
  annotations.json      comments, each pointing at a semantic id
  screens/home.tsx      one file per screen; default-export the component
\`\`\`

Ask your coding agent for it with the \`build-prototype\` skill (\`npx prototype-lab install-skill\`
adds it to the project).
`

export function EmptyLab() {
  return (
    <div className='flex h-screen items-center justify-center bg-muted p-6'>
      <div className='max-w-lg rounded-lg border border-border bg-card p-6'>
        <Markdown source={GETTING_STARTED} />
      </div>
    </div>
  )
}
