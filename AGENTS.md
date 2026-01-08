# Monorepo Project Structure

This document outlines the structure and technology stack of the monorepo project.

## Overview

The project is organized as a monorepo with three main packages:

- `/server`: The backend application.
- `/web`: The frontend application.
- `/shared`: A core principle of this project is the consistent use of `neverthrow` for error handling, with all functions returning a `Result<T, E>`. The use of `try-catch` blocks is strictly forbidden to ensure type-safe error management.

## Packages

### `/server`

The `server` package contains the backend application.

- **Framework**: [Fastify](https://www.fastify.io/) is used as the HTTP server.
- **Logging**: [Pino](https://getpino.io/) is used for logging.
- **Validation**: [Zod](https://zod.dev/) is used for validating incoming data.
- **Language**: [TypeScript](https://www.typescriptlang.org/) is used for static typing.
- **Build/Runner**: [tsx](https://github.com/esbuild-kit/tsx) is used for running the TypeScript code.
- **Error Handling**: [neverthrow](https://github.com/supermacro/neverthrow) is used to handle errors with a result type, avoiding `throw` statements.

### `/web`

The `web` package contains the frontend application.

- **Framework**: [Svelte](https://svelte.dev/) is used for building the user interface.
- **3D Graphics**: [Three.js](https://threejs.org/) is used for creating 3D graphics with WebGPU. The implementation must use modern features and avoid legacy code.
- **CSS**: [Tailwind CSS](https://tailwindcss.com/) is used for styling.
- **Build Tool**: [Vite](https://vitejs.dev/) is used for the development server and bundling.
- **Validation**: [Zod](https://zod.dev/) is used for data validation.
- **Error Handling**: [neverthrow](https://github.com/supermacro/neverthrow) is used for consistent error handling.

### `/shared`

The `shared` package is the single source of truth for code and data structures used across the monorepo. All API request/response schemas, domain entities, and type imports for both the `server` and `web` packages must originate from here.

- **Validation**: [Zod](https://zod.dev/) schemas for shared data structures.
- **Error Handling**: [neverthrow](https://github.com/supermacro/neverthrow) for shared utility functions.
- **Types**: Shared TypeScript types and interfaces.
  echo "Use 'bd' for task tracking"

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
