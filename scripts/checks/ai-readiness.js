/**
 * checks/ai-readiness.js
 *
 * Audits two AI discoverability signals at the domain root:
 *
 *   1. llms.txt — a markdown file at <origin>/llms.txt that tells LLMs
 *      what the site is about and what content to index. Proposed standard
 *      by Answer.ai / Jeremy Howard, adopted by a growing number of sites.
 *
 *   2. robots.txt AI crawler policy — checks whether the site has explicit
 *      rules for the major AI user-agents. Absence of a policy means the
 *      site has no conscious stance on AI training/crawling.
 *      Note: blocking is not flagged as an error — it is a valid choice.
 *      Only the absence of any policy is flagged.
 *
 * Both resources are fetched via the /proxy endpoint.
 */

import { fetchRaw } from '../lib/fetch.js';

/** AI crawler user-agents to look for in robots.txt */
const AI_AGENTS = [
  'GPTBot', // OpenAI
  'ChatGPT-User', // OpenAI (browsing)
  'anthropic-ai', // Anthropic
  'ClaudeBot', // Anthropic
  'Google-Extended', // Google AI training
  'PerplexityBot', // Perplexity
  'Meta-ExternalAgent', // Meta
  'Bytespider', // ByteDance / TikTok
];

/**
 * @param {string} url
 * @returns {Promise<{id: string, label: string, status: 'pass'|'warn'|'fail', findings: string[]}>}
 */
export async function run(url) {
  const origin = new URL(url).origin;
  const findings = [];

  // Run both fetches in parallel
  const [llmsResult, robotsResult] = await Promise.allSettled([
    fetchRaw(`${origin}/llms.txt`),
    fetchRaw(`${origin}/robots.txt`),
  ]);

  // 1. llms.txt
  if (llmsResult.status === 'rejected' || !llmsResult.value.ok) {
    findings.push(
      "No llms.txt found at domain root — add one to give LLMs a structured summary of your site's content and purpose.",
    );
  } else if (!llmsResult.value.body.trim()) {
    findings.push(
      'llms.txt exists but is empty — populate it with a description of your site and links to key content.',
    );
  }

  // 2. robots.txt AI crawler policy
  if (robotsResult.status === 'rejected' || !robotsResult.value.ok) {
    findings.push(
      'No robots.txt found — add one with explicit rules for AI crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot).',
    );
  } else {
    const robotsBody = robotsResult.value.body;
    const mentionedAgents = AI_AGENTS.filter((agent) => new RegExp(`^User-agent:\\s*${agent}`, 'im').test(robotsBody));

    if (mentionedAgents.length === 0) {
      findings.push(
        `robots.txt has no explicit policy for any AI crawler — add User-agent rules for: ${AI_AGENTS.slice(0, 4).join(', ')}, and others.`,
      );
    } else {
      // Surface which agents are covered and their stance (blocked vs allowed)
      const blocked = mentionedAgents.filter((agent) => isBlocked(robotsBody, agent));
      const allowed = mentionedAgents.filter((agent) => !isBlocked(robotsBody, agent));
      const uncovered = AI_AGENTS.filter((a) => !mentionedAgents.includes(a));

      if (uncovered.length > 0) {
        findings.push(
          `robots.txt covers ${mentionedAgents.length}/${AI_AGENTS.length} AI crawlers (${mentionedAgents.join(', ')}). No explicit rule for: ${uncovered.join(', ')}.`,
        );
      }

      // Informational: surface the policy stance (not a fail either way)
      if (blocked.length > 0) {
        findings.push(
          `AI crawlers explicitly blocked: ${blocked.join(', ')} — intentional, but these agents won't index or cite your content.`,
        );
      }
      if (allowed.length > 0 && blocked.length > 0) {
        findings.push(`AI crawlers explicitly allowed: ${allowed.join(', ')}.`);
      }
    }
  }

  const status = findings.length > 0 ? 'warn' : 'pass';
  return result(status, findings);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a given user-agent is blocked in the robots.txt content.
 * Looks for a Disallow: / rule in the block following the User-agent match.
 */
function isBlocked(robotsBody, agent) {
  const lines = robotsBody.split(/\r?\n/);
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^User-agent:/i.test(trimmed)) {
      inBlock = trimmed.toLowerCase().includes(agent.toLowerCase());
    }
    if (inBlock && /^Disallow:\s*\//i.test(trimmed)) return true;
    if (inBlock && /^Allow:\s*\//i.test(trimmed)) return false;
  }
  return false;
}

const CHECKS = [
  'llms.txt present and non-empty at domain root',
  'robots.txt has explicit User-agent rules for major AI crawlers',
];

function result(status, findings) {
  return { id: 'ai-readiness', label: 'AI Readiness', status, findings, checks: CHECKS };
}
