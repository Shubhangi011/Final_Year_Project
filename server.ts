import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import {
  db,
  initDatabase,
  getDatabaseMode,
  fuzzCoordinates,
  haversineDistanceKm,
} from './server/database/mongoStore.ts';
import { seedDatabaseIfEmpty } from './server/database/seedData.ts';
import { ensureSingleSkillCourse } from './server/database/skillCurriculumCatalog.ts';
import {
  runPythonEngine,
  generateProfessionalProfile,
  generateJobDescriptionAI,
  runPlatformAssistant,
} from './server/services/aiService.ts';

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'kaushalsetu-jwt-secret-key-2026';

const CITY_COORDS: Record<string, [number, number]> = {
  latur: [76.5604, 18.4088],
  pune: [73.8567, 18.5204],
  'navi mumbai': [73.0297, 19.033],
  mumbai: [72.8777, 19.076],
  thane: [72.9781, 19.2183],
  nagpur: [79.0882, 21.1458],
  nashik: [73.7898, 19.9975],
  solapur: [75.9064, 17.6599],
  kolhapur: [74.2433, 16.705],
  aurangabad: [75.3433, 19.8762],
  'chhatrapati sambhajinagar': [75.3433, 19.8762],
  nanded: [77.321, 19.1383],
  satara: [74.0009, 17.6805],
  sangli: [74.5815, 16.8524],
  amravati: [77.7523, 20.932],
  akola: [77.0082, 20.7002],
  ahmednagar: [74.748, 19.0948],
  jalgaon: [75.5626, 21.0077],
  ratnagiri: [73.312, 16.9902],
  delhi: [77.209, 28.6139],
  bengaluru: [77.5946, 12.9716],
  hyderabad: [78.4867, 17.385],
};

function resolveCityCoords(city: string, customCoords?: [number, number]): [number, number] {
  if (customCoords && Array.isArray(customCoords) && customCoords.length === 2) {
    return [Number(customCoords[0]), Number(customCoords[1])];
  }
  const key = (city || 'Latur').trim().toLowerCase();
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(name)) return coords;
  }
  return CITY_COORDS.latur;
}

interface AuthPayload {
  userId: string;
  role: 'worker' | 'employer' | 'admin';
  email: string;
  name: string;
}

interface AuthedRequest extends Request {
  user?: AuthPayload;
}

// Simple in-memory IP rate limiter for auth & write safety
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxPerMinute = 180) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'local';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > maxPerMinute) {
      return res.status(429).json({ error: 'Too many requests. Please retry in a moment.' });
    }
    next();
  };
}

function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

function requireRole(...roles: Array<'worker' | 'employer' | 'admin'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role permissions for this operation.' });
    }
    next();
  };
}

// Connected WebSocket clients mapped by userId
const wsClients = new Map<string, Set<WebSocket>>();

