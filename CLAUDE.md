@AGENTS.md

# Claude Code notes

- The project guide lives in `AGENTS.md` (imported above); i18n rules are in `docs-i18n.md`. Add only Claude-specific instructions here; do not duplicate content.
- Next.js in this project differs from the familiar version (16.x, `cacheComponents`): before writing any Next API code, read the relevant guide under `node_modules/next/dist/docs/`.
- The user writes in Turkish; reply in the language the user uses. UI strings are never hardcoded — add them to the dictionaries per `docs-i18n.md`.
- Before finishing: `npx tsc --noEmit && npx eslint src && npx vitest run`. See `AGENTS.md` → "Known state".
- For the dev server use `.claude/launch.json` → `tuik-dev` (port 3111); do not start it with Bash.
- Commit only as the user asked (progressive commits); never push unless the user asks.
