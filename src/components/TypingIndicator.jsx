const TypingIndicator = ({ className = "" }) => (
  <div
    className={`flex items-center gap-1 text-slate-400 ${className}`}
    role="status"
    aria-label="AI assistant is typing"
  >
    {[0, 1, 2].map((dot) => (
      <span
        key={dot}
        className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
        style={{ animationDelay: `${dot * 120}ms` }}
      />
    ))}
  </div>
);

export default TypingIndicator;
