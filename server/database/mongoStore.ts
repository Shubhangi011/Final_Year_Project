import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import type { Db } from 'mongodb';

export const ALL_COLLECTIONS = [
  'users',
  'worker_profiles',
  'employer_profiles',
  'skills',
  'worker_skills',
  'skill_assessments',
  'assessment_questions',
  'assessment_results',
  'certificates',
  'jobs',
  'job_applications',
  'hiring_requests',
  'work_projects',
  'project_updates',
  'reviews',
  'reputation_scores',
  'worker_availability',
  'messages',
  'notifications',
  'reports',
  'disputes',
  'work_agreements',
  'learning_resources',
  'ai_recommendations',
  'saved_workers',
  'saved_jobs',
  'fraud_alerts',
  'wage_recommendations',
  'skill_passports',
  'audit_logs',
] as const;

export type CollectionName = (typeof ALL_COLLECTIONS)[number];

export interface BaseDoc {
  _id: string;
  [key: string]: any;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'kaushalsetu_mongodb.json');

let mongoClient: MongoClient | null = null;
let nativeDb: Db | null = null;
let diskData: Record<CollectionName, BaseDoc[]> | null = null;
let activeBackendMode: 'mongodb_native' | 'mongodb_persistent_bson_store' = 'mongodb_persistent_bson_store';

export function newObjectId(): string {
  return new ObjectId().toHexString();
}

export function haversineDistanceKm(coords1: [number, number], coords2: [number, number]): number {
  const [lon1, lat1] = coords1.map((d) => (d * Math.PI) / 180);
  const [lon2, lat2] = coords2.map((d) => (d * Math.PI) / 180);
  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Number((6371 * 2 * Math.asin(Math.sqrt(a))).toFixed(2));
}

export function fuzzCoordinates(coords: [number, number]): [number, number] {
  // Deterministic ~700m offset so public maps protect exact residential addresses
  const lngOffset = (((Math.sin(coords[0] * 1000) + 1) / 2) * 0.008) - 0.004;
  const latOffset = (((Math.cos(coords[1] * 1000) + 1) / 2) * 0.008) - 0.004;
  return [Number((coords[0] + lngOffset).toFixed(5)), Number((coords[1] + latOffset).toFixed(5))];
}

function ensureDiskLoaded(): Record<CollectionName, BaseDoc[]> {
  if (diskData) return diskData;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const initial = {} as Record<CollectionName, BaseDoc[]>;
  for (const col of ALL_COLLECTIONS) {
    initial[col] = [];
  }
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      for (const col of ALL_COLLECTIONS) {
        if (Array.isArray(parsed[col])) {
          initial[col] = parsed[col];
        }
      }
    } catch (err) {
      console.error('Error loading persistent store, starting clean:', err);
    }
  }
  diskData = initial;
  return diskData;
}

