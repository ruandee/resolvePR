// GitHub REST API client — server-side only (used in API route handlers)

export interface GHUser {
  login: string
  name: string | null
  avatar_url: string
  email: string | null
}

export interface GHRepo {
  id: number
  full_name: string
  name: string
  owner: { login: string; avatar_url: string }
  description: string | null
  language: string | null
  stargazers_count: number
  updated_at: string
  private: boolean
  open_issues_count: number
  default_branch: string
}

export interface GHPR {
  number: number
  title: string
  state: string
  user: { login: string; avatar_url: string }
  created_at: string
  updated_at: string
  head: { sha: string; ref: string }
  base: { ref: string }
  changed_files: number
  additions: number
  deletions: number
  draft: boolean
}

export interface GHFile {
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  patch?: string
}

async function gh<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub ${res.status} ${path}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export const githubAPI = {
  getUser: (token: string) =>
    gh<GHUser>('/user', token),

  // Fetch repos the user owns, collaborates on, or is a member of via orgs
  listRepos: async (token: string): Promise<GHRepo[]> => {
    const [owned, member] = await Promise.all([
      gh<GHRepo[]>('/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator', token),
      gh<GHRepo[]>('/user/repos?sort=updated&per_page=100&affiliation=organization_member', token),
    ])
    // Merge and deduplicate by repo id
    const seen = new Set<number>()
    const all: GHRepo[] = []
    for (const r of [...owned, ...member]) {
      if (!seen.has(r.id)) { seen.add(r.id); all.push(r) }
    }
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  },

  listPRs: (token: string, owner: string, repo: string) =>
    gh<GHPR[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=30&sort=updated`, token),

  getPRFiles: (token: string, owner: string, repo: string, pr: number) =>
    gh<GHFile[]>(`/repos/${owner}/${repo}/pulls/${pr}/files?per_page=100`, token),
}
