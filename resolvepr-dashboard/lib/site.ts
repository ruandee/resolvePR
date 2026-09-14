// Single place to edit when the repository is renamed or moved.

export const SITE_NAME = 'ResolvePR'
export const SITE_TAGLINE = 'Security review for every pull request, scoped to the functions that actually changed.'

/** GitHub repository for the "Try it on your repo" call to action. */
export const REPO_URL = 'https://github.com/ruandee/resolvepr'

/** Action reference used in the install snippet. */
export const ACTION_REF = 'ruandee/resolvepr@v1'

/** Shown in the footer. */
export const BUILT_AT = 'Built at GDG Hacks 2026 · Go · tree-sitter · Claude · Next.js'

export const INSTALL_SNIPPET = `name: ResolvePR
on: pull_request
jobs:
  resolvepr:
    runs-on: ubuntu-latest
    permissions: { contents: read, pull-requests: write, checks: write }
    steps:
      - uses: ${ACTION_REF}
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
`
