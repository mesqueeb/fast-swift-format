import * as vscode from 'vscode'
import { execFile } from 'node:child_process'
import * as path from 'node:path'
import * as os from 'node:os'

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Fast Swift Format', { log: true })
  let discoveredExecutable: Promise<string> | undefined
  const resolveExecutable = (): Promise<string> => {
    const configured = vscode.workspace.getConfiguration('fastSwiftFormat').get<string>('executable', '')
    if (configured) {
      if (!path.isAbsolute(configured)) return Promise.reject(new Error('fastSwiftFormat.executable must be an absolute path.'))
      return Promise.resolve(configured)
    }
    if (!discoveredExecutable) {
      discoveredExecutable = process.platform === 'darwin'
        ? new Promise<string>((resolve, reject) => {
          execFile('/usr/bin/xcrun', ['--find', 'swift-format'], { timeout: 10000 }, (error, stdout) => {
            if (error) reject(error)
            else resolve(stdout.trim())
          })
        }).catch(error => {
          discoveredExecutable = undefined
          throw error
        })
        : Promise.resolve('swift-format')
    }
    return discoveredExecutable
  }

  const provider: vscode.DocumentFormattingEditProvider = {
    async provideDocumentFormattingEdits(document, _options, token) {
      const started = performance.now()
      const version = document.version
      const original = document.getText()
      if (token.isCancellationRequested) return []
      try {
        const executable = await resolveExecutable()
        if (token.isCancellationRequested) return []
        const folder = vscode.workspace.getWorkspaceFolder(document.uri)
          ?? (vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0] : undefined)
        const filename = document.uri.scheme === 'file'
          ? document.uri.fsPath
          : path.join(folder?.uri.fsPath ?? os.tmpdir(), 'Untitled.swift')
        const formatted = await new Promise<string>((resolve, reject) => {
          const child = execFile(executable, ['format', '--assume-filename', filename, '-'], {
            cwd: path.dirname(filename), timeout: 10000, maxBuffer: 16 * 1024 * 1024,
          }, (error, stdout, stderr) => {
            cancellation.dispose()
            if (token.isCancellationRequested) resolve(original)
            else if (error) reject(new Error(stderr.trim() || error.message))
            else resolve(stdout)
          })
          const cancellation = token.onCancellationRequested(() => child.kill())
          child.stdin?.on('error', error => {
            if (!token.isCancellationRequested) output.error(`Formatter stdin: ${error.message}`)
          })
          child.stdin?.end(original)
          if (token.isCancellationRequested) child.kill()
        })
        output.info(`Formatted ${filename} in ${(performance.now() - started).toFixed(1)} ms (process launch included)`)
        if (token.isCancellationRequested || document.version !== version || original === formatted) return []
        if (original.trim() && !formatted.trim()) throw new Error('Formatter returned empty output; preserving the document.')
        let start = 0
        while (start < original.length && start < formatted.length && original[start] === formatted[start]) start++
        let oldEnd = original.length
        let newEnd = formatted.length
        while (oldEnd > start && newEnd > start && original[oldEnd - 1] === formatted[newEnd - 1]) {
          oldEnd--
          newEnd--
        }
        // Keep edit boundaries outside UTF-16 surrogate pairs used by VS Code positions.
        if (start > 0 && /[\uDC00-\uDFFF]/.test(original[start] ?? '')) start--
        if (oldEnd < original.length && /[\uDC00-\uDFFF]/.test(original[oldEnd])) { oldEnd++; newEnd++ }
        const range = new vscode.Range(document.positionAt(start), document.positionAt(oldEnd))
        return [vscode.TextEdit.replace(range, formatted.slice(start, newEnd))]
      } catch (error) {
        if (token.isCancellationRequested) return []
        const message = error instanceof Error ? error.message : String(error)
        output.error(message)
        throw new Error(`Fast Swift Format: ${message}`)
      }
    },
  }
  context.subscriptions.push(
    output,
    vscode.languages.registerDocumentFormattingEditProvider({ language: 'swift' }, provider),
    vscode.commands.registerCommand('fastSwiftFormat.showOutput', () => output.show()),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('fastSwiftFormat.executable')) discoveredExecutable = undefined
    }),
  )
  output.info('Formatter registered; no Swift extension or language server dependency.')
}
