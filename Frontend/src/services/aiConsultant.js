import axios from 'axios';

const BASE = '/api/ai-consultant';

const aiConsultant = {
  async status() {
    const r = await axios.get(`${BASE}/status`);
    return r.data;
  },

  async chat({ message, conversationId, includePII, formContext, taxYear }) {
    const r = await axios.post(`${BASE}/chat`, {
      message, conversationId, includePII, formContext, taxYear,
    });
    return r.data;
  },

  async fieldHelp({ fieldName, formStep, currentValue, includePII, formContext, taxYear }) {
    const r = await axios.post(`${BASE}/field-help`, {
      fieldName, formStep, currentValue, includePII, formContext, taxYear,
    });
    return r.data;
  },

  async listConversations() {
    const r = await axios.get(`${BASE}/conversations`);
    return r.data;
  },

  async getConversation(id) {
    const r = await axios.get(`${BASE}/conversations/${id}`);
    return r.data;
  },

  async deleteConversation(id) {
    const r = await axios.delete(`${BASE}/conversations/${id}`);
    return r.data;
  },

  // Admin only
  async reloadKnowledgeBase() {
    const r = await axios.post(`${BASE}/knowledge-base/reload`);
    return r.data;
  },

  // Admin only — `files` is a FileList or array of File objects.
  async uploadKnowledgeBase(files) {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    const r = await axios.post(`${BASE}/knowledge-base/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },
};

export default aiConsultant;
