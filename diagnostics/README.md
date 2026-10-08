# Optional startup diagnostics

These tools investigate the original Swift extension's toolchain discovery delay. They are not included in the published extension and are not needed for formatting.

`node diagnostics/install-startup-probe.mjs` instruments the inspected Swift extension 2.16.7 bundle. It preserves the original alongside it as `extension.js.swift-startup-original` and refuses to overwrite an existing backup. It logs discovery stages, commands, durations, and extension-host event-loop delay in Swift's output channel and `SwiftStartupProbe.jsonl` in the operating system's temporary directory. The output channel reports the full path. It logs no environment variables or document contents. Updating the Swift extension can replace the instrumentation.

To remove the probe, first verify that the installed bundle contains only the probe plus the preserved original. Restore the backup only when that comparison succeeds, so later extension updates are preserved.

`python3 diagnostics/capture-discovery.py` replays discovery subprocesses outside VS Code and compares the shim, direct compiler and direct formatter. Run it soon after a naturally cold start for useful evidence. Its artifact directory contains command output, timings, and stack samples of commands and descendants that last more than half a second. Sampling adds overhead; use it to identify where commands wait, not precise formatter benchmarking.

`--uncached` uses xcrun's documented `xcrun_nocache` option to refresh lookup entries. It does not reproduce all effects of rebooting. The script does not build the project or modify source files.
