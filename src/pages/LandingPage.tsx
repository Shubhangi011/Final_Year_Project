import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, Search, ArrowRight, QrCode } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SupportedLanguage, t } from '../utils/i18n';
import {
  getMonogramSurface,
  getWorkerInitials,
  HERO_TRADES_IMAGE,
  MAHARASHTRA_CITIES,
  resolveWorkerAvatar,
  TRADE_CATEGORIES,
} from '../utils/mediaAssets';

export function LandingPage() {
  const { language, setLanguage, notify, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [listening, setListening] = useState(false);

  // Interactive AI Fair Wage Estimator on Landing Page
  const [wageForm, setWageForm] = useState({
    category: 'Electrical',
    city: 'Latur',
    skillLevel: 'Advanced',
    complexity: 'Standard',
    durationDays: 3,
    experienceYears: 4,
  });
  const [wageResult, setWageResult] = useState<any>(null);
  const [wageLoading, setWageLoading] = useState(false);

  useEffect(() => {
    api
      .get('/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {});

    api
      .post('/ai/wage-recommendation', wageForm)
      .then(({ data }) => setWageResult(data.recommendation))
      .catch(() => {});
  }, []);

  const handleVoiceSearch = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      // Fallback sample Marathi voice query when browser lacks SpeechRecognition API
      const sample = 'माझ्या जवळ इलेक्ट्रिशियनची नोकरी शोधा';
      setSearchQuery(sample);
      notify('Voice input simulated (browser SpeechRecognition unavailable): Searching Electrician jobs', 'info');
      navigate(`/jobs?q=${encodeURIComponent(sample)}`);
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setSearchQuery(transcript);
      setListening(false);
      if (transcript) {
        navigate(`/jobs?q=${encodeURIComponent(transcript)}`);
      }
    };
    recognition.onerror = () => {
      setListening(false);
      notify('Microphone permission blocked or unavailable; try typing or clicking the Marathi voice demo below.', 'info');
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const handleCalculateWage = async (e: React.FormEvent) => {
    e.preventDefault();
    setWageLoading(true);
    try {
      const { data } = await api.post('/ai/wage-recommendation', wageForm);
      setWageResult(data.recommendation);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setWageLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HERO SECTION */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-14">
          {/* Workspace Utility Row: Language Switcher (kept out of <header> per Top Bar Contract) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100">
            <div className="text-xs text-slate-500">
              <span>{t(language, 'heroKicker')}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>Maharashtra &amp; Pan-India Trades</span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {([
                { code: 'en', label: 'English' },
                { code: 'mr', label: 'मराठी' },
                { code: 'hi', label: 'हिन्दी' },
              ] as { code: SupportedLanguage; label: string }[]).map((item) => (
                <button
                  key={item.code}
                  onClick={() => setLanguage(item.code)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    language === item.code
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2-Column Hero Split with items-stretch */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-950 leading-[1.12] text-balance max-w-2xl">
                  {t(language, 'heroTitle')}
                </h1>
                <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                  {t(language, 'heroSubtitle')}
                </p>

                {/* Search & Multilingual Voice Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    navigate(`/jobs?q=${encodeURIComponent(searchQuery)}`);
                  }}
                  className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <div className="flex items-center gap-2.5 flex-1 px-3 py-2">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t(language, 'searchPlaceholder')}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleVoiceSearch}
                      className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        listening
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{listening ? t(language, 'voiceListening') : t(language, 'voiceBtn')}</span>
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t(language, 'searchBtn')}
                    </button>
                  </div>
                </form>

                {/* Sample Marathi Voice Search Quick Trigger */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Try regional voice query:</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs?q=${encodeURIComponent('माझ्या जवळ इलेक्ट्रिशियनची नोकरी शोधा')}`)}
                    className="text-teal-700 hover:underline font-medium cursor-pointer"
                  >
                    &ldquo;माझ्या जवळ इलेक्ट्रिशियनची नोकरी शोधा&rdquo;
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => navigate('/workers?fairOpportunity=true')}
                    className="text-slate-700 hover:underline font-medium cursor-pointer"
                  >
                    Explore Fair Opportunity Newcomers
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => navigate(user ? (user.role === 'employer' ? '/dashboard/employer' : '/dashboard/worker') : '/auth')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{user?.role === 'employer' ? t(language, 'hireWorkerCta') : t(language, 'joinWorkerCta')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/workers"
                  className="text-sm font-medium text-slate-700 hover:text-slate-950 px-3 py-2 whitespace-nowrap shrink-0"
                >
                  Browse Verified Workers &rarr;
                </Link>
              </div>
            </div>

            {/* Right Hero Media Column */}
            <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[320px]">
              <img
                src={HERO_TRADES_IMAGE}
                alt="Skilled Indian electrical and solar technician testing a distribution panel with a digital multimeter"
                referrerPolicy="no-referrer"
                className="w-full h-full lg:h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 text-white">
                <div className="text-xs text-slate-200">
                  Skill Assessment · Bayesian Reputation · QR Skill Passport
                </div>
                <div className="mt-1 font-display text-lg font-semibold leading-snug">
                  Practical workmanship evaluated transparently—even without formal degrees.
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Live MongoDB Platform KPI Strip */}
          <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-semibold text-slate-950 tabular-nums">
                {stats ? stats.counts.totalWorkers : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t(language, 'statsWorkers')}
                {stats?.counts?.femaleWorkers !== undefined && (
                  <span> · {stats.counts.femaleWorkers} Women &amp; {stats.counts.maleWorkers} Men</span>
                )}
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-semibold text-slate-950 tabular-nums">
                {stats ? `${stats.counts.distinctCategoriesCount || 26}+` : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Unrestricted Trade Domains · {stats?.counts?.distinctSkillsCount || 120}+ Distinct Skills
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-semibold text-teal-700 tabular-nums">
                {stats ? stats.counts.assessedSkillsCount : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">{t(language, 'statsAssessed')}</div>
            </div>
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-semibold text-slate-950 tabular-nums">
                {stats ? stats.counts.openJobs : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">{t(language, 'statsJobs')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: HOW IT WORKS & CORE AI MECHANISMS */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 text-balance">
            How KaushalSetu replaces guesswork with verifiable skill intelligence
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Designed specifically for India’s practical trade workforce, homeowners, and site contractors.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-slate-950">
              01. Practical Skill Verification &amp; QR Passport
            </h3>
            <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
              Workers take scenario-based technical assessments and upload ITI/NSDC credentials. Self-declared skills stay strictly separated from AI-assessed and Admin-verified badges on a scannable QR Skill Passport.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-slate-950">
              02. Explainable TF-IDF &amp; 2dsphere Geo-Matching
            </h3>
            <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
              Our Python matching engine scores skill compatibility, experience, Haversine travel distance, availability, and daily wage alignment (0–100%), with Fair Opportunity Mode giving verified newcomers equal visibility.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-slate-950">
              03. Bayesian Reputation &amp; Digital Agreements
            </h3>
            <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
              New workers begin with a fair Bayesian baseline instead of zero. Every accepted job generates a bilateral Work Agreement and issues a downloadable Completion Certificate once confirmed.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3: FEATURED SKILLED WORKERS (ZERO-PILL METADATA DISCIPLINE) */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
                Featured Skilled Women &amp; Men Across Diverse Trades
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                From electrical, solar, and EV mechanics to tailoring, home nursing, CCTV networking, catering, and custom crafts—not limited to construction.
              </p>
            </div>
            <Link to="/workers" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
              Browse All {stats?.counts?.totalWorkers || 500} Workers &rarr;
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(stats?.featuredWorkers || []).map((w: any) => {
              const avatar = resolveWorkerAvatar(w.profile);
              const repScore = w.reputation?.overallScore ?? 72.0;
              const assessedCount = (w.skills || []).filter((s: any) => s.verificationType !== 'self_declared').length;

              return (
                <div
                  key={w._id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3.5">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={w.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-14 h-14 rounded-lg flex items-center justify-center font-display font-bold text-base shrink-0 ${getMonogramSurface(w.name)}`}
                        >
                          {getWorkerInitials(w.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-bold text-slate-950 truncate">
                          {w.name}
                        </h3>
                        {/* Clean unboxed inline metadata per Zero-Pill rule */}
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          <span>{w.profile?.category}</span>
                          {w.gender && w.gender !== 'Unspecified' && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>{w.gender}</span>
                            </>
                          )}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{w.city}</span>
                          {w.isDemo && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>Demo</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {w.profile?.headline}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Reputation Score</span>
                        <span className="font-mono font-semibold text-slate-950 tabular-nums">
                          {repScore} / 100
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Expected Daily Wage</span>
                        <span className="font-mono font-semibold text-slate-950 tabular-nums">
                          ₹{w.profile?.expectedDailyWage || 750}/day
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Assessed Skills</span>
                        <span className="font-mono text-teal-700 font-medium tabular-nums">
                          {assessedCount} of {(w.skills || []).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                    {w.passportCode ? (
                      <Link
                        to={`/passport/${w.passportCode}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-900 hover:text-teal-700"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>View Skill Passport</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">Passport Pending</span>
                    )}
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {w.profile?.experienceYears} yrs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 4: WORKER DEMAND ANALYTICS + AI FAIR WAGE ESTIMATOR */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Live MongoDB Category Demand Chart */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-950">
              Live Trade Demand &amp; Daily Wage Benchmarks
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Aggregated dynamically from active job postings and registered worker profiles in MongoDB.
            </p>

            <div className="mt-6 h-72 w-full">
              {stats?.categoryDemand?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.categoryDemand} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip />
                    <Bar dataKey="avgDailyWage" name="Avg Daily Budget (₹)" fill="#0f1d38" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Loading live category aggregations...
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
              {TRADE_CATEGORIES.slice(0, 8).map((cat) => (
                <button
                  key={cat}
                  onClick={() => navigate(`/workers?category=${encodeURIComponent(cat)}`)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive AI Wage Recommendation Calculator */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-xl font-bold text-slate-950">
              AI Fair Daily Wage Estimator
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Supports 26+ built-in trades or type any custom skill &amp; city.
            </p>

            <form onSubmit={handleCalculateWage} className="mt-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trade or Custom Skill</label>
                  <input
                    list="landing-trades-list"
                    value={wageForm.category}
                    onChange={(e) => setWageForm({ ...wageForm, category: e.target.value })}
                    placeholder="Select or type any skill..."
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                  <datalist id="landing-trades-list">
                    {TRADE_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Work City</label>
                  <input
                    list="landing-cities-list"
                    value={wageForm.city}
                    onChange={(e) => setWageForm({ ...wageForm, city: e.target.value })}
                    placeholder="Select or type city..."
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                  <datalist id="landing-cities-list">
                    {MAHARASHTRA_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Skill Level</label>
                  <select
                    value={wageForm.skillLevel}
                    onChange={(e) => setWageForm({ ...wageForm, skillLevel: e.target.value })}
                    className="w-full text-sm px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Complexity</label>
                  <select
                    value={wageForm.complexity}
                    onChange={(e) => setWageForm({ ...wageForm, complexity: e.target.value })}
                    className="w-full text-sm px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Simple">Simple</option>
                    <option value="Standard">Standard</option>
                    <option value="Complex">Complex</option>
                    <option value="Industrial / Hazardous">Industrial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Days</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={wageForm.durationDays}
                    onChange={(e) => setWageForm({ ...wageForm, durationDays: Number(e.target.value || 1) })}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={wageLoading}
                className="w-full py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                {wageLoading ? 'Calculating...' : 'Estimate Fair Wage Range'}
              </button>
            </form>

            {wageResult && (
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-slate-600">Recommended Daily Range</span>
                  <span className="font-mono text-xl font-bold text-teal-700 tabular-nums">
                    ₹{wageResult.recommendedDailyMin} – ₹{wageResult.recommendedDailyMax}/day
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between text-xs text-slate-600">
                  <span>Estimated {wageResult.durationDays}-Day Project Total</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    ₹{wageResult.estimatedTotalMin} – ₹{wageResult.estimatedTotalMax}
                  </span>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-500 leading-normal">
                  {wageResult.disclaimer}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 5: ATTRIBUTABLE OUTCOMES & QUIET FOOTER */}
      <section className="bg-white border-t border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-2xl font-bold text-slate-950">
            Field Perspectives from Maharashtra
          </h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <blockquote className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-sm text-slate-700 leading-relaxed">
                &ldquo;Before Digital Skill Passports, contractors judged me only on word-of-mouth referrals. Passing the 3-phase wiring scenario check and sharing my QR passport helped me secure two full bungalow rewiring contracts at fair daily rates.&rdquo;
              </p>
              <footer className="mt-4 text-xs text-slate-500">
                <strong className="text-slate-900 font-semibold">Sanjay Kulkarni</strong> · Residential &amp; Panel Electrician · Latur (Demo Case Study)
              </footer>
            </blockquote>
            <blockquote className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-sm text-slate-700 leading-relaxed">
                &ldquo;Instead of calling ten unverified numbers during urgent site deadlines, AI Smart Shortlisting compares assessed skills, travel distance, and punctuality history side-by-side—and generates a clean work agreement in seconds.&rdquo;
              </p>
              <footer className="mt-4 text-xs text-slate-500">
                <strong className="text-slate-900 font-semibold">Vikram Deshmukh</strong> · Principal Contractor, Deshmukh Infra &amp; Interiors · Latur (Demo Case Study)
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <footer className="bg-navy-950 text-slate-400 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs">
          <div>
            <div className="font-display text-base font-bold text-white">KaushalSetu</div>
            <p className="mt-1 text-slate-400">
              AI-Powered Skilled Worker Hiring &amp; Reputation Intelligence Ecosystem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/jobs" className="hover:text-white transition-colors">Find Jobs</Link>
            <Link to="/workers" className="hover:text-white transition-colors">Discover Workers</Link>
            <Link to="/map" className="hover:text-white transition-colors">Geo Map</Link>
            <Link to="/learning" className="hover:text-white transition-colors">Community Learning</Link>
            <Link to="/auth" className="hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
