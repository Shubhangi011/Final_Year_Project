import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { SupportedLanguage } from '../utils/i18n';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'worker' | 'employer' | 'admin';
  city: string;
  preferredLanguage: SupportedLanguage;
  isDemo?: boolean;
}

export interface ToastItem {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: Record<string, any>) => Promise<AuthUser>;
  logout: () => void;
  notifications: any[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  liveMessages: any[];
  refreshMessages: () => Promise<void>;
  sendMessage: (receiverId: string, receiverName: string, content: string) => Promise<void>;
  notify: (title: string, type?: 'success' | 'error' | 'info') => void;
  wsConnected: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = window.sessionStorage.getItem('ks_ui_lang');
    return saved === 'mr' || saved === 'hi' || saved === 'en' ? saved : 'en';
  });

  const setLanguage = (lang: SupportedLanguage) => {
    window.sessionStorage.setItem('ks_ui_lang', lang);
    setLanguageState(lang);
  };
  const [notifications, setNotifications] = useState<any[]>([]);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const notify = (title: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const refreshNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
    } catch {
      // ignore if logged out
    }
  };

  const refreshMessages = async () => {
    try {
      const { data } = await api.get('/messages');
      setLiveMessages(data.messages || []);
    } catch {
      // ignore
    }
  };

  const markNotificationRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
  };

  const sendMessage = async (receiverId: string, receiverName: string, content: string) => {
    const { data } = await api.post('/messages', { receiverId, receiverName, content });
    setLiveMessages((prev) => {
      if (prev.some((m) => m._id === data.message._id)) return prev;
      return [...prev, data.message];
    });
  };

  useEffect(() => {
    const token = window.sessionStorage.getItem('ks_auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
      })
      .catch(() => {
        window.sessionStorage.removeItem('ks_auth_token');
      })
      .finally(() => setLoading(false));
  }, []);

  // Connect real-time WebSocket whenever user session is active
  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    refreshNotifications();
    refreshMessages();

    const token = window.sessionStorage.getItem('ks_auth_token');
    if (!token) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => setWsConnected(true);
    socket.onclose = () => setWsConnected(false);
    socket.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'notification:new' && msg.payload) {
          setNotifications((prev) => {
            if (prev.some((n) => n._id === msg.payload._id)) return prev;
            return [msg.payload, ...prev];
          });
          notify(msg.payload.title, 'info');
        }
        if (msg.event === 'message:new' && msg.payload) {
          setLiveMessages((prev) => {
            if (prev.some((m) => m._id === msg.payload._id)) return prev;
            return [...prev, msg.payload];
          });
        }
      } catch {
        // ignore malformed frame
      }
    };

    return () => {
      socket.close();
    };
  }, [user?._id]);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const { data } = await api.post('/auth/login', { email, password });
    window.sessionStorage.setItem('ks_auth_token', data.token);
    setUser(data.user);
    notify(`Welcome back, ${data.user.name}`, 'success');
    return data.user;
  };

  const register = async (payload: Record<string, any>): Promise<AuthUser> => {
    const { data } = await api.post('/auth/register', payload);
    window.sessionStorage.setItem('ks_auth_token', data.token);
    setUser(data.user);
    notify(`Account created for ${data.user.name}`, 'success');
    return data.user;
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    window.sessionStorage.removeItem('ks_auth_token');
    setUser(null);
    setNotifications([]);
    setLiveMessages([]);
    notify('Signed out cleanly', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        language,
        setLanguage,
        login,
        register,
        logout,
        notifications,
        refreshNotifications,
        markNotificationRead,
        liveMessages,
        refreshMessages,
        sendMessage,
        notify,
        wsConnected,
      }}
    >
      {children}
      {/* Non-intrusive Toast Feedback Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg border shadow-sm text-sm font-medium transition-opacity duration-150 ${
              item.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : item.type === 'success'
                ? 'bg-teal-50 border-teal-200 text-teal-950'
                : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {item.title}
          </div>
        ))}
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

