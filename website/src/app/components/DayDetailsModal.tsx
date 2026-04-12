'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Repository {
  name: string;
  owner: { login: string };
  url: string;
}

interface Issue {
  title: string;
  url: string;
  number: number;
  repository: Repository;
}

interface PullRequest {
  title: string;
  url: string;
  number: number;
  repository: Repository;
}

interface Commit {
  sha: string;
  message: string;
  url: string;
  timestamp: string;
}

interface CommitContribution {
  repository: Repository;
  contributions: {
    nodes: Array<{
      commitCount: number;
      occurredAt: string;
    }>;
  };
}

interface CommitDetail {
  repository: Repository;
  commits: Commit[];
}

interface DayDetails {
  commitContributionsByRepository: CommitContribution[];
  commitDetails?: CommitDetail[];
  issueContributions: {
    nodes: Array<{
      issue: Issue;
      occurredAt: string;
    }>;
  };
  pullRequestContributions: {
    nodes: Array<{
      pullRequest: PullRequest;
      occurredAt: string;
    }>;
  };
  pullRequestReviewContributions: {
    nodes: Array<{
      pullRequest: PullRequest;
      occurredAt: string;
    }>;
  };
}

interface DayDetailsModalProps {
  username: string;
  date: string;
  contributionCount: number;
  onClose: () => void;
}

type CategoryType = 'commits' | 'prs' | 'issues' | 'reviews';

export default function DayDetailsModal({ username, date, onClose }: DayDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('commits');

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/github-day-details?username=${encodeURIComponent(username)}&date=${encodeURIComponent(date)}`
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch details');
        }
        const data = await response.json();
        setDetails(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch details');
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [username, date]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const totalCommits =
    details?.commitContributionsByRepository.reduce(
      (sum, repo) => sum + repo.contributions.nodes.reduce((s, c) => s + c.commitCount, 0),
      0
    ) || 0;
  const totalIssues = details?.issueContributions.nodes.length || 0;
  const totalPRs = details?.pullRequestContributions.nodes.length || 0;
  const totalReviews = details?.pullRequestReviewContributions.nodes.length || 0;
  const totalAll = totalCommits + totalIssues + totalPRs + totalReviews;

  const categories: { key: CategoryType; label: string; count: number }[] = [
    { key: 'commits', label: 'Commits', count: totalCommits },
    { key: 'prs', label: 'PRs', count: totalPRs },
    { key: 'issues', label: 'Issues', count: totalIssues },
    { key: 'reviews', label: 'Reviews', count: totalReviews },
  ];

  const linkIcon = (
    <svg className="w-4 h-4 text-neutral-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Activity Details</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{formattedDate}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-lg p-4 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          ) : totalAll === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No detailed activity found for this day</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">GitHub may count some private contributions</p>
            </div>
          ) : (
            <>
              {/* Category tabs */}
              <div className="flex border-b border-neutral-100 dark:border-neutral-800 px-6">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-4 py-3 text-xs font-medium transition-colors relative ${
                      selectedCategory === cat.key
                        ? 'text-neutral-900 dark:text-white'
                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    {cat.label}
                    {cat.count > 0 && (
                      <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                        selectedCategory === cat.key
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}>
                        {cat.count}
                      </span>
                    )}
                    {selectedCategory === cat.key && (
                      <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-emerald-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-6 space-y-3">
                {/* Commits */}
                {selectedCategory === 'commits' && details?.commitDetails && details.commitDetails.length > 0 && (
                  <div className="space-y-4">
                    {details.commitDetails.map((repoCommits, i) =>
                      repoCommits.commits.length > 0 ? (
                        <div key={i}>
                          <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
                            {repoCommits.repository.owner.login}/{repoCommits.repository.name}
                          </p>
                          <div className="space-y-1.5">
                            {repoCommits.commits.map((commit, j) => (
                              <a
                                key={j}
                                href={commit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500/40 transition-colors group"
                              >
                                <code className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                                  {commit.sha}
                                </code>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-neutral-900 dark:text-white break-words leading-snug">
                                    {commit.message.split('\n')[0]}
                                  </p>
                                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                                    {new Date(commit.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                                  {linkIcon}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                )}
                {selectedCategory === 'commits' && (!details?.commitDetails || details.commitDetails.length === 0) && (
                  <p className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">No commits found for this day</p>
                )}

                {/* PRs */}
                {selectedCategory === 'prs' && details && details.pullRequestContributions.nodes.length > 0 && (
                  <div className="space-y-1.5">
                    {details.pullRequestContributions.nodes.map((pr, i) => (
                      <a
                        key={i}
                        href={pr.pullRequest.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500/40 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{pr.pullRequest.title}</p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {pr.pullRequest.repository.owner.login}/{pr.pullRequest.repository.name} #{pr.pullRequest.number}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">{linkIcon}</div>
                      </a>
                    ))}
                  </div>
                )}
                {selectedCategory === 'prs' && details?.pullRequestContributions.nodes.length === 0 && (
                  <p className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">No pull requests found for this day</p>
                )}

                {/* Issues */}
                {selectedCategory === 'issues' && details && details.issueContributions.nodes.length > 0 && (
                  <div className="space-y-1.5">
                    {details.issueContributions.nodes.map((issue, i) => (
                      <a
                        key={i}
                        href={issue.issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500/40 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{issue.issue.title}</p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {issue.issue.repository.owner.login}/{issue.issue.repository.name} #{issue.issue.number}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">{linkIcon}</div>
                      </a>
                    ))}
                  </div>
                )}
                {selectedCategory === 'issues' && details?.issueContributions.nodes.length === 0 && (
                  <p className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">No issues found for this day</p>
                )}

                {/* Reviews */}
                {selectedCategory === 'reviews' && details && details.pullRequestReviewContributions.nodes.length > 0 && (
                  <div className="space-y-1.5">
                    {details.pullRequestReviewContributions.nodes.map((review, i) => (
                      <a
                        key={i}
                        href={review.pullRequest.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500/40 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{review.pullRequest.title}</p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {review.pullRequest.repository.owner.login}/{review.pullRequest.repository.name} #{review.pullRequest.number}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">{linkIcon}</div>
                      </a>
                    ))}
                  </div>
                )}
                {selectedCategory === 'reviews' && details?.pullRequestReviewContributions.nodes.length === 0 && (
                  <p className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">No reviews found for this day</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
