import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const projectRoot = process.cwd()
const srcRoot = join(projectRoot, 'src')
const dtoRoot = join(srcRoot, 'dto')

const patterns = [
  {
    name: 'inline_ws_json_parse',
    regex: /JSON\.parse\(event\.data\)/g,
  },
  {
    name: 'response_cast',
    regex: /\bas\s+[A-Za-z0-9_]+Response\b/g,
  },
]

const walk = (dir) => {
  const output = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      output.push(...walk(fullPath))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    output.push(fullPath)
  }
  return output
}

const files = walk(srcRoot).filter((file) => !file.startsWith(`${dtoRoot}${sep}`) && file !== dtoRoot)

const violations = []
for (const file of files) {
  const content = readFileSync(file, 'utf8')
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0
    if (pattern.regex.test(content)) {
      violations.push({ file: relative(projectRoot, file), rule: pattern.name })
    }
  }
}

if (violations.length) {
  console.error('DTO boundary violations found:')
  for (const violation of violations) {
    console.error(`- [${violation.rule}] ${violation.file}`)
  }
  process.exit(1)
}

console.log('DTO boundary check passed')
