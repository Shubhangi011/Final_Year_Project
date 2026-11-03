import { useEffect, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

type AdminTab = 'analytics' | 'verifications' | 'fraud_safety' | 'disputes' | 'users_audit';

export function AdminDashboard() {
  const { user, logout, notify } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

  const [dashboard, setDashboard] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [scanBusy, setScanBusy] = useState(false);

  // User Suspend / Reactivate modal + 500-user search & pagination state
  const [targetUserModal, setTargetUserModal] = useState<any | null>(null);
  const [justificationText, setJustificationText] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userGenderFilter, setUserGenderFilter] = useState('All');
  const [userPage, setUserPage] = useState(1);

  const loadAdminData = async () => {
    try {
      const [dashRes, statRes, verRes, repRes, usrRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/stats'),
        api.get('/admin/verifications'),
        api.get('/admin/reports'),
        api.get('/admin/users'),
      ]);
      setDashboard(dashRes.data);
      setStats(statRes.data);
      setVerifications(verRes.data.verifications || []);
      setReports(repRes.data.reports || []);
      setAllUsers(usrRes.data.users || []);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleVerifyCertificate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/admin/verifications/${id}`, {
        status,
        adminNotes:
          status === 'approved'
            ? 'Verified credential number and issuing authority; upgraded skill to Admin Verified.'
            : 'Insufficient document clarity; please re-upload.',
      });
      notify(`Certificate ${status}! Worker passport & reputation updated.`, 'success');
      loadAdminData();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleRunLiveFraudScan = async () => {
    setScanBusy(true);
    try {
      const { data } = await api.post('/ai/fraud-analysis');
      notify(
        `Python Z-Score & Rule Scan complete: ${(data.alerts || []).length} anomaly pattern(s) evaluated for human review.`,
        'info'
      );
      loadAdminData();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setScanBusy(false);
    }
  };

  const handleFraudAlertAction = async (id: string, status: string) => {
    try {
      await api.put(`/admin/fraud-alerts/${id}`, {
        status,
        adminNotes: `Marked ${status} after human admin review.`,
      });
      notify(`Fraud alert marked ${status}.`, 'success');
      loadAdminData();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleResolveDispute = async (id: string, status: 'resolved_no_fault' | 'established_finding') => {
    try {
      await api.put(`/admin/disputes/${id}`, {
        status,
        resolutionSummary:
          status === 'resolved_no_fault'
            ? 'Mutual clarification completed—no worker fault established; reputation unaffected.'
            : 'Verified evidence confirmed breach of agreed scope; calibrated reliability adjustment logged.',
      });
      notify(`Dispute resolved (${status}).`, 'success');
      loadAdminData();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleChangeUserStatus = async () => {
    if (!targetUserModal) return;
    const nextStatus = targetUserModal.status === 'suspended' ? 'active' : 'suspended';
    try {
      await api.put(`/admin/users/${targetUserModal._id}/status`, {
        status: nextStatus,
        justification: justificationText,
      });
      notify(`User account ${nextStatus} with logged audit justification.`, 'success');
      setTargetUserModal(null);
      setJustificationText('');
      loadAdminData();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const m = dashboard?.metrics || {};

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="bg-navy-900 text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-teal-400 shrink-0" />
          <div>
            <div className="text-xs text-slate-300">Platform Governance, Trust &amp; AI Oversight Console</div>
            <h1 className="font-display text-2xl font-bold">{user?.name}</h1>
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-1 p-1.5 bg-slate-200/70 rounded-xl">
        {([
          { id: 'analytics', label: 'Platform Analytics & AI Logs' },
          { id: 'verifications', label: `Certificate Verifications (${m.pendingVerifications || 0})` },
          { id: 'fraud_safety', label: `AI Fraud & Safety Alerts (${(m.openFraudAlerts || 0) + (m.openReports || 0)})` },
          { id: 'disputes', label: `Dispute Mediation (${m.openDisputes || 0})` },
          { id: 'users_audit', label: 'Users & Audit Logs' },
        ] as { id: AdminTab; label: string }[]).map((t) => (
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

      {/* TAB 1: PLATFORM ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Registered Users', val: m.totalUsers ?? 0 },
              { label: 'Workers / Employers', val: `${m.totalWorkers ?? 0} / ${m.totalEmployers ?? 0}` },
              { label: 'Open Verified Jobs', val: m.activeJobs ?? 0 },
              { label: 'Pending Cert Verifications', val: m.pendingVerifications ?? 0 },
            ].map((k) => (
              <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500">{k.label}</div>
                <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-lg font-bold text-slate-950">
                Supply vs. Demand Across Trade Categories (Live MongoDB Aggregation)
              </h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.categoryDemand || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip />
                    <Bar dataKey="workersCount" name="Registered Workers" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="openJobs" name="Open Jobs" fill="#0f1d38" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-display text-base font-bold text-slate-950">
                AI Recommendation Monitoring Feed
              </h2>
              <p className="mt-1 text-xs text-slate-500">Recent matching &amp; scoring executions logged for fairness oversight.</p>
              <div className="mt-3 divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
                {(dashboard?.aiLogs || []).length === 0 ? (
                  <p className="text-slate-500 py-3">No AI recommendation logs recorded yet.</p>
                ) : (
                  dashboard.aiLogs.map((lg: any) => (
                    <div key={lg._id} className="py-2.5">
                      <div className="font-semibold text-slate-900">{lg.inputSummary}</div>
                      <div className="text-slate-500">{lg.outputSummary}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CERTIFICATE VERIFICATIONS */}
      {activeTab === 'verifications' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-slate-950">
            Worker Trade Certificate Verification Queue
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Approving a credential marks the worker’s primary skill as Admin Verified and logs to the immutable audit trail.
          </p>

          <div className="mt-4 divide-y divide-slate-200">
            {verifications.map((cert) => (
              <div key={cert._id} className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-display text-sm font-bold text-slate-950">
                    {cert.title} — {cert.workerName}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    Authority: {cert.issuingAuthority} ({cert.issueYear}) · Credential No:{' '}
                    <span className="font-mono">{cert.credentialNumber || 'N/A'}</span> · Status:{' '}
                    <strong className="uppercase">{cert.status}</strong>
                  </div>
                </div>

                {cert.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerifyCertificate(cert._id, 'rejected')}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleVerifyCertificate(cert._id, 'approved')}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg cursor-pointer"
                    >
                      Approve &amp; Verify Skill
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AI FRAUD DETECTION & SAFETY REPORTS */}
      {activeTab === 'fraud_safety' && (
        <div className="mt-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950">
                  AI Fraud &amp; Anomaly Investigation Queue
                </h2>
                <p className="text-xs text-slate-500">
                  KaushalSetu never automatically bans accounts based solely on ML predictions—human Admin investigation is mandatory.
                </p>
              </div>
              <button
                onClick={handleRunLiveFraudScan}
                disabled={scanBusy}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {scanBusy ? 'Running Python Z-Score Scan...' : 'Run Live Fraud Anomaly Scan'}
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-200 text-xs">
              {(dashboard?.fraudAlerts || []).map((al: any) => (
                <div key={al._id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="font-semibold text-slate-950">
                      Target: {al.targetType.toUpperCase()} · Anomaly Score:{' '}
                      <span className="font-mono text-red-700">{al.anomalyScore}/100</span> · Status:{' '}
                      <span className="uppercase">{al.status}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{al.reason}</p>
                  </div>
                  {al.status === 'open' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFraudAlertAction(al._id, 'dismissed')}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        Dismiss (Legitimate Urgent Rate)
                      </button>
                      <button
                        onClick={() => handleFraudAlertAction(al._id, 'investigating')}
                        className="px-3 py-1.5 bg-amber-600 text-white font-semibold rounded-lg cursor-pointer"
                      >
                        Flag for Investigation
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-base font-bold text-slate-950">Worker Safety &amp; Trust Reports</h2>
            <div className="mt-3 divide-y divide-slate-200 text-xs">
              {reports.length === 0 ? (
                <p className="text-slate-500 py-3">No pending safety reports.</p>
              ) : (
                reports.map((r) => (
                  <div key={r._id} className="py-3">
                    <div className="font-semibold text-slate-900">
                      {r.category} — Reported by {r.reporterName}
                    </div>
                    <p className="text-slate-600 mt-0.5">{r.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DISPUTE MEDIATION */}
      {activeTab === 'disputes' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-slate-950">Bilateral Dispute Resolution</h2>
          <p className="mt-1 text-xs text-slate-500">
            Open or unverified complaints do not reduce worker reputation. Only an Established Finding updates reliability metrics.
          </p>

          <div className="mt-4 divide-y divide-slate-200 text-xs">
            {(dashboard?.disputes || []).map((d: any) => (
              <div key={d._id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-2xl space-y-1">
                  <div className="font-display text-sm font-bold text-slate-950">
                    Project: {d.projectTitle} ({d.raisedByName} &harr; {d.againstName})
                  </div>
                  <div className="text-slate-700">Reason: {d.reason}</div>
                  {d.evidenceNotes && <div className="text-slate-500">Evidence Note: {d.evidenceNotes}</div>}
                  <div className="text-slate-500">Status: <strong className="uppercase">{d.status}</strong></div>
                </div>

                {d.status === 'open' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResolveDispute(d._id, 'resolved_no_fault')}
                      className="px-3.5 py-1.5 bg-teal-600 text-white font-semibold rounded-lg cursor-pointer"
                    >
                      Resolve — No Fault (Protect Reputation)
                    </button>
                    <button
                      onClick={() => handleResolveDispute(d._id, 'established_finding')}
                      className="px-3.5 py-1.5 bg-red-700 text-white font-semibold rounded-lg cursor-pointer"
                    >
                      Record Established Finding
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: USER MANAGEMENT & IMMUTABLE AUDIT TRAIL */}
      {activeTab === 'users_audit' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-slate-950">
                User Account Governance ({allUsers.length} Accounts)
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Search name, email, city..."
                  className="px-3 py-1.5 border border-slate-300 rounded-lg"
                />
                <select
                  value={userGenderFilter}
                  onChange={(e) => {
                    setUserGenderFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="All">All Genders</option>
                  <option value="Female">Women</option>
                  <option value="Male">Men</option>
                </select>
              </div>
            </div>

            {(() => {
              const q = userSearch.trim().toLowerCase();
              const filtered = allUsers.filter((u) => {
                if (userGenderFilter !== 'All' && (u.gender || '') !== userGenderFilter) return false;
                if (!q) return true;
                return (
                  (u.name || '').toLowerCase().includes(q) ||
                  (u.email || '').toLowerCase().includes(q) ||
                  (u.city || '').toLowerCase().includes(q) ||
                  (u.role || '').toLowerCase().includes(q)
                );
              });
              const pageSize = 20;
              const maxPages = Math.max(1, Math.ceil(filtered.length / pageSize));
              const slice = filtered.slice((userPage - 1) * pageSize, userPage * pageSize);

              return (
                <>
                  <div className="mt-4 divide-y divide-slate-200 text-xs">
                    {slice.map((u) => (
                      <div key={u._id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {u.name} ({u.role}{u.gender ? ` · ${u.gender}` : ''}) {u.isDemo ? '· Demo' : ''}
                          </div>
                          <div className="text-slate-500">
                            {u.email} · {u.city} · Status: <strong className="uppercase">{u.status}</strong>
                          </div>
                        </div>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => setTargetUserModal(u)}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium cursor-pointer"
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {maxPages > 1 && (
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-mono tabular-nums">
                        Page {userPage} of {maxPages} ({filtered.length} matching accounts)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={userPage <= 1}
                          onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40 cursor-pointer"
                        >
                          Prev
                        </button>
                        <button
                          disabled={userPage >= maxPages}
                          onClick={() => setUserPage((p) => Math.min(maxPages, p + 1))}
                          className="px-3 py-1 bg-navy-900 text-white rounded disabled:opacity-40 cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-base font-bold text-slate-950">Security &amp; Governance Audit Trail</h2>
            <div className="mt-3 divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
              {(dashboard?.auditLogs || []).map((al: any) => (
                <div key={al._id} className="py-2.5">
                  <div className="font-mono font-semibold text-slate-900">{al.action}</div>
                  <div className="text-slate-600">{al.justification}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{al.createdAt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Justification Modal for Suspend / Reactivate */}
      {targetUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="font-display text-base font-bold text-slate-950">
              {targetUserModal.status === 'suspended' ? 'Reactivate' : 'Suspend'} Account: {targetUserModal.name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Governance Rule: Account status changes require a recorded written justification in audit_logs.
            </p>
            <textarea
              rows={3}
              value={justificationText}
              onChange={(e) => setJustificationText(e.target.value)}
              placeholder="Enter written governance justification (minimum 5 characters)..."
              className="mt-4 w-full p-3 text-xs border border-slate-300 rounded-lg"
            />
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setTargetUserModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeUserStatus}
                className="px-4 py-2 bg-navy-900 text-white font-semibold rounded-lg cursor-pointer"
              >
                Confirm &amp; Log Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
