import React, { useEffect, useState, useCallback } from 'react';
import { MessageCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import aiConsultant from '../../services/aiConsultant';
import ConsultantChat from './ConsultantChat';

// Full-page consultant: conversation list on the left, active chat on the right.
function ConsultantPage() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await aiConsultant.listConversations();
      setConversations(r.conversations || []);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await aiConsultant.status();
        setConfigured(!!s.configured);
        if (s.configured) await refresh();
      } catch {
        setConfigured(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const onNew = () => setActiveId(null);

  const onDelete = async (id) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await aiConsultant.deleteConversation(id);
      if (activeId === id) setActiveId(null);
      await refresh();
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <MessageCircle className="mx-auto text-gray-300 mb-3" size={48} />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">AI Tax Consultant unavailable</h2>
        <p className="text-gray-500">
          The AI consultant is not configured. A server administrator needs to set the
          <code className="mx-1 px-1 bg-gray-100 rounded text-sm">DEEPSEEK_API_KEY</code>
          environment variable.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white">
      {/* Sidebar */}
      <aside className="w-72 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-3 border-b border-gray-200">
          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 bg-lime hover:bg-lime/80
                       text-white rounded-brand py-2 transition"
          >
            <Plus size={16} /> New conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-sm text-gray-500 text-center p-6">No conversations yet.</p>
          )}
          <ul>
            {conversations.map((c) => (
              <li
                key={c.id}
                className={`group flex items-center justify-between px-3 py-2 cursor-pointer
                            border-b border-gray-100 hover:bg-white ${
                              activeId === c.id ? 'bg-white border-l-2 border-l-navy' : ''
                            }`}
                onClick={() => setActiveId(c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{c.title}</div>
                  <div className="text-[11px] text-gray-500">
                    {new Date(c.updated_at).toLocaleString()} · {c.message_count} msg
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 min-w-0">
        <ConsultantChat
          key={activeId || 'new'}
          conversationId={activeId}
          onConversationCreated={(id) => { setActiveId(id); refresh(); }}
        />
      </main>
    </div>
  );
}

export default ConsultantPage;
