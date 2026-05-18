// AI Tax Consultant orchestration.
//
// One function per surface (chat, fieldHelp) that:
//   1. Pulls or creates the conversation row.
//   2. Builds a grounded system prompt = persona + retrieved KB chunks +
//      live tax slabs (+ optional user form context).
//   3. Loads prior turns so the model has memory of the session.
//   4. Calls DeepSeek, persists both the user message and the reply.
//
// "Continuous learning" with a hosted API means cross-session memory via
// conversation persistence + always-fresh KB / DB context — not fine-tuning.

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const kb = require('./knowledgeBase');
const { chat: deepseekChat } = require('./deepseekClient');
const { redactText, redactObject } = require('./piiRedactor');

const MAX_HISTORY_TURNS = 12;        // last N (user, assistant) pairs
const MAX_KB_CHUNKS = 5;

const SYSTEM_PERSONA = `You are an expert Pakistani tax consultant embedded inside the Pakistan Tax App (FBR / IRIS compliant for tax year 2025-26, Finance Act 2025).

Your job:
- Help individual salaried and non-salaried taxpayers understand and complete their income tax return.
- Explain fields clearly (what to enter, where the number comes from on a salary slip / withholding certificate / bank statement).
- Quote Pakistani tax rules accurately, citing the Income Tax Ordinance section, Finance Act clause, or FBR circular when relevant.
- Use only the rates / slabs / thresholds provided in the LIVE TAX DATA section below — they are authoritative for the current tax year. Never invent numbers.
- When asked about a specific user's situation, reason step by step and show the math.
- If the user's question is outside Pakistani income tax (criminal law, medical advice, etc.), say so politely and decline.
- If the knowledge you need is not in the context provided, say "I don't have that in my reference materials — please verify with FBR" rather than guessing.
- Respond in the same language the user wrote in (English or Urdu). Keep answers concise unless the user asks for detail.`;

function formatKbContext(retrievedChunks) {
  if (!retrievedChunks?.length) return '';
  const blocks = retrievedChunks.map((c, i) =>
    `[#${i + 1}] (${c.source}${c.title && c.title !== c.source ? ` — ${c.title}` : ''})\n${c.text}`
  );
  return `KNOWLEDGE BASE EXCERPTS (use these to ground your answer; cite by [#N] when relevant):\n\n${blocks.join('\n\n---\n\n')}`;
}

function formatLiveRates(live) {
  if (!live) return '';
  const lines = [`LIVE TAX DATA (tax year ${live.taxYear}) — these are the AUTHORITATIVE current rates. Use these, never quote any other numbers:`];
  if (live.slabs?.length) {
    // Group by slab_type (individual / aop / etc.) so the model can see them
    // separately rather than as one undifferentiated list.
    const byType = new Map();
    for (const s of live.slabs) {
      if (!byType.has(s.type)) byType.set(s.type, []);
      byType.get(s.type).push(s);
    }
    for (const [type, slabs] of byType) {
      lines.push(`\nSlabs (${type}):`);
      for (const s of slabs) {
        const upper = s.maxIncome == null ? 'and above' : `to PKR ${s.maxIncome.toLocaleString()}`;
        const fixed = s.fixedAmount ? `, plus fixed PKR ${s.fixedAmount.toLocaleString()}` : '';
        lines.push(`  - ${s.name}: PKR ${s.minIncome.toLocaleString()} ${upper} → ${s.ratePercent}%${fixed}`);
      }
    }
  }
  return lines.join('\n');
}

function buildSystemPrompt({ retrievedChunks, live, formContext, includePII }) {
  const parts = [SYSTEM_PERSONA];
  const liveStr = formatLiveRates(live);
  if (liveStr) parts.push(liveStr);
  const kbStr = formatKbContext(retrievedChunks);
  if (kbStr) parts.push(kbStr);
  if (formContext) {
    const ctx = includePII ? formContext : redactObject(formContext);
    parts.push(`USER FORM CONTEXT (what they have entered so far):\n${JSON.stringify(ctx, null, 2)}`);
  }
  parts.push(`Privacy mode: ${includePII ? 'FULL (PII visible)' : 'REDACTED (placeholders only)'}`);
  return parts.join('\n\n');
}

