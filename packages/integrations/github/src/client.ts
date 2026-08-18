const GITHUB_API = 'https://api.github.com';

async function githubFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (res.status === 401) throw new Error('GITHUB_TOKEN_INVALID');
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);

  return res.json();
}

async function graphql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401) throw new Error('GITHUB_TOKEN_INVALID');
  if (!res.ok) throw new Error(`GitHub GraphQL error: ${res.status}`);

  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(`GraphQL: ${data.errors[0].message}`);
  }
  return data.data;
}

// ── Commits ────────────────────────────────────────────────────────────────

export async function fetchUserCommits(
  token: string,
  username: string,
  since: Date,
  /** Restrict to these `owner/name` repos. Undefined means every contributed repo. */
  trackedRepos?: string[],
): Promise<Array<{ sha: string; message: string; repo: string; occurred_at: string }>> {
  // First get repos the user has contributed to recently
  const repos = await graphql<{
    viewer: {
      contributionsCollection: {
        commitContributionsByRepository: Array<{
          repository: { nameWithOwner: string };
        }>;
      };
    };
  }>(token, `{
    viewer {
      contributionsCollection(from: "${since.toISOString()}") {
        commitContributionsByRepository(maxRepositories: 20) {
          repository { nameWithOwner }
        }
      }
    }
  }`);

  // Narrow before the per-repo commit calls below — each one is its own REST
  // request, so filtering here is what actually saves work.
  const repoNames = repos.viewer.contributionsCollection.commitContributionsByRepository
    .map((r) => r.repository.nameWithOwner)
    .filter((name) => !trackedRepos || trackedRepos.includes(name));

  // Fetch actual commits per repo
  const commits: Array<{ sha: string; message: string; repo: string; occurred_at: string }> = [];
  const sinceISO = since.toISOString();

  for (const repo of repoNames) {
    try {
      const repoCommits = await githubFetch<
        Array<{
          sha: string;
          commit: { message: string; author: { date: string; name: string } };
        }>
      >(
        `${GITHUB_API}/repos/${repo}/commits?author=${username}&since=${sinceISO}&per_page=100`,
        token,
      );

      for (const c of repoCommits) {
        commits.push({
          sha: c.sha,
          message: c.commit.message,
          repo,
          occurred_at: c.commit.author.date,
        });
      }
    } catch {
      // Skip repos we can't access
    }
  }

  return commits;
}

// ── Pull Requests ──────────────────────────────────────────────────────────

export async function fetchUserPullRequests(
  token: string,
  _username: string,
  since: Date,
  /** Restrict to these `owner/name` repos. Undefined means every repo. */
  trackedRepos?: string[],
): Promise<
  Array<{
    number: number;
    title: string;
    repo: string;
    state: string;
    merged_at: string | null;
    created_at: string;
    additions: number;
    deletions: number;
    changed_files: number;
  }>
> {
  const data = await graphql<{
    viewer: {
      contributionsCollection: {
        pullRequestContributions: {
          nodes: Array<{
            pullRequest: {
              number: number;
              title: string;
              repository: { nameWithOwner: string };
              mergedAt: string | null;
              createdAt: string;
              additions: number;
              deletions: number;
              changedFiles: number;
            };
          }>;
        };
      };
    };
  }>(token, `{
    viewer {
      contributionsCollection(from: "${since.toISOString()}") {
        pullRequestContributions(first: 100, orderBy: {direction: DESC}) {
          nodes {
            pullRequest {
              number
              title
              repository { nameWithOwner }
              mergedAt
              createdAt
              additions
              deletions
              changedFiles
            }
          }
        }
      }
    }
  }`);

  return data.viewer.contributionsCollection.pullRequestContributions.nodes
    .filter((n) => n.pullRequest.mergedAt)
    .filter((n) => !trackedRepos || trackedRepos.includes(n.pullRequest.repository.nameWithOwner))
    .map((n) => ({
      number: n.pullRequest.number,
      title: n.pullRequest.title,
      repo: n.pullRequest.repository.nameWithOwner,
      state: 'closed',
      merged_at: n.pullRequest.mergedAt,
      created_at: n.pullRequest.createdAt,
      additions: n.pullRequest.additions,
      deletions: n.pullRequest.deletions,
      changed_files: n.pullRequest.changedFiles,
    }));
}

