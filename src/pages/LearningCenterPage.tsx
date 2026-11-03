import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, ChevronRight, Plus, Search, X } from 'lucide-react';
import { api, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TRADE_CATEGORIES } from '../utils/mediaAssets';

interface ModuleItem {
  moduleNumber: number;
  title: string;
  durationMinutes: number;
  stageLabel: string;
  objective: string;
  topics: string[];
  toolsAndMaterials: string[];
  practicalExercise: string;
  checklist: string[];
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

interface SkillCourse {
  _id: string;
  title: string;
  category: string;
  targetSkill: string;
  language: string;
  languagesAvailable?: string[];
  provider: string;
  standardCode?: string;
  level?: string;
  durationHours: number;
  modulesCount?: number;
  summary: string;
  localizedSummary?: {
    en: string;
    mr: string;
    hi: string;
  };
  modules?: ModuleItem[];
}

const GUEST_PROGRESS_STORAGE_KEY = 'ks_guest_skill_module_progress';
const PAGE_SIZE = 18;

export function LearningCenterPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, language: appLang, notify } = useAuth();

  const initialSkillParam = searchParams.get('skill') || '';
  const initialCategoryParam = searchParams.get('category') || 'All';

  const [resources, setResources] = useState<SkillCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSkillsCovered, setTotalSkillsCovered] = useState(0);
  const [totalModulesCount, setTotalModulesCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Array<{ category: string; count: number }>>([]);
  const [workerSkillNames, setWorkerSkillNames] = useState<string[]>([]);

  // Filter & Search States
  const [category, setCategory] = useState(initialCategoryParam);
  const [search, setSearch] = useState('');
  const [displayLang, setDisplayLang] = useState<'en' | 'mr' | 'hi'>(appLang || 'en');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'my_skills' | 'in_progress'>('all');
  const [page, setPage] = useState(1);

  // Module Progress Map: { [resourceId]: [1, 2, ...] }
  const [progressMap, setProgressMap] = useState<Record<string, number[]>>(() => {
    try {
      const saved = localStorage.getItem(GUEST_PROGRESS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Active Two-Zone Interactive Module Studio State
  const [activeCourse, setActiveCourse] = useState<SkillCourse | null>(null);
  const [activeModuleNumber, setActiveModuleNumber] = useState<number>(1);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizChecked, setQuizChecked] = useState(false);
  const [savingModule, setSavingModule] = useState(false);

  // Add Custom Skill Course State
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customSkillName, setCustomSkillName] = useState('');
  const [customSkillCategory, setCustomSkillCategory] = useState('Electrical');
  const [creatingCustom, setCreatingCustom] = useState(false);

  useEffect(() => {
    setDisplayLang(appLang || 'en');
  }, [appLang]);

  const fetchCourses = async (skillDeepLink?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/learning-resources', {
        params: {
          category,
          search,
          skill: skillDeepLink || undefined,
        },
      });
      const list: SkillCourse[] = data.resources || [];
      setResources(list);
      setTotalSkillsCovered(data.totalSkillsCovered || list.length);
      setTotalModulesCount(data.totalModulesCount || list.length * 4);
      if (Array.isArray(data.categoryCounts)) {
        setCategoryCounts(data.categoryCounts);
      }
      if (Array.isArray(data.workerSkillNames)) {
        setWorkerSkillNames(data.workerSkillNames);
      }
      if (data.progressMap && Object.keys(data.progressMap).length > 0) {
        setProgressMap((prev) => ({ ...prev, ...data.progressMap }));
      }

      if (skillDeepLink && list.length > 0) {
        const match =
          list.find((c) => c.targetSkill.toLowerCase() === skillDeepLink.toLowerCase()) || list[0];
        openCourseStudio(match, 1);
      }
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchCourses(initialSkillParam || undefined);
  }, [category]);

  const openCourseStudio = (course: SkillCourse, moduleNum = 1) => {
    setActiveCourse(course);
    setActiveModuleNumber(moduleNum);
    setSelectedQuizOption(null);
    setQuizChecked(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCourses();
  };

  const getLocalizedSummary = (course: SkillCourse): string => {
    if (course.localizedSummary) {
      return course.localizedSummary[displayLang] || course.localizedSummary.en;
    }
    return course.summary;
  };

  const filteredResources = useMemo(() => {
    let list = resources;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((item) => {
        const modTitles = (item.modules || []).map((m) => `${m.title} ${(m.topics || []).join(' ')}`).join(' ');
        const hay = `${item.targetSkill} ${item.title} ${item.category} ${item.summary} ${modTitles}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (scopeFilter === 'my_skills') {
      const lowerSet = new Set(workerSkillNames.map((s) => s.toLowerCase()));
      list = list.filter((item) => lowerSet.has((item.targetSkill || '').toLowerCase()));
    } else if (scopeFilter === 'in_progress') {
      list = list.filter((item) => (progressMap[item._id] || []).length > 0);
    }
    return list;
  }, [resources, search, scopeFilter, workerSkillNames, progressMap]);

  const totalPages = Math.max(1, Math.ceil(filteredResources.length / PAGE_SIZE));
  const pagedResources = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredResources.slice(start, start + PAGE_SIZE);
  }, [filteredResources, page]);

  const totalUserCompletedModules = useMemo(() => {
    return (Object.values(progressMap) as number[][]).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0
    );
  }, [progressMap]);

  const activeModulesList: ModuleItem[] = useMemo(() => {
    if (!activeCourse) return [];
    if (Array.isArray(activeCourse.modules) && activeCourse.modules.length > 0) {
      return activeCourse.modules;
    }
    return [];
  }, [activeCourse]);

  const currentModule: ModuleItem | undefined = useMemo(() => {
    return activeModulesList.find((m) => m.moduleNumber === activeModuleNumber) || activeModulesList[0];
  }, [activeModulesList, activeModuleNumber]);

  const handleCompleteModule = async (course: SkillCourse, moduleNum: number) => {
    setSavingModule(true);
    try {
      const currentDone = new Set<number>(progressMap[course._id] || []);
      const alreadyCompleted = currentDone.has(moduleNum);
      const nextCompletedState = !alreadyCompleted;

      if (user) {
        const { data } = await api.post(`/learning-resources/${course._id}/progress`, {
          moduleNumber: moduleNum,
          completed: nextCompletedState,
        });
        setProgressMap((prev) => ({
          ...prev,
          [course._id]: data.completedModules || [],
        }));
        if (data.courseFinished && nextCompletedState) {
          notify(
            `All 4 modules completed for "${course.targetSkill}"! Skill recorded on your profile.`,
            'success'
          );
        } else if (nextCompletedState) {
          notify(`Module 0${moduleNum} marked complete.`, 'success');
        }
      } else {
        if (nextCompletedState) currentDone.add(moduleNum);
        else currentDone.delete(moduleNum);
        const updatedArr = Array.from(currentDone).sort((a, b) => a - b);
        const nextMap = { ...progressMap, [course._id]: updatedArr };
        setProgressMap(nextMap);
        try {
          localStorage.setItem(GUEST_PROGRESS_STORAGE_KEY, JSON.stringify(nextMap));
        } catch {
          // ignore storage quota
        }
        if (nextCompletedState) {
          notify(
            updatedArr.length >= 4
              ? `Completed all 4 modules for ${course.targetSkill}! Sign in as a Worker to sync to your Skill Passport.`
              : `Module 0${moduleNum} completed!`,
            'success'
          );
        }
      }

      // Advance smoothly to next module if marking complete and more modules remain
      if (nextCompletedState && moduleNum < activeModulesList.length) {
        setActiveModuleNumber(moduleNum + 1);
        setSelectedQuizOption(null);
        setQuizChecked(false);
      }
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setSavingModule(false);
    }
  };

  const handleCreateCustomSkillCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSkillName.trim()) return;
    setCreatingCustom(true);
    try {
      const { data } = await api.post('/learning-resources/custom-skill', {
        skillName: customSkillName.trim(),
        category: customSkillCategory.trim() || 'General Skilled Trade',
      });
      if (data.course) {
        notify(`Generated 4 structured learning modules for "${data.course.targetSkill}"!`, 'success');
        setCustomSkillName('');
        setShowCustomBuilder(false);
        await fetchCourses(data.course.targetSkill);
      }
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setCreatingCustom(false);
    }
  };

  const allCategoryOptions = useMemo(() => {
    if (categoryCounts.length > 0) return categoryCounts;
    return TRADE_CATEGORIES.map((c) => ({ category: c, count: 5 }));
  }, [categoryCounts]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* HEADER & LANGUAGE / CUSTOM SKILL CONTROLS */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <div className="text-xs text-slate-500">
            <span>Every Platform Skill Covered</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>4 Progressive Modules per Skill</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>NSDC / Sector Skill Council Aligned</span>
          </div>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">
            Skill-by-Skill Learning &amp; Practical Module Studio
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Every skill mentioned across KaushalSetu includes a structured 4-module practical curriculum covering safety standards, step-by-step execution, fault diagnostics, and Skill Passport readiness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Language Selector for Module Summaries */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {[
              { code: 'en' as const, label: 'English' },
              { code: 'mr' as const, label: 'मराठी' },
              { code: 'hi' as const, label: 'हिन्दी' },
            ].map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setDisplayLang(l.code)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  displayLang === l.code
                    ? 'bg-white text-slate-950 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCustomBuilder((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-navy-900 hover:bg-navy-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Any Custom Skill</span>
          </button>
        </div>
      </div>

      {/* EXPANDABLE CUSTOM SKILL MODULE GENERATOR */}
      {showCustomBuilder && (
        <form
          onSubmit={handleCreateCustomSkillCourse}
          className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
        >
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New or Specialized Skill Name *
            </label>
            <input
              type="text"
              required
              value={customSkillName}
              onChange={(e) => setCustomSkillName(e.target.value)}
              placeholder="e.g., Hydroponic Nutrient Dosing, Drone Photogrammetry, Saree Kuchu Tassel Work..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Trade or Domain Category (Select or Type Any)
            </label>
            <input
              list="learning-custom-domains"
              value={customSkillCategory}
              onChange={(e) => setCustomSkillCategory(e.target.value)}
              placeholder="Select or type custom trade..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <datalist id="learning-custom-domains">
              {allCategoryOptions.map((c) => (
                <option key={c.category} value={c.category} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={creatingCustom}
              className="flex-1 py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
            >
              {creatingCustom ? 'Building 4 Modules...' : 'Generate 4 Modules'}
            </button>
            <button
              type="button"
              onClick={() => setShowCustomBuilder(false)}
              className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* 4-COLUMN QUANTITATIVE COVERAGE STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 tabular-nums">
            {totalSkillsCovered || resources.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Distinct Skills with Full Courses (100% Platform Skills)
          </div>
        </div>
        <div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-teal-700 tabular-nums">
            {totalModulesCount || resources.length * 4}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Structured Practical Modules (4 Modules per Skill)
          </div>
        </div>
        <div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 tabular-nums">
            {allCategoryOptions.length}+
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Trade, Artisan, Care, Digital &amp; Engineering Domains
          </div>
        </div>
        <div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 tabular-nums">
            {totalUserCompletedModules}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Modules Completed by You {user ? '(Synced to Account)' : '(Saved Locally)'}
          </div>
        </div>
      </div>

      {/* TWO-ZONE INTERACTIVE SKILL MODULE STUDIO (WHEN A SKILL IS OPENED) */}
      {activeCourse && currentModule && (
        <section className="bg-white border border-slate-300 rounded-xl overflow-hidden">
          {/* Studio Header Bar */}
          <div className="bg-navy-900 text-white px-6 py-5 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="text-xs text-teal-300">
                <span>{activeCourse.category}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>{activeCourse.standardCode || 'NSQF Practical Standard'}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{activeCourse.durationHours} hrs total</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
                {activeCourse.targetSkill}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {getLocalizedSummary(activeCourse)}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs text-slate-200 tabular-nums">
                {(progressMap[activeCourse._id] || []).length} / {activeModulesList.length} Modules Completed
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveCourse(null);
                  if (searchParams.has('skill')) {
                    searchParams.delete('skill');
                    setSearchParams(searchParams);
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Studio</span>
              </button>
            </div>
          </div>

          {/* Two-Zone Split Layout: Left Module Syllabus Rail + Right Active Lesson & Practice Stage */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Left Zone: 4-Module Syllabus Rail */}
            <div className="lg:col-span-4 p-5 bg-slate-50/70 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>Course Syllabus (4 Modules)</span>
                  <span className="font-mono tabular-nums text-teal-700">
                    {Math.round(
                      (((progressMap[activeCourse._id] || []).length || 0) /
                        Math.max(1, activeModulesList.length)) *
                        100
                    )}
                    % Done
                  </span>
                </div>
                <div className="mt-2 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-transform duration-200 origin-left"
                    style={{
                      transform: `scaleX(${
                        ((progressMap[activeCourse._id] || []).length || 0) /
                        Math.max(1, activeModulesList.length)
                      })`,
                    }}
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white overflow-hidden">
                {activeModulesList.map((mod) => {
                  const isDone = (progressMap[activeCourse._id] || []).includes(mod.moduleNumber);
                  const isSelected = mod.moduleNumber === currentModule.moduleNumber;
                  return (
                    <button
                      key={mod.moduleNumber}
                      type="button"
                      onClick={() => {
                        setActiveModuleNumber(mod.moduleNumber);
                        setSelectedQuizOption(null);
                        setQuizChecked(false);
                      }}
                      className={`w-full text-left p-3.5 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          Module 0{mod.moduleNumber} · {mod.durationMinutes} min ·{' '}
                          <span className={isDone ? 'text-teal-700 font-semibold' : 'text-slate-500'}>
                            {isDone ? 'Completed' : isSelected ? 'Active' : 'Pending'}
                          </span>
                        </div>
                        <div
                          className={`text-xs font-semibold leading-snug ${
                            isSelected ? 'text-slate-950' : 'text-slate-800'
                          }`}
                        >
                          {mod.title}
                        </div>
                      </div>
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 text-xs text-slate-500 space-y-2">
                <div>
                  <strong className="text-slate-700">Accreditation Alignment:</strong> {activeCourse.provider}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/worker')}
                  className="w-full py-2.5 px-4 border border-slate-300 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Go to Worker Skill Assessment &rarr;
                </button>
              </div>
            </div>

            {/* Right Zone: Active Module Lesson, Practical Exercise, Checklist & Quiz */}
            <div className="lg:col-span-8 p-6 sm:p-8 space-y-6">
              <div>
                <div className="text-xs font-mono text-teal-700 tabular-nums">
                  {currentModule.stageLabel} · {currentModule.durationMinutes} Minutes
                </div>
                <h3 className="mt-1 font-display text-xl font-bold text-slate-950">
                  0{currentModule.moduleNumber}. {currentModule.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  <strong className="text-slate-900">Learning Objective:</strong> {currentModule.objective}
                </p>
              </div>

              {/* Core Step-by-Step Topics */}
              <div className="pt-5 border-t border-slate-200">
                <h4 className="font-display text-sm font-bold text-slate-950">
                  Core Technical Lessons in Module 0{currentModule.moduleNumber}
                </h4>
                <div className="mt-3 space-y-2.5">
                  {(currentModule.topics || []).map((topic, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                      <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums mt-0.5 shrink-0">
                        0{idx + 1}.
                      </span>
                      <span>{topic}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Tools & Hands-On Exercise */}
              <div className="pt-5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-950">
                    Tools, Gauges &amp; Materials Covered
                  </h4>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {(currentModule.toolsAndMaterials || []).join(' · ')}
                  </p>
                </div>

                <div>
                  <h4 className="font-display text-sm font-bold text-slate-950">
                    Hands-On Practical Field Exercise
                  </h4>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {currentModule.practicalExercise}
                  </p>
                </div>
              </div>

              {/* Interactive Safety & Quality Verification Checklist */}
              <div className="pt-5 border-t border-slate-200">
                <h4 className="font-display text-sm font-bold text-slate-950">
                  Self-Check Practical Readiness List
                </h4>
                <div className="mt-2.5 space-y-2">
                  {(currentModule.checklist || []).map((chk, idx) => {
                    const key = `${activeCourse._id}-${currentModule.moduleNumber}-${idx}`;
                    const isChecked = Boolean(checkedItems[key]);
                    return (
                      <label
                        key={key}
                        className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setCheckedItems((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                          className="mt-0.5 rounded border-slate-300"
                        />
                        <span className={isChecked ? 'line-through text-slate-400' : ''}>{chk}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Scenario Knowledge Check */}
              {currentModule.quiz && (
                <div className="pt-5 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-bold text-slate-950">
                      Module 0{currentModule.moduleNumber} Scenario Check
                    </h4>
                    <span className="text-xs text-slate-500">Test your practical understanding</span>
                  </div>
                  <p className="text-xs font-medium text-slate-800">{currentModule.quiz.question}</p>
                  <div className="space-y-2">
                    {currentModule.quiz.options.map((opt, oIdx) => {
                      const isPicked = selectedQuizOption === oIdx;
                      const isRight = currentModule.quiz!.correctIndex === oIdx;
                      let borderStyle = 'border-slate-200 hover:bg-slate-50';
                      if (quizChecked) {
                        if (isRight) borderStyle = 'border-teal-600 bg-teal-50/60';
                        else if (isPicked) borderStyle = 'border-red-400 bg-red-50/50';
                      } else if (isPicked) {
                        borderStyle = 'border-navy-900 bg-slate-50';
                      }

                      return (
                        <label
                          key={oIdx}
                          className={`flex items-start gap-2.5 p-3 border rounded-lg text-xs cursor-pointer transition-colors ${borderStyle}`}
                        >
                          <input
                            type="radio"
                            name={`mod-quiz-${currentModule.moduleNumber}`}
                            checked={isPicked}
                            onChange={() => {
                              setSelectedQuizOption(oIdx);
                              setQuizChecked(true);
                            }}
                            className="mt-0.5"
                          />
                          <span className="text-slate-800 leading-relaxed">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                  {quizChecked && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                      <strong className="text-slate-950">
                        {selectedQuizOption === currentModule.quiz.correctIndex
                          ? 'Correct — '
                          : 'Key Principle — '}
                      </strong>
                      {currentModule.quiz.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Module Action Footer */}
              <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {currentModule.moduleNumber > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModuleNumber(currentModule.moduleNumber - 1);
                        setSelectedQuizOption(null);
                        setQuizChecked(false);
                      }}
                      className="px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      &larr; Previous Module
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={savingModule}
                    onClick={() => handleCompleteModule(activeCourse, currentModule.moduleNumber)}
                    className="px-5 py-2.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {(progressMap[activeCourse._id] || []).includes(currentModule.moduleNumber)
                      ? 'Completed (Click to Undo)'
                      : currentModule.moduleNumber < activeModulesList.length
                      ? `Complete Module 0${currentModule.moduleNumber} & Next \u2192`
                      : 'Complete Final Module & Finish Course'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SEARCH, DOMAIN FILTER & LEARNER SCOPE BAR */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
      >
        <div className="md:col-span-5 flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search any skill or module (e.g., Conduit Wiring, Pattern Cutting, Glucometer, BMS, Tally)..."
            className="w-full text-sm focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="md:col-span-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="All">All Skill &amp; Trade Domains ({totalSkillsCovered || resources.length} Skills)</option>
            {allCategoryOptions.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.count} skills)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setScopeFilter('all');
              setPage(1);
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              scopeFilter === 'all' ? 'bg-white text-slate-950 shadow-xs font-semibold' : 'text-slate-600'
            }`}
          >
            All ({resources.length})
          </button>
          {user?.role === 'worker' && (
            <button
              type="button"
              onClick={() => {
                setScopeFilter('my_skills');
                setPage(1);
              }}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                scopeFilter === 'my_skills' ? 'bg-white text-slate-950 shadow-xs font-semibold' : 'text-slate-600'
              }`}
            >
              My Skills
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setScopeFilter('in_progress');
              setPage(1);
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              scopeFilter === 'in_progress' ? 'bg-white text-slate-950 shadow-xs font-semibold' : 'text-slate-600'
            }`}
          >
            Started
          </button>
        </div>
      </form>

      {/* SKILL COURSES & MODULES DIRECTORY */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          Loading structured 4-module courses across all platform skills...
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <div className="font-display text-lg font-bold text-slate-950">
            No matching skill course found
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Clear your current search filter, or generate a full 4-module course immediately for "{search || 'your custom skill'}".
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('All');
                setScopeFilter('all');
              }}
              className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Reset Filters
            </button>
            {search.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  setCustomSkillName(search.trim());
                  setShowCustomBuilder(true);
                }}
                className="px-4 py-2 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer"
              >
                Generate 4 Modules for "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing <strong className="font-mono text-slate-900 tabular-nums">{pagedResources.length}</strong> of{' '}
              <strong className="font-mono text-slate-900 tabular-nums">{filteredResources.length}</strong> skills (each with 4 modules — click any module to launch)
            </span>
            <span className="font-mono tabular-nums">
              Page {page} of {totalPages}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagedResources.map((item) => {
              const doneMods = progressMap[item._id] || [];
              const modList = item.modules || [];
              const isSelectedCard = activeCourse?._id === item._id;

              return (
                <div
                  key={item._id}
                  className={`bg-white border rounded-xl p-6 flex flex-col justify-between transition-colors ${
                    isSelectedCard ? 'border-teal-600' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Zero-Pill Unboxed Metadata */}
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-teal-700">{item.category}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{modList.length || 4} Modules</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.durationHours} hrs</span>
                      {doneMods.length > 0 && (
                        <>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {doneMods.length}/{modList.length || 4} Done
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="mt-2 font-display text-lg font-bold text-slate-950 leading-snug">
                      {item.targetSkill}
                    </h2>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {getLocalizedSummary(item)}
                    </p>

                    {/* Explicit 4-Module Breakdown Listed Directly for Every Skill */}
                    {modList.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 divide-y divide-slate-100">
                        {modList.map((m) => {
                          const mDone = doneMods.includes(m.moduleNumber);
                          return (
                            <button
                              key={m.moduleNumber}
                              type="button"
                              onClick={() => openCourseStudio(item, m.moduleNumber)}
                              className="w-full py-2 text-left flex items-start justify-between gap-2 text-xs hover:text-teal-700 transition-colors cursor-pointer group"
                            >
                              <span className="leading-snug text-slate-700 group-hover:text-slate-950">
                                <strong className="font-mono text-slate-900 tabular-nums mr-1.5">
                                  0{m.moduleNumber}.
                                </strong>
                                {m.title}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                                {mDone ? 'Done' : `${m.durationMinutes}m`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 truncate" title={item.provider}>
                      {item.provider}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCourseStudio(item, doneMods.length > 0 && doneMods.length < 4 ? doneMods.length + 1 : 1)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{doneMods.length > 0 ? 'Continue Modules' : 'Start 4 Modules'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                Page {page} of {totalPages} · {filteredResources.length} Skill Courses ({filteredResources.length * 4} Modules)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 280, behavior: 'smooth' });
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 rounded-lg cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 280, behavior: 'smooth' });
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-navy-900 hover:bg-navy-800 text-white disabled:opacity-40 rounded-lg cursor-pointer"
                >
                  Next Skills &rarr;
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
