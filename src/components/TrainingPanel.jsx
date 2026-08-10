import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, Briefcase, Database, Megaphone } from "lucide-react";
import { fetchKnowledgeItems } from "../services/knowledgeService";

const sourceIcons = {
  announcement: <Megaphone size={15} />,
  livelihood: <Briefcase size={15} />,
  manual: <BrainCircuit size={15} />,
};

const TrainingPanel = () => {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadKnowledge = async () => {
      try {
        const data = await fetchKnowledgeItems({ limit: 6 });
        if (isMounted) {
          setItems(data);
          setError("");
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || "Unable to load resident knowledge.");
          setItems([]);
        }
      }
    };

    loadKnowledge();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeCount = useMemo(
    () => items.filter((item) => item.status === "Active").length,
    [items]
  );

  return (
    <section className="blue-glass-surface overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/45 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-[#10213f]">AI Knowledge Trainer</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">{activeCount} active resident-facing item(s)</p>
        </div>
        <Link className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-800" to="/ai-knowledge">
          Open
        </Link>
      </div>

      <div className="divide-y divide-slate-100 px-5">
        {error ? (
          <div className="py-5 text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No resident knowledge saved yet.
          </div>
        ) : (
          items.slice(0, 4).map((item) => (
            <div key={item.id} className="flex items-start gap-3 py-4 transition hover:bg-blue-50/25">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-700 ring-1 ring-blue-100">
                {sourceIcons[item.source_type] || <Database size={15} />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-[#10213f]">{item.title}</h3>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default TrainingPanel;
