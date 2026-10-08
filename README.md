# Fast Swift Format

Apple's `swift-format`, directly in VS Code. Format on save without waiting for Swift extension startup, SourceKit-LSP, package discovery, or indexing.

## Why we made this

We measured a 21-second toolchain discovery delay in the Swift VS Code extension. Meanwhile, launching Apple's standalone `swift-format`, sending it source, formatting it, and waiting for it to exit took only 10–13 milliseconds on the same Mac once the tools were warm.

Formatting should not need to wait for the rest of the development environment. Fast Swift Format registers a native VS Code formatting provider and calls the formatter directly. Actual VS Code save requests measured 15–33 milliseconds, including process launch. These are local measurements on small files, not a guarantee for every file or machine. The exact cause of the original 21-second discovery delay remains unproven; this extension removes that dependency from formatting.

The Swift extension can keep providing completion, diagnostics, debugging, and other language features. This extension handles formatting independently.

## Install and enable globally

Install **Fast Swift Format** by **mesqueeb** from the VS Code Extensions view, or run:

```sh
code --install-extension mesqueeb.fast-swift-format
```

Add this to your **User** `settings.json` so it applies across projects:

```jsonc
{
  "[swift]": {
    "editor.defaultFormatter": "mesqueeb.fast-swift-format",
    "editor.formatOnSave": true
  }
}
```

If you already have a `[swift]` block, merge these settings into it. A workspace's Swift-specific settings can override your user settings.

## Use Apple's formatter

You need Apple's [`swift-format`](https://github.com/swiftlang/swift-format), included in Swift 6 toolchains. On macOS, find its absolute path with:

```sh
xcrun --find swift-format
```

For the fastest startup, copy that result into User settings:

```jsonc
"fastSwiftFormat.executable": "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift-format"
```

Use your actual path; your Xcode installation may have a different name. Update it when you change or remove that toolchain. The extension uses the configured executable directly and does not run `xcrun` first.

With the setting empty, macOS discovers the formatter once per extension session using `xcrun`. Other platforms use `swift-format` from `PATH`. In a remote workspace, the formatter must be available on the remote machine.

This is Apple's `swift-format`, not Nick Lockwood's separate `SwiftFormat` tool. Their configuration formats differ.

## Your project's formatting rules

The extension sends the current editor text through stdin and supplies the document's path with `--assume-filename`. Apple's formatter discovers the nearest `.swift-format`, including configurations in nested directories. It does not force a top-level configuration.

We verified actual VS Code saves against direct CLI output with a source-folder line length of 100 and a nested test-folder line length of 200. Both used the correct configuration.

For an untitled document, configuration lookup starts in the sole workspace folder. With multiple workspace folders or no open folder, it starts in the operating system's temporary directory. Save the document into its project to give it an unambiguous configuration path.

## How it works

- Registers a native document formatter, so **Format Document** and **Format on Save** use normal editor edits and undo.
- Starts a fresh `swift-format` process for each request, using separate executable arguments and no shell.
- Formats the editor's current contents before save, including unsaved changes.
- Cancels the formatter when VS Code cancels the request and discards results if the document changes during formatting.
- Preserves the document on process failures or unexpectedly empty output.

There is no formatter daemon or keep-warm service. A direct formatter process starts cheaply in our measurements; the expensive discovery steps are avoided. OS caches and machine load can still affect startup time.

Run **Fast Swift Format: Show Output** to see request durations, including process launch.

## Develop locally

```sh
npm ci --ignore-scripts
npm run compile
npm run package
code --install-extension ./fast-swift-format-0.1.0.vsix
```

The extension has no runtime npm dependencies. Research and optional startup diagnostics are in [`docs/research/swift-formatter-startup.md`](docs/research/swift-formatter-startup.md) and [`diagnostics/README.md`](diagnostics/README.md).

## License

MIT. Created by [Luca Ban / mesqueeb](https://github.com/mesqueeb).
