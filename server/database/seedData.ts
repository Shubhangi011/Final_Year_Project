import bcrypt from 'bcryptjs';
import { db, fuzzCoordinates, newObjectId } from './mongoStore.ts';
import { ensureWorkforcePopulation } from './workerPopulationGenerator.ts';
import { ensureSkillLearningCatalog } from './skillCurriculumCatalog.ts';

async function upsertCoreUser(
  email: string,
  plainPasswordForDemoRepair: string,
  passwordHash: string,
  fields: Record<string, any>
) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing =
    (await db.findOne('users', { email: normalizedEmail })) ||
    (await db.findOne('users', { email: { $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }));

  if (!existing) {
    return db.insertOne('users', {
      ...fields,
      email: normalizedEmail,
      passwordHash,
    });
  }

  const updates: Record<string, any> = {
    email: normalizedEmail,
    role: fields.role,
    status: 'active',
  };
  let hashValid = false;
  if (typeof existing.passwordHash === 'string' && existing.passwordHash.startsWith('$2')) {
    try {
      hashValid = await bcrypt.compare(plainPasswordForDemoRepair, existing.passwordHash);
    } catch {
      hashValid = false;
    }
  }
  if (!hashValid) {
    updates.passwordHash = passwordHash;
  }
  const updated = await db.updateOne('users', { _id: existing._id }, updates);
  return updated || existing;
}

