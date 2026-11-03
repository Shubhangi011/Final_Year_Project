import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, QrCode, Search, X } from 'lucide-react';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  getMonogramSurface,
  getWorkerInitials,
  MAHARASHTRA_CITIES,
  resolveWorkerAvatar,
  TRADE_CATEGORIES,
} from '../utils/mediaAssets';

export function WorkersDiscoveryPage() {
  const { user, notify } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [workers, setWorkers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [genderCounts, setGenderCounts] = useState<{ female: number; male: number }>({ female: 0, male: 0 });
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [dynamicCities, setDynamicCities] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [gender, setGender] = useState(searchParams.get('gender') || 'All');
  const [city, setCity] = useState('All');
  const [sortBy, setSortBy] = useState('reputation');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [fairOpportunity, setFairOpportunity] = useState(searchParams.get('fairOpportunity') === 'true');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Candidate Comparison across pages (stores full worker objects up to 3)
  const [comparedMap, setComparedMap] = useState<Record<string, any>>({});
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Direct Hiring Request Modal
  const [hireTarget, setHireTarget] = useState<any | null>(null);
  const [hireForm, setHireForm] = useState({
    projectTitle: '',
    offeredDailyWage: 850,
    durationDays: 3,
    meetingScheduledAt: '',
    message: '',
  });

  const fetchWorkers = async (targetPage = page) => {
    setLoading(true);
    try {
      const { data } = await api.get('/workers', {
        params: {
          category,
          gender,
          city,
          sortBy,
          search,
          fairOpportunity: fairOpportunity ? 'true' : 'false',
          page: targetPage,
          limit: 24,
        },
      });
      setWorkers(data.workers || []);
      setTotalCount(data.totalCount ?? (data.workers || []).length);
      setTotalPages(data.totalPages || 1);
      if (data.genderCounts) setGenderCounts(data.genderCounts);
      if (Array.isArray(data.availableCategories)) setDynamicCategories(data.availableCategories);
      if (Array.isArray(data.availableCities)) setDynamicCities(data.availableCities);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchWorkers(1);
  }, [category, gender, city, sortBy, fairOpportunity]);

  const mergedCategories = Array.from(new Set([...TRADE_CATEGORIES, ...dynamicCategories])).sort();
  const mergedCities = Array.from(new Set([...MAHARASHTRA_CITIES, ...dynamicCities])).sort();

  const toggleCompare = (workerObj: any) => {
    setComparedMap((prev) => {
      const next = { ...prev };
      if (next[workerObj._id]) {
        delete next[workerObj._id];
        return next;
      }
      if (Object.keys(next).length >= 3) {
        notify('You can compare up to 3 candidates side-by-side.', 'info');
        return prev;
      }
      next[workerObj._id] = workerObj;
      return next;
    });
  };

  const handleSendHireRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hireTarget) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (user.role !== 'employer') {
      notify('Sign in as an Employer/Customer to send direct hiring requests.', 'info');
      return;
    }
    try {
      await api.post('/hiring-requests', {
        workerId: hireTarget._id,
        category: hireTarget.profile?.category,
        city: hireTarget.city,
        ...hireForm,
      });
      notify(`Hiring request sent to ${hireTarget.name}!`, 'success');
      setHireTarget(null);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const comparedWorkers = Object.values(comparedMap);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-950">
            Discover &amp; Compare Skilled Workers
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse <span className="font-mono font-semibold text-slate-900 tabular-nums">{totalCount}</span> skilled women &amp; men ({genderCounts.female} women · {genderCounts.male} men) across {mergedCategories.length}+ unrestricted trade &amp; craft domains.
          </p>
        </div>

        {comparedWorkers.length >= 2 && (
          <button
            onClick={() => setShowCompareModal(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Compare Selected ({comparedWorkers.length}) Candidates
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          fetchWorkers(1);
        }}
        className="mt-6 bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
      >
        <div className="md:col-span-4 flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any skill, custom trade, or name (e.g. Tailoring, Nursing, CCTV, EV, Paithani)..."
            className="w-full text-sm focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                setTimeout(() => fetchWorkers(1), 0);
              }}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="All">All Trades &amp; Skills ({mergedCategories.length}+)</option>
            {mergedCategories.map((c) => (
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
            {mergedCities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="reputation">Sort: Reputation</option>
            <option value="experience">Sort: Experience</option>
            <option value="wage_low">Sort: Daily Wage</option>
            <option value="nearest">Sort: Nearest</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <button
            type="submit"
            className="w-full py-2 px-3 bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            Search
          </button>
        </div>

        <div className="md:col-span-12 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Interactive Gender Segmented Filter Control */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {([
                { val: 'All', label: `All Workers (${totalCount})` },
                { val: 'Female', label: `Women (${gender === 'All' ? genderCounts.female : gender === 'Female' ? totalCount : genderCounts.female})` },
                { val: 'Male', label: `Men (${gender === 'All' ? genderCounts.male : gender === 'Male' ? totalCount : genderCounts.male})` },
              ]).map((g) => (
                <button
                  key={g.val}
                  type="button"
                  onClick={() => setGender(g.val)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    gender === g.val ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={fairOpportunity}
                onChange={(e) => setFairOpportunity(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Fair Opportunity Mode (Boosts skill-assessed newcomers with &le;2 completed jobs)</span>
            </label>
          </div>

          <span className="text-slate-500">Select 2–3 cards to compare side-by-side</span>
        </div>
      </form>

      {/* Worker Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full p-10 text-center bg-white border border-slate-200 rounded-xl text-sm text-slate-500">
            Loading verified worker profiles...
          </div>
        ) : workers.length === 0 ? (
          <div className="col-span-full p-10 text-center bg-white border border-slate-200 rounded-xl">
            <div className="text-sm font-semibold text-slate-900">No workers matched these filters.</div>
            <button
              type="button"
              onClick={() => {
                setCategory('All');
                setGender('All');
                setCity('All');
                setSearch('');
                setFairOpportunity(false);
                fetchWorkers(1);
              }}
              className="mt-3 px-4 py-2 text-xs font-semibold bg-navy-900 text-white rounded-lg cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          workers.map((w) => {
            const avatar = resolveWorkerAvatar(w.profile);
            const selectedForCompare = Boolean(comparedMap[w._id]);
            const assessedSkills = (w.skills || []).filter((s: any) => s.verificationType !== 'self_declared');
            const declaredSkills = (w.skills || []).filter((s: any) => s.verificationType === 'self_declared');

            return (
              <div
                key={w._id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={w.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-14 h-14 rounded-lg flex items-center justify-center font-display font-bold text-base tracking-wide shrink-0 ${getMonogramSurface(w.name)}`}
                        >
                          {getWorkerInitials(w.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-bold text-slate-950 truncate">{w.name}</h2>
                        {/* Unboxed inline metadata per Zero-Pill rule */}
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          <span>{w.profile?.category}</span>
                          {w.gender && w.gender !== 'Unspecified' && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>{w.gender}</span>
                            </>
                          )}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{w.city}</span>
                          {w.distanceKm !== null && w.distanceKm !== undefined && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>{w.distanceKm} km</span>
                            </>
                          )}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{w.profile?.experienceYears || 0} yrs exp</span>
                          {w.isDemo && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>Demo</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-lg font-bold text-slate-950 tabular-nums">
                        {w.reputation?.overallScore ?? 72.0}/100
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {w.reputation?.isFairStartBaseline ? 'Fair-Start Baseline' : 'Dynamic Reputation'}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">{w.profile?.bio}</p>

                  {/* Strictly separate Assessed/Verified vs Self-Declared skills — click any skill to view its 4 learning modules */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div>
                      <span className="font-semibold text-teal-800">Assessed / Verified Skills: </span>
                      <span className="text-slate-700">
                        {assessedSkills.length > 0
                          ? assessedSkills.map((s: any, idx: number) => (
                              <React.Fragment key={s._id || s.name}>
                                {idx > 0 && <span className="mx-1.5" aria-hidden="true">·</span>}
                                <Link
                                  to={`/learning?skill=${encodeURIComponent(s.name)}`}
                                  title={`Open 4 learning modules for ${s.name}`}
                                  className="hover:text-teal-700 hover:underline"
                                >
                                  {s.name} ({s.proficiency})
                                </Link>
                              </React.Fragment>
                            ))
                          : 'None assessed yet'}
                      </span>
                    </div>
                    {declaredSkills.length > 0 && (
                      <div>
                        <span className="font-medium text-slate-500">Self-Declared Skills: </span>
                        <span className="text-slate-500">
                          {declaredSkills.map((s: any, idx: number) => (
                            <React.Fragment key={s._id || s.name}>
                              {idx > 0 && <span className="mx-1.5" aria-hidden="true">·</span>}
                              <Link
                                to={`/learning?skill=${encodeURIComponent(s.name)}`}
                                title={`Open 4 learning modules for ${s.name}`}
                                className="hover:text-teal-700 hover:underline"
                              >
                                {s.name} ({s.proficiency})
                              </Link>
                            </React.Fragment>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      ₹{w.profile?.expectedDailyWage || 750}/day
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedForCompare}
                        onChange={() => toggleCompare(w)}
                        className="rounded border-slate-300"
                      />
                      <span>Compare</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {w.passportCode && (
                      <Link
                        to={`/passport/${w.passportCode}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Passport</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setHireTarget(w);
                        setHireForm({
                          projectTitle: `${w.profile?.category || 'Skilled'} Assignment (${w.city})`,
                          offeredDailyWage: w.profile?.expectedDailyWage || 800,
                          durationDays: 3,
                          meetingScheduledAt: '',
                          message: '',
                        });
                      }}
                      className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Hire / Schedule
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="text-slate-600 font-mono tabular-nums">
            Showing page {page} of {totalPages} ({totalCount} matching workers)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                const next = Math.max(1, page - 1);
                setPage(next);
                fetchWorkers(next);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 font-medium cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                fetchWorkers(next);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-navy-900 text-white rounded-lg disabled:opacity-40 hover:bg-navy-800 font-semibold cursor-pointer"
            >
              <span>Next Page</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Candidate Comparison Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-950">
                  AI Side-by-Side Candidate Comparison Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Objective evaluation across verified skill depth, reputation sub-scores, wage expectations, and availability.
                </p>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Dimension</th>
                    {comparedWorkers.map((cw) => (
                      <th key={cw._id} className="py-2.5 px-4 font-display text-sm font-bold text-slate-950">
                        {cw.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-slate-600">Trade · Gender · City</td>
                    {comparedWorkers.map((cw) => (
                      <td key={cw._id} className="py-3 px-4 text-slate-800">
                        {cw.profile?.category} · {cw.gender || 'Worker'} · {cw.city}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-slate-600">Dynamic Reputation</td>
                    {comparedWorkers.map((cw) => (
                      <td key={cw._id} className="py-3 px-4 font-mono font-bold text-teal-700 tabular-nums">
                        {cw.reputation?.overallScore ?? 72.0} / 100
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-slate-600">Work Quality / Punctuality</td>
                    {comparedWorkers.map((cw) => (
                      <td key={cw._id} className="py-3 px-4 font-mono text-slate-800 tabular-nums">
                        {cw.reputation?.qualityScore ?? 75}% · {cw.reputation?.punctualityScore ?? 75}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-slate-600">Practical Experience</td>
                    {comparedWorkers.map((cw) => (
                      <td key={cw._id} className="py-3 px-4 font-mono text-slate-800 tabular-nums">
                        {cw.profile?.experienceYears || 0} years ({cw.profile?.completedJobsCount || 0} platform jobs)
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-slate-600">Expected Daily Wage</td>
                    {comparedWorkers.map((cw) => (
                      <td key={cw._id} className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                        ₹{cw.profile?.expectedDailyWage || 750}/day
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-slate-600">Assessed / Verified Skills</td>
                    {comparedWorkers.map((cw) => (
                      <td key={cw._id} className="py-3 px-4 text-slate-700">
                        {(cw.skills || [])
                          .filter((s: any) => s.verificationType !== 'self_declared')
                          .map((s: any) => s.name)
                          .join(', ') || 'None yet'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-slate-600">Availability</td>
                    {comparedWorkers.map((cw) => (
                      <td key={cw._id} className="py-3 px-4 capitalize text-slate-800">
                        {(cw.profile?.availabilityStatus || 'available').replace('_', ' ')}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Direct Hiring & Meeting Scheduler Modal */}
      {hireTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="font-display text-lg font-bold text-slate-950">
              Send Hiring Offer to {hireTarget.name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {hireTarget.profile?.category} · {hireTarget.city} · Expected ₹{hireTarget.profile?.expectedDailyWage}/day
            </p>

            <form onSubmit={handleSendHireRequest} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Work Scope / Project Title *</label>
                <input
                  type="text"
                  required
                  value={hireForm.projectTitle}
                  onChange={(e) => setHireForm({ ...hireForm, projectTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Offered Daily Wage (₹)</label>
                  <input
                    type="number"
                    required
                    min={300}
                    value={hireForm.offeredDailyWage}
                    onChange={(e) => setHireForm({ ...hireForm, offeredDailyWage: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={hireForm.durationDays}
                    onChange={(e) => setHireForm({ ...hireForm, durationDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Optional Site Inspection / Meeting Date</label>
                <input
                  type="date"
                  value={hireForm.meetingScheduledAt}
                  onChange={(e) => setHireForm({ ...hireForm, meetingScheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Instructions for Worker</label>
                <textarea
                  rows={2}
                  value={hireForm.message}
                  onChange={(e) => setHireForm({ ...hireForm, message: e.target.value })}
                  placeholder="Share site timing, tools required, or landmark..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHireTarget(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Send Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