function pushRealtimeEvent(userId: string, event: string, payload: any) {
  const sockets = wsClients.get(userId);
  if (!sockets) return;
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

async function recalculateWorkerReputation(workerId: string, eventLabel: string) {
  const profile = await db.findOne('worker_profiles', { userId: workerId });
  const skills = await db.find('worker_skills', { workerId });
  const reviews = await db.find('reviews', { workerId });
  const disputes = await db.find('disputes', {
    againstId: workerId,
    status: 'established_finding',
  });

  const repCalc = await runPythonEngine('reputation', {
    reviews,
    skills,
    completedJobsCount: profile?.completedJobsCount || 0,
    repeatHiresCount: profile?.repeatHiresCount || 0,
    establishedDisputesCount: disputes.length,
  });

  const existingRep = await db.findOne('reputation_scores', { workerId });
  const history = Array.isArray(existingRep?.history) ? [...existingRep.history] : [];
  history.push({
    date: new Date().toISOString().split('T')[0],
    score: repCalc.overallScore,
    event: eventLabel,
  });

  await db.updateOne(
    'reputation_scores',
    { workerId },
    {
      ...repCalc,
      workerId,
      history: history.slice(-15),
      updatedAt: new Date().toISOString(),
    },
    true
  );

  return repCalc;
}

async function enrichWorkerBundle(userDoc: any, includePrivate = false) {
  const profile = await db.findOne('worker_profiles', { userId: userDoc._id });
  const skills = await db.find('worker_skills', { workerId: userDoc._id });
  const reputation = await db.findOne('reputation_scores', { workerId: userDoc._id });
  const passport = await db.findOne('skill_passports', { workerId: userDoc._id });
  const certs = await db.find('certificates', { workerId: userDoc._id });

  const safeProfile = profile ? { ...profile } : null;
  if (safeProfile && !includePrivate) {
    delete safeProfile.exactAddress;
    safeProfile.location = safeProfile.publicLocation || safeProfile.location;
  }

  return {
    _id: userDoc._id,
    name: userDoc.name,
    gender: userDoc.gender || profile?.gender || 'Unspecified',
    email: includePrivate ? userDoc.email : undefined,
    phone: includePrivate ? userDoc.phone : undefined,
    role: userDoc.role,
    city: profile?.city || userDoc.city || 'Latur',
    preferredLanguage: userDoc.preferredLanguage || 'en',
    isDemo: Boolean(userDoc.isDemo || profile?.isDemo),
    profile: safeProfile,
    skills,
    reputation,
    passportCode: passport?.passportCode || null,
    certificates: certs.map((c) => ({
      _id: c._id,
      title: c.title,
      issuingAuthority: c.issuingAuthority,
      issueYear: c.issueYear,
      status: c.status,
    })),
  };
}

async function enrichWorkerBundlesBulk(userDocs: any[], includePrivate = false) {
  const [profiles, allSkills, reputations, passports, allCerts] = await Promise.all([
    db.find('worker_profiles'),
    db.find('worker_skills'),
    db.find('reputation_scores'),
    db.find('skill_passports'),
    db.find('certificates'),
  ]);

  const profileMap = new Map<string, any>();
  for (const p of profiles) profileMap.set(p.userId, p);

  const skillMap = new Map<string, any[]>();
  for (const s of allSkills) {
    const arr = skillMap.get(s.workerId);
    if (arr) arr.push(s);
    else skillMap.set(s.workerId, [s]);
  }

  const repMap = new Map<string, any>();
  for (const r of reputations) repMap.set(r.workerId, r);

  const passportMap = new Map<string, any>();
  for (const pp of passports) passportMap.set(pp.workerId, pp);

  const certMap = new Map<string, any[]>();
  for (const c of allCerts) {
    const arr = certMap.get(c.workerId);
    if (arr) arr.push(c);
    else certMap.set(c.workerId, [c]);
  }

  return userDocs.map((userDoc) => {
    const profile = profileMap.get(userDoc._id) || null;
    const safeProfile = profile ? { ...profile } : null;
    if (safeProfile && !includePrivate) {
      delete safeProfile.exactAddress;
      safeProfile.location = safeProfile.publicLocation || safeProfile.location;
    }
    const certs = certMap.get(userDoc._id) || [];
    return {
      _id: userDoc._id,
      name: userDoc.name,
      gender: userDoc.gender || profile?.gender || 'Unspecified',
      email: includePrivate ? userDoc.email : undefined,
      phone: includePrivate ? userDoc.phone : undefined,
      role: userDoc.role,
      city: profile?.city || userDoc.city || 'Latur',
      preferredLanguage: userDoc.preferredLanguage || 'en',
      isDemo: Boolean(userDoc.isDemo || profile?.isDemo),
      profile: safeProfile,
      skills: skillMap.get(userDoc._id) || [],
      reputation: repMap.get(userDoc._id) || null,
      passportCode: passportMap.get(userDoc._id)?.passportCode || null,
      certificates: certs.map((c: any) => ({
        _id: c._id,
        title: c.title,
        issuingAuthority: c.issuingAuthority,
        issueYear: c.issueYear,
        status: c.status,
      })),
    };
  });
}

async function startServer() {
  await initDatabase();
  await seedDatabaseIfEmpty();

  const app = express();
  const server = http.createServer(app);

  // Attach WebSocket Server in noServer mode so /ws upgrades do not abort Vite HMR WebSockets
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    let boundUserId: string | null = null;
    try {
      const url = new URL(req.url || '/ws', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
        boundUserId = decoded.userId;
        if (!wsClients.has(boundUserId)) {
          wsClients.set(boundUserId, new Set());
        }
        wsClients.get(boundUserId)!.add(ws);
        ws.send(JSON.stringify({ event: 'ws:connected', payload: { userId: boundUserId } }));
      }
    } catch {
      // Unauthenticated socket closes cleanly
    }

    ws.on('close', () => {
      if (boundUserId && wsClients.has(boundUserId)) {
        wsClients.get(boundUserId)!.delete(ws);
      }
    });
  });

  app.use(express.json({ limit: '6mb' }));
  app.use('/api', rateLimit(240));

  // =========================================================
  // HEALTH & LIVE PLATFORM ANALYTICS (NO HARDCODED STATS)
  // =========================================================
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      databaseMode: getDatabaseMode(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/stats', async (_req, res) => {
    try {
      const users = await db.find('users');
      const workers = await db.find('worker_profiles');
      const jobs = await db.find('jobs');
      const projects = await db.find('work_projects');
      const workerSkills = await db.find('worker_skills');

      // Real MongoDB-style category demand & average daily wage aggregation
      const catMap: Record<string, { category: string; openJobs: number; workersCount: number; avgWage: number; wageSum: number }> = {};
      for (const j of jobs) {
        const cat = j.category || 'General';
        if (!catMap[cat]) catMap[cat] = { category: cat, openJobs: 0, workersCount: 0, avgWage: 0, wageSum: 0 };
        if (j.status === 'open') catMap[cat].openJobs += 1;
        catMap[cat].wageSum += Number(j.dailyWageBudget || 0);
      }
      for (const w of workers) {
        const cat = w.category || 'General';
        if (!catMap[cat]) catMap[cat] = { category: cat, openJobs: 0, workersCount: 0, avgWage: 0, wageSum: 0 };
        catMap[cat].workersCount += 1;
      }

      const allCategoryDemand = Object.values(catMap)
        .map((item) => {
          const catJobs = jobs.filter((j) => j.category === item.category);
          return {
            category: item.category,
            openJobs: item.openJobs,
            workersCount: item.workersCount,
            avgDailyWage: catJobs.length ? Math.round(item.wageSum / catJobs.length) : 820,
          };
        })
        .sort((a, b) => b.workersCount + b.openJobs * 5 - (a.workersCount + a.openJobs * 5));

      const assessedSkillsCount = workerSkills.filter(
        (s) => s.verificationType === 'assessed' || s.verificationType === 'admin_verified'
      ).length;

      const distinctSkillsCount = new Set(workerSkills.map((s) => s.name)).size;

      // Featured workers showcasing diverse men and women across varied trades
      const workerUsers = users.filter((u) => u.role === 'worker' && u.status === 'active');
      const allBundles = await enrichWorkerBundlesBulk(workerUsers, false);
      const withPortraits = allBundles.filter((b) => Boolean(b.profile?.avatarKey));
      const featuredWorkers = (withPortraits.length >= 6 ? withPortraits.slice(0, 6) : allBundles.slice(0, 6));

      const femaleWorkers = workerUsers.filter((u) => u.gender === 'Female').length;
      const maleWorkers = workerUsers.filter((u) => u.gender === 'Male').length;

      res.json({
        counts: {
          totalWorkers: workerUsers.length,
          femaleWorkers,
          maleWorkers,
          distinctCategoriesCount: allCategoryDemand.length,
          distinctSkillsCount,
          totalEmployers: users.filter((u) => u.role === 'employer').length,
          openJobs: jobs.filter((j) => j.status === 'open').length,
          completedProjects: projects.filter((p) => p.stage === 'Completed').length,
          assessedSkillsCount,
        },
        categoryDemand: allCategoryDemand.slice(0, 10),
        allCategories: allCategoryDemand.map((c) => c.category),
        featuredWorkers,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to compute platform stats' });
    }
  });

  // =========================================================
  // AUTHENTICATION ROUTES
  // =========================================================
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, phone, gender, role, city, category, organizationName, preferredLanguage } = req.body;
      if (!name || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Name, valid email, and password (min 6 chars) are required.' });
      }
      const allowedRole: 'worker' | 'employer' = role === 'employer' ? 'employer' : 'worker';
      const normalizedEmail = String(email).trim().toLowerCase();

      const existing = await db.findOne('users', { email: normalizedEmail });
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();
      const chosenCity = (city || 'Latur').trim();
      const chosenGender = gender || 'Female';
      const coords = resolveCityCoords(chosenCity);

      const user = await db.insertOne('users', {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        phone: String(phone || '').trim(),
        gender: chosenGender,
        role: allowedRole,
        city: chosenCity,
        preferredLanguage: preferredLanguage || 'en',
        status: 'active',
        isDemo: false,
        createdAt: now,
      });

      if (allowedRole === 'worker') {
        const tradeCategory = String(category || 'Electrical').trim() || 'Electrical';
        await db.insertOne('worker_profiles', {
          userId: user._id,
          gender: chosenGender,
          category: tradeCategory,
          avatarKey: '',
          headline: `${tradeCategory} Specialist in ${chosenCity}`,
          bio: `Skilled ${tradeCategory.toLowerCase()} professional available for residential, commercial, and custom assignments in ${chosenCity}.`,
          experienceYears: 1,
          expectedDailyWage: 750,
          maxTravelKm: 25,
          city: chosenCity,
          exactAddress: `${chosenCity}, Maharashtra`,
          location: { type: 'Point', coordinates: coords },
          publicLocation: { type: 'Point', coordinates: fuzzCoordinates(coords) },
          availabilityStatus: 'available',
          completedJobsCount: 0,
          repeatHiresCount: 0,
          emergencyContact: { name: '', relation: '', phone: '' },
          portfolioItems: [],
          adminIdentityVerified: false,
          isDemo: false,
          createdAt: now,
        });

        // Fair-Start Bayesian baseline reputation for new worker
        const rep = await runPythonEngine('reputation', {
          reviews: [],
          skills: [],
          completedJobsCount: 0,
          repeatHiresCount: 0,
          establishedDisputesCount: 0,
        });
        await db.insertOne('reputation_scores', {
          workerId: user._id,
          ...rep,
          history: [{ date: now.split('T')[0], score: rep.overallScore, event: 'Fair-Start Baseline Initialized' }],
          updatedAt: now,
        });

        const randDigits = Math.floor(2000 + Math.random() * 7900);
        await db.insertOne('skill_passports', {
          workerId: user._id,
          passportCode: `KS-MH-2026-${randDigits}`,
          issuedAt: now,
          lastSyncedAt: now,
        });

        await db.insertOne('worker_availability', {
          workerId: user._id,
          availableDates: [],
          unavailableDates: [],
          workingHours: { start: '08:30', end: '18:00' },
          updatedAt: now,
        });
      } else {
        await db.insertOne('employer_profiles', {
          userId: user._id,
          organizationName: organizationName || `${name}'s Contracting`,
          employerType: organizationName ? 'Company' : 'Individual',
          city: chosenCity,
          description: `Verified hiring account in ${chosenCity}.`,
          location: { type: 'Point', coordinates: coords },
          verifiedBusiness: false,
          isDemo: false,
          createdAt: now,
        });
      }

      await db.insertOne('audit_logs', {
        actorId: user._id,
        actorRole: allowedRole,
        action: 'USER_REGISTER',
        targetCollection: 'users',
        targetId: user._id,
        justification: `New ${allowedRole} registration`,
        createdAt: now,
      });

      const token = jwt.sign(
        { userId: user._id, role: allowedRole, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          city: user.city,
          preferredLanguage: user.preferredLanguage,
          isDemo: false,
        },
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      const normalizedEmail = String(email).trim().toLowerCase();
      const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const user =
        (await db.findOne('users', { email: normalizedEmail })) ||
        (await db.findOne('users', { email: { $regex: `^\\s*${escapedEmail}\\s*$`, $options: 'i' } }));

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({
          error: `Account suspended by Governance Admin. Reason: ${user.suspensionReason || 'Policy review'}`,
        });
      }

      const rawHash = user.passwordHash || user.hashed_password || user.password_hash;
      const inputPass = String(password);
      let valid = false;

      if (typeof rawHash === 'string' && rawHash.startsWith('$2')) {
        const normalizedBcryptHash = rawHash.replace(/^\$2y\$/, '$2a$');
        valid =
          (await bcrypt.compare(inputPass, normalizedBcryptHash)) ||
          (inputPass.trim() !== inputPass && (await bcrypt.compare(inputPass.trim(), normalizedBcryptHash)));
      } else if (typeof user.password === 'string' && user.password.length > 0) {
        // Support accounts manually inserted directly via MongoDB Compass GUI and upgrade to bcrypt
        valid = user.password === inputPass || user.password === inputPass.trim();
        if (valid) {
          const upgradedHash = await bcrypt.hash(inputPass.trim(), 10);
          await db.updateOne('users', { _id: user._id }, { passwordHash: upgradedHash });
        }
      }

      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { userId: user._id, role: user.role, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          city: user.city,
          preferredLanguage: user.preferredLanguage || 'en',
          isDemo: Boolean(user.isDemo),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.json({ message: 'Logged out cleanly.' });
  });

  app.get('/api/auth/me', authenticate, async (req: AuthedRequest, res) => {
    const user = await db.findOne('users', { _id: req.user!.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        city: user.city,
        preferredLanguage: user.preferredLanguage || 'en',
        isDemo: Boolean(user.isDemo),
      },
    });
  });

  // =========================================================
  // WORKERS, DIGITAL SKILL PASSPORT & AVAILABILITY ROUTES
  // =========================================================
  app.get('/api/workers/recommendations', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    try {
      const userDoc = await db.findOne('users', { _id: req.user!.userId });
      if (!userDoc) return res.status(404).json({ error: 'Worker not found' });
      const bundle = await enrichWorkerBundle(userDoc, true);
      const openJobs = await db.find('jobs', { status: 'open' });
      const fairOpportunity = req.query.fairOpportunity !== 'false';

      const workerPayload = {
        _id: bundle._id,
        category: bundle.profile?.category || 'Electrical',
        bio: bundle.profile?.bio || '',
        experienceYears: bundle.profile?.experienceYears || 0,
        expectedDailyWage: bundle.profile?.expectedDailyWage || 750,
        maxTravelKm: bundle.profile?.maxTravelKm || 25,
        availabilityStatus: bundle.profile?.availabilityStatus || 'available',
        completedJobsCount: bundle.profile?.completedJobsCount || 0,
        location: bundle.profile?.location || { coordinates: [76.5604, 18.4088] },
        skills: bundle.skills,
      };

      const pyRes = await runPythonEngine('match_batch_jobs', {
        worker: workerPayload,
        jobs: openJobs,
        fairOpportunity,
      });

      const jobMap = new Map(openJobs.map((j) => [j._id, j]));
      const recommendations = (pyRes.matches || []).map((m: any) => ({
        ...m,
        job: jobMap.get(m.jobId),
      }));

      res.json({ recommendations });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to compute AI job recommendations' });
    }
  });

  app.get('/api/workers/reputation', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    const rep = await db.findOne('reputation_scores', { workerId: req.user!.userId });
    const reviews = await db.find('reviews', { workerId: req.user!.userId }, { sort: { createdAt: -1 } });
    res.json({ reputation: rep, reviews });
  });

  app.get('/api/workers/skill-passport', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    try {
      const userDoc = await db.findOne('users', { _id: req.user!.userId });
      if (!userDoc) return res.status(404).json({ error: 'Worker not found' });
      const bundle = await enrichWorkerBundle(userDoc, true);
      let passport = await db.findOne('skill_passports', { workerId: userDoc._id });
      if (!passport) {
        passport = await db.insertOne('skill_passports', {
          workerId: userDoc._id,
          passportCode: `KS-MH-2026-${Math.floor(1000 + Math.random() * 8999)}`,
          issuedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        });
      }
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const verifyUrl = `${appUrl}/passport/${passport.passportCode}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#0f1d38', light: '#ffffff' },
      });

      const completedProjects = await db.find('work_projects', {
        workerId: userDoc._id,
        stage: 'Completed',
      });
      const reviews = await db.find('reviews', { workerId: userDoc._id });

      res.json({
        passportCode: passport.passportCode,
        verifyUrl,
        qrDataUrl,
        issuedAt: passport.issuedAt,
        worker: bundle,
        completedProjects,
        reviews,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate Digital Skill Passport' });
    }
  });

  app.get('/api/passport/:code', async (req, res) => {
    try {
      const passport = await db.findOne('skill_passports', { passportCode: req.params.code });
      if (!passport) return res.status(404).json({ error: 'Skill Passport ID not found' });
      const userDoc = await db.findOne('users', { _id: passport.workerId });
      if (!userDoc) return res.status(404).json({ error: 'Worker account not found' });
      const bundle = await enrichWorkerBundle(userDoc, false);
      const completedProjects = await db.find('work_projects', {
        workerId: userDoc._id,
        stage: 'Completed',
      });
      const reviews = await db.find('reviews', { workerId: userDoc._id });
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const verifyUrl = `${appUrl}/passport/${passport.passportCode}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 });

      res.json({
        passportCode: passport.passportCode,
        verifyUrl,
        qrDataUrl,
        issuedAt: passport.issuedAt,
        worker: bundle,
        completedProjects,
        reviews,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/workers/availability', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    let avail = await db.findOne('worker_availability', { workerId: req.user!.userId });
    if (!avail) {
      avail = await db.insertOne('worker_availability', {
        workerId: req.user!.userId,
        availableDates: [],
        unavailableDates: [],
        workingHours: { start: '08:30', end: '18:00' },
        updatedAt: new Date().toISOString(),
      });
    }
    res.json({ availability: avail });
  });

  app.put('/api/workers/availability', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    const { availableDates, unavailableDates, workingHours, availabilityStatus } = req.body;
    const updated = await db.updateOne(
      'worker_availability',
      { workerId: req.user!.userId },
      {
        availableDates: Array.isArray(availableDates) ? availableDates : [],
        unavailableDates: Array.isArray(unavailableDates) ? unavailableDates : [],
        workingHours: workingHours || { start: '08:30', end: '18:00' },
        updatedAt: new Date().toISOString(),
      },
      true
    );
    if (availabilityStatus) {
      await db.updateOne('worker_profiles', { userId: req.user!.userId }, { availabilityStatus });
    }
    res.json({ availability: updated });
  });

  app.put('/api/workers/profile', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    try {
      const {
        name,
        gender,
        category,
        headline,
        bio,
        bioMarathi,
        experienceYears,
        expectedDailyWage,
        maxTravelKm,
        city,
        exactAddress,
        availabilityStatus,
        emergencyContact,
        portfolioItems,
        avatarDataUrl,
      } = req.body;

      const userPatch: Record<string, any> = {};
      if (name) userPatch.name = String(name).trim();
      if (city) userPatch.city = String(city).trim();
      if (gender) userPatch.gender = String(gender).trim();
      if (Object.keys(userPatch).length > 0) {
        await db.updateOne('users', { _id: req.user!.userId }, userPatch);
      }
      const chosenCity = (city || 'Latur').trim();
      const coords = resolveCityCoords(chosenCity);

      const patch: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (gender !== undefined) patch.gender = String(gender).trim();
      if (category !== undefined) patch.category = String(category).trim();
      if (headline !== undefined) patch.headline = headline;
      if (bio !== undefined) patch.bio = bio;
      if (bioMarathi !== undefined) patch.bioMarathi = bioMarathi;
      if (experienceYears !== undefined) patch.experienceYears = Number(experienceYears);
      if (expectedDailyWage !== undefined) patch.expectedDailyWage = Number(expectedDailyWage);
      if (maxTravelKm !== undefined) patch.maxTravelKm = Number(maxTravelKm);
      if (city !== undefined) {
        patch.city = chosenCity;
        patch.location = { type: 'Point', coordinates: coords };
        patch.publicLocation = { type: 'Point', coordinates: fuzzCoordinates(coords) };
      }
      if (exactAddress !== undefined) patch.exactAddress = exactAddress;
      if (availabilityStatus !== undefined) patch.availabilityStatus = availabilityStatus;
      if (emergencyContact !== undefined) patch.emergencyContact = emergencyContact;
      if (Array.isArray(portfolioItems)) patch.portfolioItems = portfolioItems;
      if (avatarDataUrl !== undefined) patch.avatarDataUrl = avatarDataUrl;

      await db.updateOne('worker_profiles', { userId: req.user!.userId }, patch, true);
      const userDoc = await db.findOne('users', { _id: req.user!.userId });
      const bundle = await enrichWorkerBundle(userDoc, true);
      res.json({ worker: bundle });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/workers/skills', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    const { name, category, proficiency } = req.body;
    if (!name) return res.status(400).json({ error: 'Skill name is required.' });
    const trimmedName = String(name).trim();
    const skillCat = String(category || 'Custom Skill').trim();

    // Organically grow canonical skills collection & 4-module learning course for unlimited custom skills!
    await ensureSingleSkillCourse(trimmedName, skillCat);

    const existing = await db.findOne('worker_skills', {
      workerId: req.user!.userId,
      name: trimmedName,
    });
    if (existing) {
      if (existing.verificationType === 'self_declared') {
        await db.updateOne('worker_skills', { _id: existing._id }, { proficiency: proficiency || 'Intermediate' });
      }
    } else {
      await db.insertOne('worker_skills', {
        workerId: req.user!.userId,
        name: trimmedName,
        category: skillCat,
        proficiency: proficiency || 'Intermediate',
        verificationType: 'self_declared',
        updatedAt: new Date().toISOString(),
      });
    }
    await recalculateWorkerReputation(req.user!.userId, `Added skill: ${trimmedName}`);
    const skills = await db.find('worker_skills', { workerId: req.user!.userId });
    res.status(201).json({ skills });
  });

  app.post('/api/workers/certificates', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    const { title, issuingAuthority, issueYear, credentialNumber, fileDataUrl } = req.body;
    if (!title || !issuingAuthority) {
      return res.status(400).json({ error: 'Certificate title and issuing authority are required.' });
    }
    const cert = await db.insertOne('certificates', {
      workerId: req.user!.userId,
      workerName: req.user!.name,
      title: String(title).trim(),
      issuingAuthority: String(issuingAuthority).trim(),
      issueYear: String(issueYear || '2025'),
      credentialNumber: String(credentialNumber || ''),
      fileDataUrl: fileDataUrl || null,
      status: 'pending',
      adminNotes: 'Submitted for Admin credential verification.',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ certificate: cert });
  });

  app.get('/api/workers', async (req, res) => {
    try {
      const {
        category,
        gender,
        city,
        search,
        minExp,
        maxWage,
        availability,
        sortBy = 'reputation',
        fairOpportunity = 'false',
        lat,
        lng,
        page = '1',
        limit = '24',
      } = req.query as Record<string, string>;

      const workerUsers = await db.find('users', { role: 'worker', status: 'active' });
      const allBundles = await enrichWorkerBundlesBulk(workerUsers, false);

      // Dynamic facets across entire active workforce (supports unlimited custom categories & cities)
      const availableCategories = Array.from(
        new Set(allBundles.map((b) => b.profile?.category).filter(Boolean))
      ).sort();
      const availableCities = Array.from(
        new Set(allBundles.map((b) => b.city).filter(Boolean))
      ).sort();

      let bundles = allBundles;

      if (gender && gender !== 'All') {
        bundles = bundles.filter((b) => (b.gender || '').toLowerCase() === gender.toLowerCase());
      }
      if (category && category !== 'All') {
        const catLow = category.trim().toLowerCase();
        bundles = bundles.filter((b) => (b.profile?.category || '').toLowerCase().includes(catLow));
      }
      if (city && city !== 'All') {
        bundles = bundles.filter((b) => (b.city || '').toLowerCase().includes(city.toLowerCase()));
      }
      if (availability && availability !== 'all') {
        bundles = bundles.filter((b) => b.profile?.availabilityStatus === availability);
      }
      if (minExp) {
        bundles = bundles.filter((b) => Number(b.profile?.experienceYears || 0) >= Number(minExp));
      }
      if (maxWage) {
        bundles = bundles.filter((b) => Number(b.profile?.expectedDailyWage || 0) <= Number(maxWage));
      }
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        bundles = bundles.filter((b) => {
          const skillStr = b.skills.map((s: any) => s.name).join(' ').toLowerCase();
          return (
            b.name.toLowerCase().includes(q) ||
            (b.gender || '').toLowerCase().includes(q) ||
            (b.profile?.headline || '').toLowerCase().includes(q) ||
            (b.profile?.bio || '').toLowerCase().includes(q) ||
            (b.profile?.category || '').toLowerCase().includes(q) ||
            (b.city || '').toLowerCase().includes(q) ||
            skillStr.includes(q)
          );
        });
      }

      const refCoords: [number, number] | null =
        lat && lng ? [Number(lng), Number(lat)] : city && city !== 'All' ? resolveCityCoords(city) : null;

      const enrichedWithDistance = bundles.map((b) => {
        const wCoords = (b.profile?.location?.coordinates || [76.5604, 18.4088]) as [number, number];
        const distanceKm = refCoords ? haversineDistanceKm(refCoords, wCoords) : null;
        const fairBoost =
          fairOpportunity === 'true' &&
          Number(b.profile?.completedJobsCount || 0) <= 2 &&
          b.skills.some((s: any) => s.verificationType !== 'self_declared')
            ? 12
            : 0;
        return { ...b, distanceKm, fairBoost };
      });

      enrichedWithDistance.sort((a, b) => {
        if (sortBy === 'nearest' && a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        if (sortBy === 'experience') {
          return Number(b.profile?.experienceYears || 0) - Number(a.profile?.experienceYears || 0);
        }
        if (sortBy === 'wage_low') {
          return Number(a.profile?.expectedDailyWage || 0) - Number(b.profile?.expectedDailyWage || 0);
        }
        const scoreA = Number(a.reputation?.overallScore || 70) + a.fairBoost;
        const scoreB = Number(b.reputation?.overallScore || 70) + b.fairBoost;
        return scoreB - scoreA;
      });

      const femaleFiltered = enrichedWithDistance.filter((w) => w.gender === 'Female').length;
      const maleFiltered = enrichedWithDistance.filter((w) => w.gender === 'Male').length;

      const totalCount = enrichedWithDistance.length;
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Math.min(600, Number(limit) || 24));
      const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));
      const startIdx = (pageNum - 1) * limitNum;
      const pagedWorkers = enrichedWithDistance.slice(startIdx, startIdx + limitNum);

      res.json({
        workers: pagedWorkers,
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages,
        genderCounts: { female: femaleFiltered, male: maleFiltered },
        availableCategories,
        availableCities,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/workers/:id', async (req: AuthedRequest, res) => {
    const authHeader = req.headers.authorization;
    let viewerId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const d = jwt.verify(authHeader.slice(7), JWT_SECRET) as AuthPayload;
        viewerId = d.userId;
      } catch {
        // public viewer
      }
    }
    const userDoc = await db.findOne('users', { _id: req.params.id });
    if (!userDoc) return res.status(404).json({ error: 'Worker not found' });
    const isSelf = viewerId === userDoc._id;
    const bundle = await enrichWorkerBundle(userDoc, isSelf);
    const reviews = await db.find('reviews', { workerId: userDoc._id }, { sort: { createdAt: -1 } });
    res.json({ worker: bundle, reviews });
  });

  // =========================================================
  // SKILL ASSESSMENTS (AI-BASED SKILL VERIFICATION)
  // =========================================================
  app.get('/api/assessments', async (_req, res) => {
    const assessments = await db.find('skill_assessments');
    const questions = await db.find('assessment_questions');
    const safeAssessments = assessments.map((a) => ({
      ...a,
      questions: questions
        .filter((q) => q.assessmentId === a._id)
        .map(({ correctIndex, explanation, ...publicFields }) => publicFields),
    }));
    res.json({ assessments: safeAssessments });
  });

  app.post('/api/assessments/:id/submit', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    try {
      const assessment = await db.findOne('skill_assessments', { _id: req.params.id });
      if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
      const questions = await db.find('assessment_questions', { assessmentId: assessment._id });
      const submittedAnswers: number[] = Array.isArray(req.body.answers) ? req.body.answers : [];

      let earnedWeight = 0;
      let totalWeight = 0;
      const feedback = questions.map((q, idx) => {
        const w = Number(q.difficultyWeight || 1);
        totalWeight += w;
        const chosen = submittedAnswers[idx];
        const correct = chosen === q.correctIndex;
        if (correct) earnedWeight += w;
        return {
          questionId: q._id,
          correct,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        };
      });

      const pct = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
      const proficiencyAwarded: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' =
        pct >= 90 ? 'Expert' : pct >= 75 ? 'Advanced' : pct >= 55 ? 'Intermediate' : 'Beginner';

      const resultDoc = await db.insertOne('assessment_results', {
        workerId: req.user!.userId,
        assessmentId: assessment._id,
        skillName: assessment.skillName,
        score: pct,
        proficiencyAwarded,
        completedAt: new Date().toISOString(),
      });

      // Upsert into worker_skills as 'assessed'
      const existingSkill = await db.findOne('worker_skills', {
        workerId: req.user!.userId,
        name: assessment.skillName,
      });
      if (existingSkill) {
        await db.updateOne(
          'worker_skills',
          { _id: existingSkill._id },
          {
            proficiency: proficiencyAwarded,
            verificationType: existingSkill.verificationType === 'admin_verified' ? 'admin_verified' : 'assessed',
            assessmentScore: pct,
            updatedAt: new Date().toISOString(),
          }
        );
      } else {
        await db.insertOne('worker_skills', {
          workerId: req.user!.userId,
          name: assessment.skillName,
          category: assessment.category,
          proficiency: proficiencyAwarded,
          verificationType: 'assessed',
          assessmentScore: pct,
          updatedAt: new Date().toISOString(),
        });
      }

      const updatedRep = await recalculateWorkerReputation(
        req.user!.userId,
        `Completed ${assessment.skillName} Assessment (${pct}% - ${proficiencyAwarded})`
      );

      res.json({
        result: resultDoc,
        feedback,
        reputation: updatedRep,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================
  // EMPLOYERS, SHORTLISTING & HIRING REQUESTS
  // =========================================================
  app.get('/api/employers/profile', authenticate, requireRole('employer'), async (req: AuthedRequest, res) => {
    const profile = await db.findOne('employer_profiles', { userId: req.user!.userId });
    const saved = await db.find('saved_workers', { employerId: req.user!.userId });
    res.json({ profile, savedWorkerIds: saved.map((s) => s.workerId) });
  });

  app.put('/api/employers/profile', authenticate, requireRole('employer'), async (req: AuthedRequest, res) => {
    const { organizationName, employerType, city, description, gstNumber } = req.body;
    const chosenCity = city || 'Latur';
    const updated = await db.updateOne(
      'employer_profiles',
      { userId: req.user!.userId },
      {
        organizationName,
        employerType,
        city: chosenCity,
        description,
        gstNumber: gstNumber || '',
        location: { type: 'Point', coordinates: resolveCityCoords(chosenCity) },
        updatedAt: new Date().toISOString(),
      },
      true
    );
    res.json({ profile: updated });
  });

  app.post('/api/employers/saved-workers', authenticate, requireRole('employer'), async (req: AuthedRequest, res) => {
    const { workerId } = req.body;
    const existing = await db.findOne('saved_workers', {
      employerId: req.user!.userId,
      workerId,
    });
    if (existing) {
      await db.deleteOne('saved_workers', { _id: existing._id });
    } else {
      await db.insertOne('saved_workers', {
        employerId: req.user!.userId,
        workerId,
        createdAt: new Date().toISOString(),
      });
    }
    const saved = await db.find('saved_workers', { employerId: req.user!.userId });
    res.json({ savedWorkerIds: saved.map((s) => s.workerId) });
  });

  app.post('/api/hiring-requests', authenticate, requireRole('employer'), async (req: AuthedRequest, res) => {
    try {
      const { workerId, projectTitle, category, offeredDailyWage, durationDays, city, meetingScheduledAt, isRepeatHire, message } = req.body;
      if (!workerId || !projectTitle) {
        return res.status(400).json({ error: 'Worker and project title are required.' });
      }
      const workerUser = await db.findOne('users', { _id: workerId });
      const empProfile = await db.findOne('employer_profiles', { userId: req.user!.userId });
      const now = new Date().toISOString();

      const hr = await db.insertOne('hiring_requests', {
        employerId: req.user!.userId,
        employerName: empProfile?.organizationName || req.user!.name,
        workerId,
        workerName: workerUser?.name || 'Skilled Worker',
        projectTitle,
        category: category || 'Electrical',
        offeredDailyWage: Number(offeredDailyWage || 850),
        durationDays: Number(durationDays || 3),
        city: city || empProfile?.city || 'Latur',
        meetingScheduledAt: meetingScheduledAt || null,
        isRepeatHire: Boolean(isRepeatHire),
        status: 'pending',
        message: message || '',
        createdAt: now,
      });

      const notif = await db.insertOne('notifications', {
        userId: workerId,
        type: isRepeatHire ? 'repeat_hire' : 'hiring_request',
        title: isRepeatHire ? `Repeat Hire Offer: ${projectTitle}` : `New Hiring Request: ${projectTitle}`,
        body: `${empProfile?.organizationName || req.user!.name} offered ₹${hr.offeredDailyWage}/day for ${hr.durationDays} days.`,
        read: false,
        createdAt: now,
      });
      pushRealtimeEvent(workerId, 'notification:new', notif);

      res.status(201).json({ hiringRequest: hr });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/hiring-requests', authenticate, async (req: AuthedRequest, res) => {
    const filter =
      req.user!.role === 'employer'
        ? { employerId: req.user!.userId }
        : { workerId: req.user!.userId };
    const requests = await db.find('hiring_requests', filter, { sort: { createdAt: -1 } });
    res.json({ hiringRequests: requests });
  });

  app.put('/api/hiring-requests/:id/status', authenticate, async (req: AuthedRequest, res) => {
    const { status } = req.body; // 'accepted' | 'declined'
    const hr = await db.findOne('hiring_requests', { _id: req.params.id });
    if (!hr) return res.status(404).json({ error: 'Hiring request not found' });

    const updated = await db.updateOne('hiring_requests', { _id: hr._id }, { status });
    let createdProject = null;

    if (status === 'accepted') {
      const now = new Date().toISOString();
      createdProject = await db.insertOne('work_projects', {
        jobId: null,
        employerId: hr.employerId,
        employerName: hr.employerName,
        workerId: hr.workerId,
        workerName: hr.workerName,
        title: hr.projectTitle,
        category: hr.category || 'Electrical',
        agreedDailyWage: hr.offeredDailyWage,
        durationDays: hr.durationDays,
        stage: 'Accepted',
        city: hr.city || 'Latur',
        isRepeatHire: Boolean(hr.isRepeatHire),
        completionConfirmedAt: null,
        completionCertificateCode: null,
        createdAt: now,
      });

      await db.insertOne('work_agreements', {
        projectId: createdProject._id,
        employerId: hr.employerId,
        employerName: hr.employerName,
        workerId: hr.workerId,
        workerName: hr.workerName,
        workDescription: `${hr.projectTitle} (${hr.category || 'Skilled Trade'}) in ${hr.city}`,
        dailyWage: hr.offeredDailyWage,
        durationDays: hr.durationDays,
        responsibilities: [
          'Execute agreed trade scope with proper safety equipment and workmanship standards',
          'Employer provides clear site access, required materials, and timely milestone settlement',
        ],
        terms: [
          `Agreed daily wage: ₹${hr.offeredDailyWage}/day for ${hr.durationDays} estimated day(s)`,
          'Both parties may log progress updates and generate a Digital Work Completion Certificate upon handover',
        ],
        employerAccepted: true,
        workerAccepted: true,
        agreementCode: `AGR-KS-${Math.floor(10000 + Math.random() * 89999)}`,
        createdAt: now,
      });

      const notif = await db.insertOne('notifications', {
        userId: hr.employerId,
        type: 'project_started',
        title: `${hr.workerName} accepted your hiring request`,
        body: `Project "${hr.projectTitle}" is now active with a generated Work Agreement.`,
        read: false,
        createdAt: now,
      });
      pushRealtimeEvent(hr.employerId, 'notification:new', notif);
    }

    res.json({ hiringRequest: updated, project: createdProject });
  });

  // =========================================================
  // JOBS & SMART SHORTLISTING APPLICATIONS
  // =========================================================
  app.post('/api/jobs', authenticate, requireRole('employer'), async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        category,
        description,
        requiredSkills,
        minExperienceYears,
        dailyWageBudget,
        durationDays,
        city,
        isEmergency,
        responsibilities,
        deadline,
      } = req.body;

      if (!title || !description || !dailyWageBudget) {
        return res.status(400).json({ error: 'Job title, description, and daily wage budget are required.' });
      }

      const empProfile = await db.findOne('employer_profiles', { userId: req.user!.userId });
      const chosenCity = city || empProfile?.city || 'Latur';
      const coords = resolveCityCoords(chosenCity);
      const now = new Date().toISOString();

      const job = await db.insertOne('jobs', {
        employerId: req.user!.userId,
        employerName: empProfile?.organizationName || req.user!.name,
        title: String(title).trim(),
        category: category || 'Electrical',
        description: String(description).trim(),
        requiredSkills: Array.isArray(requiredSkills)
          ? requiredSkills
          : String(requiredSkills || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
        minExperienceYears: Number(minExperienceYears ?? 1),
        dailyWageBudget: Number(dailyWageBudget),
        durationDays: Number(durationDays ?? 3),
        city: chosenCity,
        location: { type: 'Point', coordinates: coords },
        isEmergency: Boolean(isEmergency),
        status: 'open',
        responsibilities: Array.isArray(responsibilities) ? responsibilities : [],
        deadline: deadline || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        isDemo: false,
        createdAt: now,
      });

      for (const reqSkill of job.requiredSkills || []) {
        await ensureSingleSkillCourse(reqSkill, job.category);
      }

      // Run AI Fraud check on newly posted job (flags extreme wage outliers for Admin without auto-banning)
      const allJobs = await db.find('jobs');
      const fraudRes = await runPythonEngine('fraud', { jobs: [job, ...allJobs.slice(0, 15)], reviews: [], users: [] });
      for (const alert of fraudRes.alerts || []) {
        if (alert.targetId === job._id) {
          await db.insertOne('fraud_alerts', {
            ...alert,
            status: 'open',
            adminNotes: '',
            createdAt: now,
          });
        }
      }

      // Emergency Hiring: Broadcast real-time alerts to nearby available workers in same category
      if (job.isEmergency) {
        const nearbyWorkers = await db.find('worker_profiles', {
          category: job.category,
          availabilityStatus: 'available',
        });
        for (const wp of nearbyWorkers) {
          const dist = haversineDistanceKm(coords, wp.location?.coordinates || coords);
          if (dist <= 60) {
            const notif = await db.insertOne('notifications', {
              userId: wp.userId,
              type: 'emergency_job',
              title: `EMERGENCY HIRING (${dist} km): ${job.title}`,
              body: `Urgent ${job.category} requirement in ${chosenCity} offering ₹${job.dailyWageBudget}/day.`,
              read: false,
              createdAt: now,
            });
            pushRealtimeEvent(wp.userId, 'notification:new', notif);
          }
        }
      }

      res.status(201).json({ job });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/jobs', async (req, res) => {
    const { category, city, search, emergencyOnly } = req.query as Record<string, string>;
    const allOpenJobs = await db.find('jobs', { status: 'open' }, { sort: { createdAt: -1 } });
    const availableCategories = Array.from(new Set(allOpenJobs.map((j) => j.category).filter(Boolean))).sort();
    const availableCities = Array.from(new Set(allOpenJobs.map((j) => j.city).filter(Boolean))).sort();

    let jobs = allOpenJobs;

    if (category && category !== 'All') {
      const catLow = category.trim().toLowerCase();
      jobs = jobs.filter((j) => (j.category || '').toLowerCase().includes(catLow));
    }
    if (city && city !== 'All') {
      jobs = jobs.filter((j) => (j.city || '').toLowerCase().includes(city.toLowerCase()));
    }
    if (emergencyOnly === 'true') {
      jobs = jobs.filter((j) => Boolean(j.isEmergency));
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      // Multilingual voice/text query keyword expansion across unrestricted trades
      const expanded: string[] = [q];
      if (/इलेक्ट्रिशियन|विजेचे|बिजली|वायरिंग/.test(q)) expanded.push('electrical', 'wiring', 'electrician');
      if (/प्लंबर|नळ|पाइप/.test(q)) expanded.push('plumbing', 'cpvc', 'pipe');
      if (/सुतार|फर्निचर|बढ़ई/.test(q)) expanded.push('carpentry', 'kitchen', 'furniture');
      if (/सोलर|सौर/.test(q)) expanded.push('solar', 'inverter');
      if (/वेल्डर|वेल्डिंग/.test(q)) expanded.push('welding', 'fabrication');
      if (/शिंपी|शिलाई|बुटिक|सिलाई|ब्लाउज|दरजी/.test(q)) expanded.push('tailor', 'boutique', 'stitching', 'garment');
      if (/नर्स|केअरटेकर|पेशंट|सुश्रुषा|आया/.test(q)) expanded.push('nursing', 'healthcare', 'elder', 'care');
      if (/ब्युटी|पार्लर|मेकअप|मेंदी/.test(q)) expanded.push('beauty', 'salon', 'bridal', 'makeup');
      if (/स्वयंपाक|केटरिंग|रसोइया|बेकरी/.test(q)) expanded.push('culinary', 'catering', 'bakery', 'cooking');
      if (/सीसीटीव्ही|संगणक|नेटवर्क|लॅपटॉप/.test(q)) expanded.push('computer', 'cctv', 'network');
      if (/मेकॅनिक|गाडी|स्कूटर|ईव्ही/.test(q)) expanded.push('automotive', 'ev', 'mechanic', 'diagnostic');
      if (/ड्रायव्हर|चालक|टेम्पो/.test(q)) expanded.push('driving', 'delivery', 'logistics');
      if (/शेती|ठिबक|नर्सरी/.test(q)) expanded.push('agriculture', 'irrigation', 'nursery');

      jobs = jobs.filter((j) => {
        const hay = `${j.title} ${j.category} ${j.description} ${j.city} ${(j.requiredSkills || []).join(' ')}`.toLowerCase();
        return expanded.some((term) => hay.includes(term));
      });
    }

    res.json({ jobs, availableCategories, availableCities });
  });

  app.get('/api/jobs/:id', async (req, res) => {
    const job = await db.findOne('jobs', { _id: req.params.id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  });

  app.put('/api/jobs/:id', authenticate, requireRole('employer', 'admin'), async (req: AuthedRequest, res) => {
    const job = await db.findOne('jobs', { _id: req.params.id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (req.user!.role !== 'admin' && job.employerId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized to modify this job.' });
    }
    const updated = await db.updateOne('jobs', { _id: job._id }, req.body);
    res.json({ job: updated });
  });

  app.delete('/api/jobs/:id', authenticate, requireRole('employer', 'admin'), async (req: AuthedRequest, res) => {
    const job = await db.findOne('jobs', { _id: req.params.id });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (req.user!.role !== 'admin' && job.employerId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this job.' });
    }
    await db.deleteOne('jobs', { _id: job._id });
    res.json({ deleted: true });
  });

  app.post('/api/applications', authenticate, requireRole('worker'), async (req: AuthedRequest, res) => {
    try {
      const { jobId, coverNote, proposedDailyWage } = req.body;
      const job = await db.findOne('jobs', { _id: jobId });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const userDoc = await db.findOne('users', { _id: req.user!.userId });
      const bundle = await enrichWorkerBundle(userDoc, true);

      const matchRes = await runPythonEngine('match_single', {
        worker: {
          _id: bundle._id,
          category: bundle.profile?.category,
          bio: bundle.profile?.bio,
          experienceYears: bundle.profile?.experienceYears,
          expectedDailyWage: proposedDailyWage || bundle.profile?.expectedDailyWage,
          maxTravelKm: bundle.profile?.maxTravelKm,
          availabilityStatus: bundle.profile?.availabilityStatus,
          completedJobsCount: bundle.profile?.completedJobsCount,
          location: bundle.profile?.location,
          skills: bundle.skills,
        },
        job,
        fairOpportunity: true,
      });

      const now = new Date().toISOString();
      const appDoc = await db.insertOne('job_applications', {
        jobId,
        jobTitle: job.title,
        employerId: job.employerId,
        workerId: req.user!.userId,
        workerName: req.user!.name,
        workerCategory: bundle.profile?.category || 'Electrical',
        coverNote: coverNote || 'Interested and available for on-time site execution.',
        proposedDailyWage: Number(proposedDailyWage || bundle.profile?.expectedDailyWage || job.dailyWageBudget),
        status: 'applied',
        aiMatchScore: matchRes.overallScore,
        aiBreakdown: matchRes.breakdown,
        aiExplanation: matchRes.explanation,
        distanceKm: matchRes.distanceKm,
        createdAt: now,
      });

      const notif = await db.insertOne('notifications', {
        userId: job.employerId,
        type: 'application',
        title: `New Application (${matchRes.overallScore}% AI Match)`,
        body: `${req.user!.name} applied for "${job.title}".`,
        read: false,
        createdAt: now,
      });
      pushRealtimeEvent(job.employerId, 'notification:new', notif);

      res.status(201).json({ application: appDoc });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/applications', authenticate, async (req: AuthedRequest, res) => {
    if (req.user!.role === 'worker') {
      const apps = await db.find('job_applications', { workerId: req.user!.userId }, { sort: { createdAt: -1 } });
      return res.json({ applications: apps });
    }
    // Employer Smart Shortlisting: rank candidates by AI match + reputation
    const myJobs = await db.find('jobs', { employerId: req.user!.userId });
    const myJobIds = myJobs.map((j) => j._id);
    const apps = await db.find('job_applications', { employerId: req.user!.userId });
    // Also include seeded apps on employer's jobs
    const jobApps =
      apps.length > 0
        ? apps
        : (await db.find('job_applications')).filter((a) => myJobIds.includes(a.jobId));

    const enriched = await Promise.all(
      jobApps.map(async (a) => {
        const rep = await db.findOne('reputation_scores', { workerId: a.workerId });
        const skills = await db.find('worker_skills', { workerId: a.workerId });
        const job = myJobs.find((j) => j._id === a.jobId);
        const smartRankScore = Number(
          ((Number(a.aiMatchScore || 80) * 0.65) + (Number(rep?.overallScore || 75) * 0.35)).toFixed(1)
        );
        return {
          ...a,
          jobTitle: a.jobTitle || job?.title || 'Job Posting',
          reputationScore: rep?.overallScore || 72,
          verifiedSkillsCount: skills.filter((s) => s.verificationType !== 'self_declared').length,
          smartRankScore,
        };
      })
    );
    enriched.sort((a, b) => b.smartRankScore - a.smartRankScore);
    res.json({ applications: enriched });
  });

  app.put('/api/applications/:id/status', authenticate, requireRole('employer'), async (req: AuthedRequest, res) => {
    const { status } = req.body; // 'shortlisted' | 'accepted' | 'rejected'
    const appDoc = await db.findOne('job_applications', { _id: req.params.id });
    if (!appDoc) return res.status(404).json({ error: 'Application not found' });

    const updated = await db.updateOne('job_applications', { _id: appDoc._id }, { status });
    const job = await db.findOne('jobs', { _id: appDoc.jobId });
    const now = new Date().toISOString();

    let createdProject = null;
    if (status === 'accepted' && job) {
      const priorProjects = await db.find('work_projects', {
        employerId: req.user!.userId,
        workerId: appDoc.workerId,
        stage: 'Completed',
      });
      createdProject = await db.insertOne('work_projects', {
        jobId: job._id,
        employerId: req.user!.userId,
        employerName: job.employerName || req.user!.name,
        workerId: appDoc.workerId,
        workerName: appDoc.workerName,
        title: job.title,
        category: job.category,
        agreedDailyWage: appDoc.proposedDailyWage || job.dailyWageBudget,
        durationDays: job.durationDays || 3,
        stage: 'Accepted',
        city: job.city || 'Latur',
        isRepeatHire: priorProjects.length > 0,
        completionConfirmedAt: null,
        completionCertificateCode: null,
        createdAt: now,
      });

      await db.insertOne('work_agreements', {
        projectId: createdProject._id,
        employerId: req.user!.userId,
        employerName: job.employerName || req.user!.name,
        workerId: appDoc.workerId,
        workerName: appDoc.workerName,
        workDescription: job.description,
        dailyWage: createdProject.agreedDailyWage,
        durationDays: createdProject.durationDays,
        responsibilities: job.responsibilities?.length
          ? job.responsibilities
          : ['Complete trade scope safely according to specifications'],
        terms: [
          `Daily wage fixed at ₹${createdProject.agreedDailyWage}/day for ${createdProject.durationDays} days`,
          'Completion certificate issued digitally upon employer confirmation',
        ],
        employerAccepted: true,
        workerAccepted: true,
        agreementCode: `AGR-KS-${Math.floor(10000 + Math.random() * 89999)}`,
        createdAt: now,
      });
    }

    const notif = await db.insertOne('notifications', {
      userId: appDoc.workerId,
      type: 'application_status',
      title: `Application ${status.toUpperCase()}: ${job?.title || appDoc.jobTitle}`,
      body:
        status === 'accepted'
          ? 'Congratulations! A Work Project & Digital Agreement have been created in your dashboard.'
          : `Your application status was updated to ${status}.`,
      read: false,
      createdAt: now,
    });
    pushRealtimeEvent(appDoc.workerId, 'notification:new', notif);

    res.json({ application: updated, project: createdProject });
  });

  // =========================================================
  // PROJECTS, WORK AGREEMENTS & REVIEWS
  // =========================================================
  app.get('/api/projects', authenticate, async (req: AuthedRequest, res) => {
    const filter =
      req.user!.role === 'admin'
        ? {}
        : req.user!.role === 'employer'
        ? { employerId: req.user!.userId }
        : { workerId: req.user!.userId };
    const projects = await db.find('work_projects', filter, { sort: { createdAt: -1 } });
    const agreements = await db.find('work_agreements');
    const reviews = await db.find('reviews');

    const enriched = projects.map((p) => ({
      ...p,
      agreement: agreements.find((a) => a.projectId === p._id) || null,
      review: reviews.find((r) => r.projectId === p._id) || null,
    }));
    res.json({ projects: enriched });
  });

  app.put('/api/projects/:id/status', authenticate, async (req: AuthedRequest, res) => {
    const { stage, note } = req.body;
    const allowedStages = ['Requested', 'Accepted', 'In Progress', 'Submitted for Review', 'Completed'];
    if (!allowedStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid project stage.' });
    }
    const project = await db.findOne('work_projects', { _id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (stage === 'Completed' && req.user!.role !== 'employer' && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the Employer can confirm final project completion.' });
    }

    const now = new Date().toISOString();
    const patch: Record<string, any> = { stage, updatedAt: now };

    if (stage === 'Completed' && project.stage !== 'Completed') {
      patch.completionConfirmedAt = now;
      patch.completionCertificateCode = `CERT-KS-2026-${Math.floor(1000 + Math.random() * 8999)}`;

      // Update worker completedJobsCount & repeatHiresCount
      const wp = await db.findOne('worker_profiles', { userId: project.workerId });
      if (wp) {
        await db.updateOne(
          'worker_profiles',
          { _id: wp._id },
          {
            completedJobsCount: Number(wp.completedJobsCount || 0) + 1,
            repeatHiresCount: Number(wp.repeatHiresCount || 0) + (project.isRepeatHire ? 1 : 0),
          }
        );
      }
      await recalculateWorkerReputation(project.workerId, `Completed project: ${project.title}`);
    }

    const updated = await db.updateOne('work_projects', { _id: project._id }, patch);
    await db.insertOne('project_updates', {
      projectId: project._id,
      actorId: req.user!.userId,
      stage,
      note: note || `Stage transitioned to ${stage}`,
      createdAt: now,
    });

    const targetNotifyId = req.user!.userId === project.employerId ? project.workerId : project.employerId;
    const notif = await db.insertOne('notifications', {
      userId: targetNotifyId,
      type: 'project_stage',
      title: `Project Stage: ${stage}`,
      body: `"${project.title}" moved to ${stage}.`,
      read: false,
      createdAt: now,
    });
    pushRealtimeEvent(targetNotifyId, 'notification:new', notif);

    res.json({ project: updated });
  });

  app.post('/api/reviews', authenticate, requireRole('employer'), async (req: AuthedRequest, res) => {
    try {
      const { projectId, quality, punctuality, reliability, satisfaction, wouldRehire, comment } = req.body;
      const project = await db.findOne('work_projects', { _id: projectId });
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (project.employerId !== req.user!.userId) {
        return res.status(403).json({ error: 'You can only review workers on your own verified projects.' });
      }
      if (project.stage !== 'Completed') {
        return res.status(400).json({ error: 'Confirm project completion before submitting a review.' });
      }

      const clamp = (v: any) => Math.max(1, Math.min(5, Number(v || 5)));
      const now = new Date().toISOString();
      const review = await db.insertOne('reviews', {
        projectId,
        workerId: project.workerId,
        reviewerId: req.user!.userId,
        reviewerName: project.employerName || req.user!.name,
        quality: clamp(quality),
        punctuality: clamp(punctuality),
        reliability: clamp(reliability),
        satisfaction: clamp(satisfaction),
        wouldRehire: Boolean(wouldRehire),
        comment: String(comment || '').trim(),
        createdAt: now,
      });

      const rep = await recalculateWorkerReputation(
        project.workerId,
        `Received verified review on "${project.title}" (${clamp(quality)}/5)`
      );

      const notif = await db.insertOne('notifications', {
        userId: project.workerId,
        type: 'review',
        title: `New Verified Employer Review (${clamp(quality)}/5)`,
        body: `Your Dynamic Reputation Score is now ${rep.overallScore}/100.`,
        read: false,
        createdAt: now,
      });
      pushRealtimeEvent(project.workerId, 'notification:new', notif);

      res.status(201).json({ review, reputation: rep });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/reviews/:workerId', async (req, res) => {
    const reviews = await db.find('reviews', { workerId: req.params.workerId }, { sort: { createdAt: -1 } });
    res.json({ reviews });
  });

  // =========================================================
  // AI INTELLIGENCE ENDPOINTS (/api/ai/*)
  // =========================================================
  app.post('/api/ai/match-workers', authenticate, async (req: AuthedRequest, res) => {
    try {
      const { jobId, customJob, fairOpportunity = true } = req.body;
      const job = jobId ? await db.findOne('jobs', { _id: jobId }) : customJob;
      if (!job) return res.status(404).json({ error: 'Job specification required for matching.' });

      const workerUsers = await db.find('users', { role: 'worker', status: 'active' });
      const bundles = await enrichWorkerBundlesBulk(workerUsers, false);

      const workersPayload = bundles.map((b) => ({
        _id: b._id,
        category: b.profile?.category,
        bio: b.profile?.bio,
        experienceYears: b.profile?.experienceYears,
        expectedDailyWage: b.profile?.expectedDailyWage,
        maxTravelKm: b.profile?.maxTravelKm,
        availabilityStatus: b.profile?.availabilityStatus,
        completedJobsCount: b.profile?.completedJobsCount,
        location: b.profile?.location,
        skills: b.skills,
      }));

      const pyRes = await runPythonEngine('match_batch_workers', {
        job,
        workers: workersPayload,
        fairOpportunity: Boolean(fairOpportunity),
      });

      const bundleMap = new Map(bundles.map((b) => [b._id, b]));
      const allRanked = pyRes.matches || [];
      const matches = allRanked.slice(0, 30).map((m: any) => ({
        ...m,
        worker: bundleMap.get(m.workerId),
      }));

      await db.insertOne('ai_recommendations', {
        userId: req.user!.userId,
        recommendationType: 'worker_job_matching',
        inputSummary: job.title,
        outputSummary: `Evaluated ${bundles.length} workers · Top Match: ${matches[0]?.overallScore || 0}%`,
        score: matches[0]?.overallScore || 0,
        createdAt: new Date().toISOString(),
      });

      res.json({ matches, totalEvaluated: bundles.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ai/match-jobs', authenticate, async (req: AuthedRequest, res) => {
    try {
      const userDoc = await db.findOne('users', { _id: req.user!.userId });
      const bundle = await enrichWorkerBundle(userDoc, true);
      const openJobs = await db.find('jobs', { status: 'open' });
      const pyRes = await runPythonEngine('match_batch_jobs', {
        worker: {
          _id: bundle._id,
          category: bundle.profile?.category,
          bio: bundle.profile?.bio,
          experienceYears: bundle.profile?.experienceYears,
          expectedDailyWage: bundle.profile?.expectedDailyWage,
          maxTravelKm: bundle.profile?.maxTravelKm,
          availabilityStatus: bundle.profile?.availabilityStatus,
          completedJobsCount: bundle.profile?.completedJobsCount,
          location: bundle.profile?.location,
          skills: bundle.skills,
        },
        jobs: openJobs,
        fairOpportunity: Boolean(req.body.fairOpportunity ?? true),
      });
      const jobMap = new Map(openJobs.map((j) => [j._id, j]));
      res.json({
        matches: (pyRes.matches || []).map((m: any) => ({ ...m, job: jobMap.get(m.jobId) })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ai/generate-profile', authenticate, async (req: AuthedRequest, res) => {
    const { rawText, language } = req.body;
    if (!rawText || String(rawText).trim().length < 8) {
      return res.status(400).json({ error: 'Please describe your work experience in at least one sentence.' });
    }
    const generated = await generateProfessionalProfile(String(rawText), language || 'en');
    res.json({ profile: generated });
  });

  app.post('/api/ai/generate-job-description', authenticate, async (req: AuthedRequest, res) => {
    const { promptText } = req.body;
    if (!promptText || String(promptText).trim().length < 6) {
      return res.status(400).json({ error: 'Please enter a brief requirement (e.g., trade and city).' });
    }
    const jobSpec = await generateJobDescriptionAI(String(promptText));
    res.json({ jobSpec });
  });

  app.post('/api/ai/skill-gap-analysis', authenticate, async (req: AuthedRequest, res) => {
    const workerId = req.body.workerId || req.user!.userId;
    const workerSkills = await db.find('worker_skills', { workerId });
    const targetRole = req.body.targetRole || 'Industrial Electrician';
    const analysis = await runPythonEngine('skill_gap', { workerSkills, targetRole });
    res.json({ analysis });
  });

  app.post('/api/ai/wage-recommendation', async (req, res) => {
    const recommendation = await runPythonEngine('wage', req.body || {});
    if (req.body?.saveHistory === true) {
      await db.insertOne('wage_recommendations', {
        category: recommendation.category,
        city: recommendation.city,
        skillLevel: recommendation.skillLevel,
        recommendedDailyMin: recommendation.recommendedDailyMin,
        recommendedDailyMax: recommendation.recommendedDailyMax,
        createdAt: new Date().toISOString(),
      });
    }
    res.json({ recommendation });
  });

  app.post('/api/ai/career-recommendation', authenticate, async (req: AuthedRequest, res) => {
    const profile = await db.findOne('worker_profiles', { userId: req.user!.userId });
    const skills = await db.find('worker_skills', { workerId: req.user!.userId });
    const career = await runPythonEngine('career', {
      category: req.body.category || profile?.category || 'Electrical',
      experienceYears: profile?.experienceYears || 1,
      completedJobsCount: profile?.completedJobsCount || 0,
      assessedSkillsCount: skills.filter((s) => s.verificationType !== 'self_declared').length,
    });
    res.json({ career });
  });

  app.post('/api/ai/fraud-analysis', authenticate, requireRole('admin'), async (_req, res) => {
    const jobs = await db.find('jobs');
    const reviews = await db.find('reviews');
    const users = await db.find('users');
    const result = await runPythonEngine('fraud', { jobs, reviews, users });
    res.json(result);
  });

  app.post('/api/ai/assistant', authenticate, async (req: AuthedRequest, res) => {
    const { message, language } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    let contextSummary = `Role: ${req.user!.role}`;
    if (req.user!.role === 'worker') {
      const wp = await db.findOne('worker_profiles', { userId: req.user!.userId });
      const rep = await db.findOne('reputation_scores', { workerId: req.user!.userId });
      const skills = await db.find('worker_skills', { workerId: req.user!.userId });
      contextSummary = `Trade: ${wp?.category}, City: ${wp?.city}, Daily Wage: ₹${wp?.expectedDailyWage}, Reputation: ${rep?.overallScore}/100, Recorded Skills: ${skills.map((s) => `${s.name} (${s.verificationType})`).join(', ')}`;
    } else if (req.user!.role === 'employer') {
      const myJobs = await db.find('jobs', { employerId: req.user!.userId });
      contextSummary = `Posted ${myJobs.length} job(s), Open jobs: ${myJobs.filter((j) => j.status === 'open').length}`;
    }

    const response = await runPlatformAssistant({
      message: String(message),
      role: req.user!.role,
      userName: req.user!.name,
      language: language || 'en',
      contextSummary,
    });
    res.json(response);
  });

  // =========================================================
  // LEARNING RESOURCES (4-MODULE COURSES FOR EVERY SKILL), PROGRESS & REAL-TIME MESSAGES
  // =========================================================
  app.get('/api/learning-resources', async (req: AuthedRequest, res) => {
    try {
      const { category, language, search, skill, onlyMySkills } = req.query as Record<string, string>;

      // Optional auth lookup so logged-in users get saved module completion progress
      let viewerId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as AuthPayload;
          viewerId = decoded.userId;
        } catch {
          // public viewer
        }
      }

      const allItems = await db.find('learning_resources');

      // Category counts across all skills
      const catCounter = new Map<string, number>();
      for (const item of allItems) {
        const cat = item.category || 'General Skilled Trade';
        catCounter.set(cat, (catCounter.get(cat) || 0) + 1);
      }
      const categoryCounts = Array.from(catCounter.entries())
        .map(([cat, count]) => ({ category: cat, count }))
        .sort((a, b) => a.category.localeCompare(b.category));

      let progressMap: Record<string, number[]> = {};
      let workerSkillNames: string[] = [];
      if (viewerId) {
        const progDocs = await db.find('ai_recommendations', {
          userId: viewerId,
          type: 'learning_progress',
        });
        for (const p of progDocs) {
          if (p.resourceId && Array.isArray(p.completedModules)) {
            progressMap[p.resourceId] = p.completedModules;
          }
        }
        const mySkills = await db.find('worker_skills', { workerId: viewerId });
        workerSkillNames = mySkills.map((s) => String(s.name || '').trim()).filter(Boolean);
      }

      let items = [...allItems];

      if (category && category !== 'All') {
        const catLow = category.trim().toLowerCase();
        items = items.filter((i) => String(i.category || '').toLowerCase() === catLow || String(i.category || '').toLowerCase().includes(catLow));
      }

      if (language && language !== 'All') {
        items = items.filter(
          (i) =>
            i.language === 'Multilingual' ||
            i.language === language ||
            (Array.isArray(i.languagesAvailable) && i.languagesAvailable.includes(language))
        );
      }

      if (onlyMySkills === 'true' && workerSkillNames.length > 0) {
        const lowerSet = new Set(workerSkillNames.map((n) => n.toLowerCase()));
        items = items.filter((i) => lowerSet.has(String(i.targetSkill || '').toLowerCase()));
      }

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        items = items.filter((i) => {
          const modText = Array.isArray(i.modules)
            ? i.modules.map((m: any) => `${m.title} ${(m.topics || []).join(' ')}`).join(' ')
            : '';
          const locText = i.localizedSummary ? `${i.localizedSummary.en} ${i.localizedSummary.mr} ${i.localizedSummary.hi}` : '';
          const hay = `${i.targetSkill} ${i.title} ${i.category} ${i.summary} ${i.provider} ${modText} ${locText}`.toLowerCase();
          return hay.includes(q);
        });
      }

      if (skill && skill.trim()) {
        const skLow = skill.trim().toLowerCase();
        // Ensure if a worker deep-links to a brand-new skill from Skill Gap Analyzer, its 4-module course exists!
        const hasExact = allItems.some((i) => String(i.targetSkill || '').trim().toLowerCase() === skLow);
        if (!hasExact) {
          const created = await ensureSingleSkillCourse(skill.trim(), category && category !== 'All' ? category : 'General Skilled Trade');
          if (created) items.unshift(created);
        }
        items.sort((a, b) => {
          const aExact = String(a.targetSkill || '').toLowerCase() === skLow ? 2 : String(a.targetSkill || '').toLowerCase().includes(skLow) ? 1 : 0;
          const bExact = String(b.targetSkill || '').toLowerCase() === skLow ? 2 : String(b.targetSkill || '').toLowerCase().includes(skLow) ? 1 : 0;
          if (bExact !== aExact) return bExact - aExact;
          return String(a.targetSkill || '').localeCompare(String(b.targetSkill || ''));
        });
      } else {
        items.sort((a, b) => {
          const catCmp = String(a.category || '').localeCompare(String(b.category || ''));
          if (catCmp !== 0) return catCmp;
          return String(a.targetSkill || '').localeCompare(String(b.targetSkill || ''));
        });
      }

      const totalSkillsCovered = allItems.length;
      const totalModulesCount = allItems.reduce((sum, i) => sum + (Array.isArray(i.modules) ? i.modules.length : 4), 0);

      res.json({
        resources: items,
        totalSkillsCovered,
        totalModulesCount,
        categoryCounts,
        progressMap,
        workerSkillNames,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load skill learning modules' });
    }
  });

  app.post('/api/learning-resources/custom-skill', async (req, res) => {
    try {
      const { skillName, category } = req.body || {};
      if (!skillName || String(skillName).trim().length < 2) {
        return res.status(400).json({ error: 'Please enter a valid skill name.' });
      }
      const course = await ensureSingleSkillCourse(
        String(skillName).trim(),
        String(category || 'General Skilled Trade').trim()
      );
      res.status(201).json({ course });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not create skill modules' });
    }
  });

  app.post('/api/learning-resources/:id/progress', authenticate, async (req: AuthedRequest, res) => {
    try {
      const course = await db.findOne('learning_resources', { _id: req.params.id });
      if (!course) return res.status(404).json({ error: 'Skill learning course not found' });

      const moduleNumber = Number(req.body.moduleNumber);
      const completed = req.body.completed !== false;
      if (!moduleNumber || moduleNumber < 1 || moduleNumber > 10) {
        return res.status(400).json({ error: 'Valid moduleNumber is required' });
      }

      const existing = await db.findOne('ai_recommendations', {
        userId: req.user!.userId,
        type: 'learning_progress',
        resourceId: course._id,
      });

      const prevSet = new Set<number>(existing?.completedModules || []);
      if (completed) prevSet.add(moduleNumber);
      else prevSet.delete(moduleNumber);

      const completedModules = Array.from(prevSet).sort((a, b) => a - b);
      const totalMods = Array.isArray(course.modules) ? course.modules.length : 4;
      const courseFinished = completedModules.length >= totalMods;
      const now = new Date().toISOString();

      if (existing) {
        await db.updateOne(
          'ai_recommendations',
          { _id: existing._id },
          { completedModules, courseFinished, updatedAt: now }
        );
      } else {
        await db.insertOne('ai_recommendations', {
          userId: req.user!.userId,
          type: 'learning_progress',
          resourceId: course._id,
          targetSkill: course.targetSkill,
          category: course.category,
          completedModules,
          courseFinished,
          createdAt: now,
          updatedAt: now,
        });
      }

      let skillSynced = false;
      if (courseFinished && req.user!.role === 'worker' && course.targetSkill) {
        const existingWS = await db.findOne('worker_skills', {
          workerId: req.user!.userId,
          name: course.targetSkill,
        });
        if (existingWS) {
          await db.updateOne('worker_skills', { _id: existingWS._id }, { learningCompleted: true, updatedAt: now });
        } else {
          await db.insertOne('worker_skills', {
            workerId: req.user!.userId,
            name: course.targetSkill,
            category: course.category || 'General Skilled Trade',
            proficiency: 'Intermediate',
            verificationType: 'self_declared',
            learningCompleted: true,
            updatedAt: now,
          });
        }
        skillSynced = true;

        const notif = await db.insertOne('notifications', {
          userId: req.user!.userId,
          type: 'learning_completed',
          title: `Completed All 4 Modules: ${course.targetSkill}`,
          body: `Your training in ${course.targetSkill} is recorded on your profile. Take a Scenario Skill Assessment next to earn an Assessed badge!`,
          read: false,
          createdAt: now,
        });
        pushRealtimeEvent(req.user!.userId, 'notification:new', notif);
      }

      res.json({
        resourceId: course._id,
        completedModules,
        courseFinished,
        skillSynced,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not update module progress' });
    }
  });

  app.get('/api/messages', authenticate, async (req: AuthedRequest, res) => {
    const uid = req.user!.userId;
    const all = await db.find('messages', {}, { sort: { createdAt: 1 } });
    const mine = all.filter((m) => m.senderId === uid || m.receiverId === uid);
    res.json({ messages: mine });
  });

  app.post('/api/messages', authenticate, async (req: AuthedRequest, res) => {
    const { receiverId, receiverName, content } = req.body;
    if (!receiverId || !content || !String(content).trim()) {
      return res.status(400).json({ error: 'Recipient and message text are required.' });
    }
    const targetUser = await db.findOne('users', { _id: receiverId });
    const msg = await db.insertOne('messages', {
      senderId: req.user!.userId,
      senderName: req.user!.name,
      receiverId,
      receiverName: receiverName || targetUser?.name || 'User',
      content: String(content).trim(),
      read: false,
      createdAt: new Date().toISOString(),
    });
    pushRealtimeEvent(receiverId, 'message:new', msg);
    pushRealtimeEvent(req.user!.userId, 'message:new', msg);
    res.status(201).json({ message: msg });
  });

  app.get('/api/notifications', authenticate, async (req: AuthedRequest, res) => {
    const list = await db.find('notifications', { userId: req.user!.userId }, { sort: { createdAt: -1 }, limit: 30 });
    res.json({ notifications: list });
  });

  app.put('/api/notifications/:id/read', authenticate, async (req: AuthedRequest, res) => {
    const updated = await db.updateOne('notifications', { _id: req.params.id, userId: req.user!.userId }, { read: true });
    res.json({ notification: updated });
  });

  app.post('/api/reports', authenticate, async (req: AuthedRequest, res) => {
    const { targetType, targetId, category, description } = req.body;
    if (!description) return res.status(400).json({ error: 'Please describe the safety or trust concern.' });
    const report = await db.insertOne('reports', {
      reporterId: req.user!.userId,
      reporterName: req.user!.name,
      targetType: targetType || 'worksite_safety',
      targetId: targetId || 'general',
      category: category || 'Safety Concern',
      description: String(description).trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ report });
  });

  app.get('/api/disputes', authenticate, async (req: AuthedRequest, res) => {
    const all = await db.find('disputes', {}, { sort: { createdAt: -1 } });
    const list =
      req.user!.role === 'admin'
        ? all
        : all.filter((d) => d.raisedById === req.user!.userId || d.againstId === req.user!.userId);
    res.json({ disputes: list });
  });

  app.post('/api/disputes', authenticate, async (req: AuthedRequest, res) => {
    const { projectId, reason, evidenceNotes } = req.body;
    if (!projectId || !reason) return res.status(400).json({ error: 'Project and dispute reason are required.' });
    const project = await db.findOne('work_projects', { _id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const againstId = req.user!.userId === project.employerId ? project.workerId : project.employerId;
    const againstName = req.user!.userId === project.employerId ? project.workerName : project.employerName;

    const dispute = await db.insertOne('disputes', {
      projectId,
      projectTitle: project.title,
      raisedById: req.user!.userId,
      raisedByName: req.user!.name,
      againstId,
      againstName,
      reason: String(reason).trim(),
      evidenceNotes: String(evidenceNotes || '').trim(),
      status: 'open', // Note: Unverified open disputes NEVER reduce worker reputation!
      resolutionSummary: '',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ dispute });
  });

  // =========================================================
  // ADMIN GOVERNANCE ROUTES (/api/admin/*)
  // =========================================================
  app.get('/api/admin/dashboard', authenticate, requireRole('admin'), async (_req, res) => {
    const users = await db.find('users');
    const jobs = await db.find('jobs');
    const certs = await db.find('certificates');
    const reports = await db.find('reports');
    const fraudAlerts = await db.find('fraud_alerts', {}, { sort: { createdAt: -1 } });
    const disputes = await db.find('disputes', {}, { sort: { createdAt: -1 } });
    const aiLogs = await db.find('ai_recommendations', {}, { sort: { createdAt: -1 }, limit: 15 });
    const auditLogs = await db.find('audit_logs', {}, { sort: { createdAt: -1 }, limit: 20 });

    res.json({
      metrics: {
        totalUsers: users.length,
        totalWorkers: users.filter((u) => u.role === 'worker').length,
        totalEmployers: users.filter((u) => u.role === 'employer').length,
        activeJobs: jobs.filter((j) => j.status === 'open').length,
        pendingVerifications: certs.filter((c) => c.status === 'pending').length,
        openReports: reports.filter((r) => r.status === 'pending').length,
        openFraudAlerts: fraudAlerts.filter((f) => f.status === 'open').length,
        openDisputes: disputes.filter((d) => d.status === 'open' || d.status === 'investigating').length,
      },
      fraudAlerts,
      disputes,
      aiLogs,
      auditLogs,
    });
  });

  app.get('/api/admin/users', authenticate, requireRole('admin'), async (_req, res) => {
    const users = await db.find('users', {}, { sort: { createdAt: -1 } });
    res.json({
      users: users.map(({ passwordHash, ...safe }) => safe),
    });
  });

  app.put('/api/admin/users/:id/status', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const { status, justification } = req.body; // 'active' | 'suspended'
    if (!justification || String(justification).trim().length < 5) {
      return res.status(400).json({ error: 'A clear written justification is required to change user account status.' });
    }
    const updated = await db.updateOne(
      'users',
      { _id: req.params.id },
      { status, suspensionReason: status === 'suspended' ? justification : '' }
    );
    await db.insertOne('audit_logs', {
      actorId: req.user!.userId,
      actorRole: 'admin',
      action: `USER_STATUS_${String(status).toUpperCase()}`,
      targetCollection: 'users',
      targetId: req.params.id,
      justification,
      createdAt: new Date().toISOString(),
    });
    res.json({ user: updated });
  });

  app.get('/api/admin/verifications', authenticate, requireRole('admin'), async (_req, res) => {
    const certs = await db.find('certificates', {}, { sort: { createdAt: -1 } });
    res.json({ verifications: certs });
  });

  app.put('/api/admin/verifications/:id', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const { status, adminNotes } = req.body; // 'approved' | 'rejected'
    const cert = await db.findOne('certificates', { _id: req.params.id });
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    const updated = await db.updateOne('certificates', { _id: cert._id }, {
      status,
      adminNotes: adminNotes || `Reviewed by Admin (${status})`,
      reviewedBy: req.user!.userId,
      reviewedAt: new Date().toISOString(),
    });

    if (status === 'approved') {
      await db.updateOne('worker_profiles', { userId: cert.workerId }, { adminIdentityVerified: true });
      const workerSkills = await db.find('worker_skills', { workerId: cert.workerId });
      if (workerSkills.length > 0) {
        await db.updateOne(
          'worker_skills',
          { _id: workerSkills[0]._id },
          { verificationType: 'admin_verified' }
        );
      }
      await recalculateWorkerReputation(cert.workerId, `Admin approved credential: ${cert.title}`);
    }

    await db.insertOne('audit_logs', {
      actorId: req.user!.userId,
      actorRole: 'admin',
      action: `CERTIFICATE_${String(status).toUpperCase()}`,
      targetCollection: 'certificates',
      targetId: cert._id,
      justification: adminNotes || status,
      createdAt: new Date().toISOString(),
    });

    res.json({ verification: updated });
  });

  app.get('/api/admin/reports', authenticate, requireRole('admin'), async (_req, res) => {
    const reports = await db.find('reports', {}, { sort: { createdAt: -1 } });
    res.json({ reports });
  });

  app.put('/api/admin/fraud-alerts/:id', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const { status, adminNotes } = req.body;
    const updated = await db.updateOne('fraud_alerts', { _id: req.params.id }, { status, adminNotes: adminNotes || '' });
    res.json({ alert: updated });
  });

  app.put('/api/admin/disputes/:id', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const { status, resolutionSummary } = req.body; // 'investigating' | 'resolved_no_fault' | 'established_finding'
    const dispute = await db.findOne('disputes', { _id: req.params.id });
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    const updated = await db.updateOne('disputes', { _id: dispute._id }, {
      status,
      resolutionSummary: resolutionSummary || '',
      resolvedAt: new Date().toISOString(),
    });

    if (status === 'established_finding') {
      await recalculateWorkerReputation(dispute.againstId, `Admin established dispute finding on ${dispute.projectTitle}`);
    }

    await db.insertOne('audit_logs', {
      actorId: req.user!.userId,
      actorRole: 'admin',
      action: `DISPUTE_${String(status).toUpperCase()}`,
      targetCollection: 'disputes',
      targetId: dispute._id,
      justification: resolutionSummary || status,
      createdAt: new Date().toISOString(),
    });

    res.json({ dispute: updated });
  });

  // =========================================================
  // VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
  // =========================================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !hmrDisabled,
        ws: hmrDisabled ? false : { server },
        watch: hmrDisabled ? null : { ignored: ['**/data/**', '**/*.tmp', '**/backend/**'] },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`KaushalSetu Full-Stack Server + WebSocket + Python AI Engine listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KaushalSetu server:', err);
  process.exit(1);
});
