# Announcement draft

Publish this after the Marketplace listing is live.

## Title

Fast Swift Format: Apple's formatter in VS Code without waiting for language-server startup

## Post

I made a small VS Code extension called Fast Swift Format after running into a 21-second Swift toolchain discovery delay. The standalone Apple formatter was much quicker, so I separated formatting from the language-server startup path.

It uses Apple's `swift-format`, respects the nearest `.swift-format` configuration, and works with Format Document and Format on Save. The Swift extension can continue providing completion and diagnostics.

On small files on my Mac, actual save-format requests took 15–33 ms, including starting the formatter process. Those are local measurements, not a universal performance promise. Setting an absolute formatter path also avoids `xcrun` discovery when the extension starts.

Install `mesqueeb.fast-swift-format` and select it as the Swift default formatter in VS Code User settings to use it across projects. Workspace settings can override that choice.

Source and setup: https://github.com/mesqueeb/fast-swift-format

Marketplace: https://marketplace.visualstudio.com/items?itemName=mesqueeb.fast-swift-format

I'd appreciate feedback from people who have run into similar delays, especially across different Swift toolchains and project configurations.
