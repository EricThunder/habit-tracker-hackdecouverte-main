# AI Coding Agent Instructions

These instructions capture the current, minimal static habit tracker app to help agents contribute safely and productively.

## Overview
Single-page static web app (`index.html` + `styles.css` + `test.js`) for creating and tracking daily habit completions. No build tooling, backend, or external libs. Persistence via `localStorage` key `habits`.

## Core Files
- `index.html`: Structure; loads `test.js` at end of body. Sections: create form (`#habit-form`), habit list container (`#habits-container`).
- `styles.css`: Pure styling; no dynamic dependencies.
- `test.js`: All logic (state, rendering, event handling, persistence).
- `data.json`: Misnamed/incomplete JS-like stub (Firebase placeholders). Currently unused. Treat as inert until clarified.

## Data Model
Habit object shape (inline in `test.js`):
```js
{ id: Number, name: String, completions: Array<String /* YYYY-MM-DD */> }
```
- IDs use `Date.now()`; uniqueness is sufficient for this scale.
- Dates stored as ISO date (not datetime): `new Date().toISOString().split('T')[0]`.
- Past dates validated against regex `^\d{4}-\d{2}-\d{2}$`, non-future, non-duplicate.

## State & Persistence
- Source of truth: in-memory `habits` array.
- Always call `persist()` after mutating habits; then `renderHabits()`.
- Avoid writing directly to `localStorage` outside `persist()`.

## Rendering Pattern
- `renderHabits()` fully regenerates `#habits-container` (clears `innerHTML`, rebuilds DOM pieces).
- Each habit becomes a `.habit-item` div assembled via template literal into `innerHTML` of a created container node.
- Disabled state for today's completion button determined before insertion (`isCompletedToday`).

## Event Handling
- Form submit guarded: checks existence & trimmed input before creating habit.
- Delegated click handling on `#habits-container` using `e.target.closest()` for `.delete-btn`, `.log-btn`, `.past-btn`.
- This pattern enables simple future extension (add new buttons without extra listeners).

## Validation & Edge Cases
- Empty habit names ignored.
- Duplicate or future past dates rejected with user alerts.
- Deletion requires user confirmation (`confirm`).
- Double logging today prevented by disabling the button + guard in `logCompletion`.

## Conventions
- Functions are action-noun: `persist`, `renderHabits`, `logCompletion`, `deleteHabit`, `addPastCompletion`.
- Date strings kept sorted only when adding past completions (`habit.completions.sort()` in `addPastCompletion`). Do not sort on every render.
- Minimal defensive null checks around DOM elements (`if (!habit) return;`). Preserve this style (silent no-op over throwing).

## Extending Safely (Examples)
- Add habit rename: locate habit, update `name`, then `persist()` + `renderHabits()`.
- Add frequency attribute: extend habit object `{ frequency: 'daily' }`; ensure legacy habits handled with default when loading from storage.
- Add streaks: compute in `renderHabits()` or a helper (derive, never store separately to avoid sync issues).

## Performance
- O(N) rebuild on each mutation; acceptable for small habit counts (< hundreds). If scaling, consider diffing instead of full rebuild.

## UI Constraints
- Keep button classes (`log-btn`, `past-btn`, `delete-btn`) stable if reusing delegation logic.
- Disabled state must use `disabled` attribute (CSS expects it for styling).

## data.json Guidance
- File content is not valid JSON and unused. Do not rely on it. If integrating Firebase, rename to `config.js` or supply actual JSON before consumption.

## Common Pitfalls to Avoid
- Forgetting to call `persist()` after mutations (leads to lost data on reload).
- Introducing future dates without validation.
- Writing direct `innerHTML` user-supplied names without escaping (currently safe under basic usage; if adding rich input, sanitize).

## Quick Workflow
1. Open `index.html` directly or serve: `python3 -m http.server 8000`.
2. Interact; habits stored automatically in browser.
3. Modify logic in `test.js`; refresh page to load new code.

## Agent DO / AVOID
- DO reuse existing helper functions; AVOID duplicating persistence logic.
- DO maintain date format `YYYY-MM-DD`; AVOID storing full ISO datetimes.
- DO extend habit objects carefully with backward compatibility; AVOID breaking shape for existing stored entries.
- DO preserve delegation model; AVOID per-row individual listeners unless necessary.

## Feedback Targets
Please clarify if: (a) `data.json` should be removed or formalized, (b) habit editing beyond deletion is desired, (c) future integration (Firebase) is imminent.

---
Provide updates referencing function names and paths; keep changes minimal & consistent.
