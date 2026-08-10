import { useEffect, useRef, useState } from "react";
import { Bot, Database, MessageCircle, Send, X } from "lucide-react";
import { recordAiLog } from "../services/adminActivityService";
import { askAIAssistant } from "../services/aiAssistantService";
import TypingIndicator from "./TypingIndicator";

const AIWidget = () => {
  const aiAssistantActions = [
    { id: 1, action: "How many total residents, male, female, seniors, and PWD?" },
    { id: 2, action: "Summarize residents by purok, status, and age group" },
    { id: 3, action: "Show pending document requests" },
    { id: 4, action: "What records need admin attention today?" },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Good day, Admin! I can answer using your resident, archive, document request, document template, user profile, and notification data.",
      sender: "ai",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isOpen, loading, messages]);

  const addMessage = (message) => {
    setMessages((prev) => [...prev, message]);
  };

  const sendQuery = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextId = messages.length + 1;
    addMessage({ id: nextId, text: trimmed, sender: "user" });

    const processingId = nextId + 1;
    addMessage({
      id: processingId,
      text: "",
      sender: "ai",
      isTyping: true,
    });

    setLoading(true);
    setInput("");

    try {
      const response = await askAIAssistant(trimmed);
      recordAiLog({
        question: trimmed,
        answer: response,
        status: "success",
      });
      setMessages((prev) =>
        prev.map((message) =>
          message.id === processingId
            ? { ...message, text: response, isTyping: false }
            : message
        )
      );
    } catch (error) {
      const errorMessage = error.message || "Unable to get a response.";
      recordAiLog({
        question: trimmed,
        answer: errorMessage,
        status: "error",
      });
      setMessages((prev) =>
        prev.map((message) =>
          message.id === processingId
            ? {
                ...message,
                text: `Sorry, I couldn't get a response right now. ${errorMessage}`,
                isTyping: false,
              }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    sendQuery(input);
  };

  const handleActionClick = (action) => {
    sendQuery(action);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-xl shadow-blue-900/24 ring-4 ring-cyan-100/80 transition hover:-translate-y-0.5 hover:shadow-2xl sm:bottom-6 sm:right-6"
          aria-label="Open AI assistant"
        >
          <MessageCircle size={22} />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-x-3 bottom-3 z-50 flex h-[min(560px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-lg border border-cyan-100/80 bg-white/92 shadow-2xl shadow-blue-950/18 backdrop-blur-xl sm:bottom-6 sm:left-auto sm:right-6 sm:h-[min(620px,calc(100dvh-3rem))] sm:w-[380px] md:w-[410px]">
          <div className="flex items-center justify-between bg-[linear-gradient(135deg,#10213f,#1f63ca_58%,#21c7df)] px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/18">
                <Bot size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">KaagapAI Assistant</p>
                <p className="truncate text-xs text-blue-100">Admin data chatbot</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1.5 transition hover:bg-white/10"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-blue-50/40 p-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] rounded-lg px-3 py-2 text-sm leading-5 shadow-sm ${
                    message.sender === "user"
                      ? "bg-[#1f63ca] text-white shadow-blue-900/12"
                      : "border border-slate-200/70 bg-white/86 text-slate-800"
                  } whitespace-pre-line`}
                >
                  {message.isTyping ? <TypingIndicator className="px-1 py-1" /> : message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && (
            <div className="max-h-[34vh] shrink-0 space-y-2 overflow-y-auto border-t border-slate-100 bg-slate-50/90 px-3 py-3">
              {aiAssistantActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action.action)}
                  className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white/92 px-3 py-2 text-left text-xs font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-blue-50"
                >
                  <Database size={14} className="flex-shrink-0" />
                  {action.action}
                </button>
              ))}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white/92 px-3 py-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type a message..."
              disabled={loading}
              className="hd-focus min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              onClick={handleSendMessage}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIWidget;
