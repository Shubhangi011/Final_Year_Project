import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  LogOut,
  Mic,
  QrCode,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MAHARASHTRA_CITIES, resolveWorkerAvatar, TRADE_CATEGORIES } from '../utils/mediaAssets';
import {
  downloadCompletionCertificatePDF,
  downloadGeneratedProfilePDF,
  downloadSkillPassportPDF,
  downloadWorkAgreementPDF,
} from '../utils/pdfGenerator';

type WorkerTab = 'overview' | 'profile' | 'skills_ai' | 'projects_calendar' | 'passport' | 'messages_safety';

const TARGET_ROLES = [
  'Industrial Electrician',
  'Solar PV Lead Technician',
  'Master Boutique Designer & Tailor',
  'Senior Home Healthcare & Nursing Lead',
  'IT Networking & IP Surveillance Lead',
  'EV & Multi-Brand Master Diagnostic Tech',
  'Master Modular Carpenter',
  'Commercial Plumbing Supervisor',
  'Structural TIG/MIG Welder',
];

export function WorkerDashboard() {
  const {
    user,
    logout,
    notify,
    language,
    notifications,
    markNotificationRead,
    liveMessages,
    sendMessage,
    wsConnected,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<WorkerTab>('overview');
  const [workerBundle, setWorkerBundle] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [hiringRequests, setHiringRequests] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [passportData, setPassportData] = useState<any | null>(null);
  const [availability, setAvailability] = useState<any>({
    availableDates: [],
    unavailableDates: [],
    workingHours: { start: '08:30', end: '18:00' },
  });
  const [loading, setLoading] = useState(true);

  // AI Profile Generator state
  const [rawExperienceText, setRawExperienceText] = useState(
    'I have worked as an electrician for five years. I know concealed residential wiring, MCB distribution panels, inverter connections, and fault testing.'
  );
  const [generatedProfile, setGeneratedProfile] = useState<any | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  // Profile Edit Form state
  const [profileForm, setProfileForm] = useState<any>({
    name: '',
    gender: 'Female',
    category: 'Electrical',
    headline: '',
    bio: '',
    experienceYears: 2,
    expectedDailyWage: 800,
    maxTravelKm: 25,
    city: 'Latur',
    exactAddress: '',
    availabilityStatus: 'available',
    emergencyContactName: '',
    emergencyContactPhone: '',
    avatarDataUrl: '',
  });
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillProf, setNewSkillProf] = useState('Intermediate');

  // Certificate Upload Form
  const [certForm, setCertForm] = useState({
    title: '',
    issuingAuthority: '',
    issueYear: '2025',
    credentialNumber: '',
  });

  // Assessment Runner state
  const [activeAssessment, setActiveAssessment] = useState<any | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any | null>(null);

  // Skill Gap & Career state
  const [targetRole, setTargetRole] = useState('Industrial Electrician');
  const [skillGapResult, setSkillGapResult] = useState<any | null>(null);
  const [careerResult, setCareerResult] = useState<any | null>(null);

  // Messaging & Safety Report state
  const [selectedChatPartner, setSelectedChatPartner] = useState<{ id: string; name: string } | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [safetyReportText, setSafetyReportText] = useState('');
  const [disputeProject, setDisputeProject] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [wRes, recRes, appRes, hrRes, projRes, assRes, passRes, availRes] = await Promise.all([
        api.get(`/workers/${user._id}`),
        api.get('/workers/recommendations'),
        api.get('/applications'),
        api.get('/hiring-requests'),
        api.get('/projects'),
        api.get('/assessments'),
        api.get('/workers/skill-passport'),
        api.get('/workers/availability'),
      ]);

      const wb = wRes.data.worker;
      setWorkerBundle(wb);
      setProfileForm({
        name: wb.name || '',
        gender: wb.gender || wb.profile?.gender || 'Female',
        category: wb.profile?.category || 'Electrical',
        headline: wb.profile?.headline || '',
        bio: wb.profile?.bio || '',
        experienceYears: wb.profile?.experienceYears ?? 1,
        expectedDailyWage: wb.profile?.expectedDailyWage ?? 750,
        maxTravelKm: wb.profile?.maxTravelKm ?? 25,
        city: wb.city || 'Latur',
        exactAddress: wb.profile?.exactAddress || '',
        availabilityStatus: wb.profile?.availabilityStatus || 'available',
        emergencyContactName: wb.profile?.emergencyContact?.name || '',
        emergencyContactPhone: wb.profile?.emergencyContact?.phone || '',
        avatarDataUrl: wb.profile?.avatarDataUrl || '',
      });

      setRecommendations(recRes.data.recommendations || []);
      setApplications(appRes.data.applications || []);
      setHiringRequests(hrRes.data.hiringRequests || []);
      setProjects(projRes.data.projects || []);
      setAssessments(assRes.data.assessments || []);
      setPassportData(passRes.data);
      if (availRes.data.availability) setAvailability(availRes.data.availability);

      // Load AI Skill Gap & Career Growth
      const [gapRes, carRes] = await Promise.all([
        api.post('/ai/skill-gap-analysis', { targetRole }),
        api.post('/ai/career-recommendation', { category: wb.profile?.category }),
      ]);
      setSkillGapResult(gapRes.data.analysis);
      setCareerResult(carRes.data.career);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user?._id]);

  const runSkillGapForTarget = async (roleName: string) => {
    setTargetRole(roleName);
    try {
      const { data } = await api.post('/ai/skill-gap-analysis', { targetRole: roleName });
      setSkillGapResult(data.analysis);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleQuickApply = async (job: any) => {
    try {
      const { data } = await api.post('/applications', {
        jobId: job._id,
        proposedDailyWage: profileForm.expectedDailyWage || job.dailyWageBudget,
        coverNote: `Applied via AI Recommendation (${profileForm.experienceYears} yrs practical experience in ${profileForm.category}).`,
      });
      notify(`Applied! AI Compatibility Score: ${data.application.aiMatchScore}%`, 'success');
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleHiringRequestDecision = async (id: string, status: 'accepted' | 'declined') => {
    try {
      await api.put(`/hiring-requests/${id}/status`, { status });
      notify(status === 'accepted' ? 'Hiring offer accepted! Project & Work Agreement created.' : 'Offer declined.', 'success');
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/workers/profile', {
        ...profileForm,
        emergencyContact: {
          name: profileForm.emergencyContactName,
          relation: 'Emergency Contact',
          phone: profileForm.emergencyContactPhone,
        },
      });
      notify('Worker profile & safety details saved to MongoDB!', 'success');
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev: any) => ({ ...prev, avatarDataUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAIProfile = async () => {
    setGenBusy(true);
    try {
      const { data } = await api.post('/ai/generate-profile', {
        rawText: rawExperienceText,
        language,
      });
      setGeneratedProfile(data.profile);
      notify('Professional profile generated! Review and apply below.', 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setGenBusy(false);
    }
  };

  const handleVoiceProfileInput = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setRawExperienceText(
        'मी पाच वर्षांपासून प्लंबर म्हणून काम करत आहे. मला सीपीव्हीसी पाईप फिटिंग, बाथरूम बसवणे आणि पाण्याची गळती दुरुस्ती येते.'
      );
      notify('Sample Marathi voice description inserted—click Generate AI Profile!', 'info');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    rec.onresult = (ev: any) => {
      const txt = ev.results?.[0]?.[0]?.transcript || '';
      if (txt) setRawExperienceText(txt);
    };
    rec.start();
  };

  const applyGeneratedToProfile = async () => {
    if (!generatedProfile) return;
    try {
      await api.put('/workers/profile', {
        ...profileForm,
        category: generatedProfile.category,
        headline: generatedProfile.headline,
        bio: generatedProfile.professionalSummary,
        experienceYears: generatedProfile.experienceYears,
      });
      for (const sk of generatedProfile.extractedSkills || []) {
        await api.post('/workers/skills', {
          name: sk.name,
          category: generatedProfile.category,
          proficiency: sk.proficiency,
        });
      }
      notify('AI-generated headline, bio, and trade skills saved to your profile!', 'success');
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    try {
      await api.post('/workers/skills', {
        name: newSkillName,
        category: profileForm.category,
        proficiency: newSkillProf,
      });
      setNewSkillName('');
      notify('Self-declared skill added. Take an assessment to verify it!', 'success');
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleUploadCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/workers/certificates', certForm);
      setCertForm({ title: '', issuingAuthority: '', issueYear: '2025', credentialNumber: '' });
      notify('Certificate submitted to Admin Verification Queue!', 'success');
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleSubmitAssessment = async () => {
    if (!activeAssessment) return;
    const answers = (activeAssessment.questions || []).map((_: any, idx: number) =>
      quizAnswers[idx] !== undefined ? quizAnswers[idx] : -1
    );
    try {
      const { data } = await api.post(`/assessments/${activeAssessment._id}/submit`, { answers });
      setQuizResult(data);
      notify(
        `Assessment Scored ${data.result.score}% — Awarded ${data.result.proficiencyAwarded} Assessed Badge!`,
        'success'
      );
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleUpdateProjectStage = async (projectId: string, stage: string) => {
    try {
      await api.put(`/projects/${projectId}/status`, { stage });
      notify(`Project moved to "${stage}"`, 'success');
      loadAll();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const toggleCalendarDate = async (dateStr: string) => {
    const currentAvail: string[] = availability.availableDates || [];
    const nextAvail = currentAvail.includes(dateStr)
      ? currentAvail.filter((d) => d !== dateStr)
      : [...currentAvail, dateStr];
    setAvailability({ ...availability, availableDates: nextAvail });
    try {
      await api.put('/workers/availability', {
        ...availability,
        availableDates: nextAvail,
      });
      notify(`Updated availability for ${dateStr}`, 'info');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeProject || !disputeReason.trim()) return;
    try {
      await api.post('/disputes', {
        projectId: disputeProject._id,
        reason: disputeReason,
        evidenceNotes: 'Submitted from Worker Workspace for fair admin mediation.',
      });
      notify('Dispute submitted for Admin mediation.', 'success');
      setDisputeProject(null);
      setDisputeReason('');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  if (loading && !workerBundle) {
    return <div className="p-12 text-center text-sm text-slate-500">Loading Worker Intelligence Workspace...</div>;
  }

  const avatar = resolveWorkerAvatar(workerBundle?.profile);
  const rep = workerBundle?.reputation;
  const completedProjects = projects.filter((p) => p.stage === 'Completed');
  const totalEarned = completedProjects.reduce(
    (acc, p) => acc + Number(p.agreedDailyWage || 0) * Number(p.durationDays || 1),
    0
  );

  // Compute real profile completion percentage
  let completionPts = 40;
  if (workerBundle?.profile?.bio?.length > 20) completionPts += 15;
  if ((workerBundle?.skills || []).length > 0) completionPts += 15;
  if ((workerBundle?.skills || []).some((s: any) => s.verificationType !== 'self_declared')) completionPts += 15;
  if (workerBundle?.profile?.emergencyContact?.phone) completionPts += 15;

  // Unique chat contacts from projects/messages
  const chatPartnersMap = new Map<string, string>();
  projects.forEach((p) => {
    if (p.employerId) chatPartnersMap.set(p.employerId, p.employerName || 'Employer');
  });
  liveMessages.forEach((m) => {
    if (m.senderId !== user?._id) chatPartnersMap.set(m.senderId, m.senderName || 'Contact');
    if (m.receiverId !== user?._id) chatPartnersMap.set(m.receiverId, m.receiverName || 'Contact');
  });
  const chatPartners = Array.from(chatPartnersMap.entries()).map(([id, name]) => ({ id, name }));

  // Generate 14 upcoming dates for availability calendar
  const calendarDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Workspace Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt={workerBundle?.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-navy-900 text-white flex items-center justify-center font-display text-xl font-bold shrink-0">
              {user?.name?.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-xs text-slate-500">
              <span>Worker Intelligence Workspace</span>
              <span className="mx-1.5">·</span>
              <span>{workerBundle?.profile?.category}</span>
              <span className="mx-1.5">·</span>
              <span>{workerBundle?.city}</span>
              <span className="mx-1.5">·</span>
              <span>Profile {completionPts}% Complete</span>
            </div>
            <h1 className="mt-0.5 font-display text-2xl font-bold text-slate-950">
              Namaste, {workerBundle?.name}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {workerBundle?.passportCode && (
            <Link
              to={`/passport/${workerBundle.passportCode}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Public Passport ({workerBundle.passportCode})</span>
            </Link>
          )}
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-red-700 border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Segmented Workspace Navigation Tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-1 p-1.5 bg-slate-200/70 rounded-xl">
        {([
          { id: 'overview', label: 'Overview & AI Matches' },
          { id: 'profile', label: 'Profile & AI Builder' },
          { id: 'skills_ai', label: 'Skill Assessments & Career Lab' },
          { id: 'projects_calendar', label: 'Projects, Agreements & Calendar' },
          { id: 'passport', label: 'Digital Skill Passport' },
          { id: 'messages_safety', label: 'Chat & Safety SOS' },
        ] as { id: WorkerTab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW, REPUTATION & AI JOB MATCHES */}
      {activeTab === 'overview' && (
        <div className="mt-6 space-y-6">
          {/* 4 KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Dynamic Reputation Score</div>
              <div className="mt-1 font-mono text-2xl font-bold text-teal-700 tabular-nums">
                {rep?.overallScore ?? 72.0} / 100
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {rep?.isFairStartBaseline ? 'Fair-Start Baseline Active' : 'Bayesian Verified Score'}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Assessed / Verified Skills</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">
                {(workerBundle?.skills || []).filter((s: any) => s.verificationType !== 'self_declared').length} / {(workerBundle?.skills || []).length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Credibility multiplier active</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Active &amp; Completed Projects</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">
                {projects.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{completedProjects.length} completed with certificate</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">Verified Platform Earnings</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">
                ₹{totalEarned.toLocaleString('en-IN')}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Expected ₹{profileForm.expectedDailyWage}/day</div>
            </div>
          </div>

          {/* Pending Direct / Repeat Hiring Requests */}
          {hiringRequests.filter((h) => h.status === 'pending').length > 0 && (
            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-5">
              <h2 className="font-display text-base font-bold text-slate-950">
                Incoming Direct &amp; Repeat Hiring Offers
              </h2>
              <div className="mt-3 divide-y divide-teal-200/60">
                {hiringRequests
                  .filter((h) => h.status === 'pending')
                  .map((hr) => (
                    <div key={hr._id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">
                          {hr.isRepeatHire ? '[Repeat Hire] ' : ''}{hr.projectTitle} — {hr.employerName}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Offered: <span className="font-mono font-semibold">₹{hr.offeredDailyWage}/day</span> · {hr.durationDays} days · {hr.city}
                          {hr.meetingScheduledAt && ` · Meeting: ${hr.meetingScheduledAt}`}
                        </div>
                        {hr.message && <p className="text-xs text-slate-600 mt-1">&ldquo;{hr.message}&rdquo;</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleHiringRequestDecision(hr._id, 'declined')}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleHiringRequestDecision(hr._id, 'accepted')}
                          className="px-4 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer"
                        >
                          Accept &amp; Generate Agreement
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* AI Recommended Jobs */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    AI-Recommended Job Opportunities
                  </h2>
                  <p className="text-xs text-slate-500">
                    Scored in real time by Python TF-IDF skill similarity, Haversine distance, and daily wage fit.
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-slate-200">
                {recommendations.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No open jobs currently available.</p>
                ) : (
                  recommendations.map((rec) => {
                    const jb = rec.job;
                    if (!jb) return null;
                    const alreadyApplied = applications.some((a) => a.jobId === jb._id);

                    return (
                      <div key={rec.jobId} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs text-slate-500">
                              {jb.isEmergency && <span className="font-bold text-red-700 mr-1.5">URGENT ·</span>}
                              <span>{jb.category}</span>
                              <span className="mx-1.5">·</span>
                              <span>{jb.city} ({rec.distanceKm} km)</span>
                              <span className="mx-1.5">·</span>
                              <span className="font-mono">₹{jb.dailyWageBudget}/day</span>
                            </div>
                            <h3 className="mt-1 font-display text-base font-bold text-slate-950">{jb.title}</h3>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono text-lg font-bold text-teal-700 tabular-nums">
                              {rec.overallScore}% Match
                            </div>
                            {alreadyApplied ? (
                              <span className="text-xs text-slate-500 font-medium">Applied</span>
                            ) : (
                              <button
                                onClick={() => handleQuickApply(jb)}
                                className="mt-1 px-3 py-1 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-md cursor-pointer"
                              >
                                1-Click Apply
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Explainable 5-Dimension Breakdown */}
                        <div className="mt-2.5 grid grid-cols-5 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg font-mono tabular-nums">
                          <div>Skill: {rec.breakdown?.skillCompatibility}%</div>
                          <div>Exp: {rec.breakdown?.experienceCompatibility}%</div>
                          <div>Geo: {rec.breakdown?.locationCompatibility}%</div>
                          <div>Avail: {rec.breakdown?.availabilityCompatibility}%</div>
                          <div>Wage: {rec.breakdown?.budgetCompatibility}%</div>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">{rec.explanation}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reputation History Chart & Notifications */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-slate-950">
                  Reputation Score Trajectory
                </h2>
                <p className="mt-1 text-xs text-slate-500">{rep?.explanation}</p>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rep?.history || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-display text-base font-bold text-slate-950">
                  Live Notifications ({notifications.filter((n) => !n.read).length} Unread)
                </h2>
                <div className="mt-3 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div key={n._id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                        <div>
                          <div className={`font-semibold ${n.read ? 'text-slate-600' : 'text-slate-950'}`}>{n.title}</div>
                          <div className="text-slate-500 mt-0.5">{n.body}</div>
                        </div>
                        {!n.read && (
                          <button
                            onClick={() => markNotificationRead(n._id)}
                            className="text-[11px] text-teal-700 hover:underline shrink-0 cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE EDITOR, AI PROFILE GENERATOR & CERTIFICATES */}
      {activeTab === 'profile' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* AI Professional Profile Generator */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <h2 className="font-display text-lg font-bold text-slate-950">
                AI Professional Profile Generator
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Describe your trade work in simple everyday sentences or speak in Marathi/Hindi/English. AI converts it into a structured professional profile &amp; downloadable PDF resume.
            </p>

            <textarea
              rows={4}
              value={rawExperienceText}
              onChange={(e) => setRawExperienceText(e.target.value)}
              className="w-full p-3 text-sm border border-slate-300 rounded-lg"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVoiceProfileInput}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Voice Input</span>
              </button>
              <button
                type="button"
                disabled={genBusy}
                onClick={handleGenerateAIProfile}
                className="flex-1 py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {genBusy ? 'Generating...' : 'Generate Professional Profile'}
              </button>
            </div>

            {generatedProfile && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                <div className="font-display text-sm font-bold text-slate-950">{generatedProfile.headline}</div>
                <p className="text-slate-700 leading-relaxed">{generatedProfile.professionalSummary}</p>
                <div className="text-slate-600">
                  <strong>Extracted Skills:</strong>{' '}
                  {(generatedProfile.extractedSkills || []).map((s: any) => `${s.name} (${s.proficiency})`).join(' · ')}
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyGeneratedToProfile}
                    className="px-3 py-1.5 bg-navy-900 text-white font-semibold rounded-md cursor-pointer"
                  >
                    Apply to My Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadGeneratedProfilePDF(profileForm.name, profileForm.city, generatedProfile)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white text-slate-800 font-medium rounded-md cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Profile PDF</span>
                  </button>
                </div>
              </div>
            )}

            {/* Add Self-Declared Skill & Direct 4-Module Learning Links */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="font-display text-sm font-bold text-slate-950">Add Practical Skill &amp; Study Modules</h3>
              <form onSubmit={handleAddSkill} className="flex gap-2">
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. Inverter Wiring or any custom skill"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <select
                  value={newSkillProf}
                  onChange={(e) => setNewSkillProf(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
                <button type="submit" className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer">
                  Add
                </button>
              </form>

              {(workerBundle?.skills || []).length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/60">
                  {(workerBundle?.skills || []).map((sk: any) => (
                    <div key={sk._id || sk.name} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="truncate">
                        <span className="font-medium text-slate-900">{sk.name}</span>
                        <span className="text-slate-500"> · {sk.proficiency}</span>
                      </div>
                      <Link
                        to={`/learning?skill=${encodeURIComponent(sk.name)}`}
                        className="text-teal-700 hover:underline font-semibold whitespace-nowrap shrink-0"
                      >
                        4 Modules &rarr;
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200">
              <h3 className="font-display text-sm font-bold text-slate-950">Submit Trade Certificate for Verification</h3>
              <form onSubmit={handleUploadCertificate} className="mt-2 space-y-2.5 text-xs">
                <input
                  type="text"
                  required
                  placeholder="Certificate Title (e.g., ITI Wireman / Suryamitra)"
                  value={certForm.title}
                  onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Issuing Authority"
                    value={certForm.issuingAuthority}
                    onChange={(e) => setCertForm({ ...certForm, issuingAuthority: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Credential / Reg No."
                    value={certForm.credentialNumber}
                    onChange={(e) => setCertForm({ ...certForm, credentialNumber: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-navy-900 text-white font-semibold rounded-lg cursor-pointer">
                  Submit for Admin Verification
                </button>
              </form>
            </div>
          </div>

          {/* Complete Worker Profile Editor */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-950">Edit Worker Profile &amp; Wage Preferences</h2>
            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Profile Photo Upload</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  >
                    <option value="Female">Woman / Female</option>
                    <option value="Male">Man / Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Primary Trade (Open / Any)</label>
                  <input
                    list="worker-trades-list"
                    value={profileForm.category}
                    onChange={(e) => setProfileForm({ ...profileForm, category: e.target.value })}
                    placeholder="Select or type any skill..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  />
                  <datalist id="worker-trades-list">
                    {TRADE_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    value={profileForm.experienceYears}
                    onChange={(e) => setProfileForm({ ...profileForm, experienceYears: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Expected Wage (₹/day)</label>
                  <input
                    type="number"
                    min={300}
                    value={profileForm.expectedDailyWage}
                    onChange={(e) => setProfileForm({ ...profileForm, expectedDailyWage: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Professional Headline</label>
                <input
                  type="text"
                  value={profileForm.headline}
                  onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Practical Bio &amp; Work Summary</label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Working City (Any)</label>
                  <input
                    list="worker-cities-list"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  />
                  <datalist id="worker-cities-list">
                    {MAHARASHTRA_CITIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Max Travel Distance (km)</label>
                  <input
                    type="number"
                    value={profileForm.maxTravelKm}
                    onChange={(e) => setProfileForm({ ...profileForm, maxTravelKm: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Current Availability</label>
                  <select
                    value={profileForm.availabilityStatus}
                    onChange={(e) => setProfileForm({ ...profileForm, availabilityStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  >
                    <option value="available">Available Immediately</option>
                    <option value="part_time">Part-Time / Weekends</option>
                    <option value="busy">Assigned on Project</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Exact Residential Address (Private — Never shown publicly on maps)
                </label>
                <input
                  type="text"
                  value={profileForm.exactAddress}
                  onChange={(e) => setProfileForm({ ...profileForm, exactAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Save Worker Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: SKILL ASSESSMENTS, SKILL GAP ANALYZER & CAREER GROWTH */}
      {activeTab === 'skills_ai' && (
        <div className="mt-6 space-y-6">
          {/* Interactive Skill Assessment Engine */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-950">
              AI Scenario-Based Trade Skill Verification
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Pass real-world technical &amp; safety scenario checks to upgrade skills from Self-Declared to AI-Assessed on your Digital Skill Passport.
            </p>

            {!activeAssessment ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {assessments.map((ass) => (
                  <div key={ass._id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-teal-700 font-semibold">{ass.category}</div>
                      <h3 className="mt-1 font-display text-sm font-bold text-slate-950">{ass.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Verifies: {ass.skillName} · {(ass.questions || []).length} scenario questions
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveAssessment(ass);
                        setQuizAnswers({});
                        setQuizResult(null);
                      }}
                      className="mt-4 w-full py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Start Assessment
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-slate-950">{activeAssessment.title}</h3>
                  <button
                    onClick={() => setActiveAssessment(null)}
                    className="text-xs text-slate-600 hover:text-slate-950 cursor-pointer"
                  >
                    &larr; Back to All Assessments
                  </button>
                </div>

                {(activeAssessment.questions || []).map((q: any, qIdx: number) => (
                  <div key={q._id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                    <div className="text-xs text-teal-700 font-medium">Scenario: {q.scenarioContext}</div>
                    <div className="text-sm font-semibold text-slate-900">
                      Q{qIdx + 1}. {q.questionText}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {(q.options || []).map((opt: string, oIdx: number) => (
                        <label
                          key={oIdx}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer ${
                            quizAnswers[qIdx] === oIdx
                              ? 'border-teal-600 bg-teal-50/60 text-slate-950 font-medium'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${qIdx}`}
                            checked={quizAnswers[qIdx] === oIdx}
                            onChange={() => setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx })}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                    {quizResult?.feedback?.[qIdx] && (
                      <div className="mt-2 p-2.5 rounded bg-slate-100 text-xs text-slate-700">
                        <strong>{quizResult.feedback[qIdx].correct ? 'Correct:' : 'Explanation:'}</strong>{' '}
                        {quizResult.feedback[qIdx].explanation}
                      </div>
                    )}
                  </div>
                ))}

                {!quizResult ? (
                  <button
                    onClick={handleSubmitAssessment}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Submit &amp; Verify Proficiency
                  </button>
                ) : (
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                    <div className="text-xs text-teal-950">
                      <strong>Score: {quizResult.result.score}%</strong> · Proficiency Awarded:{' '}
                      <strong>{quizResult.result.proficiencyAwarded}</strong> · Reputation synced to {quizResult.reputation?.overallScore}/100!
                    </div>
                    <button
                      onClick={() => setActiveAssessment(null)}
                      className="px-4 py-1.5 bg-navy-900 text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Skill Gap Analyzer + AI Career Growth Ladder */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950">AI Skill Gap Analyzer</h2>
                  <p className="text-xs text-slate-500">Compare your current skills against higher-paying specialist roles.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    list="target-roles-list"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="Select or type any target role..."
                    className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium w-56"
                  />
                  <datalist id="target-roles-list">
                    {TARGET_ROLES.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => runSkillGapForTarget(targetRole)}
                    className="px-3 py-2 bg-navy-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Analyze
                  </button>
                </div>
              </div>

              {skillGapResult && (
                <div className="mt-5 space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <span className="text-slate-600">Role Readiness: </span>
                      <strong className="font-mono text-base text-slate-950 tabular-nums">
                        {skillGapResult.readinessPercentage}%
                      </strong>
                    </div>
                    <div className="text-teal-700 font-semibold font-mono tabular-nums">
                      +{skillGapResult.estimatedWageUpliftPct}% Potential Wage Uplift
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">
                      Missing Competencies to Acquire (Click any skill to study its 4 modules):
                    </div>
                    <div className="mt-1.5 text-slate-600 leading-relaxed">
                      {(skillGapResult.missingSkills || []).length === 0 ? (
                        <span>All core skills covered!</span>
                      ) : (
                        (skillGapResult.missingSkills || []).map((ms: string, idx: number) => (
                          <React.Fragment key={ms}>
                            {idx > 0 && <span className="mx-1.5 text-slate-400">·</span>}
                            <Link
                              to={`/learning?skill=${encodeURIComponent(ms)}`}
                              className="text-teal-700 hover:underline font-medium"
                            >
                              {ms} (4 Modules)
                            </Link>
                          </React.Fragment>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">Personalized Upskilling Roadmap:</span>
                      <Link to="/learning" className="text-teal-700 hover:underline font-semibold">
                        Browse All Skill Courses &rarr;
                      </Link>
                    </div>
                    <div className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {(skillGapResult.learningRoadmap || []).slice(0, 5).map((step: any) => (
                        <div key={step.step} className="p-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">
                              0{step.step}. {step.title}
                            </div>
                            <div className="text-slate-500 mt-0.5">{step.detail}</div>
                          </div>
                          <span className="font-mono text-slate-500 shrink-0">{step.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-lg font-bold text-slate-950">AI Career Growth Pathway</h2>
              <p className="mt-1 text-xs text-slate-500">
                Progression milestones for {careerResult?.category || profileForm.category}.
              </p>

              {careerResult && (
                <div className="mt-4 space-y-3">
                  {(careerResult.pathway || []).map((st: any, idx: number) => {
                    const isCurrent = idx === careerResult.currentStageIndex;
                    const isCompleted = idx < careerResult.currentStageIndex;
                    return (
                      <div
                        key={st.stage}
                        className={`p-3.5 rounded-lg border text-xs ${
                          isCurrent
                            ? 'border-teal-600 bg-teal-50/50'
                            : isCompleted
                            ? 'border-slate-200 bg-slate-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-950">
                          <span>
                            {idx + 1}. {st.stage} {isCurrent ? '(Current)' : ''}
                          </span>
                          <span className="font-mono text-teal-700 tabular-nums">~₹{st.avg_daily_wage}/day</span>
                        </div>
                        <p className="mt-1 text-slate-600">{st.milestone}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROJECTS, AGREEMENTS & AVAILABILITY CALENDAR */}
      {activeTab === 'projects_calendar' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-950">
              Work Progress Tracking &amp; Digital Agreements
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Pipeline: Requested &rarr; Accepted &rarr; In Progress &rarr; Submitted for Review &rarr; Completed.
            </p>

            <div className="mt-4 space-y-4">
              {projects.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No projects assigned yet. Apply to AI-recommended jobs to begin!</p>
              ) : (
                projects.map((p) => (
                  <div key={p._id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-display text-sm font-bold text-slate-950">{p.title}</div>
                        <div className="text-slate-500 mt-0.5">
                          Employer: {p.employerName} · {p.city} · <span className="font-mono">₹{p.agreedDailyWage}/day x {p.durationDays}d</span>
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-teal-700">{p.stage}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                      {p.stage === 'Accepted' && (
                        <button
                          onClick={() => handleUpdateProjectStage(p._id, 'In Progress')}
                          className="px-3 py-1.5 bg-navy-900 text-white font-semibold rounded-md cursor-pointer"
                        >
                          Mark Work Started (In Progress)
                        </button>
                      )}
                      {p.stage === 'In Progress' && (
                        <button
                          onClick={() => handleUpdateProjectStage(p._id, 'Submitted for Review')}
                          className="px-3 py-1.5 bg-teal-600 text-white font-semibold rounded-md cursor-pointer"
                        >
                          Submit Completed Work for Employer Review
                        </button>
                      )}
                      {p.agreement && (
                        <button
                          onClick={() => downloadWorkAgreementPDF(p.agreement)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 bg-white text-slate-800 rounded-md cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Agreement PDF</span>
                        </button>
                      )}
                      {p.stage === 'Completed' && (
                        <button
                          onClick={() => downloadCompletionCertificatePDF(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 text-white font-semibold rounded-md cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Completion Certificate PDF</span>
                        </button>
                      )}
                      <button
                        onClick={() => setDisputeProject(p)}
                        className="px-3 py-1.5 text-slate-600 hover:text-red-700 cursor-pointer"
                      >
                        Report Issue / Dispute
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Worker Availability Calendar */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <h2 className="font-display text-lg font-bold text-slate-950">Availability Calendar</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Click dates to toggle your open availability for AI job matching and emergency hiring alerts.
            </p>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {calendarDates.map((dt) => {
                const isAvail = (availability.availableDates || []).includes(dt);
                return (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => toggleCalendarDate(dt)}
                    className={`p-2.5 rounded-lg border text-xs font-mono tabular-nums text-left transition-colors cursor-pointer ${
                      isAvail
                        ? 'border-teal-600 bg-teal-50 text-teal-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>{dt}</div>
                    <div className="text-[10px] font-sans mt-0.5">{isAvail ? 'Available' : 'Off / Unset'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DIGITAL SKILL PASSPORT */}
      {activeTab === 'passport' && passportData && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="font-mono text-xs font-semibold text-teal-700">
              UNIQUE WORKER IDENTITY · {passportData.passportCode}
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-950">
              Your Verifiable Digital Skill Passport
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Share your QR code with homeowners, site engineers, and contractors to prove your AI-assessed trade skills, completed project certificates, and Bayesian reputation score without needing formal college degrees.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => downloadSkillPassportPDF(passportData)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Printable PDF Passport</span>
              </button>
              <Link
                to={`/passport/${passportData.passportCode}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                <UserCheck className="w-4 h-4" />
                <span>Open Public Verification View</span>
              </Link>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center shrink-0">
            <img src={passportData.qrDataUrl} alt="Digital Skill Passport QR" className="w-36 h-36 mx-auto" />
            <div className="mt-2 font-mono text-xs font-semibold text-slate-800">{passportData.passportCode}</div>
          </div>
        </div>
      )}

      {/* TAB 6: REAL-TIME MESSAGES & WORKER SAFETY MODULE */}
      {activeTab === 'messages_safety' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* WebSocket Live Chat */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-950">Employer Direct Messages</h2>
              <span className="text-xs text-slate-500">
                {wsConnected ? 'Live WebSocket Connected' : 'Syncing...'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {chatPartners.map((cp) => (
                <button
                  key={cp.id}
                  onClick={() => setSelectedChatPartner(cp)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    selectedChatPartner?.id === cp.id
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {cp.name}
                </button>
              ))}
            </div>

            <div className="mt-4 h-64 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
              {liveMessages.length === 0 ? (
                <p className="text-slate-500">No messages yet.</p>
              ) : (
                liveMessages
                  .filter(
                    (m) =>
                      !selectedChatPartner ||
                      m.senderId === selectedChatPartner.id ||
                      m.receiverId === selectedChatPartner.id
                  )
                  .map((m) => {
                    const mine = m.senderId === user?._id;
                    return (
                      <div key={m._id} className={mine ? 'text-right' : 'text-left'}>
                        <div
                          className={`inline-block px-3 py-2 rounded-lg max-w-[85%] text-left ${
                            mine ? 'bg-navy-900 text-white' : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="text-[10px] opacity-70 mb-0.5">{m.senderName}</div>
                          <div>{m.content}</div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {chatPartners.length > 0 && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const target = selectedChatPartner || chatPartners[0];
                  if (!target || !chatInput.trim()) return;
                  await sendMessage(target.id, target.name, chatInput);
                  setChatInput('');
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Write message to employer..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg cursor-pointer">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Worker Safety & Emergency Module */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h2 className="font-display text-lg font-bold text-slate-950">Worker On-Site Safety Module</h2>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
              <div className="font-semibold text-slate-900">Mandatory Trade Safety Reminders:</div>
              <div>1. Isolate MCB/main isolator and test voltage with calibrated meter before handling bare conductors.</div>
              <div>2. Wear insulated footwear, safety eyewear, and harness on rooftop solar or scaffold work.</div>
              <div>3. Confirm bilateral KaushalSetu Work Agreement before starting multi-day site work.</div>
            </div>

            <div className="text-xs">
              <div className="font-semibold text-slate-900">Registered Emergency Contact:</div>
              <div className="text-slate-600 mt-0.5">
                {profileForm.emergencyContactName || 'Not set'} ·{' '}
                <span className="font-mono">{profileForm.emergencyContactPhone || 'Add in Profile tab'}</span> · National Helpline: <span className="font-mono font-bold">112</span>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!safetyReportText.trim()) return;
                await api.post('/reports', {
                  targetType: 'worksite_safety',
                  category: 'Unsafe Worksite / Payment Harassment',
                  description: safetyReportText,
                });
                setSafetyReportText('');
                notify('Safety report logged for immediate Admin investigation.', 'success');
              }}
              className="space-y-2.5 pt-2 border-t border-slate-200 text-xs"
            >
              <label className="block font-semibold text-slate-900">Report Unsafe Site or Employer Violation</label>
              <textarea
                rows={3}
                value={safetyReportText}
                onChange={(e) => setSafetyReportText(e.target.value)}
                placeholder="Describe unsafe electrical/height conditions, misleading job location, or wage violation..."
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
              <button type="submit" className="w-full py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg cursor-pointer">
                Submit Safety Alert to Governance Team
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="font-display text-base font-bold text-slate-950">
              Submit Project Dispute: {disputeProject.title}
            </h3>
            <form onSubmit={handleFileDispute} className="mt-4 space-y-3 text-xs">
              <textarea
                rows={3}
                required
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe payment delay, scope disagreement, or site issue..."
                className="w-full p-3 border border-slate-300 rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDisputeProject(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-navy-900 text-white font-semibold rounded-lg cursor-pointer">
                  Submit Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
