// Mobile-side wrapper around /api/wizard/*. The shared axios instance
// already attaches the bearer token from SecureStore + the X-App-Version
// header — same as the web client's interceptors but native side.

import api from './api';

export const wizardAPI = {
  status: async (taxYear) => {
    const r = await api.get('/wizard/status', {
      params: taxYear ? { taxYear } : undefined,
    });
    return r.data;
  },

  start: async ({ taxYear, force } = {}) => {
    const r = await api.post('/wizard/start', { taxYear, force });
    return r.data;
  },

  // turn() accepts structured values, an LLM-extractable raw_reply, or both.
  // Structured wins on conflict (matches backend behavior).
  turn: async ({ sessionId, stepId, values, rawReply }) => {
    const r = await api.post('/wizard/turn', {
      session_id: sessionId,
      step_id: stepId,
      values: values || undefined,
      raw_reply: rawReply || undefined,
    });
    return r.data;
  },

  finalize: async ({ sessionId }) => {
    const r = await api.post('/wizard/finalize', { session_id: sessionId });
    return r.data;
  },

  // reset() returns the prior session's captured_data so the next /start
  // can pre-fill from it. The WizardScreen handles the pre-fill by writing
  // the seed into each step's values on mount.
  reset: async ({ taxYear } = {}) => {
    const r = await api.post('/wizard/reset', { taxYear });
    return r.data;
  },
};
