export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  revokeGitHubGrant,
} from './oauth';

export {
  fetchUserCommits,
  fetchUserPullRequests,
  fetchUserReviews,
  fetchRepositories,
  type GitHubRepo,
} from './client';

export {
  normalizeCommits,
  normalizePullRequests,
  normalizeReviews,
} from './normalizer';
