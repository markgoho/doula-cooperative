# Gemini Assistant Development Guidelines

This document provides a summary of the key development guidelines, rules, and project structure for working on this codebase. It is derived from the rules defined in the `.cursor/rules/` directory.

## 1. Core Principles & Project Management

The project follows a strict, task-driven development process managed through markdown files in `docs/delivery/`.

- **Task-Driven Development**: No code shall be changed unless explicitly authorized by a task. All tasks must be associated with a Product Backlog Item (PBI).
- **User Authority**: The user is the sole decider for the scope and design of all work.
- **Scope**: No "gold plating" or scope creep. Any changes outside the explicit scope of an agreed task are prohibited.
- **File Structure**:
  - **Backlog**: `docs/delivery/backlog.md`
  - **PBI Details**: `docs/delivery/<PBI-ID>/prd.md`
  - **Task Lists**: `docs/delivery/<PBI-ID>/tasks.md`
  - **Task Details**: `docs/delivery/<PBI-ID>/<PBI-ID>-<TASK-ID>.md`
- **Workflows**: PBIs and Tasks have defined statuses and transition events (e.g., `Proposed` -> `Agreed` -> `InProgress` -> `Review` -> `Done`). All status changes must be logged in the respective files.
- **Testing**: Test plans are required for each task and must be proportional to the task's complexity. The plan should be documented in the task's markdown file.

## 2. Tech Stack & Project Structure

- **Tech Stack**: Firebase (Functions, Firestore, Auth), Hugo, Angular, TypeScript, SCSS.
- **Project Directories**:
  - `/functions/`: Firebase Cloud Functions.
  - `/hugo/`: Hugo static site (public website).
  - `/members/`: Angular application (member's area).
  - `/emulator-seed-data/`: Seed data for the Firebase emulator.
- **Development Environment**:
  - The applications (Hugo, Angular) are already running. Do not try to start them.
  - Default to using **Bun** for all operations (`bun install`, `bun run`, `bun test`, etc.).

## 3. Coding Guidelines

### TypeScript (`*.ts`)

- **Errors**: Always resolve all ESLint and TypeScript errors before considering work complete.
- **Style**:
  - Prefer destructuring imports: `import { method } from 'package';`.
  - Use object lookup maps instead of `switch` statements where possible.
  - Do not disable ESLint rules unless it's the absolute last resort, and document why.
- **Linting**: You MUST check for and fix lint errors after adding or changing code.

### Firebase Functions (`functions/**/*.ts`)

- Use `import { getFirestore } from "firebase-admin/firestore";` to access Firestore.
- Keep functions idempotent where possible.
- **Lazy Loading**: When adding new functions in `functions/src/index.ts`, always lazy-load them using the `async/await import()` pattern.

### Angular (`members/`)

- **Components (`*.ts`)**:
  - Use `inject` for dependency injection, not the constructor.
  - Use signal-based APIs and `ChangeDetection.OnPush`.
  - Avoid subscribing to observables directly; use the `async` pipe in templates.
  - Do not import `CommonModule`; import specific modules needed.
  - Components should not access Firebase directly; use a service layer.
- **Templates (`*.html`)**:
  - Use modern control flow syntax (`@if`, `@for`).
  - Use signals to simplify change detection.
- **Styles (`*.scss`)**:
  - Use modern, intrinsic CSS principles.
  - Use predefined tokens for colors, spacing, and lengths instead of hard-coding values.

### SCSS / CSS (`*.scss`)

- Use modern, accessible, intrinsic CSS (e.g., custom properties, container queries, `rem` units).
- Prefer native CSS over SCSS-specific functionality.
- Use design tokens instead of hard-coded values.

### Hugo (`hugo/`)

- **Page-Specific CSS**: To add CSS to a specific page, use the provided Go template snippet to inline the compiled SCSS.
- **Verification**: When making changes to Hugo files, use the Playwright MCP tools to visually browse and verify that the changes appear correctly.
