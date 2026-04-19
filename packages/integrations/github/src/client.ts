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

  const repoNames = repos.viewer.contributionsCollection.commitContributionsByRepository.map(
    (r) => r.repository.nameWithOwner,
  );

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

  return data.viewer.contributionsCollection.pullRequestReviewContributions.nodes.map((n) => ({
    review_id: n.pullRequestReview.databaseId,
    pr_number: n.pullRequestReview.pullRequest.number,
    repo: n.pullRequestReview.pullRequest.repository.nameWithOwner,
    state: n.pullRequestReview.state,
    body: n.pullRequestReview.body || '',
    occurred_at: n.pullRequestReview.createdAt,
  }));
}
