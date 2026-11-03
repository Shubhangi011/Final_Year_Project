import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, Share2 } from 'lucide-react';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getWorkerInitials, resolveWorkerAvatar } from '../utils/mediaAssets';
import { downloadSkillPassportPDF } from '../utils/pdfGenerator';

export function SkillPassportPublicPage() {
  const { code } = useParams();
  const { notify } = useAuth();
  const [passport, setPassport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    api
      .get(`/passport/${code}`)
      .then(({ data }) => setPassport(data))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-14 text-center text-sm text-slate-500">
        Verifying Digital Skill Passport ledger...
      </div>
    );
  }

  if (error || !passport) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-950">Skill Passport Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">{error || 'Invalid passport verification code.'}</p>
        <Link to="/workers" className="inline-block mt-5 px-4 py-2 bg-navy-900 text-white text-xs font-semibold rounded-lg">
          Browse Verified Workers
        </Link>
      </div>
    );
  }

  const w = passport.worker;
  const rep = w?.reputation;
  const avatar = resolveWorkerAvatar(w?.profile);
  const genderLabel = w?.profile?.gender || w?.gender || '';
  const verifiedSkills = (w?.skills || []).filter((s: any) => s.verificationType !== 'self_declared');
  const declaredSkills = (w?.skills || []).filter((s: any) => s.verificationType === 'self_declared');

  const copyShareLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    notify('Shareable Skill Passport link copied to clipboard!', 'success');
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Official Navy Passport Header */}
        <div className="bg-navy-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {avatar ? (
              <img
                src={avatar}
                alt={w.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-xl object-cover border-2 border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-teal-600 text-white flex items-center justify-center font-display text-2xl font-bold shrink-0">
                {getWorkerInitials(w.name)}
              </div>
            )}
            <div>
              <div className="font-mono text-xs text-teal-400">
                DIGITAL SKILL PASSPORT · {passport.passportCode}
              </div>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold">{w.name}</h1>
              <div className="mt-1 text-xs text-slate-300">
                <span>{w.profile?.category}</span>
                {genderLabel && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span>{genderLabel}</span>
                  </>
                )}
                <span className="mx-1.5">·</span>
                <span>{w.city}</span>
                <span className="mx-1.5">·</span>
                <span>{w.profile?.experienceYears || 0} Years Experience</span>
                {w.isDemo && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span>Demo Evaluation Record</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white p-2.5 rounded-xl shrink-0">
            <img src={passport.qrDataUrl} alt="Skill Passport Verification QR Code" className="w-24 h-24" />
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Issued: <span className="font-mono">{String(passport.issuedAt || '').split('T')[0]}</span> · Exact residential address protected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium border border-slate-300 bg-white hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </button>
            <button
              onClick={() => downloadSkillPassportPDF(passport)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Passport</span>
            </button>
          </div>
        </div>

        {/* Passport Body */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Dynamic Reputation Breakdown */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-950">
                Dynamic Worker Reputation Intelligence
              </h2>
              <span className="font-mono text-2xl font-bold text-teal-700 tabular-nums">
                {rep?.overallScore ?? 72.0} / 100
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{rep?.explanation}</p>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 border-t border-slate-100">
              {[
                { label: 'Work Quality', val: rep?.qualityScore ?? 75 },
                { label: 'Reliability', val: rep?.reliabilityScore ?? 75 },
                { label: 'Punctuality', val: rep?.punctualityScore ?? 75 },
                { label: 'Client Satisfaction', val: rep?.satisfactionScore ?? 75 },
                { label: 'Skill Proficiency', val: rep?.skillProficiencyScore ?? 75 },
              ].map((m) => (
                <div key={m.label}>
                  <div className="text-xs text-slate-500">{m.label}</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-slate-950 tabular-nums">
                    {m.val}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessed vs Self-Declared Skills */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Assessed &amp; Admin-Verified Trade Skills
              </h3>
              <div className="mt-3 divide-y divide-slate-100">
                {verifiedSkills.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No formal skill assessments completed yet.</p>
                ) : (
                  verifiedSkills.map((sk: any) => (
                    <div key={sk._id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">{sk.name}</div>
                        <div className="text-slate-500">
                          {sk.verificationType === 'admin_verified' ? 'Admin Credential Verified' : 'AI Scenario Assessment Passed'}
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-teal-700 tabular-nums">
                        {sk.proficiency} {sk.assessmentScore ? `(${sk.assessmentScore}%)` : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Self-Declared Practical Skills &amp; Certificates
              </h3>
              <div className="mt-3 divide-y divide-slate-100">
                {declaredSkills.map((sk: any) => (
                  <div key={sk._id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-700">{sk.name}</span>
                    <span className="text-slate-500">{sk.proficiency} · Self-Declared</span>
                  </div>
                ))}
                {(w.certificates || []).map((c: any) => (
                  <div key={c._id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-800">{c.title}</div>
                      <div className="text-slate-500">{c.issuingAuthority} ({c.issueYear})</div>
                    </div>
                    <span className="font-mono text-slate-600 uppercase">{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Completed Projects & Employer Reviews */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Completed Platform Projects ({(passport.completedProjects || []).length})
              </h3>
              <div className="mt-3 space-y-3">
                {(passport.completedProjects || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Eligible for entry projects under Fair Opportunity Mode.</p>
                ) : (
                  passport.completedProjects.map((p: any) => (
                    <div key={p._id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div className="font-semibold text-slate-900">{p.title}</div>
                      <div className="text-slate-500 mt-0.5">
                        {p.employerName} · {p.city} · Cert: <span className="font-mono">{p.completionCertificateCode}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Verified Employer Reviews ({(passport.reviews || []).length})
              </h3>
              <div className="mt-3 space-y-3">
                {(passport.reviews || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No employer reviews yet—protected by Fair-Start Reputation baseline.</p>
                ) : (
                  passport.reviews.map((r: any) => (
                    <div key={r._id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{r.reviewerName}</span>
                        <span className="font-mono text-teal-700 tabular-nums">{r.quality}/5 Quality</span>
                      </div>
                      <p className="mt-1 text-slate-600">{r.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