// ── Reviews ────────────────────────────────────────────────────────────────

export async function fetchUserReviews(
  token: string,
  _username: string,
  since: Date,
  /** Restrict to these `owner/name` repos. Undefined means every repo. */
  trackedRepos?: string[],
): Promise<
  Array<{
    review_id: number;
    pr_number: number;
    repo: string;
    state: string;
    body: string;
    occurred_at: string;
  }>
> {
  const data = await graphql<{
    viewer: {
      contributionsCollection: {
        pullRequestReviewContributions: {
          nodes: Array<{
            pullRequestReview: {
              databaseId: number;
              state: string;
              body: string;
              createdAt: string;
              pullRequest: {
                number: number;
                repository: { nameWithOwner: string };
              };
            };
          }>;
        };
      };
    };
  }>(token, `{
    viewer {
      contributionsCollection(from: "${since.toISOString()}") {
        pullRequestReviewContributions(first: 100, orderBy: {direction: DESC}) {
          nodes {
            pullRequestReview {
              databaseId
              state
              body
              createdAt
              pullRequest {
                number
                repository { nameWithOwner }
              }
            }
          }
        }
      }
    }
  }`);

  return data.viewer.contributionsCollection.pullRequestReviewContributions.nodes
    .filter(
      (n) =>
        !trackedRepos ||
        trackedRepos.includes(n.pullRequestReview.pullRequest.repository.nameWithOwner),
    )
    .map((n) => ({
      review_id: n.pullRequestReview.databaseId,
      pr_number: n.pullRequestReview.pullRequest.number,
      repo: n.pullRequestReview.pullRequest.repository.nameWithOwner,
      state: n.pullRequestReview.state,
      body: n.pullRequestReview.body || '',
      occurred_at: n.pullRequestReview.createdAt,
    }));
}

// ── Repositories ───────────────────────────────────────────────────────────

export interface GitHubRepo {
  nameWithOwner: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  description: string | null;
  primaryLanguage: string | null;
  pushedAt: string | null;
}

/**
 * Every repo the user can see, for choosing which ones to track.
 *
 * affiliations covers repos they own, collaborate on, and reach through an org.
 * Private repos are included — the OAuth grant asks for `repo`, which covers them —
 * so this list is only as broad as what the user already authorised.
 */
export async function fetchRepositories(token: string): Promise<GitHubRepo[]> {
  const out: GitHubRepo[] = [];
  let cursor: string | null = null;

  do {
    const data: {
      viewer: {
        repositories: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            nameWithOwner: string;
            isPrivate: boolean;
            isFork: boolean;
            isArchived: boolean;
            description: string | null;
            primaryLanguage: { name: string } | null;
            pushedAt: string | null;
          }>;
        };
      };
    } = await graphql(
      token,
      `query($cursor: String) {
        viewer {
          repositories(
            first: 100
            after: $cursor
            affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
            orderBy: { field: PUSHED_AT, direction: DESC }
          ) {
            pageInfo { hasNextPage endCursor }
            nodes {
              nameWithOwner
              isPrivate
              isFork
              isArchived
              description
              primaryLanguage { name }
              pushedAt
            }
          }
        }
      }`,
      { cursor },
    );

    const page = data.viewer.repositories;
    for (const n of page.nodes) {
      out.push({
        nameWithOwner: n.nameWithOwner,
        isPrivate: n.isPrivate,
        isFork: n.isFork,
        isArchived: n.isArchived,
        description: n.description,
        primaryLanguage: n.primaryLanguage?.name ?? null,
        pushedAt: n.pushedAt,
      });
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  return out;
}
