import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, X, Check, Clock, AlertTriangle, FileText, Shield } from 'lucide-react';
import { notificationApi } from '../api';

export default function NotificationCenterModal({ isOpen, onClose, onRefreshCount }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      setNotifications(res || []);
      if (onRefreshCount) onRefreshCount();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      await loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      await loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const filtered = notifications.filter(n => filter === 'ALL' || (filter === 'UNREAD' && !n.is_read));
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-[#DCE3EA]">
        
        {/* Header */}
        <div className="p-4 bg-[#12345A] text-white rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#F2A900]" />
            <h3 className="text-sm font-bold">AICTE Official Notifications & Alerts</h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex border-b border-slate-200 px-4 py-2 bg-slate-50 text-xs gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
              filter === 'ALL' ? 'bg-[#12345A] text-white' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('UNREAD')}
            className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
              filter === 'UNREAD' ? 'bg-[#12345A] text-white' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading notifications...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No notifications to display.</div>
          ) : (
            filtered.map(notif => (
              <div
                key={notif.id}
                className={`p-3 rounded-lg border transition ${
                  notif.is_read
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-blue-50/60 border-blue-200 text-slate-900 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#12345A]">
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                    <span>{notif.title}</span>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="text-[10px] text-blue-700 hover:underline shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {notif.message}
                </p>
                <div className="text-[9px] text-slate-400 mt-2 flex items-center justify-between">
                  <span>Type: {notif.type || 'STATUTORY_ALERT'}</span>
                  <span>{new Date(notif.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded text-xs font-semibold hover:bg-slate-300"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