async function repairAnyLegacyMongoUsers(defaultDemoHash: string): Promise<void> {
  const allUsers = await db.find('users');
  for (const u of allUsers) {
    if (!u.passwordHash || typeof u.passwordHash !== 'string' || !u.passwordHash.startsWith('$2')) {
      const legacyHash = u.hashed_password || u.password_hash;
      let nextHash = defaultDemoHash;
      if (typeof legacyHash === 'string' && legacyHash.startsWith('$2')) {
        nextHash = legacyHash;
      } else if (typeof u.password === 'string' && u.password.length > 0) {
        nextHash = await bcrypt.hash(u.password, 10);
      } else if (u.role === 'admin') {
        nextHash = await bcrypt.hash('Admin@123', 10);
      }
      await db.updateOne('users', { _id: u._id }, {
        email: String(u.email || '').trim().toLowerCase(),
        passwordHash: nextHash,
        status: u.status || 'active',
      });
    }
  }
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  const now = new Date().toISOString();
  const demoPassHash = await bcrypt.hash('Demo@123', 10);
  const adminPassHash = await bcrypt.hash('Admin@123', 10);

  // Always guarantee Admin & Employers exist and have valid bcrypt hashes even if MongoDB already had users
  const adminUser = await upsertCoreUser('admin@kaushalsetu.in', 'Admin@123', adminPassHash, {
    name: 'Aarti Kulkarni (Platform Governance)',
    phone: '9822001100',
    role: 'admin',
    city: 'Pune',
    preferredLanguage: 'en',
    status: 'active',
    isDemo: true,
    createdAt: now,
  });

  const emp1 = await upsertCoreUser('vikram.deshmukh@demo.kaushalsetu.in', 'Demo@123', demoPassHash, {
    name: 'Vikram Deshmukh',
    phone: '9822114455',
    role: 'employer',
    city: 'Latur',
    preferredLanguage: 'en',
    status: 'active',
    isDemo: true,
    createdAt: now,
  });

  const emp2 = await upsertCoreUser('meenal.joshi@demo.kaushalsetu.in', 'Demo@123', demoPassHash, {
    name: 'Meenal Joshi',
    phone: '9823445566',
    role: 'employer',
    city: 'Pune',
    preferredLanguage: 'mr',
    status: 'active',
    isDemo: true,
    createdAt: now,
  });

  if (!(await db.findOne('employer_profiles', { userId: emp1._id }))) {
    await db.insertOne('employer_profiles', {
      userId: emp1._id,
      organizationName: 'Deshmukh Infra & Interiors',
      employerType: 'Contractor',
      city: 'Latur',
      description: 'Residential civil, electrical, and modular interior contracting firm across Marathwada.',
      location: { type: 'Point', coordinates: [76.5604, 18.4088] },
      verifiedBusiness: false,
      isDemo: true,
      createdAt: now,
    });
  }

  if (!(await db.findOne('employer_profiles', { userId: emp2._id }))) {
    await db.insertOne('employer_profiles', {
      userId: emp2._id,
      organizationName: 'Sahyadri Green Roofs Pvt Ltd',
      employerType: 'Company',
      city: 'Pune',
      description: 'Rooftop solar EPC installer serving residential housing societies across Pune and Satara.',
      location: { type: 'Point', coordinates: [73.8567, 18.5204] },
      verifiedBusiness: true,
      isDemo: true,
      createdAt: now,
    });
  }

  await repairAnyLegacyMongoUsers(demoPassHash);

  // Re-link any demo jobs created before employer accounts existed
  const validEmployerIds = new Set((await db.find('users', { role: 'employer' })).map((e) => e._id));
  const allJobs = await db.find('jobs');
  for (let idx = 0; idx < allJobs.length; idx++) {
    const jb = allJobs[idx];
    if (jb.isDemo && !validEmployerIds.has(jb.employerId)) {
      await db.updateOne('jobs', { _id: jb._id }, { employerId: idx % 2 === 0 ? emp1._id : emp2._id });
    }
  }

  // Check if core demo worker & project ecosystem already exists
  const sanjayExists = await db.findOne('users', { email: 'sanjay.kulkarni@demo.kaushalsetu.in' });
  const priyaExists = await db.findOne('users', { email: 'priya.jadhav@demo.kaushalsetu.in' });
  if (sanjayExists && priyaExists) {
    await upsertCoreUser('sanjay.kulkarni@demo.kaushalsetu.in', 'Demo@123', demoPassHash, sanjayExists);
    await upsertCoreUser('priya.jadhav@demo.kaushalsetu.in', 'Demo@123', demoPassHash, priyaExists);
    const sunita = await db.findOne('users', { email: 'sunita.shinde@demo.kaushalsetu.in' });
    if (sunita) {
      await upsertCoreUser('sunita.shinde@demo.kaushalsetu.in', 'Demo@123', demoPassHash, sunita);
    }
    await ensureWorkforcePopulation(500);
    await ensureSkillLearningCatalog();
    return;
  }

  // 1. Canonical Trade Skills (skills collection)
  const canonicalSkills = [
    { name: 'Concealed Conduit Wiring', category: 'Electrical', translations: { mr: 'छुपी वायरिंग', hi: 'कन्सील्ड वायरिंग' } },
    { name: 'MCB Distribution Panel', category: 'Electrical', translations: { mr: 'एमसीबी पॅनेल', hi: 'एमसीबी पैनल' } },
    { name: 'Three-Phase Wiring', category: 'Electrical', translations: { mr: 'थ्री-फेज वायरिंग', hi: 'थ्री-फेज वायरिंग' } },
    { name: 'Industrial Earthing & Safety', category: 'Electrical', translations: { mr: 'अर्थिंग आणि सुरक्षा', hi: 'अर्थिंग व सुरक्षा' } },
    { name: 'Rooftop Solar Array Mounting', category: 'Solar & Inverter', translations: { mr: 'सोलर पॅनेल बसवणे', hi: 'रूफटॉप सोलर माउंटिंग' } },
    { name: 'DC/AC Hybrid Inverter Wiring', category: 'Solar & Inverter', translations: { mr: 'इन्व्हर्टर वायरिंग', hi: 'हाइब्रिड इन्वर्टर वायरिंग' } },
    { name: 'Modular Kitchen Installation', category: 'Carpentry', translations: { mr: 'मॉड्युलर किचन काम', hi: 'मॉड्यूलर किचन फिटिंग' } },
    { name: 'Laminate & Veneer Pressing', category: 'Carpentry', translations: { mr: 'लॅमिनेट फिनिशिंग', hi: 'लैमिनेट फिनिशिंग' } },
    { name: 'CPVC & UPVC Pressure Piping', category: 'Plumbing', translations: { mr: 'सीपीव्हीसी पाईप फिटिंग', hi: 'सीपीवीसी पाइप फिटिंग' } },
    { name: 'Hydro-Testing & Leak Diagnostics', category: 'Plumbing', translations: { mr: 'गळती तपासणी', hi: 'लीकेज जांच' } },
    { name: 'MIG & TIG Precision Welding', category: 'Welding & Fabrication', translations: { mr: 'एमआयजी/टीआयजी वेल्डिंग', hi: 'एमआईजी/टीआईजी वेल्डिंग' } },
  ];
  for (const sk of canonicalSkills) {
    if (!(await db.findOne('skills', { name: sk.name }))) {
      await db.insertOne('skills', { ...sk, createdAt: now });
    }
  }

  // Workers
  const workersSeed = [
    {
      user: {
        name: 'Sanjay Kulkarni',
        email: 'sanjay.kulkarni@demo.kaushalsetu.in',
        phone: '9422610101',
        city: 'Latur',
        preferredLanguage: 'mr',
      },
      profile: {
        category: 'Electrical',
        avatarKey: 'electrician',
        headline: 'Residential & Three-Phase Electrician (ITI Trained)',
        bio: '6 years practical experience in concealed residential wiring, MCB distribution panels, earthing pits, and hybrid inverter backup lines across Latur and Ausa.',
        bioMarathi: 'लातूर परिसरात ६ वर्षांचा घरगुती व थ्री-फेज वायरिंग, एमसीबी पॅनेल आणि इन्व्हर्टर जोडणीचा प्रत्यक्ष अनुभव.',
        experienceYears: 6,
        expectedDailyWage: 850,
        maxTravelKm: 30,
        city: 'Latur',
        exactAddress: 'Plot 14, Barshi Road, Latur 413512 (Protected)',
        coords: [76.5642, 18.4055] as [number, number],
        availabilityStatus: 'available',
        completedJobsCount: 5,
        repeatHiresCount: 2,
        emergencyContact: { name: 'Sunita Kulkarni', relation: 'Spouse', phone: '9422610199' },
        portfolioItems: [
          { title: '3BHK Full Concealed Wiring & 8-Way MCB DB', location: 'Adarsh Colony, Latur', year: '2026' },
          { title: '5kVA Pure Sine-Wave Inverter Commissioning', location: 'MIDC Latur', year: '2025' },
        ],
      },
      skills: [
        { name: 'Concealed Conduit Wiring', category: 'Electrical', proficiency: 'Expert', verificationType: 'assessed', assessmentScore: 92 },
        { name: 'MCB Distribution Panel', category: 'Electrical', proficiency: 'Advanced', verificationType: 'assessed', assessmentScore: 88 },
        { name: 'Industrial Earthing & Safety', category: 'Electrical', proficiency: 'Intermediate', verificationType: 'self_declared' },
      ],
      reputation: {
        overallScore: 89.4,
        qualityScore: 91.2,
        reliabilityScore: 90.5,
        punctualityScore: 88.0,
        satisfactionScore: 90.0,
        skillProficiencyScore: 87.3,
        isFairStartBaseline: false,
        explanation: 'Calculated across 2 verified project reviews, 5 completed jobs, 2 repeat hires, and 2 AI-assessed skills (Demo Profile).',
        history: [
          { date: '2026-07-10', score: 72.0, event: 'Fair-Start Baseline Initialized' },
          { date: '2026-08-18', score: 81.5, event: 'Passed Electrical Wiring Assessment (92%)' },
          { date: '2026-09-22', score: 86.2, event: 'Completed Residential Rewiring Project (4.8/5)' },
          { date: '2026-10-19', score: 89.4, event: 'Repeat Hire Completed on Schedule (5.0/5)' },
        ],
      },
    },
    {
      user: {
        name: 'Priya Jadhav',
        email: 'priya.jadhav@demo.kaushalsetu.in',
        phone: '9422610202',
        city: 'Pune',
        preferredLanguage: 'mr',
      },
      profile: {
        category: 'Solar & Inverter',
        avatarKey: 'solar_tech',
        headline: 'Rooftop Solar PV & Inverter Technician (Suryamitra Trainee)',
        bio: '1.5 years hands-on experience mounting rooftop solar structures, MC4 DC string wiring, and hybrid inverter setup. Recently joined KaushalSetu to build verified digital track record.',
        bioMarathi: 'रूफटॉप सोलर पॅनेल बसवणे, डीसी/एसी इन्व्हर्टर वायरिंग आणि नेट मीटरिंग तपासणीचा १.५ वर्षांचा प्रत्यक्ष अनुभव.',
        experienceYears: 1.5,
        expectedDailyWage: 800,
        maxTravelKm: 25,
        city: 'Pune',
        exactAddress: 'Kothrud Depot Lane 4, Pune 411038 (Protected)',
        coords: [73.8077, 18.5074] as [number, number],
        availabilityStatus: 'available',
        completedJobsCount: 0,
        repeatHiresCount: 0,
        emergencyContact: { name: 'Mohan Jadhav', relation: 'Father', phone: '9422610288' },
        portfolioItems: [
          { title: '3kW Residential Rooftop Solar String Testing', location: 'Bavdhan, Pune', year: '2026' },
        ],
      },
      skills: [
        { name: 'Rooftop Solar Array Mounting', category: 'Solar & Inverter', proficiency: 'Advanced', verificationType: 'assessed', assessmentScore: 86 },
        { name: 'DC/AC Hybrid Inverter Wiring', category: 'Solar & Inverter', proficiency: 'Intermediate', verificationType: 'assessed', assessmentScore: 82 },
        { name: 'Multimeter & Clamp Testing', category: 'Solar & Inverter', proficiency: 'Intermediate', verificationType: 'self_declared' },
      ],
      reputation: {
        overallScore: 76.4,
        qualityScore: 75.0,
        reliabilityScore: 75.0,
        punctualityScore: 75.0,
        satisfactionScore: 75.0,
        skillProficiencyScore: 83.2,
        isFairStartBaseline: true,
        explanation: 'Fair-Start Baseline active: New worker initialized without cold-start penalty, boosted by 2 passed Skill Assessments (Demo Profile).',
        history: [
          { date: '2026-10-02', score: 72.0, event: 'Fair-Start Baseline Initialized' },
          { date: '2026-10-15', score: 76.4, event: 'Passed Solar PV Technical Assessment (86%)' },
        ],
      },
    },
    {
      user: {
        name: 'Ramesh Patil',
        email: 'ramesh.patil@demo.kaushalsetu.in',
        phone: '9422610303',
        city: 'Latur',
        preferredLanguage: 'hi',
      },
      profile: {
        category: 'Carpentry',
        avatarKey: 'carpenter',
        headline: 'Master Modular Furniture & Woodwork Craftsman',
        bio: '9 years specializing in modular kitchen carcasses, marine plywood wardrobes, soft-close Hettich hardware, and teak main doors in Latur and Solapur.',
        bioMarathi: 'लातूर आणि सोलापूर भागात ९ वर्षांपासून मॉड्युलर किचन, कपाटे आणि सागवानी दरवाजांचे कुशल सुतारकाम.',
        experienceYears: 9,
        expectedDailyWage: 950,
        maxTravelKm: 35,
        city: 'Latur',
        exactAddress: 'Gandhi Chowk, Latur 413512 (Protected)',
        coords: [76.5712, 18.4125] as [number, number],
        availabilityStatus: 'available',
        completedJobsCount: 8,
        repeatHiresCount: 3,
        emergencyContact: { name: 'Kavita Patil', relation: 'Spouse', phone: '9422610399' },
        portfolioItems: [
          { title: 'L-Shaped Acrylic Modular Kitchen Fit-Out', location: 'Ausa Road, Latur', year: '2026' },
          { title: 'Sliding Wardrobe & Study Unit', location: 'Shivaji Nagar, Latur', year: '2025' },
        ],
      },
      skills: [
        { name: 'Modular Kitchen Installation', category: 'Carpentry', proficiency: 'Expert', verificationType: 'assessed', assessmentScore: 95 },
        { name: 'Laminate & Veneer Pressing', category: 'Carpentry', proficiency: 'Expert', verificationType: 'assessed', assessmentScore: 91 },
        { name: 'Soft-Close Hardware Fitting', category: 'Carpentry', proficiency: 'Advanced', verificationType: 'self_declared' },
      ],
      reputation: {
        overallScore: 92.1,
        qualityScore: 94.0,
        reliabilityScore: 92.5,
        punctualityScore: 90.0,
        satisfactionScore: 93.0,
        skillProficiencyScore: 90.8,
        isFairStartBaseline: false,
        explanation: 'Calculated across verified project completions, 3 repeat hires, and 95% Carpentry Assessment score (Demo Profile).',
        history: [
          { date: '2026-06-12', score: 72.0, event: 'Fair-Start Baseline Initialized' },
          { date: '2026-07-28', score: 85.0, event: 'Passed Modular Carpentry Assessment (95%)' },
          { date: '2026-10-10', score: 92.1, event: '3rd Repeat Hire Completed with 5/5 Quality' },
        ],
      },
    },
    {
      user: {
        name: 'Rajesh Shinde',
        email: 'rajesh.shinde@demo.kaushalsetu.in',
        phone: '9422610404',
        city: 'Solapur',
        preferredLanguage: 'mr',
      },
      profile: {
        category: 'Plumbing',
        avatarKey: 'plumber',
        headline: 'CPVC Concealed Plumbing & Leak Diagnostics Specialist',
        bio: '5 years practical work in bathroom concealed diverters, pressure booster pumps, solar water heater piping, and non-destructive leak repair.',
        bioMarathi: 'बाथरूम कन्सील्ड प्लंबिंग, सीपीव्हीसी पाईपलाईन आणि पाण्याची गळती दुरुस्तीमध्ये ५ वर्षांचा अनुभव.',
        experienceYears: 5,
        expectedDailyWage: 780,
        maxTravelKm: 40,
        city: 'Solapur',
        exactAddress: 'Vijapur Road, Solapur 413004 (Protected)',
        coords: [75.9064, 17.6599] as [number, number],
        availabilityStatus: 'available',
        completedJobsCount: 3,
        repeatHiresCount: 1,
        emergencyContact: { name: 'ashok Shinde', relation: 'Brother', phone: '9422610488' },
        portfolioItems: [
          { title: '4-Bathroom Concealed CPVC & Diverter Setup', location: 'Jule Solapur', year: '2026' },
        ],
      },
      skills: [
        { name: 'CPVC & UPVC Pressure Piping', category: 'Plumbing', proficiency: 'Advanced', verificationType: 'assessed', assessmentScore: 84 },
        { name: 'Hydro-Testing & Leak Diagnostics', category: 'Plumbing', proficiency: 'Intermediate', verificationType: 'self_declared' },
      ],
      reputation: {
        overallScore: 83.6,
        qualityScore: 85.0,
        reliabilityScore: 84.0,
        punctualityScore: 82.5,
        satisfactionScore: 84.0,
        skillProficiencyScore: 82.0,
        isFairStartBaseline: false,
        explanation: 'Calculated across 3 completed jobs and passed Plumbing Pipe-Fitting Assessment (Demo Profile).',
        history: [
          { date: '2026-08-01', score: 72.0, event: 'Fair-Start Baseline Initialized' },
          { date: '2026-09-14', score: 83.6, event: 'Completed Concealed Bathroom Piping + Passed Assessment' },
        ],
      },
    },
  ];

  const createdWorkers: any[] = [];
  for (let i = 0; i < workersSeed.length; i++) {
    const item = workersSeed[i];
    const u = await upsertCoreUser(item.user.email, 'Demo@123', demoPassHash, {
      ...item.user,
      role: 'worker',
      status: 'active',
      isDemo: true,
      createdAt: now,
    });

    const pubCoords = fuzzCoordinates(item.profile.coords);
    let wp = await db.findOne('worker_profiles', { userId: u._id });
    if (!wp) {
      wp = await db.insertOne('worker_profiles', {
        userId: u._id,
        category: item.profile.category,
        avatarKey: item.profile.avatarKey,
        headline: item.profile.headline,
        bio: item.profile.bio,
        bioMarathi: item.profile.bioMarathi,
        experienceYears: item.profile.experienceYears,
        expectedDailyWage: item.profile.expectedDailyWage,
        maxTravelKm: item.profile.maxTravelKm,
        city: item.profile.city,
        exactAddress: item.profile.exactAddress,
        location: { type: 'Point', coordinates: item.profile.coords },
        publicLocation: { type: 'Point', coordinates: pubCoords },
        availabilityStatus: item.profile.availabilityStatus,
        completedJobsCount: item.profile.completedJobsCount,
        repeatHiresCount: item.profile.repeatHiresCount,
        emergencyContact: item.profile.emergencyContact,
        portfolioItems: item.profile.portfolioItems,
        adminIdentityVerified: false,
        isDemo: true,
        createdAt: now,
      });
    }

    const existingWSkills = await db.find('worker_skills', { workerId: u._id });
    if (existingWSkills.length === 0) {
      for (const sk of item.skills) {
        await db.insertOne('worker_skills', {
          workerId: u._id,
          ...sk,
          updatedAt: now,
        });
      }
    }

    if (!(await db.findOne('reputation_scores', { workerId: u._id }))) {
      await db.insertOne('reputation_scores', {
        workerId: u._id,
        ...item.reputation,
        updatedAt: now,
      });
    }

    const passportCode = `KS-MH-2026-${1041 + i}`;
    const existingPassport =
      (await db.findOne('skill_passports', { workerId: u._id })) ||
      (await db.findOne('skill_passports', { passportCode }));
    if (!existingPassport) {
      await db.insertOne('skill_passports', {
        workerId: u._id,
        passportCode,
        issuedAt: now,
        lastSyncedAt: now,
      });
    }

    if (!(await db.findOne('worker_availability', { workerId: u._id }))) {
      await db.insertOne('worker_availability', {
        workerId: u._id,
        availableDates: [
          '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07',
          '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
        ],
        unavailableDates: ['2026-11-08'],
        workingHours: { start: '08:30', end: '18:00' },
        updatedAt: now,
      });
    }

    createdWorkers.push({ user: u, profile: wp, passportCode });
  }

  // 3. Certificates (Pending admin review so Admin Verification Queue works with real documents!)
  await db.insertOne('certificates', {
    workerId: createdWorkers[0].user._id,
    workerName: createdWorkers[0].user.name,
    title: 'ITI Electrician Trade National Certificate (NCVT)',
    issuingAuthority: 'Directorate of Vocational Education & Training, Maharashtra',
    issueYear: '2020',
    credentialNumber: 'MH-ITI-LAT-2020-8841',
    status: 'pending',
    adminNotes: 'Demo submission awaiting Admin review.',
    createdAt: now,
  });

  await db.insertOne('certificates', {
    workerId: createdWorkers[1].user._id,
    workerName: createdWorkers[1].user.name,
    title: 'Suryamitra Solar PV Installer Programme',
    issuingAuthority: 'NISE / Skill Council for Green Jobs',
    issueYear: '2025',
    credentialNumber: 'SCGJ-SURYA-2025-3190',
    status: 'pending',
    adminNotes: 'Demo submission awaiting Admin review.',
    createdAt: now,
  });

  // 4. Skill Assessments & Real Technical/Scenario Questions
  const assessmentsSeed = [
    {
      category: 'Electrical',
      title: 'Residential & Three-Phase Electrical Safety Assessment',
      skillName: 'Concealed Conduit Wiring',
      durationMinutes: 10,
      passingScore: 60,
      questions: [
        {
          questionText: 'In a standard Indian single-phase 230V residential circuit, which wire color code is designated for Protective Earth (PE) under IS 732?',
          scenarioContext: 'You are wiring a 16A geyser socket in a newly plastered bathroom in Latur.',
          options: ['Green or Green-with-Yellow stripe', 'Black', 'Red', 'Blue'],
          correctIndex: 0,
          difficultyWeight: 1,
          explanation: 'Green / Green-Yellow is strictly designated for Protective Earth to prevent shock on metallic appliance enclosures.',
        },
        {
          questionText: 'A homeowner reports that a 32A RCCB trips immediately whenever the kitchen microwave is switched on, though individual MCBs do not trip. What is the primary fault to inspect?',
          scenarioContext: 'Troubleshooting a live distribution board with a clamp/insulation tester.',
          options: [
            'Earth leakage or Neutral-to-Earth short in the appliance/socket circuit',
            'Supply voltage from transformer is 235V',
            'Ceiling fan capacitor degradation in bedroom',
            'Undersized main energy meter display',
          ],
          correctIndex: 0,
          difficultyWeight: 2,
          explanation: 'RCCBs detect current imbalance between Phase and Neutral caused by Earth leakage or Neutral-Earth contact.',
        },
        {
          questionText: 'Before connecting an inverter output wire to selected lighting/fan points inside a room switchboard, what critical isolation step is mandatory?',
          scenarioContext: 'Installing a 1.5kVA home backup inverter.',
          options: [
            'Disconnect the grid phase loop feeding those backup switches so grid & inverter phases never collide',
            'Connect inverter output directly across main 2-pole isolator input',
            'Remove the earthing wire from the switchboard',
            'Bypass all miniature circuit breakers',
          ],
          correctIndex: 0,
          difficultyWeight: 2,
          explanation: 'Isolating backup load switches from the raw grid phase loop prevents catastrophic back-feeding.',
        },
      ],
    },
    {
      category: 'Plumbing',
      title: 'CPVC Pressure Piping & Concealed Sanitary Assessment',
      skillName: 'CPVC & UPVC Pressure Piping',
      durationMinutes: 10,
      passingScore: 60,
      questions: [
        {
          questionText: 'Why must yellow CPVC solvent cement be used on hot-water geyser lines instead of standard blue UPVC solvent?',
          scenarioContext: 'Installing concealed hot/cold mixer lines inside bathroom brickwork.',
          options: [
            'CPVC resin handles up to 82–93°C hot water chemically; UPVC solvent softens and leaks under heat',
            'Yellow solvent dries slower for aesthetic reasons only',
            'UPVC pipes have higher thermal rating than CPVC',
            'Solvent color only indicates pipe diameter',
          ],
          correctIndex: 0,
          difficultyWeight: 1,
          explanation: 'CPVC solvent fuses chlorinated PVC molecules rated for high-temperature hot water lines.',
        },
        {
          questionText: 'Before wall tiles are laid over concealed bathroom piping, what hydro-test check confirms leak-free joints?',
          scenarioContext: 'Handover check with civil tile mason waiting.',
          options: [
            'Pressurize line to 1.5x working pressure (~6–10 bar) with hand test pump and monitor gauge drop for at least 30–60 minutes',
            'Pour a bucket of water over the wall plaster',
            'Tap pipes with a steel hammer',
            'Tile immediately while solvent is still wet',
          ],
          correctIndex: 0,
          difficultyWeight: 2,
          explanation: 'Hydrostatic pressure testing before tiling catches pin-hole joint leaks prior to costly wall finishing.',
        },
      ],
    },
    {
      category: 'Carpentry',
      title: 'Modular Furniture & Precision Joinery Assessment',
      skillName: 'Modular Kitchen Installation',
      durationMinutes: 10,
      passingScore: 60,
      questions: [
        {
          questionText: 'Which plywood grade is strictly recommended for modular kitchen sink-unit carcasses exposed to moisture?',
          scenarioContext: 'Advising a customer on durable kitchen cabinetry.',
          options: [
            'IS:710 Certified Boiling Water Proof (BWP / Marine) Plywood or HDHMR',
            'Interior MR Commercial Particle Board without edge banding',
            'Unseasoned soft pine packing crate wood',
            '3mm MDF backing sheet',
          ],
          correctIndex: 0,
          difficultyWeight: 1,
          explanation: 'IS:710 BWP Marine plywood resists delamination in high-humidity under-sink zones.',
        },
        {
          questionText: 'When mounting heavy overhead kitchen wall cabinets on a brick wall, what ensures level alignment and load safety?',
          scenarioContext: 'Installing a 7-foot overhead storage loft.',
          options: [
            'Spirit/laser level datum line + heavy-duty wall-hanging brackets anchored into solid masonry',
            'Fixing with 1-inch headless finish nails into wall putty',
            'Relying only on silicone sealant along backsplash tiles',
            'Aligning visually with floor skirting without level check',
          ],
          correctIndex: 0,
          difficultyWeight: 2,
          explanation: 'Laser/spirit datum lines plus deep masonry anchors prevent cabinet sag or pull-out failure.',
        },
      ],
    },
    {
      category: 'Solar & Inverter',
      title: 'Rooftop Solar PV & Hybrid Inverter Safety Assessment',
      skillName: 'Rooftop Solar Array Mounting',
      durationMinutes: 10,
      passingScore: 60,
      questions: [
        {
          questionText: 'In Maharashtra (Northern Hemisphere), which direction and approximate tilt angle maximize annual rooftop solar PV generation?',
          scenarioContext: 'Laying out a 5kW residential solar structure in Pune/Latur (~18.5°N latitude).',
          options: [
            'True South facing at ~18°–20° tilt angle without shadow obstruction',
            'True North facing at 45° tilt angle',
            'Flat 0° under overhead water tank shadow',
            'West facing vertical wall mounting',
          ],
          correctIndex: 0,
          difficultyWeight: 1,
          explanation: 'True South orientation at tilt approximately equal to local latitude (~18°–20°) maximizes annual irradiance.',
        },
        {
          questionText: 'Why must MC4 connectors never be unplugged while a solar PV string is under load current in bright sunlight?',
          scenarioContext: 'Routine maintenance on a 600V DC rooftop string.',
          options: [
            'High-voltage DC current draws a sustained plasma arc that can cause severe burns or fire; isolate AC/DC breakers first',
            'It resets the customer Wi-Fi router',
            'Solar panels generate AC 50Hz directly at panel terminals',
            'MC4 connectors are single-use disposable clips',
          ],
          correctIndex: 0,
          difficultyWeight: 2,
          explanation: 'DC has no zero-crossing point, so breaking load current creates dangerous sustained DC arcing.',
        },
      ],
    },
  ];

  for (const a of assessmentsSeed) {
    const { questions, ...meta } = a;
    const createdAss = await db.insertOne('skill_assessments', { ...meta, createdAt: now });
    for (const q of questions) {
      await db.insertOne('assessment_questions', {
        assessmentId: createdAss._id,
        ...q,
      });
    }
  }

  // 5. Realistic Open Jobs (including 1 Emergency Job & 1 Entry-Friendly Fair Opportunity Job)
  const jobsSeed = [
    {
      employerId: emp1._id,
      employerName: 'Deshmukh Infra & Interiors',
      title: 'Residential Electrical Wiring & 8-Way MCB DB Upgrade',
      category: 'Electrical',
      description: 'Complete concealed copper wiring, modular switchboards, earthing check, and 8-way MCB distribution box installation for a newly renovated 3BHK house on Ausa Road, Latur.',
      requiredSkills: ['Concealed Conduit Wiring', 'MCB Distribution Panel', 'Industrial Earthing & Safety'],
      minExperienceYears: 2,
      dailyWageBudget: 900,
      durationDays: 6,
      city: 'Latur',
      location: { type: 'Point', coordinates: [76.558, 18.399] },
      isEmergency: false,
      status: 'open',
      responsibilities: [
        'Pull ISI-grade FR copper cables through concealed PVC conduits',
        'Assemble 8-way double-door MCB + RCCB distribution board',
        'Verify earthing resistance and inverter backup phase separation',
      ],
      deadline: '2026-11-20',
      isDemo: true,
      createdAt: now,
    },
    {
      employerId: emp2._id,
      employerName: 'Sahyadri Green Roofs Pvt Ltd',
      title: '3kW Rooftop Solar PV Mounting & Hybrid Inverter Setup',
      category: 'Solar & Inverter',
      description: 'Install 6 mono-PERC solar modules, DCDB/ACDB protection boxes, MC4 crimping, and hybrid inverter commissioning for a bungalow in Kothrud, Pune. Skill-assessed newcomers welcome under Fair Opportunity Mode.',
      requiredSkills: ['Rooftop Solar Array Mounting', 'DC/AC Hybrid Inverter Wiring'],
      minExperienceYears: 1,
      dailyWageBudget: 950,
      durationDays: 3,
      city: 'Pune',
      location: { type: 'Point', coordinates: [73.814, 18.509] },
      isEmergency: false,
      status: 'open',
      responsibilities: [
        'Anchor galvanized elevated solar mounting structure safely',
        'Complete MC4 string wiring, surge protection, and earthing pit bonding',
        'Assist lead engineer during hybrid inverter voltage check',
      ],
      deadline: '2026-11-18',
      isDemo: true,
      createdAt: now,
    },
    {
      employerId: emp1._id,
      employerName: 'Deshmukh Infra & Interiors',
      title: 'URGENT: Main CPVC Supply Line Burst & Valve Replacement',
      category: 'Plumbing',
      description: 'Emergency repair required for ruptured 1.5-inch CPVC overhead tank riser and concealed ball valve leakage at commercial clinic site. Immediate same-day availability needed.',
      requiredSkills: ['CPVC & UPVC Pressure Piping', 'Hydro-Testing & Leak Diagnostics'],
      minExperienceYears: 2,
      dailyWageBudget: 1100,
      durationDays: 1,
      city: 'Solapur',
      location: { type: 'Point', coordinates: [75.912, 17.664] },
      isEmergency: true,
      status: 'open',
      responsibilities: [
        'Isolate overhead supply, cut damaged section, and fuse heavy-duty SDR-11 CPVC union & brass ball valve',
        'Pressure test repaired riser before restoring clinic water supply',
      ],
      deadline: '2026-11-05',
      isDemo: true,
      createdAt: now,
    },
    {
      employerId: emp1._id,
      employerName: 'Deshmukh Infra & Interiors',
      title: 'Modular Kitchen & 2 Sliding Wardrobes Carpentry',
      category: 'Carpentry',
      description: 'Fabricate and install BWP marine-ply modular kitchen cabinets with soft-close tandem drawers and two bedroom sliding wardrobes in Shivaji Nagar, Latur.',
      requiredSkills: ['Modular Kitchen Installation', 'Laminate & Veneer Pressing', 'Soft-Close Hardware Fitting'],
      minExperienceYears: 4,
      dailyWageBudget: 1050,
      durationDays: 10,
      city: 'Latur',
      location: { type: 'Point', coordinates: [76.569, 18.409] },
      isEmergency: false,
      status: 'open',
      responsibilities: [
        'Verify site laser measurements and cut BWP plywood sheets cleanly',
        'Press 1mm matte laminate with edge-banding and fit soft-close channels',
      ],
      deadline: '2026-11-25',
      isDemo: true,
      createdAt: now,
    },
  ];

  const createdJobs: any[] = [];
  for (const jb of jobsSeed) {
    createdJobs.push(await db.insertOne('jobs', jb));
  }

  // 6. Seed 1 Completed Work Project + Review + Work Agreement + 1 Ongoing Work Project
  const completedProject = await db.insertOne('work_projects', {
    jobId: createdJobs[0]._id,
    employerId: emp1._id,
    employerName: 'Deshmukh Infra & Interiors',
    workerId: createdWorkers[0].user._id,
    workerName: createdWorkers[0].user.name,
    title: '2BHK Concealed Electrical & Inverter Backup Line',
    category: 'Electrical',
    agreedDailyWage: 850,
    durationDays: 4,
    stage: 'Completed',
    city: 'Latur',
    completionConfirmedAt: '2026-10-19T14:30:00.000Z',
    completionCertificateCode: 'CERT-KS-2026-9012',
    isDemo: true,
    createdAt: '2026-10-14T09:00:00.000Z',
  });

  await db.insertOne('reviews', {
    projectId: completedProject._id,
    workerId: createdWorkers[0].user._id,
    reviewerId: emp1._id,
    reviewerName: 'Vikram Deshmukh (Deshmukh Infra)',
    quality: 5,
    punctuality: 5,
    reliability: 5,
    satisfaction: 5,
    wouldRehire: true,
    comment: 'Sanjay completed all 8 MCB circuits cleanly with proper color-coded FR wiring and tested earthing resistance before handover.',
    isDemo: true,
    createdAt: '2026-10-19T16:00:00.000Z',
  });

  const activeProject = await db.insertOne('work_projects', {
    jobId: createdJobs[3]._id,
    employerId: emp1._id,
    employerName: 'Deshmukh Infra & Interiors',
    workerId: createdWorkers[2].user._id,
    workerName: createdWorkers[2].user.name,
    title: 'Master Bedroom Wardrobe & Teak Main Door Frame',
    category: 'Carpentry',
    agreedDailyWage: 950,
    durationDays: 5,
    stage: 'In Progress',
    city: 'Latur',
    completionConfirmedAt: null,
    completionCertificateCode: null,
    isDemo: true,
    createdAt: '2026-10-29T10:00:00.000Z',
  });

  await db.insertOne('work_agreements', {
    projectId: activeProject._id,
    employerId: emp1._id,
    employerName: 'Deshmukh Infra & Interiors',
    workerId: createdWorkers[2].user._id,
    workerName: createdWorkers[2].user.name,
    workDescription: 'Fabrication and laminate finishing of 8x7 ft sliding wardrobe and main door frame installation.',
    dailyWage: 950,
    durationDays: 5,
    responsibilities: [
      'Employer supplies BWP plywood, laminates, adhesives, and hardware on site',
      'Worker brings precision carpentry tools and completes installation within 5 working days',
      'Daily site safety and clean workspace handover at 18:00',
    ],
    terms: [
      'Payment settled in two milestones: 40% upon carcass erection, 60% upon final inspection',
      'Any scope addition outside wardrobe & door frame mutually agreed prior to execution',
    ],
    employerAccepted: true,
    workerAccepted: true,
    agreementCode: 'AGR-KS-2026-4410',
    createdAt: '2026-10-29T10:15:00.000Z',
  });

  // Seed 2 job applications so Employer Smart Shortlisting works right away
  await db.insertOne('job_applications', {
    jobId: createdJobs[0]._id,
    workerId: createdWorkers[0].user._id,
    workerName: createdWorkers[0].user.name,
    workerCategory: 'Electrical',
    coverNote: 'Available immediately in Latur with own digital multimeter, crimping kit, and 6 years 3BHK wiring experience.',
    proposedDailyWage: 850,
    status: 'applied',
    aiMatchScore: 94.2,
    aiBreakdown: {
      skillCompatibility: 96,
      experienceCompatibility: 95,
      locationCompatibility: 98,
      availabilityCompatibility: 100,
      budgetCompatibility: 96,
    },
    createdAt: now,
  });

  // 7. Community Learning Resources (English, Marathi, Hindi)
  const resources = [
    {
      title: 'Three-Phase Distribution Boards, RCCB Selection & Earthing Pit Standards',
      category: 'Electrical',
      targetSkill: 'Three-Phase Wiring',
      language: 'Marathi',
      provider: 'Maharashtra Skill Development Society (MSDS) Open Guide',
      durationHours: 4,
      format: 'Practical Field Module + Checklist',
      summary: 'Step-by-step Marathi guide covering IS:732 load balancing, 30mA RCCB fault testing, and chemical earthing installation.',
    },
    {
      title: 'PM Surya Ghar Rooftop Solar Installation & DC Arc Safety',
      category: 'Solar & Inverter',
      targetSkill: 'DC/AC Hybrid Inverter Wiring',
      language: 'Hindi',
      provider: 'Skill Council for Green Jobs (Suryamitra)',
      durationHours: 6,
      format: 'Video Workshop + Assessment Prep',
      summary: 'Covers string Voc testing, MC4 crimping torque, surge protection devices (SPD), and DISCOM net-meter readiness.',
    },
    {
      title: 'Modern Modular Kitchen Hardware, Laser Leveling & BWP Joinery',
      category: 'Carpentry',
      targetSkill: 'Modular Kitchen Installation',
      language: 'Marathi',
      provider: 'Furniture & Fittings Skill Council (FFSC)',
      durationHours: 5,
      format: 'Hands-on Blueprint Guide',
      summary: 'Precision 32mm system drilling, soft-close tandem box calibration, and moisture-sealing sink cutouts.',
    },
    {
      title: 'Concealed CPVC Hydro-Testing & Diverter Valve Diagnostics',
      category: 'Plumbing',
      targetSkill: 'Hydro-Testing & Leak Diagnostics',
      language: 'English',
      provider: 'Indian Plumbing Skills Council (IPSC)',
      durationHours: 3,
      format: 'Technical SOP Manual',
      summary: 'Standard operating procedures for 10-bar pressure testing, thermal expansion loops, and non-destructive seepage tracing.',
    },
    {
      title: 'TIG/MIG Stainless & Structural Welding Safety & Joint QA',
      category: 'Welding & Fabrication',
      targetSkill: 'MIG & TIG Precision Welding',
      language: 'Hindi',
      provider: 'Capital Goods Skill Council India',
      durationHours: 5,
      format: 'Workshop Safety & Technique Module',
      summary: 'Shielding gas flow rates, preventing sheet distortion, PPE arc-flash protection, and weld bead inspection.',
    },
  ];
  for (const r of resources) {
    await db.insertOne('learning_resources', { ...r, createdAt: now });
  }

  // 8. Seed 1 Open Dispute & 1 AI Fraud Alert for Admin Governance Demonstration
  await db.insertOne('disputes', {
    projectId: activeProject._id,
    projectTitle: activeProject.title,
    raisedById: emp1._id,
    raisedByName: 'Vikram Deshmukh',
    againstId: createdWorkers[2].user._id,
    againstName: 'Ramesh Patil',
    reason: 'Clarification needed on extra laminate sheet wastage due to wall unevenness.',
    evidenceNotes: 'Site wall had 18mm plumb variance requiring extra scribing strip. Seeking mutual mediator note—no fault alleged.',
    status: 'open',
    resolutionSummary: '',
    isDemo: true,
    createdAt: now,
  });

  await db.insertOne('fraud_alerts', {
    targetType: 'job',
    targetId: createdJobs[2]._id,
    severity: 'medium',
    anomalyScore: 68.4,
    reason: 'Emergency daily wage (₹1,100/day) is +37% above Solapur plumbing median. Queued for routine Admin verification (legitimate urgent premium likely).',
    status: 'open',
    adminNotes: '',
    createdAt: now,
  });

  // Initial notifications & messages
  await db.insertOne('notifications', {
    userId: createdWorkers[0].user._id,
    type: 'match',
    title: '94% AI Job Match in Latur',
    body: 'Deshmukh Infra posted "Residential Electrical Wiring & 8-Way MCB DB Upgrade" 1.1 km from your location.',
    read: false,
    createdAt: now,
  });

  await db.insertOne('messages', {
    senderId: emp1._id,
    senderName: 'Vikram Deshmukh',
    receiverId: createdWorkers[0].user._id,
    receiverName: 'Sanjay Kulkarni',
    content: 'Namaste Sanjay, your wiring work last month was spotless. Please check our new 3BHK electrical posting on Ausa Road.',
    read: false,
    createdAt: now,
  });

  await db.insertOne('audit_logs', {
    actorId: adminUser._id,
    actorRole: 'system',
    action: 'SEED_INITIAL_DEMO_ECOSYSTEM',
    targetCollection: 'all',
    targetId: 'bootstrap',
    justification: 'Initialized clearly labeled Maharashtra demo profiles, assessments, and jobs.',
    createdAt: now,
  });

  await ensureWorkforcePopulation(500);
  await ensureSkillLearningCatalog();
}
