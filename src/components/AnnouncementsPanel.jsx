import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader, Megaphone } from "lucide-react";
import { fetchPublishedAnnouncements } from "../services/announcementService";

const formatDate = (dateValue) => {
  if (!dateValue) return "Not scheduled";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString();
};

const AnnouncementsPanel = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const data = await fetchPublishedAnnouncements(4);
        setAnnouncements(data);
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load announcements.");
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, []);

  return (
    <section className="blue-glass-surface overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/45 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-[#10213f]">Recent Announcements</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Latest published community updates</p>
        </div>
        <Link className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-800" to="/announcements">
          View All
        </Link>
      </div>

      <div className="divide-y divide-slate-100 px-5">
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            <Loader className="mx-auto mb-2 animate-spin" size={20} />
            Loading announcements...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-rose-600">{error}</div>
        ) : announcements.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            <Megaphone className="mx-auto mb-2 text-slate-300" size={24} />
            No published announcements yet.
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="py-4 transition hover:bg-blue-50/25">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[#10213f]">{announcement.title}</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
                  {announcement.category}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{announcement.body}</p>
              <p className="mt-2 text-xs text-slate-400">Published on {formatDate(announcement.publish_date)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default AnnouncementsPanel;
