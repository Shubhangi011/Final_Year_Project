import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { GeoDiscoveryMap } from '../components/GeoDiscoveryMap';
import { MAHARASHTRA_CITIES, TRADE_CATEGORIES } from '../utils/mediaAssets';

export function MapDiscoveryPage() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [category, setCategory] = useState('All');
  const [gender, setGender] = useState('All');
  const [city, setCity] = useState('All');
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/workers', { params: { category, gender, city, limit: 550 } }),
      api.get('/jobs', { params: { category: category === 'All' ? 'All' : category, city } }),
    ]).then(([wRes, jRes]) => {
      setWorkers(wRes.data.workers || []);
      if (Array.isArray(wRes.data.availableCategories)) {
        setDynamicCategories(wRes.data.availableCategories);
      }
      setJobs(jRes.data.jobs || []);
    });
  }, [category, gender, city]);

  const mergedCategories = Array.from(new Set([...TRADE_CATEGORIES, ...dynamicCategories])).sort();

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-950">
            Geospatial Worker &amp; Job Discovery
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Mapping <span className="font-mono font-semibold text-slate-900 tabular-nums">{workers.length}</span> skilled women &amp; men and <span className="font-mono font-semibold text-slate-900 tabular-nums">{jobs.length}</span> open jobs via MongoDB 2dsphere coordinates (~850m residential privacy fuzzing).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="All">All Genders</option>
            <option value="Female">Women Workers</option>
            <option value="Male">Men Workers</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white max-w-[230px]"
          >
            <option value="All">All Trades ({mergedCategories.length}+)</option>
            {mergedCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="All">All Cities</option>
            {MAHARASHTRA_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        <GeoDiscoveryMap
          workers={workers}
          jobs={jobs}
          heightClass="h-[540px]"
          onSelectWorker={(w) => {
            if (w.passportCode) navigate(`/passport/${w.passportCode}`);
          }}
          onSelectJob={() => navigate('/jobs')}
        />
      </div>
    </div>
  );
}
