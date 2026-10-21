// scripts/setup.mjs
// Cross-platform setup script for AI Activity Visualizer

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('======================================================');
console.log('   AI Activity Visualizer - Automated Setup');
console.log('======================================================');

// 1. Verify Node.js version >= 18
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  console.error(`[ERROR] Node.js version 18 or higher is required. Found: v${process.versions.node}`);
  process.exit(1);
}
console.log(`[OK] Node.js version: v${process.versions.node}`);

// 2. npm install
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
console.log('\n[1/4] Installing dependencies (npm install)...');
execSync(`${npmCmd} install`, { cwd: rootDir, stdio: 'inherit' });

// 3. Compile TypeScript
console.log('\n[2/4] Compiling TypeScript (npm run compile)...');
execSync(`${npmCmd} run compile`, { cwd: rootDir, stdio: 'inherit' });

// 4. Build extension and webview bundles
console.log('\n[3/4] Building extension and webview (npm run build)...');
execSync(`${npmCmd} run build`, { cwd: rootDir, stdio: 'inherit' });

// 5. Package VSIX extension
console.log('\n[4/4] Packaging VSIX extension (npm run package)...');
execSync(`${npmCmd} run package`, { cwd: rootDir, stdio: 'inherit' });

// 6. Check VS Code CLI
const vsixPath = path.join(rootDir, 'ai-activity-visualizer-1.0.0.vsix');
if (fs.existsSync(vsixPath)) {
  console.log(`\n[OK] Package created: ${vsixPath}`);
  try {
    const whichCmd = process.platform === 'win32' ? 'where code' : 'which code';
    execSync(whichCmd, { stdio: 'ignore' });
    console.log('[INFO] VS Code CLI (code) detected. Installing extension into VS Code...');
    execSync(`code --install-extension "${vsixPath}"`, { cwd: rootDir, stdio: 'inherit' });
    console.log('[OK] Extension successfully installed into Visual Studio Code.');
  } catch {
    console.log('[NOTE] VS Code CLI (code) not found on PATH.');
    console.log('To install the extension into VS Code manually:');
    console.log(`  code --install-extension ai-activity-visualizer-1.0.0.vsix`);
    console.log('  or in VS Code: Extensions > ... > Install from VSIX...');
  }
}

console.log('\n======================================================');
console.log('   Setup completed successfully!');
console.log('======================================================');
console.log('To start the live bridge server and open the dashboard:');
console.log('  Run: npm start');
console.log('  Or:  start.bat (Windows CMD)');
console.log('  Or:  ./start.ps1 (PowerShell)');
console.log('  Or:  ./start.sh (macOS / Linux)\n');
