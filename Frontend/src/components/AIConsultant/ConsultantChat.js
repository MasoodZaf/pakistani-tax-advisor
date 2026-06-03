import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, ShieldCheck, ShieldOff, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import aiConsultant from '../../services/aiConsultant';

// Reusable chat UI used by the floating widget, the dedicated page, and the
// inline form helper. Stateless w.r.t. routing — it owns the message thread
// for one conversation only.
//
// Props:
//   conversationId   (string|null) — load history if given; otherwise blank
//   initialMessage   (string) — auto-send on mount (used by field helper)
//   formContext      (object) — current form values to send as grounding
//   taxYear          (number) — for live rate lookup
//   compact          (bool)  — denser layout for floating widget
//   onConversationCreated(id)— callback when first reply comes back
function ConsultantChat({
  conversationId: initialConversationId = null,
  initialMessage = '',
  formContext = null,
  taxYear = null,
  compact = false,
  onConversationCreated,
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [includePII, setIncludePII] = useState(false);
  const scrollRef = useRef(null);
  const didAutoSendRef = useRef(false);

  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingHistory(true);
        const data = await aiConsultant.getConversation(initialConversationId);
        if (cancelled) return;
        setMessages(data.messages || []);
        setIncludePII(!!data.conversation?.include_pii);
      } catch (e) {
        toast.error('Failed to load conversation');
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialConversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: trimmed, _local: true }]);
    setSending(true);
    try {
      const res = await aiConsultant.chat({
        message: trimmed,
        conversationId,
        includePII,
        formContext,
        taxYear,
      });
      if (!conversationId && res.conversationId) {
        setConversationId(res.conversationId);
        onConversationCreated?.(res.conversationId);
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.reply,
          sources: res.sources,
          _local: true,
        },
      ]);
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      const code = e.response?.data?.code;
      toast.error(code === 'AI_NOT_CONFIGURED'
        ? 'AI consultant not configured. Ask admin to set DEEPSEEK_API_KEY.'
        : `AI error: ${msg}`);
      setMessages((m) => [...m, { role: 'assistant', content: `_Error: ${msg}_`, isError: true }]);
    } finally {
      setSending(false);
    }
  };

  // Auto-send if parent provided an initial question (field helper use case).
  useEffect(() => {
    if (initialMessage && !didAutoSendRef.current) {
      didAutoSendRef.current = true;
      send(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={`flex flex-col h-full ${compact ? 'text-sm' : ''}`}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50"
      >
        {loadingHistory && (
          <div className="flex items-center justify-center text-gray-500 py-6">
            <Loader2 className="animate-spin mr-2" size={16} /> Loading conversation…
          </div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div className="text-gray-500 text-center py-6">
            <p className="font-medium text-gray-700 mb-2">Hi — I'm your tax consultant.</p>
            <p>Ask me about Pakistani income tax, FBR rules, slabs for 2025-26,
              withholding tax, or any field on your return.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={m.id || `local-${i}`} message={m} />
        ))}
        {sending && (
          <div className="flex items-center text-gray-500">
            <Loader2 className="animate-spin mr-2" size={14} />
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between px-3 pt-2">
          <button
            type="button"
            onClick={() => setIncludePII((v) => !v)}
            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full border transition ${
              includePII
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-gray-200 bg-gray-50 text-gray-600'
            }`}
            title={
              includePII
                ? 'Sending your full data (CNIC, name, etc.) to DeepSeek'
                : 'PII masked before sending to DeepSeek'
            }
          >
            {includePII ? <ShieldOff size={12} /> : <ShieldCheck size={12} />}
            {includePII ? 'Full data' : 'PII redacted'}
          </button>
          {formContext && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <FileText size={12} /> form context attached
            </span>
          )}
        </div>
        <div className="flex items-end gap-2 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={compact ? 2 : 3}
            placeholder="Ask a tax question…"
            className="flex-1 resize-none border border-gray-300 rounded-brand px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-transparent
                       text-sm"
            disabled={sending}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="bg-lime hover:bg-lime/80 disabled:bg-gray-300
                       text-white rounded-brand p-2 transition"
            aria-label="Send"
          >
            {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-navy text-white rounded-br-sm'
            : message.isError
            ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-sm'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-brand'
        }`}
      >
        <div className="text-sm">{message.content}</div>
        {message.sources?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
            <div className="font-medium mb-0.5">Sources:</div>
            <ul className="space-y-0.5">
              {message.sources.map((s, i) => (
                <li key={i}>• {s.title || s.source}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConsultantChat;
