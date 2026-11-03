import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const PYTHON_SCRIPT = path.resolve(process.cwd(), 'backend', 'ai_engine.py');

let resolvedPythonBin: string | null = null;

function resolvePythonBinary(): string {
  if (resolvedPythonBin) return resolvedPythonBin;
  const candidates = [
    process.env.PYTHON_BIN,
    ...(process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']),
  ].filter(Boolean) as string[];

  for (const cmd of candidates) {
    try {
      const check = spawnSync(cmd, ['--version'], {
        stdio: 'pipe',
        timeout: 3000,
        windowsHide: true,
      });
      if (check.status === 0) {
        resolvedPythonBin = cmd;
        return cmd;
      }
    } catch {
      // try next candidate
    }
  }
  resolvedPythonBin = process.platform === 'win32' ? 'python' : 'python3';
  return resolvedPythonBin;
}

export function runPythonEngine<T = any>(action: string, data: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const pythonCmd = resolvePythonBinary();
    const proc = spawn(pythonCmd, [PYTHON_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', (err) => {
      reject(err);
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python AI Engine (${pythonCmd}) exited with ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as T);
      } catch {
        reject(new Error(`Invalid JSON from Python AI Engine: ${stdout}`));
      }
    });

    proc.stdin.write(JSON.stringify({ action, data }), 'utf8');
    proc.stdin.end();
  });
}

