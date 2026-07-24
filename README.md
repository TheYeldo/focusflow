# FocusFlow

FocusFlow is a responsive task organizer that combines practical planning tools with a lightweight level and achievement system. Its Russian-language interface uses a glass-inspired visual design across desktop and mobile layouts.

## Features

- Create, edit, complete, and delete tasks.
- Add tasks quickly without opening the full editor.
- Organize work by category, priority, and deadline.
- Filter tasks by status or priority, search their content, and choose a sort order.
- Reorder tasks manually with drag and drop.
- Track completed work through XP, levels, daily progress, and local achievements.
- Switch between dark and light themes.
- Enable or disable subtle Web Audio feedback.
- Use a compact mobile dock and responsive task layout on smaller screens.

## Data and Privacy

FocusFlow stores tasks and interface preferences in the browser's `localStorage`. The current application does not require an account, send task content to a backend, or synchronize data between devices.

Clearing the site's browser data resets saved tasks, theme, sound preference, and progress statistics.

## Technology

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS 4 and project-specific CSS
- Lucide React icons
- vinext, Vite, and the Cloudflare Vite plugin
- Node's built-in test runner

## Requirements

- Node.js 22.13 or newer
- pnpm

## Local Development

```bash
git clone https://github.com/TheYeldo/focusflow.git
cd focusflow
pnpm install
pnpm dev
```

Open the local URL printed by the development server. No application environment variables are required for the current task board.

## Available Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the vinext development server. |
| `pnpm build` | Create a production build. |
| `pnpm start` | Serve the production build. |
| `pnpm test` | Build the application and verify the server-rendered HTML shell. |
| `pnpm lint` | Run ESLint against the project. |
| `pnpm db:generate` | Generate Drizzle migrations if the optional database scaffold is developed. |

## Project Structure

```text
app/
├── TodoQuest.tsx       # Task state, interactions, filters, and achievements
├── globals.css         # Glass UI, themes, and responsive layouts
├── layout.tsx          # Metadata and root document
└── page.tsx            # Application entry point
tests/
└── rendered-html.test.mjs
worker/
└── index.ts            # vinext worker entry point
```

The optional Drizzle and Cloudflare D1 scaffold remains separate from the current browser-persisted task experience.

## Verification

Before submitting changes, run:

```bash
pnpm lint
pnpm test
```

The test command includes the production build and then checks that the generated worker returns the expected FocusFlow HTML shell.

## Current Scope

FocusFlow is a client-side personal productivity project. Cross-device synchronization, user accounts, shared workspaces, and server-backed task storage are not part of the current implementation.
