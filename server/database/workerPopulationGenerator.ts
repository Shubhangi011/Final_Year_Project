import bcrypt from 'bcryptjs';
import { db, fuzzCoordinates, newObjectId } from './mongoStore.ts';

export interface TradeCatalogEntry {
  category: string;
  baseWage: number;
  skills: string[];
  femaleRatio: number; // 0.0 to 1.0 realistic + inclusive gender mix across trades
  headlineTemplates: string[];
  bioTemplate: (exp: number, city: string, s1: string, s2: string) => string;
}

export const UNRESTRICTED_TRADE_CATALOG: TradeCatalogEntry[] = [
  {
    category: 'Electrical',
    baseWage: 800,
    skills: ['Concealed Conduit Wiring', 'MCB Distribution Panel', 'Three-Phase Wiring', 'Industrial Earthing & Safety', 'Inverter & UPS Backup', 'Smart Home Relay Setup'],
    femaleRatio: 0.24,
    headlineTemplates: ['Residential & Commercial Electrician', 'Three-Phase Panel & Wiring Technician', 'Certified Wireman & Fault Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years hands-on electrical experience in ${city} specializing in ${s1}, ${s2}, load balancing, and RCCB safety testing.`,
  },
  {
    category: 'Solar & Inverter',
    baseWage: 880,
    skills: ['Rooftop Solar Array Mounting', 'DC/AC Hybrid Inverter Wiring', 'Net Metering & Surge Protection', 'Lithium Battery Commissioning', 'Solar String Clamp Diagnostics'],
    femaleRatio: 0.42,
    headlineTemplates: ['Rooftop Solar PV & Inverter Technician', 'Suryamitra Solar Array Specialist', 'Hybrid Solar & Battery Commissioning Tech'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years practical clean-energy field work in ${city} executing ${s1} and ${s2} for residential and society rooftops.`,
  },
  {
    category: 'Tailoring, Boutique & Garment Craft',
    baseWage: 720,
    skills: ['Blouse & Kurta Pattern Cutting', 'Bridal Lehenga & Gown Alteration', 'Industrial Overlock & Pico Stitching', 'Uniform Batch Tailoring', 'Canvas & Lining Precision Fit'],
    femaleRatio: 0.76,
    headlineTemplates: ['Master Boutique Tailor & Pattern Cutter', 'Custom Garment & Bridal Stitching Artisan', 'Commercial Apparel & Uniform Tailor'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years garment craftsmanship in ${city} delivering precision ${s1} and ${s2} with timely customer trials.`,
  },
  {
    category: 'Home Healthcare, Nursing & Elder Care',
    baseWage: 850,
    skills: ['Post-Operative Patient Care', 'Vital Signs & Glucometer Monitoring', 'Geriatric Mobility & Physiotherapy Aid', 'Medication Schedule Management', 'Bedside Hygiene & Wound Dressing'],
    femaleRatio: 0.74,
    headlineTemplates: ['Certified Home Healthcare & Nursing Attendant', 'Geriatric & Post-Surgery Care Specialist', 'GDA Trained Patient Care Technician'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years compassionate home nursing and elder care service across ${city}, skilled in ${s1} and ${s2}.`,
  },
  {
    category: 'Computer, Networking & CCTV Tech',
    baseWage: 900,
    skills: ['IP CCTV & NVR Installation', 'LAN Structured Cabling & Router Config', 'Laptop & Desktop Chip-Level Repair', 'Biometric Attendance Setup', 'Fiber Optic Splicing'],
    femaleRatio: 0.48,
    headlineTemplates: ['Computer Hardware, LAN & CCTV Technician', 'IT Field Support & Security Camera Installer', 'Network Cabling & Biometric Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years technical hardware and security installation experience in ${city} covering ${s1} and ${s2}.`,
  },
  {
    category: 'Plumbing',
    baseWage: 760,
    skills: ['CPVC & UPVC Pressure Piping', 'Hydro-Testing & Leak Diagnostics', 'Concealed Diverter & Sanitaryware', 'Solar Water Heater Piping', 'Submersible & Booster Pump Setup'],
    femaleRatio: 0.16,
    headlineTemplates: ['Concealed Sanitary & CPVC Plumber', 'Hydro-Leak Detection & Pump Specialist', 'Residential & Commercial Pipe Fitter'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years sanitary and water-line plumbing across ${city}, experienced in ${s1} and ${s2}.`,
  },
  {
    category: 'Carpentry',
    baseWage: 840,
    skills: ['Modular Kitchen Installation', 'Laminate & Veneer Pressing', 'Soft-Close Hardware Fitting', 'Solid Teak Door & Frame Joinery', 'Wardrobe & Loft Fabrication'],
    femaleRatio: 0.18,
    headlineTemplates: ['Modular Kitchen & Interior Carpenter', 'Custom Furniture & Veneer Craftsman', 'Architectural Woodwork & Door Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years interior carpentry in ${city} delivering durable ${s1} and ${s2} with clean site handover.`,
  },
  {
    category: 'Beauty, Salon & Bridal Styling',
    baseWage: 820,
    skills: ['HD Bridal Makeup & Hair Styling', 'Nauvari & Traditional Saree Draping', 'Skin Care, Facial & Threading', 'Intricate Bridal Mehendi Artistry', 'Hygienic Home Salon Service'],
    femaleRatio: 0.86,
    headlineTemplates: ['Certified Bridal Makeup & Salon Artist', 'Professional Beautician & Saree Drapist', 'Mehendi & Event Grooming Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years certified beauty and bridal styling across ${city}, specializing in ${s1} and ${s2}.`,
  },
  {
    category: 'Culinary, Catering & Bakery',
    baseWage: 780,
    skills: ['Maharashtrian & North Indian Catering', 'Hygienic Tiffin & Institutional Cooking', 'Artisan Bakery, Cakes & Millet Snacks', 'FSSAI Kitchen Hygiene & Prep', 'Event Live-Counter Cooking'],
    femaleRatio: 0.66,
    headlineTemplates: ['Professional Catering Cook & Culinary Specialist', 'Home Chef, Tiffin & Millet Bakery Artisan', 'Commercial Kitchen & Event Halwai'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years culinary and catering excellence in ${city}, known for hygienic ${s1} and ${s2}.`,
  },
  {
    category: 'Automotive & EV Mechanics',
    baseWage: 860,
    skills: ['EV Two-Wheeler Controller & BMS Check', 'OBD-II Engine Diagnostics', 'Four-Wheeler Brake & Suspension Overhaul', 'Clutch, Gearbox & Periodic Service', 'Auto Electrical & Alternator Repair'],
    femaleRatio: 0.22,
    headlineTemplates: ['Automotive & EV Diagnostics Technician', 'Multi-Brand Car & Bike Master Mechanic', 'Electric Scooter & Battery Service Tech'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years modern garage and doorstep vehicle service in ${city}, skilled in ${s1} and ${s2}.`,
  },
  {
    category: 'Welding & Fabrication',
    baseWage: 850,
    skills: ['MIG & TIG Precision Welding', 'Structural MS Gate & Truss Fabrication', 'Stainless Steel Railing Finishing', 'Sheet Metal Bending & Plasma Cutting', 'Arc Flash & Hot-Work Safety'],
    femaleRatio: 0.18,
    headlineTemplates: ['Structural MIG/TIG Welder & Fabricator', 'SS Railing & Custom Gate Craftsman', 'Industrial Metal Fabrication Technician'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years metal fabrication and precision welding in ${city}, specializing in ${s1} and ${s2}.`,
  },
  {
    category: 'Handloom, Embroidery & Artisan Craft',
    baseWage: 740,
    skills: ['Handloom Paithani & Silk Weaving', 'Aari, Zardosi & Mirror Embroidery', 'Computerized Multi-Head Embroidery', 'Block Printing & Natural Dyeing', 'Macrame, Crochet & Bamboo Craft'],
    femaleRatio: 0.78,
    headlineTemplates: ['Handloom Zari & Embroidery Master Artisan', 'Aari/Zardosi & Textile Craft Specialist', 'Traditional Weaving & Surface Ornamentation Artist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years heritage and contemporary textile craftsmanship in ${city}, expert in ${s1} and ${s2}.`,
  },
  {
    category: 'Childcare & Domestic Management',
    baseWage: 700,
    skills: ['Infant & Toddler Daycare Safety', 'Nutritious Meal Preparation', 'Early Learning & Homework Support', 'Newborn Japa & Postnatal Mother Care', 'Structured Household Organization'],
    femaleRatio: 0.84,
    headlineTemplates: ['Trained Childcare Nanny & Japa Caregiver', 'Verified Early-Childhood Home Caretaker', 'Postnatal Mother & Infant Care Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years trusted family childcare and postnatal support in ${city} focusing on ${s1} and ${s2}.`,
  },
  {
    category: 'Appliance & Mobile Electronics Repair',
    baseWage: 830,
    skills: ['RO Water Purifier Membrane & Pump Service', 'Washing Machine & Microwave PCB Repair', 'Smartphone Screen & Micro-Soldering', 'LED TV Backlight & Power Board Fix', 'Geyser & Induction Repair'],
    femaleRatio: 0.38,
    headlineTemplates: ['Home Appliance & PCB Repair Technician', 'Mobile Micro-Soldering & Electronics Specialist', 'RO Purifier & Washing Machine Service Tech'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years doorstep appliance and electronics repair in ${city} covering ${s1} and ${s2}.`,
  },
  {
    category: 'HVAC & Refrigeration',
    baseWage: 900,
    skills: ['Split & Inverter AC Installation', 'R32/R410A Refrigerant Charging & Brazing', 'Commercial Cold-Room Maintenance', 'AC Jet-Pump Deep Servicing', 'Thermostat & Compressor Diagnostics'],
    femaleRatio: 0.20,
    headlineTemplates: ['Inverter AC & Refrigeration Technician', 'Commercial HVAC & Cold-Storage Mechanic', 'Split/Cassette AC Installation Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years cooling and refrigeration maintenance across ${city}, proficient in ${s1} and ${s2}.`,
  },
  {
    category: 'Masonry & Tiling',
    baseWage: 780,
    skills: ['Large-Format Vitrified & Granite Tiling', 'Epoxy Grouting & Laser Leveling', 'RCC Brickwork & Smooth Plastering', 'Bathroom Slope & Waterproof Screeding', 'Stone Cladding & Paving'],
    femaleRatio: 0.22,
    headlineTemplates: ['Precision Tile, Granite & Masonry Craftsman', 'Civil Brickwork & Laser-Level Tile Specialist', 'Architectural Stone & Flooring Mason'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years civil masonry and precision tiling in ${city} delivering ${s1} and ${s2}.`,
  },
  {
    category: 'Painting & Waterproofing',
    baseWage: 710,
    skills: ['Interior Royal Emulsion & Texture Finish', 'Dust-Free Mechanized Sanding & Putty', 'Terrace & Bathroom Polymer Waterproofing', 'PU Wood Polish & Duco Spray', 'Exterior Crack Seal & Weather Coat'],
    femaleRatio: 0.26,
    headlineTemplates: ['Decorative Wall Texture & Waterproofing Painter', 'Mechanized Interior & PU Polish Specialist', 'Terrace Damp-Proofing & Exterior Coating Tech'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years clean architectural painting and damp-proofing in ${city}, skilled in ${s1} and ${s2}.`,
  },
  {
    category: 'Agriculture, Drip Irrigation & Nursery',
    baseWage: 690,
    skills: ['Inline Drip & Sprinkler Irrigation Setup', 'Polyhouse & Shade-Net Crop Management', 'Fruit Orchard Grafting & Pruning', 'Agri-Drone Spraying & Soil Sampling', 'Vermicompost & Organic Nursery Care'],
    femaleRatio: 0.54,
    headlineTemplates: ['Drip Irrigation & Polyhouse Agri-Technician', 'Orchard Grafting & Precision Farming Specialist', 'Certified Agri-Drone & Nursery Operator'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years modern horticulture and farm-tech field work in ${city}, specializing in ${s1} and ${s2}.`,
  },
  {
    category: 'CNC, Lathe & Industrial Machining',
    baseWage: 940,
    skills: ['CNC Turning & VMC Programming Basics', 'Vernier, Micrometer & Gauge QA Inspection', 'Conventional Lathe & Milling Operation', 'Sheet-Metal Press Brake Setup', 'Tooling Offset & Surface Tolerance Control'],
    femaleRatio: 0.30,
    headlineTemplates: ['CNC / VMC Machine Operator & QA Inspector', 'MIDC Precision Lathe & Milling Machinist', 'Industrial Tool-Room & Quality Technician'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years MIDC shop-floor machining and quality inspection in ${city} executing ${s1} and ${s2}.`,
  },
  {
    category: 'Retail Billing, Data Entry & Inventory',
    baseWage: 730,
    skills: ['Tally Prime & GST Invoice Entry', 'POS Barcode Billing & Cash Reconciliation', 'Marathi/Hindi/English Fast Typing', 'Warehouse Stock Audit & Excel Tracking', 'Customer Helpdesk & Order Dispatch'],
    femaleRatio: 0.68,
    headlineTemplates: ['Tally GST Billing & Inventory Executive', 'Multilingual Data Entry & POS Operator', 'Store Stock Audit & Back-Office Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years accurate billing, inventory, and digital office operations in ${city} handling ${s1} and ${s2}.`,
  },
  {
    category: 'Commercial Driving, Delivery & Logistics',
    baseWage: 800,
    skills: ['LMV / Commercial Tempo Defensive Driving', 'Cold-Chain & Fragile Cargo Handling', 'EV Cargo Three-Wheeler Operation', 'GPS Route Optimization & E-Way Bill Check', 'Chauffeur Etiquette & Vehicle Inspection'],
    femaleRatio: 0.24,
    headlineTemplates: ['Verified Commercial LMV & EV Fleet Driver', 'Executive Chauffeur & Intercity Logistics Partner', 'Last-Mile Delivery & Cold-Chain Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years accident-free commercial driving and logistics across ${city}, experienced in ${s1} and ${s2}.`,
  },
  {
    category: 'Housekeeping & Facility Sanitization',
    baseWage: 650,
    skills: ['Mechanized Floor Scrubbing & Buffing', 'Sofa, Carpet & Mattress Shampoo Extraction', 'Overhead Water Tank UV Sanitization', 'Hospital & Office Deep Disinfection', 'Eco-Safe Chemical Dilution'],
    femaleRatio: 0.62,
    headlineTemplates: ['Deep Cleaning & Mechanized Housekeeping Specialist', 'Commercial Facility & Tank Sanitization Tech', 'Upholstery Extraction & Hygiene Supervisor'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years professional residential and corporate deep-cleaning in ${city}, trained in ${s1} and ${s2}.`,
  },
  {
    category: 'Photography, Videography & Event Rigging',
    baseWage: 960,
    skills: ['Wedding & Event Candid Photography', 'LED Wall, Truss & Stage Sound Rigging', 'Drone Aerial Videography & Gimbal Work', 'Photo Color Grading & Album Layout', 'Live-Stream Multi-Cam Switching'],
    femaleRatio: 0.44,
    headlineTemplates: ['Event Photographer, Videographer & AV Tech', 'Stage Sound, LED Wall & Lighting Rigger', 'Drone Cinematographer & Studio Editor'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years visual media and live-event production in ${city} delivering ${s1} and ${s2}.`,
  },
  {
    category: 'Security, Fire Safety & Facility Guard',
    baseWage: 720,
    skills: ['Fire Hydrant, Extinguisher & Drill Compliance', 'Visitor Access Control & CCTV Monitoring', 'Industrial Gate Material Inward/Outward Log', 'First-Aid & Emergency Evacuation Response', 'Female Visitor Screening & Event Security'],
    femaleRatio: 0.38,
    headlineTemplates: ['PSARA-Trained Security & Fire Safety Officer', 'Corporate Access Control & Safety Guard', 'Event & Residential Society Security Specialist'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years disciplined site security and fire-safety operations in ${city} trained in ${s1} and ${s2}.`,
  },
  {
    category: 'Pottery, Ceramic & Eco-Sculpture Craft',
    baseWage: 760,
    skills: ['Potter Wheel Throwing & Terracotta Shaping', 'Ceramic Glazing & Kiln Firing', 'Eco-Friendly Shadu Clay Idol Sculpting', 'Decorative Mural & Relief Work', 'Custom Planter & Tableware Production'],
    femaleRatio: 0.56,
    headlineTemplates: ['Terracotta, Ceramic & Eco-Clay Master Artisan', 'Studio Potter & Architectural Mural Sculptor', 'Traditional & Contemporary Clay Craftsperson'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years ceramic and eco-clay artistry in ${city}, crafting ${s1} and ${s2}.`,
  },
  {
    category: 'Fitness, Yoga & Physiotherapy Wellness',
    baseWage: 920,
    skills: ['Therapeutic Yoga & Pranayama Instruction', 'Post-Injury Mobility & Rehab Exercises', 'Prenatal & Senior Citizen Wellness Coaching', 'Sports Stretching & Ergonomic Guidance', 'Group Community Wellness Sessions'],
    femaleRatio: 0.60,
    headlineTemplates: ['Certified Yoga & Mobility Wellness Instructor', 'Home Rehab & Senior Fitness Specialist', 'Holistic Therapeutic Yoga Coach'],
    bioTemplate: (exp, city, s1, s2) => `${exp} years certified wellness and mobility coaching in ${city}, guiding clients in ${s1} and ${s2}.`,
  },
];

const CITIES_WITH_COORDS: Array<{ city: string; coords: [number, number]; lang: 'mr' | 'hi' | 'en' }> = [
  { city: 'Latur', coords: [76.5604, 18.4088], lang: 'mr' },
  { city: 'Pune', coords: [73.8567, 18.5204], lang: 'mr' },
  { city: 'Mumbai', coords: [72.8777, 19.076], lang: 'hi' },
  { city: 'Navi Mumbai', coords: [73.0297, 19.033], lang: 'en' },
  { city: 'Thane', coords: [72.9781, 19.2183], lang: 'mr' },
  { city: 'Nagpur', coords: [79.0882, 21.1458], lang: 'hi' },
  { city: 'Nashik', coords: [73.7898, 19.9975], lang: 'mr' },
  { city: 'Chhatrapati Sambhajinagar', coords: [75.3433, 19.8762], lang: 'mr' },
  { city: 'Solapur', coords: [75.9064, 17.6599], lang: 'mr' },
  { city: 'Kolhapur', coords: [74.2433, 16.705], lang: 'mr' },
  { city: 'Nanded', coords: [77.321, 19.1383], lang: 'mr' },
  { city: 'Satara', coords: [74.0009, 17.6805], lang: 'mr' },
  { city: 'Sangli', coords: [74.5815, 16.8524], lang: 'mr' },
  { city: 'Amravati', coords: [77.7523, 20.932], lang: 'hi' },
  { city: 'Akola', coords: [77.0082, 20.7002], lang: 'mr' },
  { city: 'Ahmednagar', coords: [74.748, 19.0948], lang: 'mr' },
  { city: 'Jalgaon', coords: [75.5626, 21.0077], lang: 'mr' },
  { city: 'Ratnagiri', coords: [73.312, 16.9902], lang: 'mr' },
];

const FEMALE_FIRST_NAMES = [
  'Sunita', 'Anjali', 'Snehal', 'Kavita', 'Savita', 'Vaishali', 'Rohini', 'Pallavi', 'Meenakshi', 'Swati',
  'Archana', 'vandana'.replace('v', 'V'), 'rupa'.replace('r', 'R'), 'Deepali', 'Poonam', 'Shubhangi', 'ashwini'.replace('a', 'A'),
  'Neha', 'Madhuri', 'Jyoti', 'Rekha', 'kalpana'.replace('k', 'K'), 'Ujwala', 'Supriya', 'Tejaswini', 'Bhagyashree',
  'Pranali', 'Manisha', 'ratna'.replace('r', 'R'), 'Chhaya', 'Shabnam', 'Farzana', 'Yasmin', 'Geeta', 'Seema',
  'Asha', 'Lata', 'Komal', 'Nikita', 'Rutuja', 'Mayuri', 'Gayatri', 'Nंदिनी'.replace('Nंदिनी', 'Nandini'), 'Aparna',
  'Suvarna', 'Sharda', 'Vidya', 'Smita', 'Sonali', 'Yogita',
];

const MALE_FIRST_NAMES = [
  'Rajesh', 'Mahesh', 'Ganesh', 'Suresh', 'Dinesh', 'Prakash', 'Santosh', 'Sachin', 'Nilesh', 'Amol',
  'Vikas', 'pravin'.replace('p', 'P'), 'Kiran', 'Yogesh', 'Rohan', 'Sagar', 'Tushar', 'Swapnil', 'Omkar', 'Akshay',
  'datta'.replace('d', 'D'), 'Balaji', 'Govind', 'Narayan', 'Kailas', 'Vitthal', 'mangesh'.replace('m', 'M'), 'Dipak', 'vinod'.replace('v', 'V'), 'Anil',
  'Irfan', 'Salim', 'Rizwan', 'Imran', 'Rafiq', 'Gurpreet', 'Harish', 'Manoj', 'Pंकज'.replace('Pंकज', 'Pankaj'), 'Rahul',
  'Vishal', 'Shrikant', 'Somnath', 'Nagnath', 'Siddharth', 'Milind', 'kishor'.replace('k', 'K'), 'subhash'.replace('s', 'S'), 'Arjun', 'Prशांत'.replace('Prशांत', 'Prashant'),
];

const LAST_NAMES = [
  'Kulkarni', 'Jadhav', 'Patil', 'Shinde', 'Pawar', 'Deshmukh', 'Kale', 'Gaikwad', 'Chavan', 'More',
  'Bhosale', 'Kadam', 'Sawant', 'Joshi', 'Deshpande', 'Salunkhe', 'Mane', 'suryawanshi'.replace('s', 'S'), 'Biradar', 'kamble'.replace('k', 'K'),
  'Shaikh', 'Pathan', 'Sayyad', 'Ansari', 'waghmare'.replace('w', 'W'), 'Sonawane', 'nikam'.replace('n', 'N'), 'Jagtap', 'Thorat', 'Ghorpade',
  'Munde', 'phule'.replace('p', 'P'), 'Lokhande', 'Mali', 'Kumbhar', 'Sutar', 'Lohar', 'Shimpi', 'Bhalerao', 'Shirke',
];

function deterministicRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export async function ensureWorkforcePopulation(targetCount = 500): Promise<void> {
  // 1. Backfill gender on original 4 seeded workers if missing
  const initialUsers = await db.find('users', { role: 'worker' });
  for (const u of initialUsers) {
    if (!u.gender) {
      const inferredGender = u.name.startsWith('Priya') ? 'Female' : 'Male';
      await db.updateOne('users', { _id: u._id }, { gender: inferredGender });
      await db.updateOne('worker_profiles', { userId: u._id }, { gender: inferredGender });
    }
  }

  const currentWorkerCount = await db.count('worker_profiles');
  if (currentWorkerCount >= targetCount) {
    return;
  }

  const now = new Date().toISOString();
  // Pre-compute one bcrypt hash for all generated demo accounts so seeding 496 workers takes < 50ms!
  const sharedDemoHash = await bcrypt.hash('Demo@123', 8);

  // 2. Ensure all skills from UNRESTRICTED_TRADE_CATALOG exist in `skills` collection
  const existingSkillDocs = await db.find('skills');
  const existingSkillNames = new Set(existingSkillDocs.map((s) => s.name));
  const newSkillsToInsert: any[] = [];
  for (const entry of UNRESTRICTED_TRADE_CATALOG) {
    for (const skName of entry.skills) {
      if (!existingSkillNames.has(skName)) {
        existingSkillNames.add(skName);
        newSkillsToInsert.push({
          name: skName,
          category: entry.category,
          translations: {},
          createdAt: now,
        });
      }
    }
  }
  if (newSkillsToInsert.length > 0) {
    await db.insertMany('skills', newSkillsToInsert);
  }

  // 3. Seed 4 additional Trade Assessments across diverse non-construction trades if fewer than 6 exist
  const assessmentCount = await db.count('skill_assessments');
  if (assessmentCount < 6) {
    const extraAssessments = [
      {
        skillName: 'Blouse & Kurta Pattern Cutting',
        category: 'Tailoring, Boutique & Garment Craft',
        title: 'Precision Garment Pattern Drafting & Seam Allowance Assessment',
        durationMinutes: 10,
        questions: [
          {
            scenarioContext: 'Boutique Festive Silk & Cotton Lining Order',
            questionText: 'When cutting a lined cotton-silk blouse for humid weather, what pre-stitching step prevents post-wash puckering?',
            options: ['Pre-shrinking cotton lining in water and pressing flat before marking', 'Stretching fabric diagonally on bias', 'Using maximum stitch tension', 'Skipping seam allowance'],
            correctIndex: 0,
            difficultyWeight: 1.2,
            explanation: 'Cotton lining shrinks more than silk outer fabric; pre-shrinking prevents seam distortion.',
          },
          {
            scenarioContext: 'Custom Client Trial & Alteration Margin',
            questionText: 'What is the standard side-seam margin left in custom Indian boutique garments to allow client fit adjustments?',
            options: ['0.25 inch', '1.25 to 1.5 inches with three-line alteration margin', '4 inches', 'No margin needed'],
            correctIndex: 1,
            difficultyWeight: 1.0,
            explanation: '1.25–1.5 inch side allowances provide clean alteration flexibility.',
          },
        ],
      },
      {
        skillName: 'Vital Signs & Glucometer Monitoring',
        category: 'Home Healthcare, Nursing & Elder Care',
        title: 'Home Patient Care, Vital Signs & Hygiene Safety Assessment',
        durationMinutes: 10,
        questions: [
          {
            scenarioContext: 'Morning Home Diabetic & Vitals Check',
            questionText: 'Before checking capillary blood glucose with a glucometer at a patient’s home, what must you confirm after alcohol-swabbing the fingertip?',
            options: ['Prick while alcohol is still wet', 'Allow the fingertip to air-dry completely and never reuse lancets', 'Squeeze aggressively from palm', 'Use yesterday’s test strip'],
            correctIndex: 1,
            difficultyWeight: 1.3,
            explanation: 'Wet alcohol dilutes the sample and causes stinging; single-use sterile lancets prevent bloodborne infection.',
          },
          {
            scenarioContext: 'Post-Surgery Bedridden Elder Care',
            questionText: 'For a bedridden elderly patient, how often should gentle repositioning be performed to prevent pressure ulcers (bedsores)?',
            options: ['Once every 12 hours', 'Every 2 hours with pillow support at bony prominences', 'Only once a day', 'Never reposition'],
            correctIndex: 1,
            difficultyWeight: 1.2,
            explanation: 'Two-hourly turning schedules relieve capillary pressure on sacrum and heels.',
          },
        ],
      },
      {
        skillName: 'IP CCTV & NVR Installation',
        category: 'Computer, Networking & CCTV Tech',
        title: 'PoE IP Camera, Cat6 Crimping & NVR Security Assessment',
        durationMinutes: 10,
        questions: [
          {
            scenarioContext: 'Retail Warehouse PoE Camera Run',
            questionText: 'What is the maximum recommended horizontal run length for a standard Cat6 PoE Ethernet cable to an IP camera without a PoE extender?',
            options: ['25 meters', '90–100 meters', '350 meters', '500 meters'],
            correctIndex: 1,
            difficultyWeight: 1.2,
            explanation: 'IEEE 802.3 Ethernet/PoE specifies a 100-meter maximum channel length before signal/voltage drop.',
          },
          {
            scenarioContext: 'Client Mobile Remote-View Handover',
            questionText: 'Which security practice is mandatory before handing over an NVR remote-viewing app to a shop or household client?',
            options: ['Leave factory password admin/12345', 'Change default admin credentials, enable strong password & disable unused open ports', 'Share RTSP link publicly', 'Disable recording'],
            correctIndex: 1,
            difficultyWeight: 1.3,
            explanation: 'Replacing factory credentials prevents unauthorized external camera access.',
          },
        ],
      },
      {
        skillName: 'EV Two-Wheeler Controller & BMS Check',
        category: 'Automotive & EV Mechanics',
        title: 'Electric Two-Wheeler High-Voltage Isolation & BMS Diagnostics',
        durationMinutes: 10,
        questions: [
          {
            scenarioContext: '48V–72V Traction Battery Bench Service',
            questionText: 'Before disconnecting a 48V–72V traction battery pack or motor controller on an electric scooter, what is the first step?',
            options: ['Spray water on terminals', 'Turn ignition OFF, trip main MCB/isolation plug, wait for capacitor discharge & wear insulated gloves', 'Cut orange cable', 'Short terminals with wrench'],
            correctIndex: 1,
            difficultyWeight: 1.4,
            explanation: 'Isolating main breaker and allowing controller bus capacitors to discharge prevents DC arc flash.',
          },
          {
            scenarioContext: 'Intermittent Power Cut Under Gradient Load',
            questionText: 'If an EV scooter cuts power under climb load while showing 60% SOC, what commonly triggers the BMS cutoff?',
            options: ['Low tire shine', 'Weak/unbalanced cell group dropping below under-voltage threshold under load', 'Headlight bulb wattage', 'Mirror angle'],
            correctIndex: 1,
            difficultyWeight: 1.2,
            explanation: 'Cell imbalance causes a single weak series group to hit LVC under high current draw.',
          },
        ],
      },
    ];

    for (const item of extraAssessments) {
      const aDoc = await db.insertOne('skill_assessments', {
        skillName: item.skillName,
        category: item.category,
        title: item.title,
        durationMinutes: item.durationMinutes,
        passingScore: 60,
        createdAt: now,
      });
      const qDocs = item.questions.map((q) => ({
        assessmentId: aDoc._id,
        ...q,
      }));
      await db.insertMany('assessment_questions', qDocs);
    }
  }

  // 4. Generate remaining workers up to `targetCount` (500 total workers, ~50% Women, ~50% Men)
  const needed = targetCount - currentWorkerCount;
  const usersBatch: any[] = [];
  const profilesBatch: any[] = [];
  const skillsBatch: any[] = [];
  const repBatch: any[] = [];
  const passportsBatch: any[] = [];
  const availBatch: any[] = [];

  // Featured named showcase workers with newly generated portraits first
  const featuredConfigs: Array<{
    firstName: string;
    lastName: string;
    gender: 'Female' | 'Male';
    avatarKey: string;
    tradeIdx: number;
    cityIdx: number;
    exp: number;
    completedJobs: number;
  }> = [
    { firstName: 'Sunita', lastName: 'Shinde', gender: 'Female', avatarKey: 'tailor_woman', tradeIdx: 2, cityIdx: 1, exp: 8, completedJobs: 9 },
    { firstName: 'Anjali', lastName: 'Deshpande', gender: 'Female', avatarKey: 'nurse_woman', tradeIdx: 3, cityIdx: 0, exp: 5, completedJobs: 6 },
    { firstName: 'Snehal', lastName: 'Pawar', gender: 'Female', avatarKey: 'it_woman', tradeIdx: 4, cityIdx: 2, exp: 4, completedJobs: 5 },
    { firstName: 'Rajesh', lastName: 'Gaikwad', gender: 'Male', avatarKey: 'mechanic_man', tradeIdx: 9, cityIdx: 6, exp: 9, completedJobs: 11 },
  ];

  const existingEmails = new Set((await db.find('users')).map((u) => u.email));

  for (let i = 0; i < needed; i++) {
    const seq = currentWorkerCount + i + 1; // e.g., 5 .. 500
    const feat = i < featuredConfigs.length ? featuredConfigs[i] : null;

    const trade = feat
      ? UNRESTRICTED_TRADE_CATALOG[feat.tradeIdx]
      : UNRESTRICTED_TRADE_CATALOG[i % UNRESTRICTED_TRADE_CATALOG.length];

    const cityObj = feat
      ? CITIES_WITH_COORDS[feat.cityIdx]
      : CITIES_WITH_COORDS[(i * 7 + Math.floor(i / 18)) % CITIES_WITH_COORDS.length];

    // Ensure balanced overall men & women (~50/50) while respecting trade diversity (women electricians, solar techs, mechanics, tailors, nurses, IT techs, etc., and men across culinary, tailoring, healthcare, trades!)
    const isFemale = feat
      ? feat.gender === 'Female'
      : i % 2 === 0
        ? true
        : deterministicRand(seq * 13) < trade.femaleRatio * 0.45;
    const gender: 'Female' | 'Male' = isFemale ? 'Female' : 'Male';

    const fName = feat
      ? feat.firstName
      : gender === 'Female'
        ? FEMALE_FIRST_NAMES[(i * 3 + Math.floor(i / 7)) % FEMALE_FIRST_NAMES.length]
        : MALE_FIRST_NAMES[(i * 5 + Math.floor(i / 9)) % MALE_FIRST_NAMES.length];
    const lName = feat
      ? feat.lastName
      : LAST_NAMES[(i * 11 + Math.floor(i / 5)) % LAST_NAMES.length];

    const fullName = `${fName} ${lName}`;
    let emailSlug = `${fName.toLowerCase()}.${lName.toLowerCase()}.${seq}@demo.kaushalsetu.in`;
    if (feat && !existingEmails.has(`${fName.toLowerCase()}.${lName.toLowerCase()}@demo.kaushalsetu.in`)) {
      emailSlug = `${fName.toLowerCase()}.${lName.toLowerCase()}@demo.kaushalsetu.in`;
    }
    existingEmails.add(emailSlug);

    // Unique 10-digit Indian mobile per worker (avoids false duplicate-phone fraud flags)
    const phone = `94${String(20000000 + seq * 137).slice(0, 8)}`;

    // Spread coordinates realistically within ~5.5km around city center
    const angle = deterministicRand(seq * 17) * Math.PI * 2;
    const radiusDeg = 0.006 + deterministicRand(seq * 29) * 0.045;
    const coords: [number, number] = [
      Number((cityObj.coords[0] + Math.cos(angle) * radiusDeg).toFixed(5)),
      Number((cityObj.coords[1] + Math.sin(angle) * radiusDeg).toFixed(5)),
    ];

    // Experience & Fair-Opportunity newcomer mix (~28% newcomers with 0-2 completed jobs)
    const isNewcomer = !feat && seq % 7 < 2;
    const expYears = feat
      ? feat.exp
      : isNewcomer
        ? Number((0.5 + deterministicRand(seq * 31) * 1.5).toFixed(1))
        : Math.floor(2 + deterministicRand(seq * 37) * 13);

    const completedJobsCount = feat
      ? feat.completedJobs
      : isNewcomer
        ? seq % 2
        : Math.floor(3 + deterministicRand(seq * 41) * 18);

    const repeatHiresCount = completedJobsCount >= 4 ? Math.floor(completedJobsCount * 0.35) : 0;

    // Regional wage calculation
    const cityBoost = ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune'].includes(cityObj.city) ? 1.22 : 1.0;
    const expectedDailyWage = Math.round(((trade.baseWage * cityBoost) + expYears * 28) / 10) * 10;

    const availRoll = seq % 10;
    const availabilityStatus = availRoll < 7 ? 'available' : availRoll < 9 ? 'part_time' : 'busy';

    const userId = newObjectId();
    usersBatch.push({
      _id: userId,
      name: fullName,
      email: emailSlug,
      passwordHash: sharedDemoHash,
      phone,
      gender,
      role: 'worker',
      city: cityObj.city,
      preferredLanguage: cityObj.lang,
      status: 'active',
      isDemo: true,
      createdAt: now,
    });

    const headlineBase = trade.headlineTemplates[seq % trade.headlineTemplates.length];
    const s1 = trade.skills[seq % trade.skills.length];
    const s2 = trade.skills[(seq + 1) % trade.skills.length];
    const s3 = trade.skills[(seq + 2) % trade.skills.length];
    const s4 = trade.skills[(seq + 3) % trade.skills.length];

    profilesBatch.push({
      _id: newObjectId(),
      userId,
      gender,
      category: trade.category,
      avatarKey: feat ? feat.avatarKey : '',
      headline: `${headlineBase} (${expYears} Yrs Exp)`,
      bio: trade.bioTemplate(expYears, cityObj.city, s1, s2),
      experienceYears: expYears,
      expectedDailyWage,
      maxTravelKm: 15 + (seq % 25),
      city: cityObj.city,
      exactAddress: `Ward ${(seq % 18) + 1}, ${cityObj.city}, Maharashtra (Protected)`,
      location: { type: 'Point', coordinates: coords },
      publicLocation: { type: 'Point', coordinates: fuzzCoordinates(coords) },
      availabilityStatus,
      completedJobsCount,
      repeatHiresCount,
      emergencyContact: {
        name: `Family Emergency Contact (${lName})`,
        relation: 'Family',
        phone: `98${String(10000000 + seq * 193).slice(0, 8)}`,
      },
      portfolioItems: [
        {
          title: `${s1} Execution — Residential & Commercial Client`,
          location: cityObj.city,
          year: '2026',
        },
      ],
      adminIdentityVerified: false,
      isDemo: true,
      createdAt: now,
    });

    // Pick 3-4 skills with realistic separation of 'assessed' vs 'self_declared'
    // (Never falsely mark unverified demo profiles as 'admin_verified' unless backed by approved cert)
    const primaryProf = expYears >= 8 ? 'Expert' : expYears >= 4 ? 'Advanced' : expYears >= 1.5 ? 'Intermediate' : 'Beginner';
    const secProf = expYears >= 6 ? 'Advanced' : 'Intermediate';

    const workerSkillDocs = [
      {
        _id: newObjectId(),
        workerId: userId,
        name: s1,
        category: trade.category,
        proficiency: primaryProf,
        verificationType: seq % 5 === 0 ? 'self_declared' : 'assessed',
        assessmentScore: seq % 5 === 0 ? undefined : Math.round(74 + deterministicRand(seq * 43) * 23),
        updatedAt: now,
      },
      {
        _id: newObjectId(),
        workerId: userId,
        name: s2,
        category: trade.category,
        proficiency: secProf,
        verificationType: seq % 3 === 0 ? 'assessed' : 'self_declared',
        assessmentScore: seq % 3 === 0 ? Math.round(70 + deterministicRand(seq * 47) * 24) : undefined,
        updatedAt: now,
      },
      {
        _id: newObjectId(),
        workerId: userId,
        name: s3,
        category: trade.category,
        proficiency: 'Intermediate',
        verificationType: 'self_declared',
        updatedAt: now,
      },
    ];
    if (seq % 2 === 0 && s4 !== s1) {
      workerSkillDocs.push({
        _id: newObjectId(),
        workerId: userId,
        name: s4,
        category: trade.category,
        proficiency: secProf,
        verificationType: 'self_declared',
        updatedAt: now,
      });
    }
    skillsBatch.push(...workerSkillDocs);

    // Bayesian Fair-Start baseline (~73–77) for newcomers; calibrated 79–96.5 for experienced workers
    const overallScore = isNewcomer
      ? Number((72.5 + deterministicRand(seq * 53) * 5.2).toFixed(1))
      : Number((79.0 + Math.min(17.5, expYears * 0.9 + deterministicRand(seq * 59) * 6.5)).toFixed(1));

    repBatch.push({
      _id: newObjectId(),
      workerId: userId,
      overallScore,
      qualityScore: Number(Math.min(99, overallScore + 1.2).toFixed(1)),
      reliabilityScore: Number(Math.min(99, overallScore + 0.6).toFixed(1)),
      punctualityScore: Number(Math.max(70, overallScore - 0.8).toFixed(1)),
      satisfactionScore: Number(Math.min(99, overallScore + 0.9).toFixed(1)),
      skillProficiencyScore: Number(Math.min(98, overallScore + 1.5).toFixed(1)),
      isFairStartBaseline: isNewcomer,
      explanation: isNewcomer
        ? 'Fair-Start Baseline active: Newcomer initialized with Bayesian neutral prior plus skill assessment weight (Demo Profile).'
        : `Calculated across ${completedJobsCount} completed jobs, ${repeatHiresCount} repeat hires, and assessed skills in ${trade.category} (Demo Profile).`,
      history: [
        { date: '2026-08-01', score: 72.0, event: 'Fair-Start Baseline Initialized' },
        { date: '2026-10-15', score: overallScore, event: isNewcomer ? `Assessed in ${s1}` : `Verified ${trade.category} Track Record` },
      ],
      updatedAt: now,
    });

    passportsBatch.push({
      _id: newObjectId(),
      workerId: userId,
      passportCode: `KS-MH-2026-${String(2000 + seq)}`,
      issuedAt: now,
      lastSyncedAt: now,
    });

    availBatch.push({
      _id: newObjectId(),
      workerId: userId,
      availableDates: ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'],
      unavailableDates: [],
      workingHours: { start: '09:00', end: '18:00' },
      updatedAt: now,
    });
  }

  await db.insertMany('users', usersBatch);
  await db.insertMany('worker_profiles', profilesBatch);
  await db.insertMany('worker_skills', skillsBatch);
  await db.insertMany('reputation_scores', repBatch);
  await db.insertMany('skill_passports', passportsBatch);
  await db.insertMany('worker_availability', availBatch);

  // 5. Seed diverse Open & Emergency Jobs across non-construction + technical + care + craft trades if < 18 jobs exist
  const currentJobsCount = await db.count('jobs');
  if (currentJobsCount < 18) {
    const employers = await db.find('users', { role: 'employer' });
    const empA = employers[0] || { _id: newObjectId(), name: 'Deshmukh Infra & Services' };
    const empB = employers[1] || empA;

    const diverseJobs = [
      {
        employerId: empB._id,
        employerName: 'Arogya Seva Home Care Pune',
        title: 'Certified Female/Male Home Nursing Attendant for Post-Surgery Elder Care',
        category: 'Home Healthcare, Nursing & Elder Care',
        description: 'Need a compassionate GDA/nursing caregiver for daytime vitals monitoring, glucometer checks, medication schedule, and assisted mobility.',
        requiredSkills: ['Post-Operative Patient Care', 'Vital Signs & Glucometer Monitoring', 'Medication Schedule Management'],
        minExperienceYears: 2,
        dailyWageBudget: 950,
        durationDays: 14,
        city: 'Pune',
        location: { type: 'Point', coordinates: [73.8412, 18.5142] },
        isEmergency: true,
        status: 'open',
      },
      {
        employerId: empA._id,
        employerName: 'Shree Laxmi Boutique & Apparel Studio',
        title: 'Master Boutique Tailor for Festive Blouse, Kurta & Bridal Lehenga Finishing',
        category: 'Tailoring, Boutique & Garment Craft',
        description: 'Immediate requirement for precision pattern cutter and master stitcher for festive season custom orders.',
        requiredSkills: ['Blouse & Kurta Pattern Cutting', 'Bridal Lehenga & Gown Alteration', 'Industrial Overlock & Pico Stitching'],
        minExperienceYears: 3,
        dailyWageBudget: 850,
        durationDays: 10,
        city: 'Latur',
        location: { type: 'Point', coordinates: [76.5581, 18.4125] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empB._id,
        employerName: 'NetSecure Retail Systems',
        title: '8-Channel PoE IP CCTV, Biometric Attendance & Cat6 Structured Cabling',
        category: 'Computer, Networking & CCTV Tech',
        description: 'Install 8 dome/bullet PoE cameras, configure NVR mobile remote security, and terminate Cat6 patch panel for retail showroom.',
        requiredSkills: ['IP CCTV & NVR Installation', 'LAN Structured Cabling & Router Config', 'Biometric Attendance Setup'],
        minExperienceYears: 1,
        dailyWageBudget: 1050,
        durationDays: 3,
        city: 'Mumbai',
        location: { type: 'Point', coordinates: [72.8691, 19.1136] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empA._id,
        employerName: 'Annapurna Festive Catering & Millet Kitchen',
        title: 'Hygienic Catering Chef & Millet Bakery Specialist for 200-Guest Wedding Event',
        category: 'Culinary, Catering & Bakery',
        description: 'Prepare traditional Maharashtrian thali menu, puran poli live counter, and FSSAI-compliant hygienic prep.',
        requiredSkills: ['Maharashtrian & North Indian Catering', 'FSSAI Kitchen Hygiene & Prep', 'Event Live-Counter Cooking'],
        minExperienceYears: 2,
        dailyWageBudget: 950,
        durationDays: 2,
        city: 'Kolhapur',
        location: { type: 'Point', coordinates: [74.2398, 16.7012] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empB._id,
        employerName: 'GreenVolt EV Mobility Care',
        title: 'EV Two-Wheeler BMS Diagnostics & Periodic Brake/Motor Service Technician',
        category: 'Automotive & EV Mechanics',
        description: 'Diagnose lithium battery cell balance, controller hall-sensor faults, and hydraulic disc brakes at EV hub.',
        requiredSkills: ['EV Two-Wheeler Controller & BMS Check', 'OBD-II Engine Diagnostics', 'Auto Electrical & Alternator Repair'],
        minExperienceYears: 1,
        dailyWageBudget: 980,
        durationDays: 6,
        city: 'Nashik',
        location: { type: 'Point', coordinates: [73.7812, 19.9918] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empA._id,
        employerName: 'Royal Bridal & Wellness Studio',
        title: 'Certified Bridal Makeup Artist, Nauvari Saree Drapist & Mehendi Specialist',
        category: 'Beauty, Salon & Bridal Styling',
        description: 'Two-day wedding booking requiring HD bridal makeup, traditional Nauvari draping, and bridal mehendi.',
        requiredSkills: ['HD Bridal Makeup & Hair Styling', 'Nauvari & Traditional Saree Draping', 'Intricate Bridal Mehendi Artistry'],
        minExperienceYears: 2,
        dailyWageBudget: 1200,
        durationDays: 2,
        city: 'Chhatrapati Sambhajinagar',
        location: { type: 'Point', coordinates: [75.3391, 19.8725] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empB._id,
        employerName: 'Paithani Heritage Artisan Co-op',
        title: 'Handloom Silk Zari Weaver & Aari/Zardosi Surface Embroidery Artisan',
        category: 'Handloom, Embroidery & Artisan Craft',
        description: 'Craft heirloom handloom borders and intricate Aari/Zardosi motifs with fair daily craft wage.',
        requiredSkills: ['Handloom Paithani & Silk Weaving', 'Aari, Zardosi & Mirror Embroidery'],
        minExperienceYears: 2,
        dailyWageBudget: 880,
        durationDays: 12,
        city: 'Solapur',
        location: { type: 'Point', coordinates: [75.9102, 17.6641] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empA._id,
        employerName: 'KrishiMitra Agro Farms',
        title: '4-Acre Inline Drip Irrigation, Venturi Fertigation & Orchard Pruning Setup',
        category: 'Agriculture, Drip Irrigation & Nursery',
        description: 'Lay 16mm inline drip laterals, sand/screen filter assembly, and pomegranate canopy pruning.',
        requiredSkills: ['Inline Drip & Sprinkler Irrigation Setup', 'Fruit Orchard Grafting & Pruning'],
        minExperienceYears: 1,
        dailyWageBudget: 760,
        durationDays: 5,
        city: 'Latur',
        location: { type: 'Point', coordinates: [76.5812, 18.3955] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empB._id,
        employerName: 'Deccan Precision MIDC Engineering',
        title: 'CNC Turning Operator & Micrometer/Vernier Quality Inspector',
        category: 'CNC, Lathe & Industrial Machining',
        description: 'Day-shift CNC batch machining of automotive shafts with ±0.02mm tolerance inspection.',
        requiredSkills: ['CNC Turning & VMC Programming Basics', 'Vernier, Micrometer & Gauge QA Inspection'],
        minExperienceYears: 2,
        dailyWageBudget: 1100,
        durationDays: 15,
        city: 'Pune',
        location: { type: 'Point', coordinates: [73.8155, 18.6298] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empA._id,
        employerName: 'Mahalaxmi Supermart & Wholesale',
        title: 'Tally Prime GST Billing, Barcode POS & Stock Audit Executive',
        category: 'Retail Billing, Data Entry & Inventory',
        description: 'Reconcile GST purchase invoices, update barcode inventory master, and manage daily POS closing.',
        requiredSkills: ['Tally Prime & GST Invoice Entry', 'POS Barcode Billing & Cash Reconciliation', 'Warehouse Stock Audit & Excel Tracking'],
        minExperienceYears: 1,
        dailyWageBudget: 800,
        durationDays: 10,
        city: 'Nagpur',
        location: { type: 'Point', coordinates: [79.0812, 21.1498] },
        isEmergency: false,
        status: 'open',
      },
      {
        employerId: empB._id,
        employerName: 'CoolCare Commercial Services',
        title: 'URGENT: Cold-Storage & Split Inverter AC Compressor/Gas Leak Repair',
        category: 'HVAC & Refrigeration',
        description: 'Same-day emergency nitrogen pressure test, brazing, and R32 refrigerant recharge for dairy cold room.',
        requiredSkills: ['Split & Inverter AC Installation', 'R32/R410A Refrigerant Charging & Brazing', 'Commercial Cold-Room Maintenance'],
        minExperienceYears: 2,
        dailyWageBudget: 1150,
        durationDays: 1,
        city: 'Thane',
        location: { type: 'Point', coordinates: [72.9715, 19.2122] },
        isEmergency: true,
        status: 'open',
      },
      {
        employerId: empA._id,
        employerName: 'Vatsalya Family Care',
        title: 'Verified Infant Daycare & Postnatal Mother-Baby Care Specialist',
        category: 'Childcare & Domestic Management',
        description: 'Daytime infant care, sterilization hygiene, and nutritious postnatal meal preparation for young family.',
        requiredSkills: ['Infant & Toddler Daycare Safety', 'Newborn Japa & Postnatal Mother Care', 'Nutritious Meal Preparation'],
        minExperienceYears: 2,
        dailyWageBudget: 820,
        durationDays: 20,
        city: 'Navi Mumbai',
        location: { type: 'Point', coordinates: [73.0255, 19.0385] },
        isEmergency: false,
        status: 'open',
      },
    ];

    const jobDocs = diverseJobs.map((j) => ({
      ...j,
      responsibilities: [
        `Execute ${j.requiredSkills[0]} to verified trade quality standards`,
        'Follow workplace safety, hygiene, and transparent daily milestone reporting',
      ],
      deadline: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      isDemo: true,
      createdAt: now,
    }));
    await db.insertMany('jobs', jobDocs);
  }

  // 6. Seed additional inclusive Community Learning Resources if < 10 exist
  const resCount = await db.count('learning_resources');
  if (resCount < 10) {
    const extraResources = [
      {
        title: 'Boutique Garment Pattern Grading, Dart Manipulation & Alteration Mastery',
        category: 'Tailoring, Boutique & Garment Craft',
        targetSkill: 'Blouse & Kurta Pattern Cutting',
        language: 'Marathi',
        provider: 'Apparel Made-Ups & Home Furnishing Sector Skill Council',
        durationHours: 5,
        format: 'Illustrated Pattern Guide + Video',
        summary: 'Learn commercial measurement charts, shoulder-drop corrections, and clean overlock seam finishing.',
        createdAt: now,
      },
      {
        title: 'Home Geriatric Care, Glucometer/BP Monitoring & Infection Control SOP',
        category: 'Home Healthcare, Nursing & Elder Care',
        targetSkill: 'Vital Signs & Glucometer Monitoring',
        language: 'Hindi',
        provider: 'Healthcare Sector Skill Council (HSSC) Open Module',
        durationHours: 6,
        format: 'Clinical Field Checklist + Audio',
        summary: 'Covers safe patient transfer ergonomics, vital charting, bedsore prevention, and emergency escalation.',
        createdAt: now,
      },
      {
        title: 'IP CCTV PoE Networking, Cat6 RJ45 Termination & Cyber-Safe NVR Setup',
        category: 'Computer, Networking & CCTV Tech',
        targetSkill: 'IP CCTV & NVR Installation',
        language: 'English',
        provider: 'Electronics Sector Skills Council of India (ESSCI)',
        durationHours: 4,
        format: 'Hands-on Lab Guide',
        summary: 'T568B color standard, PoE power-budget math, VLAN camera isolation, and secure mobile remote access.',
        createdAt: now,
      },
      {
        title: 'EV Two-Wheeler Lithium BMS Diagnostics & High-Voltage Workshop Safety',
        category: 'Automotive & EV Mechanics',
        targetSkill: 'EV Two-Wheeler Controller & BMS Check',
        language: 'Marathi',
        provider: 'Automotive Skills Development Council (ASDC)',
        durationHours: 5,
        format: 'Technical Diagnostic Manual',
        summary: 'Safe HV isolation, BLDC hub motor hall-sensor testing, and cell-group voltage balancing.',
        createdAt: now,
      },
      {
        title: 'FSSAI Catering Hygiene, Millet Bakery & Standardized Batch Costing',
        category: 'Culinary, Catering & Bakery',
        targetSkill: 'FSSAI Kitchen Hygiene & Prep',
        language: 'Marathi',
        provider: 'Tourism & Hospitality Skill Council (FoSTaC)',
        durationHours: 3,
        format: 'Certification Prep Guide',
        summary: 'Cross-contamination prevention, cold-chain storage temperatures, and pricing tiffin/catering orders fairly.',
        createdAt: now,
      },
      {
        title: 'Tally Prime GST E-Invoicing, HSN Codes & Retail Stock Reconciliation',
        category: 'Retail Billing, Data Entry & Inventory',
        targetSkill: 'Tally Prime & GST Invoice Entry',
        language: 'English',
        provider: 'BFSI & Retail Skill Open Academy',
        durationHours: 4,
        format: 'Practical Workbook',
        summary: 'Step-by-step GSTR-1 invoice accuracy, barcode SKU mapping, and daily POS cash/UPI reconciliation.',
        createdAt: now,
      },
    ];
    await db.insertMany('learning_resources', extraResources);
  }
}
