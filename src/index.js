/**
 * LEARN: This is the entry point. GitHub Actions runs this file directly.
 * Think of it like the "main" function in Java or C++.
 *
 * The pattern here — one function that calls other modules in sequence
 * wrapped in try/catch — is called the "orchestrator pattern". Each
 * module (github.js, gemini.js, prompts.js) does ONE thing well.
 * index.js just coordinates them.
 *
 * This makes the code:
 * - Easier to test (you can test each module independently)
 * - Easier to debug (errors point to a specific module)
 * - Easier to extend (add a new step by adding a module + one line here)
 */

const core = require('@actions/core');
const { getPRDiff, postReviewComment, getPRContext } = require('./github');
const { getCodeReview } = require('./gemini');
const { buildReviewPrompt, formatReviewComment } = require('./prompts');

async function run() {
  try {
    // STEP 1: Get the PR diff from GitHub
    // LEARN: We call getPRContext() here separately so we can pass it
    // to formatReviewComment() later for the PR number in the footer.
    const prContext = getPRContext();
    core.info(`Reviewing PR #${prContext.pull_number}...`);

    const diff = await getPRDiff();

    // STEP 2: Build the prompt and send to Gemini
    // LEARN: We separate prompt building from the API call so we can
    // easily swap out the prompt template without touching the API logic.
    const prompt = buildReviewPrompt(diff, prContext);
    const review = await getCodeReview(prompt);

    // STEP 3: Format the review as Markdown and post it to the PR
    const comment = formatReviewComment(review, prContext);
    await postReviewComment(comment);

    // LEARN: core.setOutput() lets other steps in the workflow
    // read values from this step. Not strictly needed here but
    // useful if you want to chain this with other actions.
    core.setOutput('score', review.score);
    core.setOutput('issues_count', review.issues.length);

    core.info(`✅ Review posted successfully! Score: ${review.score}/10`);

  } catch (error) {
    // LEARN: core.setFailed() does two things:
    // 1. Sets the Action's exit code to 1 (failure)
    // 2. Logs the error message in the GitHub Actions UI
    // Without this, the Action might silently succeed even if something went wrong.
    core.setFailed(`AI Code Review failed: ${error.message}`);
  }
}

// LEARN: Calling run() at the bottom starts execution.
// The async/await pattern means the function returns a Promise,
// so we don't need to do anything with the return value.
run();
