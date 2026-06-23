import { NextRequest, NextResponse } from 'next/server';

const GITHUB_API = 'https://api.github.com';

// GitHub buckets contribution-calendar days in the account's timezone, so a day's
// detail window must use that timezone too — otherwise late-evening commits (which
// fall on the next UTC day) are missed. Defaults to US Eastern; override per deploy.
const CALENDAR_TZ = process.env.GITHUB_CALENDAR_TIMEZONE || 'America/New_York';

// Offset (ms) to ADD to a UTC instant to get wall-clock time in `timeZone`.
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const m: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== 'literal') m[p.type] = Number(p.value);
  }
  return Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second) - instant.getTime();
}

// UTC instant of local midnight starting day (y, mo 1-based, d) in `timeZone`.
// Date.UTC normalizes day overflow, so d+1 yields the next day's midnight.
function zonedDayStart(y: number, mo: number, d: number, timeZone: string): Date {
  const asUTC = Date.UTC(y, mo - 1, d, 0, 0, 0);
  return new Date(asUTC - tzOffsetMs(new Date(asUTC), timeZone));
}

interface GitHubRepository {
  owner: { login: string };
  name: string;
}

interface RepoContribution {
  repository: GitHubRepository;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
  html_url: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');
  const date = searchParams.get('date');

  if (!username || !date) {
    return NextResponse.json(
      { error: 'Username and date are required' },
      { status: 400 }
    );
  }

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: 'GitHub token not configured' },
      { status: 500 }
    );
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Day window in the account's calendar timezone (matches the bars), as UTC
  // instants. `date` is a contribution-day string 'YYYY-MM-DD'.
  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) {
    return NextResponse.json({ error: 'Invalid date', code: 'INVALID_DATE' }, { status: 400 });
  }
  const startOfDay = zonedDayStart(y, mo, d, CALENDAR_TZ);
  const endOfDay = new Date(zonedDayStart(y, mo, d + 1, CALENDAR_TZ).getTime() - 1);

  const query = `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          commitContributionsByRepository {
            repository {
              name
              owner {
                login
              }
              url
            }
            contributions(first: 100) {
              nodes {
                commitCount
                occurredAt
                repository {
                  name
                }
                commitCount
              }
            }
          }
          issueContributions(first: 100) {
            nodes {
              issue {
                title
                url
                number
                repository {
                  name
                  owner {
                    login
                  }
                }
              }
              occurredAt
            }
          }
          pullRequestContributions(first: 100) {
            nodes {
              pullRequest {
                title
                url
                number
                repository {
                  name
                  owner {
                    login
                  }
                }
              }
              occurredAt
            }
          }
          pullRequestReviewContributions(first: 100) {
            nodes {
              pullRequest {
                title
                url
                number
                repository {
                  name
                  owner {
                    login
                  }
                }
              }
              occurredAt
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(`${GITHUB_API}/graphql`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        query: query,
        variables: {
          username,
          from: startOfDay.toISOString(),
          to: endOfDay.toISOString()
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || `HTTP error! status: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.errors) {
      return NextResponse.json(
        { error: data.errors[0].message },
        { status: 400 }
      );
    }

    if (!data.data || !data.data.user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const contributionsData = data.data.user.contributionsCollection;

    // GitHub's contributionsCollection snaps the from/to range to day granularity
    // and can return adjacent-day items, so a PR/issue/review/commit created just
    // outside the requested day leaks in (e.g. a Wednesday PR showing under Tuesday).
    // Scope every category to the exact window by each node's occurredAt.
    const startMs = startOfDay.getTime();
    const endMs = endOfDay.getTime();
    const inWindow = (occurredAt: string) => {
      const t = new Date(occurredAt).getTime();
      return t >= startMs && t <= endMs;
    };
    type DayNode = { occurredAt: string };
    interface RepoCommitGroup {
      repository: GitHubRepository & { url?: string };
      contributions: { nodes: DayNode[] };
    }

    const scoped = {
      commitContributionsByRepository: (contributionsData.commitContributionsByRepository as RepoCommitGroup[])
        .map((repo) => ({
          ...repo,
          contributions: { ...repo.contributions, nodes: repo.contributions.nodes.filter((n) => inWindow(n.occurredAt)) },
        }))
        .filter((repo) => repo.contributions.nodes.length > 0),
      issueContributions: {
        nodes: (contributionsData.issueContributions.nodes as DayNode[]).filter((n) => inWindow(n.occurredAt)),
      },
      pullRequestContributions: {
        nodes: (contributionsData.pullRequestContributions.nodes as DayNode[]).filter((n) => inWindow(n.occurredAt)),
      },
      pullRequestReviewContributions: {
        nodes: (contributionsData.pullRequestReviewContributions.nodes as DayNode[]).filter((n) => inWindow(n.occurredAt)),
      },
    };

    // Fetch detailed commit information for each repository (scoped list only)
    const commitDetails = await Promise.all(
      scoped.commitContributionsByRepository.map(async (repo: RepoContribution) => {
        try {
          // Fetch commits for this repository on the specific date
          const commitsUrl = `${GITHUB_API}/repos/${repo.repository.owner.login}/${repo.repository.name}/commits`;
          const commitsResponse = await fetch(
            `${commitsUrl}?author=${username}&since=${startOfDay.toISOString()}&until=${endOfDay.toISOString()}&per_page=100`,
            { headers }
          );

          if (!commitsResponse.ok) {
            return {
              repository: repo.repository,
              commits: []
            };
          }

          const commits = await commitsResponse.json() as GitHubCommit[];
          return {
            repository: repo.repository,
            commits: commits.map((commit: GitHubCommit) => ({
              sha: commit.sha.substring(0, 7),
              message: commit.commit.message,
              url: commit.html_url,
              timestamp: commit.commit.author.date
            }))
          };
        } catch (error) {
          console.error(`Error fetching commits for ${repo.repository.name}:`, error);
          return {
            repository: repo.repository,
            commits: []
          };
        }
      })
    );

    return NextResponse.json({
      ...scoped,
      commitDetails
    });
  } catch (error) {
    console.error('Error fetching day details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch day details' },
      { status: 500 }
    );
  }
}
