import React, { useEffect, useState } from 'react';
import { MessageCircle, X, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import aiConsultant from '../../services/aiConsultant';
import ConsultantChat from './ConsultantChat';

// Bottom-right chat bubble. Renders only for authenticated, non-admin users
// when DEEPSEEK_API_KEY is configured on the server.
function FloatingChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(null); // null=unknown, false=disabled
  const [conversationId, setConversationId] = useState(null);

  useEffect(() => {
    if (!user || ['admin', 'super_admin'].includes(user.role)) return;
    aiConsultant.status()
      .then((r) => setConfigured(!!r.configured))
      .catch(() => setConfigured(false));
  }, [user]);

  if (!user) return null;
  if (['admin', 'super_admin'].includes(user.role)) return null;
  if (configured === false) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-[380px] h-[560px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]
                        bg-white rounded-2xl shadow-2xl border border-gray-200
                        flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} />
              <span className="font-medium">Tax Consultant</span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/consultant"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-primary-700 transition"
                title="Open full page"
              >
                <Maximize2 size={16} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-primary-700 transition"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ConsultantChat
              conversationId={conversationId}
              onConversationCreated={setConversationId}
              compact
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-full
                     w-14 h-14 shadow-lg flex items-center justify-center
                     transition transform hover:scale-105"
          aria-label="Open tax consultant"
          title="Ask the tax consultant"
        >
          <MessageCircle size={26} />
        </button>
      )}
    </div>
  );
}

export default FloatingChatWidget;