function getOptionalGeminiClient(): GoogleGenAI | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface GeneratedWorkerProfile {
  headline: string;
  professionalSummary: string;
  category: string;
  experienceYears: number;
  extractedSkills: { name: string; proficiency: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' }[];
  portfolioSummary: string;
  workHighlights: string[];
  generatedVia: 'gemini_service' | 'local_nlp_engine';
}

export async function generateProfessionalProfile(
  rawInput: string,
  language = 'en'
): Promise<GeneratedWorkerProfile> {
  const ai = getOptionalGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Convert this skilled worker's informal description into a dignified, structured professional worker profile for India. Input (${language}): "${rawInput}"`,
        config: {
          systemInstruction:
            'You are KaushalSetu Profile Intelligence. Extract the exact skilled, semi-skilled, artisan, care, hospitality, digital, agricultural, or custom trade category without restricting to construction—supporting ANY domain (e.g., Tailoring, Home Healthcare & Nursing, Beauty & Bridal, Culinary & Catering, Computer/CCTV, Automotive/EV, Handloom, Pottery, Electrical, Solar, Plumbing, Carpentry, or any custom skill). Extract experience years, concrete practical skills, a clear professional summary (2-3 sentences), and portfolio highlights.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              professionalSummary: { type: Type.STRING },
              category: { type: Type.STRING },
              experienceYears: { type: Type.NUMBER },
              extractedSkills: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    proficiency: { type: Type.STRING },
                  },
                },
              },
              portfolioSummary: { type: Type.STRING },
              workHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });
      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return {
          headline: parsed.headline || 'Skilled Trade Professional',
          professionalSummary: parsed.professionalSummary || rawInput,
          category: parsed.category || 'Plumbing',
          experienceYears: Number(parsed.experienceYears ?? 3),
          extractedSkills: Array.isArray(parsed.extractedSkills)
            ? parsed.extractedSkills.map((s: any) => ({
                name: String(s.name || 'Trade Skill'),
                proficiency: (['Beginner', 'Intermediate', 'Advanced', 'Expert'].includes(s.proficiency)
                  ? s.proficiency
                  : 'Intermediate') as any,
              }))
            : [],
          portfolioSummary: parsed.portfolioSummary || 'Hands-on residential and commercial trade execution.',
          workHighlights: Array.isArray(parsed.workHighlights) ? parsed.workHighlights : [],
          generatedVia: 'gemini_service',
        };
      }
    } catch (err) {
      console.warn('Optional Gemini profile generation unavailable, using local NLP parser:', err);
    }
  }

  // Local NLP deterministic extractor (works offline / without external API key)
  const lower = rawInput.toLowerCase();
  const numWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  let expYears = 3;
  const digitMatch = lower.match(/(\d+)\s*(?:year|yr|वर्षे|साल)/i);
  if (digitMatch) {
    expYears = Number(digitMatch[1]);
  } else {
    for (const [word, val] of Object.entries(numWords)) {
      if (lower.includes(`${word} year`)) {
        expYears = val;
        break;
      }
    }
  }

  let category = 'Skilled Trade & Craft';
  if (/electr|wiring|mcb|इलेक्ट्रिशियन|बिजली/.test(lower)) category = 'Electrical';
  else if (/plumb|pipe|leak|bathroom|sanitary|प्लंबर|नळ/.test(lower)) category = 'Plumbing';
  else if (/carpent|wood|furniture|door|modular|सुतार|बढ़ई/.test(lower)) category = 'Carpentry';
  else if (/solar|inverter|panel|सोलर|सौर/.test(lower)) category = 'Solar & Inverter';
  else if (/weld|fabricat|gate|grill|mig|tig|वेल्डर/.test(lower)) category = 'Welding & Fabrication';
  else if (/mason|tile|brick|plaster|गवंडी|मिस्त्री/.test(lower)) category = 'Masonry & Tiling';
  else if (/paint|waterproof|putty|पेंटर/.test(lower)) category = 'Painting & Waterproofing';
  else if (/tailor|stitch|blouse|kurta|boutique|garment|शिंपी|शिलाई|सिलाई/.test(lower)) category = 'Tailoring, Boutique & Garment Craft';
  else if (/nurs|patient|elder|health|hospital|caregiver|नर्स|रुग्ण/.test(lower)) category = 'Home Healthcare, Nursing & Elder Care';
  else if (/beauty|makeup|salon|bridal|mehendi|saree|ब्युटी|मेहंदी/.test(lower)) category = 'Beauty, Salon & Bridal Styling';
  else if (/cook|cater|chef|bakery|tiffin|food|स्वयंपाक|रसोई/.test(lower)) category = 'Culinary, Catering & Bakery';
  else if (/cctv|computer|laptop|network|lan|it |संगणक/.test(lower)) category = 'Computer, Networking & CCTV Tech';
  else if (/mechanic|ev |scooter|car |auto|bike|मेकॅनिक/.test(lower)) category = 'Automotive & EV Mechanics';
  else if (/handloom|embroid|zari|paithani|weav|हातमाग/.test(lower)) category = 'Handloom, Embroidery & Artisan Craft';
  else if (/agri|drip|farm|nursery|tractor|शेती|ठिबक/.test(lower)) category = 'Agriculture, Drip Irrigation & Nursery';
  else if (/tally|billing|data entry|excel|inventory/.test(lower)) category = 'Retail Billing, Data Entry & Inventory';
  else if (/child|nanny|baby|daycare|japa/.test(lower)) category = 'Childcare & Domestic Management';
  else if (/potter|clay|ceramic|terracotta|कुंभार/.test(lower)) category = 'Pottery, Ceramic & Eco-Sculpture Craft';
  else if (/yoga|fitness|physio|wellness|योगा/.test(lower)) category = 'Fitness, Yoga & Physiotherapy Wellness';

  const defaultSkillsMap: Record<string, string[]> = {
    Electrical: ['Residential Wiring', 'MCB Distribution Panel', 'Fault Diagnostics', 'Earthing & Safety'],
    Plumbing: ['CPVC & UPVC Pipe Fitting', 'Bathroom Sanitary Installation', 'Water Leakage Repair', 'Pressure Testing'],
    Carpentry: ['Custom Furniture Fabrication', 'Modular Cabinet Fitting', 'Laminate Finishing', 'Door & Lock Installation'],
    'Solar & Inverter': ['Rooftop Solar Mounting', 'Hybrid Inverter Wiring', 'Battery Commissioning', 'DC/AC Safety'],
    'Welding & Fabrication': ['Arc & MIG Welding', 'MS Gate & Truss Fabrication', 'Precision Grinding', 'Joint Inspection'],
    'Masonry & Tiling': ['Vitrified Floor Tiling', 'Brickwork & Plastering', 'Laser Leveling', 'Waterproof Grouting'],
    'Painting & Waterproofing': ['Interior Emulsion Finishing', 'Wall Putty & Sanding', 'Terrace Waterproofing', 'Crack Filling'],
    'Tailoring, Boutique & Garment Craft': ['Blouse & Kurta Pattern Cutting', 'Bridal Alteration & Fitting', 'Industrial Overlock & Pico', 'Custom Garment Finishing'],
    'Home Healthcare, Nursing & Elder Care': ['Vital Signs & Glucometer Check', 'Post-Operative Bedside Care', 'Medication Management', 'Assisted Elder Mobility'],
    'Beauty, Salon & Bridal Styling': ['HD Bridal Makeup & Hair', 'Traditional Saree Draping', 'Hygienic Skin & Facial Care', 'Bridal Mehendi Artistry'],
    'Culinary, Catering & Bakery': ['Hygienic Batch Cooking', 'Traditional & Festive Catering', 'Bakery & Millet Preparation', 'FSSAI Kitchen Hygiene'],
    'Computer, Networking & CCTV Tech': ['IP CCTV & NVR Setup', 'Cat6 LAN Cabling & Router Config', 'Desktop/Laptop Diagnostics', 'Biometric Device Setup'],
    'Automotive & EV Mechanics': ['EV Controller & BMS Diagnostics', 'OBD-II Engine Scanning', 'Brake & Suspension Service', 'Auto Electrical Repair'],
    'Handloom, Embroidery & Artisan Craft': ['Handloom Silk & Zari Weaving', 'Aari & Zardosi Embroidery', 'Surface Textile Ornamentation', 'Quality Motif Finishing'],
    'Agriculture, Drip Irrigation & Nursery': ['Inline Drip Irrigation Setup', 'Orchard Grafting & Pruning', 'Polyhouse Crop Care', 'Fertigation Filter Maintenance'],
    'Retail Billing, Data Entry & Inventory': ['Tally Prime & GST Invoicing', 'Barcode POS Billing', 'Multilingual Fast Typing', 'Stock Reconciliation'],
    'Childcare & Domestic Management': ['Infant & Toddler Daycare Safety', 'Nutritious Meal Prep', 'Newborn Postnatal Support', 'Structured Home Care'],
    'Pottery, Ceramic & Eco-Sculpture Craft': ['Wheel Throwing & Terracotta', 'Ceramic Glazing & Firing', 'Eco-Clay Sculpting', 'Surface Finishing'],
    'Fitness, Yoga & Physiotherapy Wellness': ['Therapeutic Yoga & Pranayama', 'Mobility & Rehab Guidance', 'Senior Citizen Wellness', 'Posture Assessment'],
  };

  const prof: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' =
    expYears >= 7 ? 'Expert' : expYears >= 4 ? 'Advanced' : expYears >= 2 ? 'Intermediate' : 'Beginner';

  const fallbackCustomSkills = ['Practical Domain Execution', 'Quality & Hygiene Compliance', 'Client Measurement & Estimation', 'Timely Project Handover'];
  const skills = (defaultSkillsMap[category] || fallbackCustomSkills).map((name) => ({
    name,
    proficiency: prof,
  }));

  return {
    headline: `${prof} ${category} Specialist (${expYears}+ Years Practical Experience)`,
    professionalSummary: `Dedicated ${category.toLowerCase()} technician with ${expYears} years of hands-on field experience delivering clean, reliable, and safety-compliant installations and repairs for residential and commercial clients.`,
    category,
    experienceYears: expYears,
    extractedSkills: skills,
    portfolioSummary: `Proven track record across ${skills.map((s) => s.name.toLowerCase()).join(', ')} with strong focus on timely completion and durable workmanship.`,
    workHighlights: [
      `${expYears}+ years of verified practical site execution in ${category}`,
      `Proficient in ${skills[0].name} and ${skills[1].name}`,
      'Adheres to site safety checks, transparent wage estimates, and clean handover',
    ],
    generatedVia: 'local_nlp_engine',
  };
}

