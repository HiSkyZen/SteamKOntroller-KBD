## Steam Korean Keyboard Injection

A Millennium plugin that adds Korean qwerty labels to Steam's on-screen keyboard.

## Prerequisites

- [Millennium](https://steambrew.app/)
- pnpm

## Building

```ps1
pnpm install
pnpm run build
```

For development builds:

```ps1
pnpm run dev
```

## Installing Locally

Place or symlink this repository into your Millennium plugins directory, then enable
`Steam Korean Keyboard Injection` from Steam's Millennium plugin settings.

Common plugin directories:

- Windows: `%STEAM%\plugin\steam-korean-keyboard-injection`
- Linux: `~/.local/share/millennium/plugins/steam-korean-keyboard-injection`

The SteamUI patch is implemented in `src/keyboard-injection.js` and loaded
from the Millennium frontend entry point.
