const { GoogleGenerativeAI } = require('@google/generative-ai');
const core = require('@actions/core');

/**
 * LEARN: The Gemini SDK requires an API key to authenticate.
 * We read it from the Action's input (defined in action.yml),
 * which the user sets as a GitHub Secret in their repo settings.
 *
 * NEVER hardcode API keys. GitHub Secrets are encrypted and only
 * exposed to the Action at runtime — they never appear in logs.
 */
function getGeminiModel() {
  const apiKey = core.getInput('gemini-api-key') || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const genAI = new GoogleGenerativeAI(apiKey);

  // LEARN: gemini-1.5-flash is fast and cheap, ideal for automation.
  // gemini-1.5-pro is more capable but slower and more expensive.
  // For code review running on every PR, flash is the right choice.
  // LEARN: The second argument { apiVersion: 'v1' } forces the SDK to use
  // the stable v1 endpoint instead of the default v1beta. Google has been
  // deprecating models on v1beta, so explicitly using v1 is more future-proof.
  return genAI.getGenerativeModel(
    {
      model: 'gemini-1.5-flash',
      generationConfig: {
        // LEARN: temperature controls randomness.
        // 0.0 = fully deterministic (same input → same output, good for code analysis)
        // 1.0 = very creative/random (good for creative writing)
        // For code review we want consistent, analytical responses → low temperature
        temperature: 0.2,

        // LEARN: maxOutputTokens caps the response length.
        // 1 token ≈ 4 characters. 2048 tokens ≈ ~8000 chars of review text.
        maxOutputTokens: 2048,
      },
    },
    { apiVersion: 'v1' }
  );
}

/**
 * Sends the prompt to Gemini and returns the parsed JSON review object.
 *
 * LEARN: LLMs return raw text. When we ask for JSON, we have to parse it
 * ourselves. The tricky part: the model sometimes wraps JSON in markdown
 * code fences (```json ... ```) even when told not to. We handle this
 * with a cleanup step before parsing.
 *
 * @param {string} prompt - The full prompt string from prompts.js
 * @returns {Object} Parsed review object { summary, score, positives, issues }
 */
async function getCodeReview(prompt) {
  const model = getGeminiModel();

  core.info('Sending diff to Gemini for review...');

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    throw new Error(`Gemini API call failed: ${err.message}`);
  }

  // Extract the raw text from the response
  // LEARN: Gemini wraps the response in a nested object.
  // result.response.text() is the helper method to get the plain string.
  const rawText = result.response.text();
  core.debug(`Raw Gemini response: ${rawText}`);

  // Clean up any accidental markdown code fences the model may add
  // LEARN: This is a common defensive pattern when working with LLM outputs.
  // Even well-prompted models occasionally add formatting you didn't ask for.
  const cleaned = rawText
    .replace(/^```json\s*/i, '')  // remove opening ```json
    .replace(/^```\s*/i, '')       // remove opening ```
    .replace(/\s*```$/i, '')       // remove closing ```
    .trim();

  let review;
  try {
    review = JSON.parse(cleaned);
  } catch (err) {
    // If JSON parsing fails, log the raw response to help debug
    core.error(`Failed to parse Gemini response as JSON. Raw text:\n${rawText}`);
    throw new Error(`Gemini returned invalid JSON: ${err.message}`);
  }

  // Validate the response has the fields we need
  // LEARN: Always validate external data (including LLM responses).
  // The model might return a valid JSON object but with the wrong shape.
  if (!review.summary || review.score === undefined || !Array.isArray(review.issues)) {
    throw new Error('Gemini response is missing required fields (summary, score, issues).');
  }

  core.info(`Review complete. Score: ${review.score}/10, Issues: ${review.issues.length}`);
  return review;
}

module.exports = { getCodeReview };
