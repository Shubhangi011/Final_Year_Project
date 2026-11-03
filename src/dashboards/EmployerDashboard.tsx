import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Bookmark,
  CheckCircle2,
  FileText,
  LogOut,
  RefreshCw,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MAHARASHTRA_CITIES, TRADE_CATEGORIES } from '../utils/mediaAssets';
import { downloadCompletionCertificatePDF, downloadWorkAgreementPDF } from '../utils/pdfGenerator';

type EmployerTab = 'overview' | 'post_job' | 'shortlist' | 'projects_reviews' | 'profile_chat';

export function EmployerDashboard() {
  const { user, logout, notify, liveMessages, sendMessage, wsConnected } = useAuth();
  const [activeTab, setActiveTab] = useState<EmployerTab>('overview');

  const [empProfile, setEmpProfile] = useState<any | null>(null);
  const [savedWorkerIds, setSavedWorkerIds] = useState<string[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [aiMatchedWorkers, setAiMatchedWorkers] = useState<any[]>([]);
  const [fairMode, setFairMode] = useState(true);
  const [loading, setLoading] = useState(true);

  // AI Job Description Generator + Job Form
  const [aiJobPrompt, setAiJobPrompt] = useState('I need an experienced carpenter for furniture work in Latur.');
  const [genJobBusy, setGenJobBusy] = useState(false);
  const [wageHint, setWageHint] = useState<any | null>(null);
  const [jobForm, setJobForm] = useState({
    title: '',
    category: 'Carpentry',
    description: '',
    requiredSkills: 'Modular Kitchen Installation, Laminate & Veneer Pressing',
    minExperienceYears: 2,
    dailyWageBudget: 950,
    durationDays: 5,
    city: 'Latur',
    isEmergency: false,
    responsibilitiesText: 'Execute precision carpentry & hardware installation\nMaintain clean & safe workspace',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  // Review Modal state
  const [reviewTargetProject, setReviewTargetProject] = useState<any | null>(null);
  const [reviewForm, setReviewForm] = useState({
    quality: 5,
    punctuality: 5,
    reliability: 5,
    satisfaction: 5,
    wouldRehire: true,
    comment: '',
  });

  // Employer Profile & Chat state
  const [orgForm, setOrgForm] = useState({
    organizationName: '',
    employerType: 'Contractor',
    city: 'Latur',
    description: '',
    gstNumber: '',
  });
  const [chatPartner, setChatPartner] = useState<{ id: string; name: string } | null>(null);
  const [chatText, setChatText] = useState('');

  const loadEmployerWorkspace = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profRes, jobsRes, appsRes, projRes] = await Promise.all([
        api.get('/employers/profile'),
        api.get('/jobs'),
        api.get('/applications'),
        api.get('/projects'),
      ]);

      const ep = profRes.data.profile;
      setEmpProfile(ep);
      setSavedWorkerIds(profRes.data.savedWorkerIds || []);
      if (ep) {
        setOrgForm({
          organizationName: ep.organizationName || '',
          employerType: ep.employerType || 'Contractor',
          city: ep.city || 'Latur',
          description: ep.description || '',
          gstNumber: ep.gstNumber || '',
        });
      }

      const allOpenJobs = jobsRes.data.jobs || [];
      const mine = allOpenJobs.filter((j: any) => j.employerId === user._id);
      setMyJobs(mine);
      setApplications(appsRes.data.applications || []);
      setProjects(projRes.data.projects || []);

      // Run live AI Worker Matching for first active job (or default spec)
      const targetJob = mine[0] || allOpenJobs[0];
      if (targetJob) {
        const matchRes = await api.post('/ai/match-workers', {
          jobId: targetJob._id,
          fairOpportunity: fairMode,
        });
        setAiMatchedWorkers(matchRes.data.matches || []);
      }
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployerWorkspace();
  }, [user?._id, fairMode]);

  const handleGenerateJobWithAI = async () => {
    setGenJobBusy(true);
    try {
      const { data } = await api.post('/ai/generate-job-description', { promptText: aiJobPrompt });
      const spec = data.jobSpec;
      setJobForm({
        title: spec.title,
        category: spec.category,
        description: spec.description,
        requiredSkills: (spec.requiredSkills || []).join(', '),
        minExperienceYears: spec.minExperienceYears,
        dailyWageBudget: spec.dailyWageBudget,
        durationDays: spec.durationDays,
        city: spec.city,
        isEmergency: false,
        responsibilitiesText: (spec.responsibilities || []).join('\n'),
        deadline: spec.deadline,
      });

      const wRes = await api.post('/ai/wage-recommendation', {
        category: spec.category,
        city: spec.city,
        experienceYears: spec.minExperienceYears,
        skillLevel: spec.minExperienceYears >= 3 ? 'Advanced' : 'Intermediate',
        complexity: 'Standard',
        durationDays: spec.durationDays,
      });
      setWageHint(wRes.data.recommendation);
      notify('AI drafted structured job posting & wage benchmark—review and publish below!', 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setGenJobBusy(false);
    }
  };

  const handlePublishJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/jobs', {
        title: jobForm.title,
        category: jobForm.category,
        description: jobForm.description,
        requiredSkills: jobForm.requiredSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        minExperienceYears: jobForm.minExperienceYears,
        dailyWageBudget: jobForm.dailyWageBudget,
        durationDays: jobForm.durationDays,
        city: jobForm.city,
        isEmergency: jobForm.isEmergency,
        responsibilities: jobForm.responsibilitiesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        deadline: jobForm.deadline,
      });
      notify(
        jobForm.isEmergency
          ? 'Emergency Job published! Nearby available workers notified in real time.'
          : 'Job opportunity published to MongoDB!',
        'success'
      );
      setActiveTab('overview');
      loadEmployerWorkspace();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleToggleShortlistWorker = async (workerId: string) => {
    try {
      const { data } = await api.post('/employers/saved-workers', { workerId });
      setSavedWorkerIds(data.savedWorkerIds || []);
      notify('Updated shortlisted candidates.', 'info');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleApplicationDecision = async (appId: string, status: 'shortlisted' | 'accepted' | 'rejected') => {
    try {
      await api.put(`/applications/${appId}/status`, { status });
      notify(
        status === 'accepted'
          ? 'Candidate hired! Active Project & Digital Work Agreement generated.'
          : `Application marked ${status}.`,
        'success'
      );
      loadEmployerWorkspace();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleConfirmProjectCompletion = async (projectId: string) => {
    try {
      await api.put(`/projects/${projectId}/status`, { stage: 'Completed' });
      notify('Project completion confirmed! Digital Work Completion Certificate issued.', 'success');
      loadEmployerWorkspace();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTargetProject) return;
    try {
      await api.post('/reviews', {
        projectId: reviewTargetProject._id,
        ...reviewForm,
      });
      notify('Verified review submitted! Worker Dynamic Reputation updated.', 'success');
      setReviewTargetProject(null);
      setReviewForm({
        quality: 5,
        punctuality: 5,
        reliability: 5,
        satisfaction: 5,
        wouldRehire: true,
        comment: '',
      });
      loadEmployerWorkspace();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleRepeatHire = async (project: any) => {
    try {
      await api.post('/hiring-requests', {
        workerId: project.workerId,
        projectTitle: `Repeat Hire: ${project.category} Project (${project.city})`,
        category: project.category,
        offeredDailyWage: project.agreedDailyWage,
        durationDays: project.durationDays || 3,
        city: project.city,
        isRepeatHire: true,
        message: `Rehiring following successful completion of "${project.title}".`,
      });
      notify(`Repeat Hire offer sent directly to ${project.workerName}!`, 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  if (loading && !empProfile) {
    return <div className="p-12 text-center text-sm text-slate-500">Loading Employer Hiring Console...</div>;
  }

  const ongoingProjects = projects.filter((p) => p.stage !== 'Completed');
  const completedProjects = projects.filter((p) => p.stage === 'Completed');

  const chatContactsMap = new Map<string, string>();
  projects.forEach((p) => {
    if (p.workerId) chatContactsMap.set(p.workerId, p.workerName || 'Worker');
  });
  applications.forEach((a) => {
    if (a.workerId) chatContactsMap.set(a.workerId, a.workerName || 'Applicant');
  });
  const chatContacts = Array.from(chatContactsMap.entries()).map(([id, name]) => ({ id, name }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">
            Employer &amp; Contractor Hiring Console · {empProfile?.employerType || 'Employer'} · {empProfile?.city || user?.city}
          </div>
          <h1 className="mt-0.5 font-display text-2xl font-bold text-slate-950">
            {empProfile?.organizationName || user?.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('post_job')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            + Post New Job Requirement
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-red-700 border border-slate-200 rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-1 p-1.5 bg-slate-200/70 rounded-xl">
        {([
          { id: 'overview', label: 'Overview & AI Matches' },
          { id: 'post_job', label: 'AI Job Generator & Post' },
          { id: 'shortlist', label: `Smart Shortlisting (${applications.length})` },
          { id: 'projects_reviews', label: `Projects & Repeat Hire (${projects.length})` },
          { id: 'profile_chat', label: 'Company Profile & Chat' },
        ] as { id: EmployerTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === t.id ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & AI-RECOMMENDED WORKERS */}
      {activeTab === 'overview' && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Active Open Jobs</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">{myJobs.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Applications Received</div>
              <div className="mt-1 font-mono text-2xl font-bold text-teal-700 tabular-nums">{applications.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Shortlisted Workers</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">{savedWorkerIds.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Ongoing / Completed Projects</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">
                {ongoingProjects.length} / {completedProjects.length}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* AI-Recommended Workers */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    AI-Recommended Skilled Workers
                  </h2>
                  <p className="text-xs text-slate-500">
                    Matched against your active job requirements using Python TF-IDF &amp; 2dsphere proximity.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fairMode}
                    onChange={(e) => setFairMode(e.target.checked)}
                  />
                  <span>Fair Opportunity Mode</span>
                </label>
              </div>

              <div className="mt-4 divide-y divide-slate-200">
                {aiMatchedWorkers.slice(0, 4).map((m) => {
                  const w = m.worker;
                  if (!w) return null;
                  const saved = savedWorkerIds.includes(w._id);
                  return (
                    <div key={m.workerId} className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-lg">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-base font-bold text-slate-950">{w.name}</h3>
                          <span className="text-xs text-slate-500">
                            · {w.profile?.category} · {w.city} ({m.distanceKm} km)
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{m.explanation}</p>
                        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-slate-500 tabular-nums">
                          <span>Skill: {m.breakdown?.skillCompatibility}%</span>
                          <span>Reputation: {w.reputation?.overallScore ?? 72}/100</span>
                          <span>Rate: ₹{w.profile?.expectedDailyWage}/day</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="font-mono text-base font-bold text-teal-700 tabular-nums">
                          {m.overallScore}% Match
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleShortlistWorker(w._id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border cursor-pointer ${
                              saved
                                ? 'bg-teal-50 border-teal-600 text-teal-800 font-semibold'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Bookmark className="w-3 h-3" />
                            <span>{saved ? 'Shortlisted' : 'Shortlist'}</span>
                          </button>
                          {w.passportCode && (
                            <Link
                              to={`/passport/${w.passportCode}`}
                              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium"
                            >
                              Passport
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Employer Hiring Analytics Chart */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-base font-bold text-slate-950">
                Candidate Match Distribution
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Live compatibility scores across matched regional workers.
              </p>
              <div className="mt-4 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={aiMatchedWorkers.slice(0, 5).map((m) => ({
                      name: m.worker?.name?.split(' ')[0] || 'Worker',
                      score: m.overallScore,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip />
                    <Bar dataKey="score" name="AI Match %" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI JOB DESCRIPTION GENERATOR & JOB PUBLISHER */}
      {activeTab === 'post_job' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <h2 className="font-display text-lg font-bold text-slate-950">AI Job Description Generator</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter a 1-sentence requirement (e.g., trade, task, and city). KaushalSetu generates a complete job description, required skills, responsibilities, and recommended daily wage range.
            </p>
            <textarea
              rows={3}
              value={aiJobPrompt}
              onChange={(e) => setAiJobPrompt(e.target.value)}
              className="w-full p-3 text-sm border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              disabled={genJobBusy}
              onClick={handleGenerateJobWithAI}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {genJobBusy ? 'Drafting Structured Job...' : 'Generate Structured Job Specification'}
            </button>

            {wageHint && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <div className="font-semibold text-slate-900">AI Fair Wage Benchmark ({wageHint.city}):</div>
                <div className="font-mono text-base font-bold text-teal-700 tabular-nums">
                  ₹{wageHint.recommendedDailyMin} – ₹{wageHint.recommendedDailyMax} / day
                </div>
                <p className="text-slate-500 text-[11px]">{wageHint.disclaimer}</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-950">Review &amp; Publish Job Opportunity</h2>
            <form onSubmit={handlePublishJob} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  placeholder="e.g., Experienced Modular Kitchen Carpenter"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Trade / Skill Category (Any)</label>
                  <input
                    list="emp-trades-list"
                    value={jobForm.category}
                    onChange={(e) => setJobForm({ ...jobForm, category: e.target.value })}
                    placeholder="Select or type any trade..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  />
                  <datalist id="emp-trades-list">
                    {TRADE_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Work City (Any)</label>
                  <input
                    list="emp-cities-list"
                    value={jobForm.city}
                    onChange={(e) => setJobForm({ ...jobForm, city: e.target.value })}
                    placeholder="Select or type city..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  />
                  <datalist id="emp-cities-list">
                    {MAHARASHTRA_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Daily Wage Budget (₹)</label>
                  <input
                    type="number"
                    required
                    min={300}
                    value={jobForm.dailyWageBudget}
                    onChange={(e) => setJobForm({ ...jobForm, dailyWageBudget: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Detailed Job Description *</label>
                <textarea
                  rows={3}
                  required
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Required Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={jobForm.requiredSkills}
                    onChange={(e) => setJobForm({ ...jobForm, requiredSkills: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Estimated Days</label>
                  <input
                    type="number"
                    min={1}
                    value={jobForm.durationDays}
                    onChange={(e) => setJobForm({ ...jobForm, durationDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-red-50/70 border border-red-200 rounded-lg text-red-900 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={jobForm.isEmergency}
                  onChange={(e) => setJobForm({ ...jobForm, isEmergency: e.target.checked })}
                />
                <span>
                  Publish as Urgent Emergency Hiring (Immediately alerts nearby available workers via live WebSocket notification)
                </span>
              </label>

              <button
                type="submit"
                className="px-6 py-2.5 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Publish Verified Job Posting
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: AI SMART SHORTLISTING */}
      {activeTab === 'shortlist' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-slate-950">
            AI Smart Shortlisting — Ranked Candidate Applications
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Automatically ranked by Smart Rank Score (65% AI Job Compatibility + 35% Dynamic Reputation).
          </p>

          <div className="mt-4 divide-y divide-slate-200">
            {applications.length === 0 ? (
              <p className="text-xs text-slate-500 py-6">No candidate applications received yet.</p>
            ) : (
              applications.map((app, index) => (
                <div key={app._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="text-xs text-slate-500">
                      <span className="font-mono font-bold text-slate-900">Rank #{index + 1}</span>
                      <span className="mx-1.5">·</span>
                      <span>Job: {app.jobTitle}</span>
                      <span className="mx-1.5">·</span>
                      <span>Status: <strong className="uppercase">{app.status}</strong></span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-950">
                      {app.workerName} ({app.workerCategory})
                    </h3>
                    <p className="text-xs text-slate-600">{app.coverNote}</p>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      AI Match: {app.aiMatchScore}% · Reputation: {app.reputationScore}/100 · Verified Skills: {app.verifiedSkillsCount} · Proposed Wage: ₹{app.proposedDailyWage}/day
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {app.status !== 'accepted' && (
                      <>
                        <button
                          onClick={() => handleApplicationDecision(app._id, 'shortlisted')}
                          className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          Shortlist
                        </button>
                        <button
                          onClick={() => handleApplicationDecision(app._id, 'accepted')}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer"
                        >
                          Accept &amp; Create Agreement
                        </button>
                        <button
                          onClick={() => handleApplicationDecision(app._id, 'rejected')}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:text-red-700 cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {app.status === 'accepted' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Hired &amp; Project Active</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PROJECTS, COMPLETION CERTIFICATES, REVIEWS & REPEAT HIRING */}
      {activeTab === 'projects_reviews' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-950">
            Ongoing &amp; Completed Work Projects
          </h2>
          <div className="divide-y divide-slate-200">
            {projects.length === 0 ? (
              <p className="text-xs text-slate-500 py-6">No projects created yet.</p>
            ) : (
              projects.map((p) => (
                <div key={p._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="font-display text-base font-bold text-slate-950">{p.title}</div>
                    <div className="text-slate-600">
                      Worker: <strong>{p.workerName}</strong> · {p.city} ·{' '}
                      <span className="font-mono">₹{p.agreedDailyWage}/day x {p.durationDays}d</span> · Stage:{' '}
                      <strong className="text-teal-700">{p.stage}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {p.agreement && (
                      <button
                        onClick={() => downloadWorkAgreementPDF(p.agreement)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Agreement PDF</span>
                      </button>
                    )}

                    {p.stage !== 'Completed' && (
                      <button
                        onClick={() => handleConfirmProjectCompletion(p._id)}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-md cursor-pointer"
                      >
                        Confirm Work Completion
                      </button>
                    )}

                    {p.stage === 'Completed' && (
                      <>
                        <button
                          onClick={() => downloadCompletionCertificatePDF(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Certificate PDF</span>
                        </button>

                        {!p.review && (
                          <button
                            onClick={() => setReviewTargetProject(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-navy-900 text-white font-semibold rounded-md cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>Submit Rating</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleRepeatHire(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-900 font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Repeat Hire</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: EMPLOYER PROFILE & LIVE CHAT */}
      {activeTab === 'profile_chat' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-950">Employer / Organization Profile</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await api.put('/employers/profile', orgForm);
                notify('Employer profile updated in MongoDB!', 'success');
                loadEmployerWorkspace();
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Organization or Household Name</label>
                <input
                  type="text"
                  value={orgForm.organizationName}
                  onChange={(e) => setOrgForm({ ...orgForm, organizationName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Employer Type</label>
                  <select
                    value={orgForm.employerType}
                    onChange={(e) => setOrgForm({ ...orgForm, employerType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  >
                    <option value="Individual">Individual / Homeowner</option>
                    <option value="Contractor">Site Contractor</option>
                    <option value="Company">Enterprise / Pvt Ltd</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City</label>
                  <select
                    value={orgForm.city}
                    onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  >
                    {MAHARASHTRA_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <button type="submit" className="px-5 py-2 bg-navy-900 text-white font-semibold rounded-lg cursor-pointer">
                Save Employer Profile
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-950">Worker Direct Chat</h2>
              <span className="text-xs text-slate-500">{wsConnected ? 'Live WebSocket' : 'Syncing'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chatContacts.map((cc) => (
                <button
                  key={cc.id}
                  onClick={() => setChatPartner(cc)}
                  className={`px-3 py-1 text-xs rounded-md border cursor-pointer ${
                    chatPartner?.id === cc.id ? 'bg-navy-900 text-white border-navy-900' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {cc.name}
                </button>
              ))}
            </div>
            <div className="mt-3 h-56 overflow-y-auto p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              {liveMessages
                .filter((m) => !chatPartner || m.senderId === chatPartner.id || m.receiverId === chatPartner.id)
                .map((m) => (
                  <div key={m._id} className={m.senderId === user?._id ? 'text-right' : 'text-left'}>
                    <div
                      className={`inline-block px-3 py-2 rounded-lg max-w-[85%] text-left ${
                        m.senderId === user?._id ? 'bg-navy-900 text-white' : 'bg-white border border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] opacity-70">{m.senderName}</div>
                      <div>{m.content}</div>
                    </div>
                  </div>
                ))}
            </div>
            {chatContacts.length > 0 && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const target = chatPartner || chatContacts[0];
                  if (!target || !chatText.trim()) return;
                  await sendMessage(target.id, target.name, chatText);
                  setChatText('');
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message worker..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg cursor-pointer">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Multi-Factor Review Modal */}
      {reviewTargetProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="font-display text-lg font-bold text-slate-950">
              Rate Workmanship: {reviewTargetProject.workerName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{reviewTargetProject.title}</p>

            <form onSubmit={handleSubmitReview} className="mt-4 space-y-3 text-xs">
              {(['quality', 'punctuality', 'reliability', 'satisfaction'] as const).map((field) => (
                <div key={field} className="flex items-center justify-between">
                  <label className="capitalize font-medium text-slate-700">{field} (1 to 5)</label>
                  <select
                    value={reviewForm[field]}
                    onChange={(e) => setReviewForm({ ...reviewForm, [field]: Number(e.target.value) })}
                    className="px-3 py-1.5 border border-slate-300 rounded-md font-mono"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n} / 5</option>
                    ))}
                  </select>
                </div>
              ))}

              <label className="flex items-center gap-2 pt-1 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={reviewForm.wouldRehire}
                  onChange={(e) => setReviewForm({ ...reviewForm, wouldRehire: e.target.checked })}
                />
                <span>I would rehire this worker for future projects</span>
              </label>

              <textarea
                rows={3}
                required
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                placeholder="Share specific feedback on workmanship, safety, and timeliness..."
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewTargetProject(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-navy-900 text-white font-semibold rounded-lg cursor-pointer">
                  Submit Verified Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
