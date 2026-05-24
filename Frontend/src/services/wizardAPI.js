// Small typed wrapper around /api/wizard/*. Used by the Wizard page
// and the dashboard CTA / Settings re-trigger. Axios is already
// pre-configured with the auth bearer in AuthContext's interceptor.

import axios from 'axios';

export const wizardAPI = {
  status: async (taxYear) => {
    const r = await axios.get('/api/wizard/status', {
      params: taxYear ? { taxYear } : undefined,
    });
    return r.data;
  },

  start: async ({ taxYear, force } = {}) => {
    const r = await axios.post('/api/wizard/start', { taxYear, force });
    return r.data;
  },

  // turn() accepts structured values, an LLM-extractable raw_reply, or both.
  // Structured values win on conflict (the backend enforces this too).
  turn: async ({ sessionId, stepId, values, rawReply }) => {
    const r = await axios.post('/api/wizard/turn', {
      session_id: sessionId,
      step_id: stepId,
      values: values || undefined,
      raw_reply: rawReply || undefined,
    });
    return r.data;
  },

  finalize: async ({ sessionId }) => {
    const r = await axios.post('/api/wizard/finalize', { session_id: sessionId });
    return r.data;
  },

  // reset() returns the prior session's captured_data so the next /start
  // can pre-fill from it (the "re-run with my old answers as defaults"
  // flow). The Wizard component handles the pre-fill by writing the seed
  // into each step's `values` on mount.
  reset: async ({ taxYear } = {}) => {
    const r = await axios.post('/api/wizard/reset', { taxYear });
    return r.data;
  },
};
