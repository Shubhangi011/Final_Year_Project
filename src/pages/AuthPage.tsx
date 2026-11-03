import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../services/api';
import { MAHARASHTRA_CITIES, TRADE_CATEGORIES } from '../utils/mediaAssets';

export function AuthPage() {
  const { login, register: registerUser, notify } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<'worker' | 'employer'>('worker');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
      gender: 'Female',
      city: 'Latur',
      category: 'Tailoring, Boutique & Garment Craft',
      organizationName: '',
      preferredLanguage: 'en',
    },
  });

  const routeForRole = (role: string) =>
    role === 'admin' ? '/dashboard/admin' : role === 'employer' ? '/dashboard/employer' : '/dashboard/worker';

  const onSubmit = async (values: any) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const u = await login(values.email, values.password);
        navigate(routeForRole(u.role));
      } else {
        const u = await registerUser({ ...values, role: selectedRole });
        navigate(routeForRole(u.role));
      }
    } catch (err) {
      const msg = extractErrorMessage(err);
      setErrorMsg(msg);
      notify(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const quickDemoLogin = async (email: string, password: string) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      const u = await login(email, password);
      navigate(routeForRole(u.role));
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-50 py-12 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Card */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              Create New Account
            </button>
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold text-slate-950">
            {mode === 'login' ? 'Sign in to KaushalSetu' : 'Join KaushalSetu Digital Employment Ecosystem'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'login'
              ? 'Access your Digital Skill Passport, AI job recommendations, or employer hiring console.'
              : 'Build a verified professional identity or hire trusted skilled workers.'}
          </p>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Account Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('worker')}
                      className={`py-2.5 px-4 rounded-lg border text-sm font-medium text-left transition-colors cursor-pointer ${
                        selectedRole === 'worker'
                          ? 'border-teal-600 bg-teal-50/60 text-slate-950'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">Skilled Worker</div>
                      <div className="text-xs text-slate-500">Find jobs &amp; earn Skill Passport</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('employer')}
                      className={`py-2.5 px-4 rounded-lg border text-sm font-medium text-left transition-colors cursor-pointer ${
                        selectedRole === 'employer'
                          ? 'border-teal-600 bg-teal-50/60 text-slate-950'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">Employer / Customer</div>
                      <div className="text-xs text-slate-500">Post jobs &amp; hire verified trades</div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      {...register('name', { required: mode === 'register', minLength: 2 })}
                      placeholder="e.g., MaheshKale"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                    />
                    {errors.name && <span className="text-xs text-red-600">Full name is required</span>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      {...register('phone', { required: mode === 'register', minLength: 10 })}
                      placeholder="10-digit mobile number"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                {...register('email', { required: true })}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
              {errors.email && <span className="text-xs text-red-600">Valid email is required</span>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                {...register('password', { required: true, minLength: 6 })}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
              />
              {errors.password && <span className="text-xs text-red-600">Minimum 6 characters required</span>}
            </div>

            {mode === 'register' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                    <select
                      {...register('gender')}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Female">Woman / Female</option>
                      <option value="Male">Man / Male</option>
                      <option value="Other">Non-Binary / Prefer Not to Say</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Primary City (Select or Type Any)</label>
                    <input
                      list="auth-cities-list"
                      {...register('city')}
                      placeholder="e.g., Latur, Pune, Nashik..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <datalist id="auth-cities-list">
                      {MAHARASHTRA_CITIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {selectedRole === 'worker' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Primary Skill / Trade (Unrestricted — Choose or Type Any Custom Skill)
                    </label>
                    <input
                      list="auth-trades-list"
                      {...register('category')}
                      placeholder="e.g., Tailoring, Home Nursing, Electrical, Drone Spraying, Pottery..."
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <datalist id="auth-trades-list">
                      {TRADE_CATEGORIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Company / Household Name</label>
                    <input
                      type="text"
                      {...register('organizationName')}
                      placeholder="Optional company or boutique name"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Quick Evaluation Demo Role Switcher */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-slate-950">
            Instant Role Evaluation (Demo Accounts)
          </h2>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Test all four KaushalSetu roles immediately using pre-seeded MongoDB evaluation accounts. All demo profiles are transparently labeled.
          </p>

          <div className="mt-5 divide-y divide-slate-200 border-t border-b border-slate-200">
            <div className="py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Sanjay Kulkarni (Worker)</div>
                <div className="text-xs text-slate-500">Electrician · Latur · 89.4 Reputation · QR Passport</div>
              </div>
              <button
                type="button"
                onClick={() => quickDemoLogin('sanjay.kulkarni@demo.kaushalsetu.in', 'Demo@123')}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-900 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login Worker
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Sunita Shinde (Woman Artisan)</div>
                <div className="text-xs text-slate-500">Master Tailor · Pune · Boutique &amp; Garment Craft</div>
              </div>
              <button
                type="button"
                onClick={() => quickDemoLogin('sunita.shinde@demo.kaushalsetu.in', 'Demo@123')}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-900 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login Tailor
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Priya Jadhav (Newcomer Woman)</div>
                <div className="text-xs text-slate-500">Solar Tech · Pune · 0 Reviews (Fair-Start 76.4)</div>
              </div>
              <button
                type="button"
                onClick={() => quickDemoLogin('priya.jadhav@demo.kaushalsetu.in', 'Demo@123')}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-900 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login Newcomer
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Vikram Deshmukh (Employer)</div>
                <div className="text-xs text-slate-500">Contractor · Latur · Smart Shortlist &amp; Rehire</div>
              </div>
              <button
                type="button"
                onClick={() => quickDemoLogin('vikram.deshmukh@demo.kaushalsetu.in', 'Demo@123')}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-900 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login Employer
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Aarti Kulkarni (Governance Admin)</div>
                <div className="text-xs text-slate-500">Verifications · AI Fraud Scanner · Disputes</div>
              </div>
              <button
                type="button"
                onClick={() => quickDemoLogin('admin@kaushalsetu.in', 'Admin@123')}
                className="px-3 py-1.5 text-xs font-semibold bg-navy-900 hover:bg-navy-800 text-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
