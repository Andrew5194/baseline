// One-off backfill: pull GitHub events GitHub knows about but the lossy
// incremental sync dropped, and emit idempotent SQL (ON CONFLICT DO NOTHING)
// matching events_source_dedup_idx (user_id, source, source_id, event_type).
const TOKEN = process.env.GH_TOKEN;
const USER_ID = process.env.BASELINE_USER_ID;
const USERNAME = 'Andrew5194';
const SINCE = '2026-06-16T07:13:33Z'; // just after the last ingested event
const GITHUB_API = 'https://api.github.com';

const gh = async (url) => {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
  if (!r.ok) throw new Error(`REST ${r.status} ${url}: ${await r.text()}`);
  return r.json();
};
const gql = async (query) => {
  const r = await fetch(`${GITHUB_API}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await r.json();
  if (d.errors?.length) throw new Error(`GQL: ${d.errors[0].message}`);
  return d.data;
};

// Repos via the *settled* wide window (reliable), then REST commits per repo.
const repoData = await gql(`{ viewer { contributionsCollection(from: "${SINCE}") {
  commitContributionsByRepository(maxRepositories: 50) { repository { nameWithOwner } } } } }`);
const repos = repoData.viewer.contributionsCollection.commitContributionsByRepository.map((r) => r.repository.nameWithOwner);

const rows = [];
for (const repo of repos) {
  const commits = await gh(`${GITHUB_API}/repos/${repo}/commits?author=${USERNAME}&since=${SINCE}&per_page=100`);
  for (const c of commits) {
    rows.push({
      source_id: c.sha,
      event_type: 'github.commit.pushed',
      occurred_at: c.commit.author.date,
      payload: { sha: c.sha, message: c.commit.message, repo },
    });
  }
}

// Merged PRs + reviews via GraphQL contributions.
const prData = await gql(`{ viewer { contributionsCollection(from: "${SINCE}") {
  pullRequestContributions(first: 100) { nodes { pullRequest {
    number title repository { nameWithOwner } mergedAt createdAt additions deletions changedFiles } } }
  pullRequestReviewContributions(first: 100) { nodes { pullRequestReview {
    databaseId state body createdAt pullRequest { number repository { nameWithOwner } } } } } } } }`);

for (const n of prData.viewer.contributionsCollection.pullRequestContributions.nodes) {
  const pr = n.pullRequest;
  if (!pr.mergedAt) continue;
  rows.push({
    source_id: `${pr.repository.nameWithOwner}#${pr.number}`,
    event_type: 'github.pr.merged',
    occurred_at: pr.mergedAt,
    payload: { number: pr.number, title: pr.title, repo: pr.repository.nameWithOwner, state: 'closed',
      merged_at: pr.mergedAt, created_at: pr.createdAt, additions: pr.additions, deletions: pr.deletions, changed_files: pr.changedFiles },
  });
}
for (const n of prData.viewer.contributionsCollection.pullRequestReviewContributions.nodes) {
  const rv = n.pullRequestReview;
  rows.push({
    source_id: `${rv.pullRequest.repository.nameWithOwner}#${rv.pullRequest.number}/review/${rv.databaseId}`,
    event_type: 'github.pr.reviewed',
    occurred_at: rv.createdAt,
    payload: { review_id: rv.databaseId, pr_number: rv.pullRequest.number, repo: rv.pullRequest.repository.nameWithOwner, state: rv.state },
  });
}

const esc = (s) => s.replace(/'/g, "''");
const values = rows.map((r) =>
  `('${USER_ID}','github','${esc(r.source_id)}','${r.event_type}','${r.occurred_at}','${esc(JSON.stringify(r.payload))}'::jsonb)`
);
if (!values.length) { console.error('No rows fetched'); process.exit(0); }
console.log(
  `INSERT INTO events (user_id, source, source_id, event_type, occurred_at, payload)\nVALUES\n${values.join(',\n')}\nON CONFLICT (user_id, source, source_id, event_type) DO NOTHING;`
);
console.error(`Generated ${rows.length} candidate rows from ${repos.length} repos: ${repos.join(', ')}`);
