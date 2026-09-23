#!/usr/bin/env node
// Installs the packed package into a throwaway project, the way a user gets it from npm, and runs the
// CLI there: a static build of the fixture prototypes in test/consumer, and the skill install.
//
//   node scripts/smoke-test.mjs [path/to/vinta-prototype-lab-x.y.z.tgz]
//
// With no tarball it packs one. The project lives in the system temp folder and is removed afterwards.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const work = mkdtempSync(path.join(os.tmpdir(), 'prototype-lab-smoke-'))

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(' ')}`)
  return execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })
}

function check(condition, message) {
  if (!condition) {
    throw new Error(`smoke test: ${message}`)
  }
  console.log(`ok - ${message}`)
}

try {
  let tarball = process.argv[2] === undefined ? undefined : path.resolve(process.argv[2])
  if (tarball === undefined) {
    run('pnpm', ['pack', '--pack-destination', work], repo)
    const packed = readdirSync(work).find(file => file.endsWith('.tgz'))
    check(packed !== undefined, 'pnpm pack wrote a tarball')
    tarball = path.join(work, packed)
  }

  const project = path.join(work, 'project')
  cpSync(path.join(repo, 'test/consumer'), project, { recursive: true })
  writeFileSync(
    path.join(project, 'package.json'),
    `${JSON.stringify({ name: 'consumer', private: true, type: 'module' })}\n`
  )

  run('npm', ['install', '--no-audit', '--no-fund', 'react@19', 'react-dom@19', tarball], project)

  const version = run('npx', ['--no-install', 'prototype-lab', '--version'], project).trim()
  const expected = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')).version
  check(version === expected, `the CLI reports version ${expected}`)

  run('npx', ['--no-install', 'prototype-lab', 'build', '--no-storybook'], project)
  const html = readFileSync(path.join(project, 'prototype-lab-dist/index.html'), 'utf8')
  const assets = readdirSync(path.join(project, 'prototype-lab-dist/assets'))
  check(html.includes('<div id="root"></div>'), 'build wrote the viewer page')
  check(
    assets.some(file => file.endsWith('.js')) && assets.some(file => file.endsWith('.css')),
    'build wrote the script and stylesheet'
  )

  const bundle = assets
    .filter(file => file.endsWith('.js'))
    .map(file => readFileSync(path.join(project, 'prototype-lab-dist/assets', file), 'utf8'))
  check(
    bundle.some(code => code.includes('The one action on the screen')),
    "the fixture's notes are in the bundle"
  )

  run('npx', ['--no-install', 'prototype-lab', 'install-skill'], project)
  check(existsSync(path.join(project, '.claude/skills/build-prototype/SKILL.md')), 'install-skill copied the skill')
} finally {
  rmSync(work, { recursive: true, force: true })
}
