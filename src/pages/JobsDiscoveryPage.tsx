import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, Search } from 'lucide-react';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MAHARASHTRA_CITIES, TRADE_CATEGORIES } from '../utils/mediaAssets';
import { GeoDiscoveryMap } from '../components/GeoDiscoveryMap';

export function JobsDiscoveryPage() {
  const { user, language, notify } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [jobs, setJobs] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([...TRADE_CATEGORIES]);
  const [availableCities, setAvailableCities] = useState<string[]>([...MAHARASHTRA_CITIES]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [city, setCity] = useState('All');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [listening, setListening] = useState(false);

  // Application Modal State
  const [applyingJob, setApplyingJob] = useState<any | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [proposedWage, setProposedWage] = useState<number>(850);
  const [submittingApp, setSubmittingApp] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/jobs', {
        params: {
          category,
          city,
          search,
          emergencyOnly: emergencyOnly ? 'true' : 'false',
        },
      });
      setJobs(data.jobs || []);
      if (Array.isArray(data.availableCategories)) {
        setAvailableCategories(Array.from(new Set([...TRADE_CATEGORIES, ...data.availableCategories])));
      }
      if (Array.isArray(data.availableCities)) {
        setAvailableCities(Array.from(new Set([...MAHARASHTRA_CITIES, ...data.availableCities])));
      }
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [category, city, emergencyOnly]);

  const startVoiceSearch = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      const demoVoice = 'माझ्या जवळ शिलाई किंवा इलेक्ट्रिशियनची नोकरी शोधा';
      setSearch(demoVoice);
      notify('Simulated Marathi voice search: Tailoring & Electrical jobs', 'info');
      api.get('/jobs', { params: { search: demoVoice } }).then(({ data }) => setJobs(data.jobs || []));
      return;
    }
    const rec = new SpeechRec();
    rec.lang = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    setListening(true);
    rec.onresult = (e: any) => {
      const txt = e.results?.[0]?.[0]?.transcript || '';
      setSearch(txt);
      setListening(false);
      api.get('/jobs', { params: { search: txt } }).then(({ data }) => setJobs(data.jobs || []));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJob) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (user.role !== 'worker') {
      notify('Sign in with a Worker account to apply for jobs.', 'info');
      return;
    }
    setSubmittingApp(true);
    try {
      const { data } = await api.post('/applications', {
        jobId: applyingJob._id,
        coverNote,
        proposedDailyWage: proposedWage,
      });
      notify(`Application submitted! AI Compatibility Score: ${data.application.aiMatchScore}%`, 'success');
      setApplyingJob(null);
      setCoverNote('');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-950">
            Verified Skilled Opportunities Across All Domains
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Open to every technical, artisan, healthcare, digital, culinary, and service skill—search in English, मराठी, or हिन्दी.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMap((v) => !v)}
            className="px-4 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            {showMap ? 'Hide Geo Map' : 'Show OpenStreetMap'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadJobs();
        }}
        className="mt-6 bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
      >
        <div className="md:col-span-5 flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search e.g. Boutique Tailoring, Nursing, CCTV, EV, शिलाई, इलेक्ट्रिशियन..."
            className="w-full text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={startVoiceSearch}
            title="Voice Search (mr-IN / hi-IN / en-IN)"
            className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
              listening ? 'bg-red-100 text-red-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Mic className="w-3.5 h-3.5 inline mr-1" />
            {listening ? 'Listening' : 'Voice'}
          </button>
        </div>

        <div className="md:col-span-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="All">All Skill &amp; Trade Domains ({availableCategories.length}+)</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="All">All Cities</option>
            {availableCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <button
            type="submit"
            className="w-full py-2 px-4 bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            Filter
          </button>
        </div>

        <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={emergencyOnly}
              onChange={(e) => setEmergencyOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Show Emergency Same-Day Hiring Requirements Only</span>
          </label>
          <span className="text-slate-500 font-mono tabular-nums">{jobs.length} open opportunity(s)</span>
        </div>
      </form>

      {showMap && (
        <div className="mt-6">
          <GeoDiscoveryMap
            jobs={jobs}
            onSelectJob={(jb) => {
              setApplyingJob(jb);
              setProposedWage(jb.dailyWageBudget);
            }}
          />
        </div>
      )}

      {/* Jobs List */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="p-10 text-center bg-white border border-slate-200 rounded-xl text-sm text-slate-500">
            Loading verified job opportunities...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-10 text-center bg-white border border-slate-200 rounded-xl">
            <div className="text-base font-semibold text-slate-900">No matching open jobs found</div>
            <p className="mt-1 text-xs text-slate-500">Try clearing the category or city filter.</p>
            <button
              onClick={() => {
                setCategory('All');
                setCity('All');
                setSearch('');
                setEmergencyOnly(false);
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job._id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2 max-w-3xl">
                <div className="text-xs text-slate-500">
                  {job.isEmergency && (
                    <>
                      <span className="font-bold text-red-700">URGENT EMERGENCY HIRE</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                    </>
                  )}
                  <span className="font-medium text-teal-700">{job.category}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{job.city}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>Employer: {job.employerName}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>Min {job.minExperienceYears} yr(s) exp</span>
                </div>

                <h2 className="font-display text-lg font-bold text-slate-950">{job.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{job.description}</p>

                <div className="text-xs text-slate-500 pt-1 leading-relaxed">
                  <strong className="text-slate-700 font-medium">Required Skills (click to learn modules):</strong>{' '}
                  {(job.requiredSkills || []).map((sk: string, idx: number) => (
                    <React.Fragment key={sk}>
                      {idx > 0 && <span className="mx-1.5" aria-hidden="true">·</span>}
                      <Link
                        to={`/learning?skill=${encodeURIComponent(sk)}`}
                        className="text-slate-700 hover:text-teal-700 hover:underline"
                      >
                        {sk}
                      </Link>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                <div className="text-left md:text-right">
                  <div className="font-mono text-xl font-bold text-slate-950 tabular-nums">
                    ₹{job.dailyWageBudget}/day
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Est. {job.durationDays} day(s) · Total ₹{job.dailyWageBudget * job.durationDays}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setApplyingJob(job);
                    setProposedWage(job.dailyWageBudget);
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Apply with AI Match
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Application Modal */}
      {applyingJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6">
            <h3 className="font-display text-lg font-bold text-slate-950">
              Apply for: {applyingJob.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {applyingJob.employerName} · {applyingJob.city} · Employer Budget ₹{applyingJob.dailyWageBudget}/day
            </p>

            <form onSubmit={handleApplySubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Your Proposed Daily Wage (INR) *
                </label>
                <input
                  type="number"
                  required
                  min={300}
                  max={5000}
                  value={proposedWage}
                  onChange={(e) => setProposedWage(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Practical Experience &amp; Tool Readiness Note
                </label>
                <textarea
                  rows={3}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Mention relevant completed jobs, tools you carry, and earliest start time..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyingJob(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApp}
                  className="px-5 py-2 text-xs font-semibold bg-navy-900 hover:bg-navy-800 text-white rounded-lg cursor-pointer"
                >
                  {submittingApp ? 'Calculating AI Match...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
