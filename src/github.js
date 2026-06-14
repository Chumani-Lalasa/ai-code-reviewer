const core = require('@actions/core');
const github = require('@actions/github');

/**
 * Creates an authenticated Octokit client using the GITHUB_TOKEN
 * that GitHub automatically provides to every Action run.
 *
 * LEARN: GITHUB_TOKEN is a short-lived token scoped to the repo.
 * It expires when the workflow finishes. Never hardcode a PAT here.
 */
function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set in the environment.');
  return github.getOctokit(token);
}

/**
 * Returns the PR context (owner, repo, pull_number) from the
 * GitHub Actions environment. GitHub injects this automatically.
 *
 * LEARN: github.context.payload contains the full webhook payload
 * that triggered the workflow — same JSON GitHub sends to webhooks.
 */
function getPRContext() {
  const { context } = github;
  const { owner, repo } = context.repo;
  const pull_number = context.payload.pull_request?.number;

  if (!pull_number) {
    throw new Error('This action must be triggered by a pull_request event.');
  }

  return { owner, repo, pull_number };
}

/**
 * Fetches the raw diff of the pull request.
 *
 * LEARN: GitHub's REST API supports different "media types" via the
 * Accept header. Using 'application/vnd.github.v3.diff' tells GitHub
 * to return the patch/diff format instead of JSON.
 *
 * We also trim the diff to ~6000 chars to stay within Gemini's
 * context window limits. Large diffs would need chunking.
 */
async function getPRDiff() {
  const octokit = getOctokit();
  const { owner, repo, pull_number } = getPRContext();

  core.info(`Fetching diff for PR #${pull_number} in ${owner}/${repo}`);

  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: 'diff' },
  });

  // response.data comes back as a string in diff format when mediaType.format is 'diff'
  const diff = String(response.data);

  if (!diff || diff.trim().length === 0) {
    throw new Error('PR diff is empty — nothing to review.');
  }

  core.info(`Diff fetched: ${diff.length} characters`);

  // Trim very large diffs to avoid exceeding Gemini's token limit
  // LEARN: LLMs have a "context window" — max tokens they can process at once.
  // gemini-1.5-flash supports ~1M tokens, but we keep prompts focused and fast.
  const MAX_DIFF_CHARS = 12000;
  if (diff.length > MAX_DIFF_CHARS) {
    core.warning(`Diff is large (${diff.length} chars). Trimming to ${MAX_DIFF_CHARS} chars.`);
    return diff.slice(0, MAX_DIFF_CHARS) + '\n\n[... diff truncated for review ...]';
  }

  return diff;
}

/**
 * Posts the AI review as a comment on the pull request.
 *
 * LEARN: GitHub treats PR comments like issue comments internally.
 * That's why the API method is issues.createComment, not pulls.createComment.
 * This is a quirk of GitHub's API design.
 */
async function postReviewComment(body) {
  const octokit = getOctokit();
  const { owner, repo, pull_number } = getPRContext();

  core.info(`Posting review comment on PR #${pull_number}`);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pull_number, // PR number == issue number in GitHub's API
    body,
  });

  core.info('Review comment posted successfully.');
}

module.exports = { getPRDiff, postReviewComment, getPRContext };