function flushDisk(): void {
  if (!diskData) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(diskData, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

function matchesFilter(doc: BaseDoc, filter: Record<string, any>): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (val === undefined) continue;
    if (key === '$or' && Array.isArray(val)) {
      if (!val.some((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    const docVal = doc[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('$in' in val && Array.isArray(val.$in)) {
        if (!val.$in.includes(docVal)) return false;
        continue;
      }
      if ('$ne' in val) {
        if (docVal === val.$ne) return false;
        continue;
      }
      if ('$regex' in val) {
        const re = new RegExp(val.$regex, val.$options || 'i');
        if (!re.test(String(docVal ?? ''))) return false;
        continue;
      }
    }
    if (docVal !== val) return false;
  }
  return true;
}

export async function initDatabase(): Promise<{ mode: string }> {
  const configuredUri = (process.env.MONGODB_URI || '').trim();
  const isCloudPreview = process.env.DISABLE_HMR === 'true';
  // Default to local MongoDB Community Server (127.0.0.1:27017) on laptops even if .env is missing or empty
  const rawUri = configuredUri || (!isCloudPreview ? 'mongodb://127.0.0.1:27017' : '');
  // Normalize localhost -> 127.0.0.1 to prevent Windows Node.js IPv6 (::1) ECONNREFUSED errors
  const uri = rawUri.replace(/^mongodb:\/\/localhost(?=[:/?]|$)/i, 'mongodb://127.0.0.1');
  const dbName = (process.env.MONGODB_DB_NAME || 'kaushalsetu').trim();

  if (uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
    try {
      mongoClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: configuredUri ? 4000 : 2000,
      });
      await mongoClient.connect();
      await mongoClient.db('admin').command({ ping: 1 });
      nativeDb = mongoClient.db(dbName);

      try {
        await nativeDb.collection('users').createIndex({ email: 1 }, { unique: true });
        await nativeDb.collection('worker_profiles').createIndex({ location: '2dsphere' });
        await nativeDb.collection('jobs').createIndex({ location: '2dsphere' });
        await nativeDb.collection('job_applications').createIndex({ jobId: 1, workerId: 1 }, { unique: true });
        await nativeDb.collection('reviews').createIndex({ projectId: 1, reviewerId: 1 }, { unique: true });
        await nativeDb.collection('skill_passports').createIndex({ passportCode: 1 }, { unique: true });
      } catch (indexErr) {
        console.warn('[MongoDB] Non-fatal index warning:', indexErr);
      }

      activeBackendMode = 'mongodb_native';
      console.log(`[MongoDB] Connected successfully to database "${dbName}" — inspect in MongoDB Compass.`);
      return { mode: activeBackendMode };
    } catch (err) {
      console.warn(
        `[MongoDB] Could not connect to ${uri} — falling back to data/kaushalsetu_mongodb.json.`,
        configuredUri ? err : ''
      );
      nativeDb = null;
    }
  }

  ensureDiskLoaded();
  flushDisk();
  activeBackendMode = 'mongodb_persistent_bson_store';
  return { mode: activeBackendMode };
}

export function getDatabaseMode(): string {
  return activeBackendMode;
}

export const db = {
  async find<T extends BaseDoc = BaseDoc>(
    collection: CollectionName,
    filter: Record<string, any> = {},
    options?: { sort?: Record<string, 1 | -1>; skip?: number; limit?: number }
  ): Promise<T[]> {
    if (nativeDb) {
      let cursor = nativeDb.collection(collection).find(filter as any);
      if (options?.sort) cursor = cursor.sort(options.sort);
      if (options?.skip) cursor = cursor.skip(options.skip);
      if (options?.limit) cursor = cursor.limit(options.limit);
      const docs = await cursor.toArray();
      return docs.map((d) => ({ ...d, _id: String(d._id) })) as unknown as T[];
    }
    const store = ensureDiskLoaded()[collection];
    let results = store.filter((doc) => matchesFilter(doc, filter));
    if (options?.sort) {
      const entries = Object.entries(options.sort);
      results = [...results].sort((a, b) => {
        for (const [k, dir] of entries) {
          const av = a[k] ?? '';
          const bv = b[k] ?? '';
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
        }
        return 0;
      });
    }
    if (options?.skip) results = results.slice(options.skip);
    if (options?.limit) results = results.slice(0, options.limit);
    return results as T[];
  },

  async findOne<T extends BaseDoc = BaseDoc>(
    collection: CollectionName,
    filter: Record<string, any>
  ): Promise<T | null> {
    if (nativeDb) {
      const doc = await nativeDb.collection(collection).findOne(filter as any);
      return doc ? ({ ...doc, _id: String(doc._id) } as unknown as T) : null;
    }
    const store = ensureDiskLoaded()[collection];
    const found = store.find((doc) => matchesFilter(doc, filter));
    return (found as T) || null;
  },

  async insertOne<T extends BaseDoc = BaseDoc>(
    collection: CollectionName,
    doc: Omit<T, '_id'> & { _id?: string }
  ): Promise<T> {
    const _id = doc._id || newObjectId();
    const record = { ...doc, _id } as T;
    if (nativeDb) {
      await nativeDb.collection(collection).insertOne(record as any);
      return record;
    }
    const store = ensureDiskLoaded()[collection];
    // Enforce key unique constraints just like MongoDB indexes
    if (collection === 'users' && store.some((u) => u.email === record.email)) {
      throw new Error('DUPLICATE_EMAIL: An account with this email already exists.');
    }
    if (
      collection === 'job_applications' &&
      store.some((a) => a.jobId === record.jobId && a.workerId === record.workerId)
    ) {
      throw new Error('DUPLICATE_APPLICATION: You have already applied for this job.');
    }
    if (
      collection === 'reviews' &&
      store.some((r) => r.projectId === record.projectId && r.reviewerId === record.reviewerId)
    ) {
      throw new Error('DUPLICATE_REVIEW: A review has already been submitted for this project.');
    }
    store.push(record);
    flushDisk();
    return record;
  },

  async insertMany<T extends BaseDoc = BaseDoc>(
    collection: CollectionName,
    docs: Array<Omit<T, '_id'> & { _id?: string }>
  ): Promise<T[]> {
    if (!docs.length) return [];
    const records = docs.map((d) => ({ ...d, _id: d._id || newObjectId() })) as T[];
    if (nativeDb) {
      await nativeDb.collection(collection).insertMany(records as any[]);
      return records;
    }
    const store = ensureDiskLoaded()[collection];
    for (const r of records) {
      store.push(r);
    }
    flushDisk();
    return records;
  },

  async updateOne(
    collection: CollectionName,
    filter: Record<string, any>,
    update: Record<string, any>,
    upsert = false
  ): Promise<BaseDoc | null> {
    if (nativeDb) {
      const setPayload = '$set' in update ? update : { $set: update };
      await nativeDb.collection(collection).updateOne(filter as any, setPayload, { upsert });
      const updated = await nativeDb.collection(collection).findOne(filter as any);
      return updated ? ({ ...updated, _id: String(updated._id) } as BaseDoc) : null;
    }
    const store = ensureDiskLoaded()[collection];
    const idx = store.findIndex((doc) => matchesFilter(doc, filter));
    const patch = '$set' in update ? update.$set : update;
    if (idx === -1) {
      if (upsert) {
        const created = { ...filter, ...patch, _id: newObjectId() };
        store.push(created);
        flushDisk();
        return created;
      }
      return null;
    }
    store[idx] = { ...store[idx], ...patch, _id: store[idx]._id };
    flushDisk();
    return store[idx];
  },

  async deleteOne(collection: CollectionName, filter: Record<string, any>): Promise<boolean> {
    if (nativeDb) {
      const res = await nativeDb.collection(collection).deleteOne(filter as any);
      return res.deletedCount > 0;
    }
    const store = ensureDiskLoaded()[collection];
    const idx = store.findIndex((doc) => matchesFilter(doc, filter));
    if (idx === -1) return false;
    store.splice(idx, 1);
    flushDisk();
    return true;
  },

  async count(collection: CollectionName, filter: Record<string, any> = {}): Promise<number> {
    if (nativeDb) {
      return nativeDb.collection(collection).countDocuments(filter as any);
    }
    const store = ensureDiskLoaded()[collection];
    return store.filter((doc) => matchesFilter(doc, filter)).length;
  },
};