async function getOrCreateConversation({ userId, conversationId, includePII, titleHint }) {
  if (conversationId) {
    const r = await pool.query(
      `SELECT id, user_id, title, include_pii FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    if (r.rows.length === 0) {
      const err = new Error('Conversation not found');
      err.status = 404;
      throw err;
    }
    if (typeof includePII === 'boolean' && includePII !== r.rows[0].include_pii) {
      await pool.query(`UPDATE ai_conversations SET include_pii = $1 WHERE id = $2`, [includePII, conversationId]);
    }
    return { ...r.rows[0], include_pii: includePII ?? r.rows[0].include_pii };
  }
  const title = (titleHint || 'New conversation').slice(0, 120);
  const r = await pool.query(
    `INSERT INTO ai_conversations (user_id, title, include_pii)
     VALUES ($1, $2, $3) RETURNING id, user_id, title, include_pii`,
    [userId, title, !!includePII]
  );
  return r.rows[0];
}

async function loadHistory(conversationId, limit = MAX_HISTORY_TURNS * 2) {
  const r = await pool.query(
    `SELECT role, content FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [conversationId, limit]
  );
  return r.rows.reverse();
}

async function saveMessage({ conversationId, role, content, tokensPrompt, tokensOutput, model, metadata }) {
  const r = await pool.query(
    `INSERT INTO ai_messages (conversation_id, role, content, tokens_prompt, tokens_output, model, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, role, content, created_at`,
    [conversationId, role, content, tokensPrompt, tokensOutput, model, metadata ? JSON.stringify(metadata) : null]
  );
  return r.rows[0];
}

async function chat({ userId, conversationId, message, includePII = false, formContext, taxYear }) {
  if (!message || typeof message !== 'string') {
    const err = new Error('Message is required'); err.status = 400; throw err;
  }
  const convo = await getOrCreateConversation({
    userId,
    conversationId,
    includePII,
    titleHint: message.slice(0, 80),
  });

  const userVisibleMessage = message;                       // store original for the user
  const messageForModel = includePII ? message : redactText(message);

  const [retrievedChunks, live] = await Promise.all([
    Promise.resolve(kb.retrieve(message, MAX_KB_CHUNKS)),
    kb.getLiveTaxRates(taxYear),
  ]);

  const systemPrompt = buildSystemPrompt({
    retrievedChunks,
    live,
    formContext,
    includePII,
  });

  const history = await loadHistory(convo.id);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: messageForModel },
  ];

  const response = await deepseekChat({ messages });

  // Persist BOTH messages — store the user's original text (not redacted)
  // because it's their own data on their own row; redact only what goes
  // off-server to the LLM.
  await saveMessage({
    conversationId: convo.id,
    role: 'user',
    content: userVisibleMessage,
    metadata: { redactedForModel: !includePII },
  });
  const assistantRow = await saveMessage({
    conversationId: convo.id,
    role: 'assistant',
    content: response.content,
    tokensPrompt: response.tokensPrompt,
    tokensOutput: response.tokensOutput,
    model: response.model,
    metadata: {
      sources: retrievedChunks.map((c) => c.source),
      latencyMs: response.latencyMs,
    },
  });

  logger.info('AI consultant reply', {
    userId,
    convo: convo.id,
    tokens: response.tokensOutput,
    latencyMs: response.latencyMs,
  });

  return {
    conversationId: convo.id,
    reply: response.content,
    sources: retrievedChunks.map((c) => ({ source: c.source, title: c.title })),
    usage: {
      tokensPrompt: response.tokensPrompt,
      tokensOutput: response.tokensOutput,
      latencyMs: response.latencyMs,
    },
    messageId: assistantRow.id,
  };
}

async function fieldHelp({ userId, fieldName, formStep, currentValue, includePII = false, formContext, taxYear }) {
  const q = `In the Pakistan income tax return (FBR / IRIS), explain the field "${fieldName}"${formStep ? ` on the ${formStep} form` : ''}:
- What is it?
- Which Income Tax Ordinance section / Finance Act clause governs it?
- Where does the taxpayer find this number on their documents (salary slip, withholding certificate, bank statement, etc.)?
- What's the rate or treatment for tax year 2025-26?
- Common mistakes to avoid.
Keep it under 200 words. Current value entered: ${currentValue ?? '(blank)'}.`;
  return chat({ userId, message: q, includePII, formContext, taxYear });
}

async function listConversations(userId) {
  const r = await pool.query(
    `SELECT id, title, include_pii, created_at, updated_at,
            (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS message_count
       FROM ai_conversations c
      WHERE user_id = $1 AND archived = FALSE
      ORDER BY updated_at DESC
      LIMIT 100`,
    [userId]
  );
  return r.rows;
}

async function getConversation(userId, conversationId) {
  const c = await pool.query(
    `SELECT id, title, include_pii, created_at, updated_at
       FROM ai_conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  if (c.rows.length === 0) {
    const err = new Error('Conversation not found'); err.status = 404; throw err;
  }
  const m = await pool.query(
    `SELECT id, role, content, created_at, metadata
       FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return { conversation: c.rows[0], messages: m.rows };
}

async function deleteConversation(userId, conversationId) {
  const r = await pool.query(
    `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
    [conversationId, userId]
  );
  if (r.rows.length === 0) {
    const err = new Error('Conversation not found'); err.status = 404; throw err;
  }
  return r.rows[0];
}

module.exports = {
  chat,
  fieldHelp,
  listConversations,
  getConversation,
  deleteConversation,
};
