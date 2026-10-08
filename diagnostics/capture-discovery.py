#!/usr/bin/env python3
"""Capture Swift discovery subprocess timings and stacks for slow commands."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--uncached', action='store_true', help='Refresh xcrun lookup entries using its documented no-cache environment option.')
args = parser.parse_args()
artifact_dir = Path(tempfile.mkdtemp(prefix='SwiftDiscoveryCapture-'))
environment = dict(os.environ)
if args.uncached:
    environment['xcrun_nocache'] = '1'


def capture(name, command, *, stdin=None):
    started = time.monotonic()
    with (artifact_dir / f'{name}.stdout').open('wb') as stdout, (artifact_dir / f'{name}.stderr').open('wb') as stderr:
        process = subprocess.Popen(command, env=environment, stdin=subprocess.PIPE if stdin is not None else subprocess.DEVNULL, stdout=stdout, stderr=stderr)
        if stdin is not None:
            process.stdin.write(stdin.encode())
            process.stdin.close()
        samples = []
        sampled = set()
        while process.poll() is None:
            elapsed = time.monotonic() - started
            if elapsed > 30:
                process.kill()
                process.wait()
                break
            if elapsed > 0.5:
                rows = subprocess.check_output(['/bin/ps', '-axo', 'pid=,ppid=,comm='], text=True)
                processes = {}
                for line in rows.splitlines():
                    fields = line.strip().split(None, 2)
                    if len(fields) == 3:
                        processes[int(fields[0])] = (int(fields[1]), fields[2])
                descendants = {process.pid}
                while True:
                    expanded = descendants | {pid for pid, (parent, _) in processes.items() if parent in descendants}
                    if expanded == descendants:
                        break
                    descendants = expanded
                for pid in descendants - sampled:
                    sampled.add(pid)
                    destination = artifact_dir / f'{name}-{pid}.sample.txt'
                    log = (artifact_dir / f'{name}-{pid}.sample.log').open('wb')
                    sampler = subprocess.Popen(['/usr/bin/sample', str(pid), '1', '1', '-file', str(destination)], stdout=log, stderr=log)
                    samples.append((sampler, log))
            try:
                process.wait(timeout=0.05)
            except subprocess.TimeoutExpired:
                pass
        duration = (time.monotonic() - started) * 1000
        for sampler, log in samples:
            try:
                sampler.wait(timeout=5)
            except subprocess.TimeoutExpired:
                sampler.kill()
                sampler.wait()
            log.close()
    row = {'stage': name, 'command': command, 'elapsedMs': round(duration, 1), 'exitCode': process.returncode}
    with (artifact_dir / 'timings.jsonl').open('a') as stream:
        stream.write(json.dumps(row) + '\n')
    print(f'{name}: {duration:.1f} ms, exit {process.returncode}', flush=True)
    if process.returncode != 0:
        raise SystemExit(f'Command failed; see {artifact_dir}')
    return (artifact_dir / f'{name}.stdout').read_text().strip()


print(f'Artifacts: {artifact_dir}', flush=True)
swift = capture('find-swift', ['/usr/bin/which', 'swift'])
capture('developer-directory', ['/usr/bin/xcode-select', '-p'])
capture('shim-detection', ['/usr/bin/xcrun', 'objdump', '-h', swift])
direct_swift = capture('resolve-toolchain', ['/usr/bin/xcrun', '--find', 'swift'])
capture('target-info-shim', [swift, '-print-target-info'])
capture('sdk', ['/usr/bin/xcrun', '--sdk', 'macosx', '--show-sdk-path'])
capture('target-info-direct', [direct_swift, '-print-target-info'])
formatter = str(Path(direct_swift).parent / 'swift-format')
capture('format-direct', [formatter, 'format', '--assume-filename', str(artifact_dir / 'Probe.swift'), '-'], stdin='let value=1\n')
print(f'Complete. Timings and any slow-process stack samples: {artifact_dir}', flush=True)