export interface GeneratedJobSpec {
  title: string;
  category: string;
  description: string;
  requiredSkills: string[];
  minExperienceYears: number;
  city: string;
  dailyWageBudget: number;
  durationDays: number;
  responsibilities: string[];
  deadline: string;
  generatedVia: 'gemini_service' | 'local_nlp_engine';
}

export async function generateJobDescriptionAI(promptText: string): Promise<GeneratedJobSpec> {
  const defaultDeadline = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const ai = getOptionalGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a structured skilled-trade job posting in India from this employer requirement: "${promptText}"`,
        config: {
          systemInstruction:
            'You are KaushalSetu Employer Hiring Intelligence. Return realistic Indian daily wages in INR (550 to 1800), city in Maharashtra/India, and the exact trade/skill category without artificial restriction (covering Tailoring, Home Nursing, Beauty/Bridal, Catering, Computer/CCTV, EV/Auto Mechanics, Agriculture, Handloom, Electrical, Plumbing, Carpentry, or any custom skill requested), practical required skills, and 3-4 clear responsibilities.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
              minExperienceYears: { type: Type.NUMBER },
              city: { type: Type.STRING },
              dailyWageBudget: { type: Type.NUMBER },
              durationDays: { type: Type.NUMBER },
              responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });
      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return {
          title: parsed.title || 'Skilled Trade Specialist Needed',
          category: parsed.category || 'Carpentry',
          description: parsed.description || promptText,
          requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : ['Practical Trade Execution'],
          minExperienceYears: Number(parsed.minExperienceYears ?? 2),
          city: parsed.city || 'Latur',
          dailyWageBudget: Number(parsed.dailyWageBudget ?? 850),
          durationDays: Number(parsed.durationDays ?? 5),
          responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
          deadline: defaultDeadline,
          generatedVia: 'gemini_service',
        };
      }
    } catch (err) {
      console.warn('Optional Gemini job generator unavailable, using local NLP generator:', err);
    }
  }

  const lower = promptText.toLowerCase();
  const cities = ['Latur', 'Pune', 'Mumbai', 'Nagpur', 'Nashik', 'Solapur', 'Kolhapur', 'Nanded', 'Aurangabad'];
  let detectedCity = 'Latur';
  for (const c of cities) {
    if (lower.includes(c.toLowerCase())) {
      detectedCity = c;
      break;
    }
  }

  let category = 'Carpentry';
  let title = `Experienced Furniture & Interior Carpenter — ${detectedCity}`;
  let requiredSkills = ['Custom Furniture Fabrication', 'Laminate & Veneer Finishing', 'Modular Hardware Fitting', 'Site Measurement'];
  let responsibilities = [
    'Review furniture dimensions and material sheet layouts with employer on site',
    'Execute precision cutting, joinery, edge-banding, and laminate finishing',
    'Install hinges, telescopic channels, and locks with level alignment',
    'Maintain clean work area and electrical power-tool safety protocols',
  ];

  if (/electr|wiring|inverter|mcb|इलेक्ट्रिशियन/.test(lower)) {
    category = 'Electrical';
    title = `Skilled Residential & Commercial Electrician — ${detectedCity}`;
    requiredSkills = ['Concealed Conduit Wiring', 'MCB Distribution Panel', 'Earthing & Load Testing', 'Inverter Connection'];
    responsibilities = [
      'Install and test concealed wiring, switchboards, and MCB distribution boxes',
      'Verify proper earthing continuity and load balancing across circuits',
      'Connect backup inverter/UPS lines safely according to IS standards',
      'Conduct final multimeter voltage check before handover',
    ];
  } else if (/plumb|pipe|bathroom|leak|प्लंबर/.test(lower)) {
    category = 'Plumbing';
    title = `Experienced Plumbing & Sanitary Specialist — ${detectedCity}`;
    requiredSkills = ['CPVC & UPVC Piping', 'Concealed Diverter Fitting', 'Leakage Diagnostics', 'Sanitaryware Installation'];
    responsibilities = [
      'Lay and pressure-test CPVC/UPVC water supply and drainage lines',
      'Install wall mixers, diverters, washbasins, and overhead tank valves',
      'Perform hydro-testing to guarantee zero concealed seepage',
    ];
  } else if (/solar|panel|सोलर/.test(lower)) {
    category = 'Solar & Inverter';
    title = `Rooftop Solar PV Installation Technician — ${detectedCity}`;
    requiredSkills = ['Rooftop Solar Array Mounting', 'DC/AC Hybrid Inverter Wiring', 'MC4 Crimping & Earthing'];
    responsibilities = [
      'Assemble galvanized solar mounting structure and secure PV modules',
      'Wire DCDB, ACDB, surge arresters, and hybrid inverter strings safely',
      'Perform open-circuit voltage and earthing pit resistance verification',
    ];
  } else if (/weld|gate|grill|fabricat|वेल्डर/.test(lower)) {
    category = 'Welding & Fabrication';
    title = `Structural & Gate Welding Technician — ${detectedCity}`;
    requiredSkills = ['MIG & Arc Welding', 'MS Gate & Shed Fabrication', 'Grinding & Joint Finishing'];
    responsibilities = [
      'Fabricate and weld MS structural frames, gates, or safety grills per dimensions',
      'Grind weld seams smooth and apply anti-corrosive red-oxide primer',
      'Follow full arc-shield, glove, and fire-safety precautions on site',
    ];
  }

  const wageEst = await runPythonEngine('wage', {
    category,
    city: detectedCity,
    experienceYears: lower.includes('experienced') || lower.includes('senior') ? 4 : 2,
    skillLevel: lower.includes('experienced') ? 'Advanced' : 'Intermediate',
    complexity: 'Standard',
    durationDays: 5,
  });

  return {
    title,
    category,
    description: `Seeking a reliable ${category.toLowerCase()} professional in ${detectedCity} based on requirement: "${promptText}". Candidates with assessed skills on KaushalSetu or strong practical portfolios are encouraged to apply.`,
    requiredSkills,
    minExperienceYears: lower.includes('experienced') ? 3 : 1,
    city: detectedCity,
    dailyWageBudget: Math.round((wageEst.recommendedDailyMin + wageEst.recommendedDailyMax) / 2),
    durationDays: 5,
    responsibilities,
    deadline: defaultDeadline,
    generatedVia: 'local_nlp_engine',
  };
}

export async function runPlatformAssistant(params: {
  message: string;
  role: string;
  userName: string;
  language: string;
  contextSummary: string;
}): Promise<{ reply: string; suggestions: string[] }> {
  const ai = getOptionalGeminiClient();
  const langLabel = params.language === 'mr' ? 'Marathi' : params.language === 'hi' ? 'Hindi' : 'English';

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `User (${params.userName}, Role: ${params.role}) asks: "${params.message}"\nLive Account Context: ${params.contextSummary}`,
        config: {
          systemInstruction: `You are KaushalSetu AI Assistant for India's skilled worker hiring and reputation platform. Reply in ${langLabel}. Be practical, warm, concise (under 110 words), and actionable. Help workers understand reputation scores, skill assessments, fair wages, and jobs; help employers write clear jobs, compare candidates fairly, and use agreements.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });
      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return {
          reply: parsed.reply || 'How can I assist you on KaushalSetu today?',
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
        };
      }
    } catch (err) {
      console.warn('Optional Gemini assistant fallback triggered:', err);
    }
  }

  // Deterministic multilingual smart assistant fallback
  const q = params.message.toLowerCase();
  if (q.includes('reputation') || q.includes('score') || q.includes('प्रतिष्ठा') || q.includes('स्कोर')) {
    return {
      reply:
        params.language === 'mr'
          ? 'कौशलसेतूवर नवीन कामगारांना ७२/१०० चा न्याय्य सुरुवातीचा प्रतिष्ठा स्कोर मिळतो. कौशल्य चाचणी उत्तीर्ण करून, वेळेवर काम पूर्ण करून आणि ग्राहकांकडून चांगले पुनरावलोकन मिळवून तुम्ही तुमचा स्कोर ९०+ पर्यंत वाढवू शकता.'
          : params.language === 'hi'
          ? 'कौशलसेतु पर नए कारीगरों को 72/100 का निष्पक्ष शुरुआती प्रतिष्ठा स्कोर मिलता है। कौशल परीक्षा पास करके और समय पर प्रोजेक्ट पूरा करके आप अपना स्कोर 90+ तक बढ़ा सकते हैं।'
          : 'KaushalSetu uses a Bayesian Fair-Start Reputation Engine: new workers start around 72/100 instead of zero. You can boost your score by passing a trade Skill Assessment, completing projects on time, and earning repeat hires. Unverified complaints never reduce your score.',
      suggestions: ['Take a Skill Assessment', 'Analyze my Skill Gaps', 'Download Skill Passport'],
    };
  }
  if (q.includes('skill') || q.includes('improve') || q.includes('career') || q.includes('कौशल्य')) {
    return {
      reply:
        'Open the "AI Skill & Career Lab" tab in your dashboard to compare your current trade skills against higher-paying roles like Solar PV Lead Technician or Industrial Electrician, and take a 3-question scenario assessment to earn an Assessed badge.',
      suggestions: ['Open Skill Gap Analyzer', 'View Fair Wage Estimator', 'Browse Learning Center'],
    };
  }
  return {
    reply: `Namaste ${params.userName}! Based on your ${params.role} workspace (${params.contextSummary}), you can use AI Job-Worker Matching, generate professional profiles or job descriptions from a single sentence, verify skills for your QR Digital Skill Passport, or estimate fair regional daily wages.`,
    suggestions:
      params.role === 'employer'
        ? ['Generate a Job Description', 'Discover Nearby Workers on Map', 'Estimate Fair Daily Wage']
        : ['Find AI-Matched Jobs', 'Improve My Profile with AI', 'How is my Reputation calculated?'],
  };
}
