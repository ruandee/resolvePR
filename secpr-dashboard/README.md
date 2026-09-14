# SecPR site + demo

The public face of SecPR: a two-page Next.js 16 site.

- `/` — landing page: what SecPR is, how the AST-chunked review works, what the pull-request author gets,
  and the one-file GitHub Actions install.
- `/demo` — an interactive **replay** of a recorded scan: the diff → the chunks tree-sitter extracted →
  the per-chunk Claude review → a results dashboard and a mock of the GitHub PR view with inline comments
  and the check run.

Everything is static. There is no auth, no database, no API route, no environment variable and no network
request from the site. The demo is driven entirely by the JSON fixtures in [`demo-fixtures/`](demo-fixtures/).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run build` / `npm start` | Production build (both routes prerender as static HTML) and serve it |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm run validate:fixtures` | Check every fixture in `demo-fixtures/` against the schema and consistency rules |

## Fixtures

Each fixture is one scanned pull request. To add or regenerate one:

```bash
# from the repository root, using the Go scanner
secpr scan --repo owner/name --pr 142 --fixture-out secpr-dashboard/demo-fixtures/owner-name-142.json

cd secpr-dashboard
npm run validate:fixtures          # fails until the file is also listed in lib/fixtures.ts
```

Then import it in `lib/fixtures.ts` and add it to the `FIXTURES` array. The schema, the validator's rules and
how the checked-in fixtures were produced are documented in
[`demo-fixtures/README.md`](demo-fixtures/README.md).

## Layout

```
app/                 routes: / (server component) and /demo (server shell around a client replay)
components/          shared display components (diff, source with chunk highlighting, GitHub comment and
                     check-run mocks), the demo steps under components/demo/, small UI under components/ui/
lib/                 fixture types + loader, design tokens, diff parser, GitHub text builders, site constants
demo-fixtures/       scan fixtures (JSON) + schema docs
scripts/             validate-fixtures.mjs
```

`lib/site.ts` holds the repository URL and the action reference (`OWNER/secpr@v1`) — edit it there when the
repo is renamed. `lib/tokens.ts` and `app/globals.css` hold the design tokens.

## Deploy to Vercel

1. Import the repository and set **Root Directory** to `secpr-dashboard`.
2. Framework preset: Next.js. Build command `npm run build`, output handled by Next.
3. **No environment variables are required.** Do not add any.

Any static host that can run `next build` works the same way.
