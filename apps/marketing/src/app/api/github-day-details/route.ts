import { NextRequest, NextResponse } from 'next/server';

const GITHUB_API = 'https://api.github.com';

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

  // Parse the date and create start/end timestamps for the day
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

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

    // Fetch detailed commit information for each repository
    const commitDetails = await Promise.all(
      contributionsData.commitContributionsByRepository.map(async (repo: RepoContribution) => {
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
      ...contributionsData,
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
