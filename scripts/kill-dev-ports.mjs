import { execSync } from 'node:child_process'

const ports = [5173, 3001]

if (process.platform === 'win32') {
  for (const port of ports) {
    try {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore' },
      )
    } catch {
      // Port was not in use.
    }
  }
} else {
  for (const port of ports) {
    try {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' })
    } catch {
      // Port was not in use.
    }
  }
}

console.log('Cleared dev ports 5173 and 3001 (if they were in use).')
