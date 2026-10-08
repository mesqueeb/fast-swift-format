import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const file = join(homedir(), '.vscode/extensions/swiftlang.swift-vscode-2.16.7/dist/src/extension.js')
const backup = `${file}.swift-startup-original`
const source = readFileSync(file, 'utf8')
const marker = 'async function rFt(t,e,r){try{let i=await Vn.create(t,r);'
if (source.includes('function installSwiftStartupProbe(')) {
  console.log('Startup probe already installed.')
  process.exit(0)
}
if (!source.includes(marker)) throw new Error('Installed Swift extension does not match the inspected 2.16.7 bundle; leaving it unchanged.')
if (existsSync(backup)) throw new Error('An earlier backup already exists; leaving it unchanged.')
const probe = `
function installSwiftStartupProbe(logger) {
  if (Vn.__swiftStartupProbe) return;
  Vn.__swiftStartupProbe = true;
  const fs = require('node:fs');
  const tracePath = require('node:path').join(require('node:os').tmpdir(), 'SwiftStartupProbe.jsonl');
  let sequence = 0;
  let active = 0;
  function record(event) {
    const row = {time: new Date().toISOString(), pid: process.pid, ...event};
    try { fs.appendFileSync(tracePath, JSON.stringify(row) + '\\n'); } catch {}
    logger.info('[SwiftStartupProbe] ' + JSON.stringify(row));
  }
  const originalExec = ar;
  ar = async function(command, args, ...rest) {
    if (!active || !['which', 'xcode-select', 'xcrun', 'swift', 'swift.exe'].includes(require('node:path').basename(command))) {
      return originalExec(command, args, ...rest);
    }
    const id = ++sequence;
    const start = performance.now();
    record({event: 'command-start', id, command, args});
    try { return await originalExec(command, args, ...rest); }
    finally { record({event: 'command-end', id, command, elapsedMs: performance.now() - start}); }
  };
  for (const name of ['create', 'findSwiftBinaryInPath', 'getToolchainPath', 'isXcrunShim', 'getSwiftTargetInfo', 'getRuntimePath', 'getDefaultSDK', 'getSDKPath', 'getXCTestPath', 'getSwiftTestingPath', 'getSwiftPMTestingHelperPath']) {
    const original = Vn[name];
    if (typeof original !== 'function') continue;
    Vn[name] = async function(...args) {
      const id = ++sequence;
      const start = performance.now();
      let lag = 0;
      let expected = start + 50;
      let timer;
      if (name === 'create') {
        active++;
        timer = setInterval(() => {
          const now = performance.now();
          lag = Math.max(lag, now - expected);
          expected = now + 50;
        }, 50);
        timer.unref();
      }
      record({event: 'stage-start', id, stage: name});
      try { return await original.apply(this, args); }
      finally {
        if (timer) { clearInterval(timer); active--; }
        record({event: 'stage-end', id, stage: name, elapsedMs: performance.now() - start, ...(timer ? {maxEventLoopLagMs: lag} : {})});
      }
    };
  }
  record({event: 'installed', tracePath});
}
`
copyFileSync(file, backup)
writeFileSync(file, probe + source.replace(marker, 'async function rFt(t,e,r){installSwiftStartupProbe(r);try{let i=await Vn.create(t,r);'))
console.log(`Installed per-operation timing probe. Original preserved at ${backup}`)
