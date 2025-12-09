import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ext = process.platform === 'win32' ? '.exe' : ''

// Get the target triple from rustc
const rustInfo = execSync('rustc -vV').toString()
const targetTripleMatch = /host: (\S+)/g.exec(rustInfo)
if (!targetTripleMatch) {
  console.error('Failed to determine platform target triple')
  process.exit(1)
}
const targetTriple = targetTripleMatch[1]

console.log(`Building sidecar for target: ${targetTriple}`)

// Ensure the binaries directory exists
const binariesDir = path.join(__dirname, '..', 'src-tauri', 'binaries')
if (!fs.existsSync(binariesDir)) {
  fs.mkdirSync(binariesDir, { recursive: true })
}

// Build the Bun binary
const outputPath = path.join(binariesDir, `werkday-server-${targetTriple}${ext}`)

console.log(`Compiling to: ${outputPath}`)

execSync(
  `bun build ./src-server/index.ts --compile --outfile "${outputPath}"`,
  { stdio: 'inherit' }
)

console.log('Sidecar build complete!')
