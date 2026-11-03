import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../utils/i18n';

export function Navbar() {
  const { user, language } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const dashboardRoute =
    user?.role === 'admin'
      ? '/dashboard/admin'
      : user?.role === 'employer'
      ? '/dashboard/employer'
      : '/dashboard/worker';

  const navItems = [
    { to: '/jobs', label: t(language, 'navFindJobs') },
    { to: '/workers', label: t(language, 'navDiscoverWorkers') },
    { to: '/map', label: t(language, 'navSkillMap') },
    { to: '/learning', label: t(language, 'navLearning') },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single clean wordmark */}
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
        >
          KaushalSetu
        </Link>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
                  active
                    ? 'text-slate-950 border-teal-600'
                    : 'border-transparent hover:text-slate-950 hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              onClick={() => navigate(dashboardRoute)}
              className="px-4 py-2 text-sm font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t(language, 'navWorkspace')}
            </button>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 text-sm font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t(language, 'navSignIn')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
