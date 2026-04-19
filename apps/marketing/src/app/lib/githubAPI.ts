/**
 * GitHub API module for fetching contribution data
 */

export interface ContributionDay {
  date: string;
  count: number;
  weekday?: number;
}

export interface ContributionData {
  total: number;
  contributions: ContributionDay[];
}

/**
 * Fetches contribution data via Next.js API route (server-side)
 * This ensures the GitHub token stays secure on the server
 * @param username - GitHub username
 * @returns Contribution data
 */
export async function fetchContributions(
  username: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _token?: string // Token parameter kept for compatibility but not used (handled server-side)
): Promise<ContributionData> {
  const response = await fetch(`/api/github-contributions?username=${encodeURIComponent(username)}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const calendar = await response.json();
  return parseContributionData(calendar);
}

interface GraphQLDay {
  date: string;
  contributionCount: number;
  weekday: number;
}

interface GraphQLWeek {
  contributionDays: GraphQLDay[];
}

interface GraphQLCalendar {
  totalContributions: number;
  weeks: GraphQLWeek[];
}

/**
 * Parses contribution data from GraphQL response
 */
function parseContributionData(calendar: GraphQLCalendar): ContributionData {
  const contributions: ContributionDay[] = [];

  calendar.weeks.forEach((week) => {
    week.contributionDays.forEach((day) => {
      contributions.push({
        date: day.date,
        count: day.contributionCount,
        weekday: day.weekday
      });
    });
  });

  return {
    total: calendar.totalContributions,
    contributions: contributions
  };
}
