import { db, newObjectId } from './mongoStore.ts';

export interface SkillLearningModule {
  moduleNumber: number;
  title: string;
  durationMinutes: number;
  stageLabel: string;
  objective: string;
  topics: string[];
  toolsAndMaterials: string[];
  practicalExercise: string;
  checklist: string[];
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface DomainCurriculumSpec {
  provider: string;
  standardCode: string;
  mrDomain: string;
  hiDomain: string;
  coreTools: string[];
  consumables: string[];
  safetyProtocol: string;
  measurementMethod: string;
  commonDefect: string;
  qaVerification: string;
}

const DOMAIN_SPECS: Record<string, DomainCurriculumSpec> = {
  'Electrical': {
    provider: 'Power Sector Skill Council (PSSC) & PWD Wireman Standards',
    standardCode: 'IS 732 & CEA Electrical Safety Regulations',
    mrDomain: 'इलेक्ट्रिकल व वायरिंग कौशल्य',
    hiDomain: 'इलेक्ट्रिकल एवं वायरिंग कौशल',
    coreTools: ['True-RMS Digital Multimeter', 'Insulated Combination Pliers (1000V)', 'Clamp Meter & Continuity Tester', 'Wire Stripper & Crimping Tool'],
    consumables: ['FR-LSH Copper Conductor Wire', 'HMS PVC Conduit & Saddles', 'Color-Coded Ferrules & Lugs'],
    safetyProtocol: 'Isolate main incoming MCB/MCCB, apply Lockout-Tagout, verify zero voltage between Phase-Neutral and Phase-Earth, and wear IS-rated insulated footwear.',
    measurementMethod: 'Calculate connected load current (I = P / V·cosφ), verify wire gauge ampacity, and confirm protective earth resistance below 2–5 Ohms.',
    commonDefect: 'Loose terminal lug crimping causing thermal arcing, or reversed Phase-Neutral polarity at socket outlets.',
    qaVerification: 'Perform insulation resistance (Megger) check, RCCB 30mA trip-time test, and load-balance check across phases.',
  },
  'Solar & Inverter': {
    provider: 'Skill Council for Green Jobs (SCGJ — Suryamitra)',
    standardCode: 'MNRE Rooftop PV Guidelines & IEC 62548',
    mrDomain: 'सोलर व इन्व्हर्टर तंत्रज्ञान',
    hiDomain: 'रूफटॉप सोलर एवं इन्वर्टर तकनीक',
    coreTools: ['Solar DC Clamp Meter (1000V DC)', 'MC4 Ratchet Crimping Tool', 'Digital Inclinometer & Compass', 'Torque Wrench & Insulation Tester'],
    consumables: ['UV-Resistant 4sqmm Solar DC Cable', 'IP68 MC4 Connectors', 'DC/AC Surge Protection Devices (SPD)'],
    safetyProtocol: 'Wear full-body rooftop safety harness, cover PV array or open DC isolator before breaking string connections (never disconnect MC4 under DC load).',
    measurementMethod: 'Orient modules true South at ~18°–20° tilt, verify shadow-free window (9 AM–4 PM), and match open-circuit string Voc within inverter MPPT window.',
    commonDefect: 'Cross-mated MC4 connectors or unsealed roof anchor bolts leading to DC arc faults or monsoon terrace seepage.',
    qaVerification: 'Measure string Voc and Isc, verify separate DC & AC earthing pits, and test anti-islanding shutoff during grid outage.',
  },
  'Tailoring, Boutique & Garment Craft': {
    provider: 'Apparel, Made-Ups & Home Furnishing Sector Skill Council (AMHSSC)',
    standardCode: 'NSDC Self-Employed Tailor & Boutique Pattern Standard',
    mrDomain: 'शिलाई, बुटिक व पॅटर्न कटिंग कौशल्य',
    hiDomain: 'सिलाई, बुटीक एवं पैटर्न कटिंग कौशल',
    coreTools: ['8-Inch Brass-Handle Tailoring Shears', 'French Curve, L-Scale & Hip Curve', 'High-Speed Lockstitch & 4-Thread Overlock Machine', 'Steam Press & Tailor Chalk'],
    consumables: ['Pre-Shrunk Cotton Lining (Astar)', 'Polyester Core-Spun Thread', 'Fusible Canvas Buckram & Concealed Zippers'],
    safetyProtocol: 'Verify needle guard alignment, keep fingers clear of presser-foot travel path, isolate motor switch before bobbin/needle replacement, and maintain ergonomic seating.',
    measurementMethod: 'Record 12-point body measurements (bust/chest, waist, apex-to-apex, shoulder slope, armhole depth) and add exact ease + seam allowances on brown draft paper first.',
    commonDefect: 'Shoulder drop slipping, armhole wrinkling due to improper front-scye depth, or fabric puckering from unbalanced bobbin thread tension.',
    qaVerification: 'Check grainline symmetry, stitch density (10–12 SPI), flat pressed darts, overlocked raw edges, and clean trial-fit drape.',
  },
  'Home Healthcare, Nursing & Elder Care': {
    provider: 'Healthcare Sector Skill Council (HSSC — General Duty Assistant)',
    standardCode: 'HSSC Home-Care Clinical Hygiene & Patient Safety SOP',
    mrDomain: 'गृह रुग्णसेवा, नर्सिंग व ज्येष्ठ नागरिक काळजी',
    hiDomain: 'होम हेल्थकेयर, नर्सिंग एवं बुजुर्ग देखभाल',
    coreTools: ['Calibrated Digital BP Sphygmomanometer', 'Pulse Oximeter & Capillary Glucometer', 'Infrared Thermometer', 'Patient Transfer Belt'],
    consumables: ['Sterile Single-Use Lancets & Alcohol Swabs', 'Nitrile Examination Gloves', 'Antiseptic Barrier Cream & Sterile Gauze'],
    safetyProtocol: 'Perform WHO 6-step hand sanitization, wear fresh nitrile gloves, dispose sharps/lancets in puncture-proof container, and verify doctor prescription chart before care.',
    measurementMethod: 'Seat or position patient comfortably for 5 minutes prior to BP/SpO2 reading; record timestamped vitals, fluid intake/output, and capillary glucose accurately.',
    commonDefect: 'Taking glucometer sample on wet alcohol residue, improper cuff height relative to heart level, or delayed two-hourly repositioning of bedridden patients.',
    qaVerification: 'Audit completed daily vitals logbook, verify skin integrity at pressure points, and brief family/doctor on abnormal red-flag thresholds.',
  },
  'Computer, Networking & CCTV Tech': {
    provider: 'Electronics Sector Skills Council of India (ESSCI)',
    standardCode: 'TIA/EIA-568B Structured Cabling & IEEE 802.3af/at PoE',
    mrDomain: 'संगणक हार्डवेअर, नेटवर्किंग व सीसीटीव्ही तंत्रज्ञान',
    hiDomain: 'कंप्यूटर हार्डवेयर, नेटवर्किंग एवं सीसीटीवी तकनीक',
    coreTools: ['RJ45 Pass-Through Crimper & Punch-Down Tool', 'LAN Continuity & PoE Cable Tester', 'ESD Anti-Static Wrist Strap', 'Precision Screwdriver Kit & Multimeter'],
    consumables: ['Pure Copper Cat6 UTP/STP Cable', 'Weatherproof IP66 Junction Boxes', 'Thermal Paste & Shielded RJ45 Plugs'],
    safetyProtocol: 'Wear ESD wrist protection before touching motherboards/NVRs, isolate 230V rack UPS power before PSU work, and stabilize ladders during camera mounting.',
    measurementMethod: 'Maintain Cat6 PoE channel length under 90–100m, calculate total camera wattage against PoE switch budget, and map coverage angles with zero blind spots.',
    commonDefect: 'Split-pair RJ45 pinouts causing packet loss, exposed outdoor BNC/RJ45 joints corroding in rain, or leaving default factory admin passwords on NVRs.',
    qaVerification: 'Pass 8-wire LAN continuity test, verify 24x7 NVR HDD recording retention, harden admin credentials, and test encrypted mobile remote playback.',
  },
  'Plumbing': {
    provider: 'Indian Plumbing Skills Council (IPSC)',
    standardCode: 'Uniform Illustrated Plumbing Code — India (UIPC-I) & IS 15778',
    mrDomain: 'प्लंबिंग व सॅनिटरी पाईप फिटिंग कौशल्य',
    hiDomain: 'प्लंबिंग एवं सैनिटरी पाइप फिटिंग कौशल',
    coreTools: ['Ratchet Pipe Cutter & Deburring Tool', 'Hydrostatic Hand Pressure Test Pump', 'Spirit Level & Pipe Wrench', 'PTFE Thread & Solvent Applicator'],
    consumables: ['SDR-11 CPVC Hot/Cold Pipes', 'Yellow Medium-Bodied CPVC Solvent Cement', 'Brass Threaded Inserts & EPDM Seals'],
    safetyProtocol: 'Shut off overhead/municipal main isolation valve, depressurize hot geyser lines before cutting, and wear eye protection when wall-chasing or applying solvent.',
    measurementMethod: 'Set concealed diverter mixing valve depth strictly to finished tile datum + plaster thickness, and maintain 1:48 to 1:60 drainage slope.',
    commonDefect: 'Using UPVC solvent on hot-water CPVC joints, skipping pipe deburring/chamfering, or tiling over concealed lines without pressure testing.',
    qaVerification: 'Pressurize piping to 6–10 bar for 60 minutes with zero gauge drop before plastering/tiling, and verify smooth drain flow without airlocks.',
  },
  'Carpentry': {
    provider: 'Furniture & Fittings Skill Council (FFSC)',
    standardCode: 'IS 710 Marine Plywood & 32mm Modular Cabinet System',
    mrDomain: 'सुतारकाम व मॉड्युलर फर्निचर कौशल्य',
    hiDomain: 'कारपेंट्री एवं मॉड्यूलर फर्नीचर कौशल',
    coreTools: ['Plunge Track Saw & Carbide Blade', '35mm Concealed Cup-Hinge Jig & Drill', 'Laser Cross-Line Level', 'Laminate Trimmer Router & Clamps'],
    consumables: ['IS:710 BWP Marine Plywood / HDHMR', '2mm PVC Edge Banding Tape', 'D3 Waterproof PVA / Contact Adhesive & SS304 Hinges'],
    safetyProtocol: 'Wear polycarbonate safety goggles and N95 dust mask during cutting/routing, clamp workpieces firmly, and unplug router before changing bits.',
    measurementMethod: 'Check wall plumb and floor level across 3 points using laser datum, deduct exact shutter gap tolerances (2mm), and map plumbing/electrical cutouts.',
    commonDefect: 'Unsealed sink-cutout raw plywood edges swelling from water, misaligned drawer slides binding, or air bubbles under laminate pressing.',
    qaVerification: 'Confirm uniform 2mm shutter reveal lines, 90° diagonal cabinet squareness, soft-close damper action, and waterproof silicone sealing.',
  },
  'Beauty, Salon & Bridal Styling': {
    provider: 'Beauty & Wellness Sector Skill Council (B&WSSC)',
    standardCode: 'B&WSSC Salon Hygiene, Skin Patch-Test & Cosmetology SOP',
    mrDomain: 'ब्युटी पार्लर, मेकअप व ब्रायडल स्टायलिंग',
    hiDomain: 'ब्यूटी सैलून, मेकअप एवं ब्राइडल स्टाइलिंग',
    coreTools: ['UV Sterilizer Cabinet & Professional Brush Set', 'Ceramic Ionic Hair Dryer & Tong', 'Skin Undertone Color Wheel', 'Disposable Spatulas & Draping Pins'],
    consumables: ['Dermatologically Tested Primer & HD Foundation', '70% Isopropyl Brush Sanitizer', 'Hypoallergenic Natural Henna / Skincare'],
    safetyProtocol: 'Sterilize combs, tweezers, and brushes between every client, conduct 24-hour sensitivity check for active/chemical products, and use disposable applicators for lip/eye products.',
    measurementMethod: 'Assess skin type (dry/oily/combination) and undertone (warm/neutral/cool) in natural daylight along jawline before selecting base shade or facial regimen.',
    commonDefect: 'Flashback white cast under wedding photography lighting, cakey unblended jawline transition, or loose saree pleats/hairpins during long events.',
    qaVerification: 'Check makeup oxidation stability after 15 minutes, test flash-photo appearance, confirm secure pin comfort, and share safe post-event removal care.',
  },
  'Culinary, Catering & Bakery': {
    provider: 'Tourism & Hospitality Skill Council (THSC) & FSSAI FoSTaC',
    standardCode: 'FSSAI Schedule 4 Food Hygiene & Temperature Control',
    mrDomain: 'पाककला, केटरिंग व बेकरी कौशल्य',
    hiDomain: 'पाककला, कैटरिंग एवं बेकरी कौशल',
    coreTools: ['Digital Food Probe Thermometer', 'Precision Kitchen Weighing Scale', 'Color-Coded Chopping Boards & Chef Knives', 'Commercial Convection Oven / Bhatti'],
    consumables: ['Food-Grade Hairnet, Apron & Nitrile Gloves', 'FSSAI-Certified Raw Ingredients', 'Insulated Hot/Cold Gastronorm Containers'],
    safetyProtocol: 'Enforce strict raw-vs-cooked board separation, wear hairnet/apron, inspect LPG hose/regulator with soap-solution check, and keep hot holding above 60°C.',
    measurementMethod: 'Standardize recipe gram-weights (Baker’s percentage / per-plate yield) so 10-person and 200-person batches maintain identical spice, texture, and cost accuracy.',
    commonDefect: 'Temperature danger-zone Holding (5°C–60°C) risking spoilage, inconsistent salt/moisture in bulk batches, or inaccurate per-plate raw-material costing.',
    qaVerification: 'Verify core cooking temperature (>75°C), taste-audit seasoning balance, inspect hygienic packaging seals, and label allergen/prep time.',
  },
  'Automotive & EV Mechanics': {
    provider: 'Automotive Skills Development Council (ASDC)',
    standardCode: 'AIS-038 / AIS-156 EV Traction Battery & OBD-II Service Standard',
    mrDomain: 'ऑटोमोटिव्ह व इलेक्ट्रिक वाहन (EV) दुरुस्ती',
    hiDomain: 'ऑटोमोटिव एवं इलेक्ट्रिक वाहन (EV) रिपेयर',
    coreTools: ['OBD-II Diagnostic Scanner & CAN Analyzer', '1000V Insulated EV Tool Kit', 'Calibrated Click Torque Wrench', 'Digital Multimeter & Cell Internal-Resistance Meter'],
    consumables: ['Class-0 High-Voltage Insulated Gloves', 'DOT-4 Brake Fluid & Synthetic Lubricants', 'Dielectric Grease & Heat-Shrink Sleeves'],
    safetyProtocol: 'Switch ignition OFF, pull EV High-Voltage service disconnect plug, wait 5 minutes for controller bus capacitor discharge, and support vehicles on rated axle stands.',
    measurementMethod: 'Read live OBD-II / BMS cell-group delta voltages (target <15–20mV imbalance), verify hall-sensor 5V switching pulses, and tighten fasteners to OEM Nm torque.',
    commonDefect: 'Bypassing BMS thermal sensors, over-torquing hub/caliper bolts without torque wrench, or misdiagnosing controller cutoffs caused by weak series cell groups.',
    qaVerification: 'Clear fault DTCs, verify zero warning lamps during road-load test, check brake stopping balance, and share printed/digital health readings with owner.',
  },
  'Welding & Fabrication': {
    provider: 'Capital Goods & Strategic Skill Council (CGSSC)',
    standardCode: 'IS 816 Structural Welding & AWS Hot-Work Safety',
    mrDomain: 'वेल्डिंग व मेटल फॅब्रिकेशन कौशल्य',
    hiDomain: 'वेल्डिंग एवं मेटल फैब्रिकेशन कौशल',
    coreTools: ['IGBT Inverter MIG/TIG Welding Machine', 'Auto-Darkening Welding Helmet (Shade 9–13)', 'Angle Grinder with Wheel Guard', 'Magnetic Welding Squares & Vernier Caliper'],
    consumables: ['ER70S-6 / ER308L Filler Wire & Argon Shielding Gas', 'Leather Welding Gauntlets & Apron', 'Pickling/Passivation Gel & Flap Discs'],
    safetyProtocol: 'Clear 5-meter radius of flammables, attach return earth clamp close to weld joint, wear auto-darkening shield + leather gauntlets, and ensure fume ventilation.',
    measurementMethod: 'Set shielding gas flow (10–15 L/min), match amperage/voltage to sheet thickness, and tack-weld diagonally first to confirm squareness before full seams.',
    commonDefect: 'Weld porosity from wind/contaminated base metal, heat warping on thin SS/MS frames, or undercut/slag inclusions weakening structural joints.',
    qaVerification: 'Perform visual bead uniformity & dye-penetrant check, verify diagonal dimensions within ±1mm, grind smooth burr-free corners, and apply anti-rust primer.',
  },
  'Handloom, Embroidery & Artisan Craft': {
    provider: 'Textile Sector Skill Council (TSC) & Handicrafts SSC',
    standardCode: 'GI Handloom Craft Authenticity & Textile Finishing Standard',
    mrDomain: 'हातमाग विणकाम, आरी-जरदोसी व हस्तकला',
    hiDomain: 'हथकरघा बुनाई, आरी-जरदोजी एवं हस्तशिल्प',
    coreTools: ['Wooden/Metallic Adda Embroidery Frame', 'Fine Aari/Tambour Hook Needles', 'Handloom Shuttle, Reed & Warp Beam', 'Thread Snips & Loupe Magnifier'],
    consumables: ['Pure Silk / Mercerized Cotton Warp & Zari', 'Colorfast Natural/AZO-Free Dyes', 'Tracing Butter Paper & Khaka Pin'],
    safetyProtocol: 'Maintain balanced task lighting (500+ lux) to prevent eye strain, take 5-minute wrist/neck micro-stretches hourly, and use protective thimbles.',
    measurementMethod: 'Stretch fabric drum-tight on Adda frame along true warp/weft grain, prick motif khaka evenly, and maintain uniform stitch tension & picks-per-inch.',
    commonDefect: 'Fabric puckering upon frame release, loose zari loops snagging, or color bleeding from unfixed dye washes.',
    qaVerification: 'Inspect reverse-side knot security, test rub/wash colorfastness on swatch, steam-block gently on reverse, and package with acid-free tissue.',
  },
  'Childcare & Domestic Management': {
    provider: 'Domestic Workers Sector Skill Council (DWSSC)',
    standardCode: 'DWSSC Child-Safe Home Care, Hygiene & First-Aid Standard',
    mrDomain: 'बालसंगोपन, जपा केअर व गृहव्यवस्थापन',
    hiDomain: 'शिशु देखभाल, जपा केयर एवं गृह प्रबंधन',
    coreTools: ['Steam Bottle Sterilizer & Digital Room/Bath Thermometer', 'Infant First-Aid & Choking-Response Kit', 'Baby-Safe Corner Guards', 'Daily Feeding & Sleep Log'],
    consumables: ['Food-Grade Cleansers', 'Hypoallergenic Sanitizer & Cotton Swaddles', 'Fresh Age-Appropriate Ingredients'],
    safetyProtocol: 'Never leave infants unattended on elevated surfaces or near water, test bath water at 37°C, keep small choking hazards/chemicals locked, and wash hands before handling baby.',
    measurementMethod: 'Follow parents’ written pediatric feeding/nap schedule, measure formula/milk ratios accurately, and log meal times, diaper counts, and mood cues.',
    commonDefect: 'Improper bottle sterilization, overheating milk in microwave creating hot spots, or lack of structured emergency parent/doctor contact readiness.',
    qaVerification: 'Review daily care log with parents at shift handover, confirm sanitized play/feeding zone, and maintain calm, attentive child engagement.',
  },
  'Appliance & Mobile Electronics Repair': {
    provider: 'Electronics Sector Skills Council of India (ESSCI)',
    standardCode: 'ESSCI ESD-Safe PCB Diagnostics & Home Appliance Safety SOP',
    mrDomain: 'घरगुती उपकरणे व मोबाईल पीसीबी दुरुस्ती',
    hiDomain: 'होम अप्लायंस एवं मोबाइल पीसीबी रिपेयर',
    coreTools: ['Temperature-Controlled Hot-Air Rework & Soldering Station', 'Digital Multimeter & DC Bench Power Supply', 'TDS Meter & Pressure Gauge (for RO)', 'ESD Mat & Stereo Microscope'],
    consumables: ['Lead-Free Solder Paste & Flux', 'Food-Grade RO Cartridges / OEM Seals', 'Kapton Heat Tape & Isopropyl Alcohol (99%)'],
    safetyProtocol: 'Unplug 230V appliance and discharge high-voltage microwave/SMPS capacitors safely via resistor probe before touching PCB; use ESD grounding for mobile logic boards.',
    measurementMethod: 'Trace short circuits using diode-mode voltage drop / milliamps draw on DC bench supply; measure RO input/output TDS (target 50–150 ppm mineral balance).',
    commonDefect: 'Lifted PCB copper pads from excessive hot-air heat, bypassing thermal cutouts on geysers, or unsealed water joints near appliance wiring.',
    qaVerification: 'Run full load cycle (spin/heat/cooling/charging) for 20 minutes, verify earth leakage current is zero, and demonstrate working parameters to customer.',
  },
  'HVAC & Refrigeration': {
    provider: 'Electronics & Capital Goods HVAC Skill Standards (ISHRAE/ESSCI)',
    standardCode: 'ISHRAE Refrigerant Handling, Nitrogen Brazing & R32 Safety Code',
    mrDomain: 'एसी (HVAC) व रेफ्रिजरेशन दुरुस्ती कौशल्य',
    hiDomain: 'एसी (HVAC) एवं रेफ्रिजरेशन सर्विस कौशल',
    coreTools: ['Two-Stage Rotary Vacuum Pump & Micron Gauge', 'Digital Manifold Gauge Set & Refrigerant Scale', 'Flaring & Swaging Block', 'Clamp Meter & Digital Anemometer'],
    consumables: ['Copper Refrigerant Coil & Elastomeric Insulation', 'Dry OFN Nitrogen & Silver Brazing Rods', 'R32 / R410A / R290 Refrigerant Cylinders'],
    safetyProtocol: 'Ensure cross-ventilation when servicing mildly flammable A2L/HC refrigerants (R32/R290), never pressurize systems with oxygen/air, and wear brazing goggles + gloves.',
    measurementMethod: 'Pull deep vacuum below 500 microns before charging refrigerant by exact gram weight on digital scale; measure superheat, subcooling, and grill ΔT (10°C–14°C).',
    commonDefect: 'Skipping vacuuming ("air purging") causing moisture acid/ice blockage, eccentric flare cracks leaking gas, or indoor unit drain slope backflow.',
    qaVerification: 'Hold standing nitrogen pressure test without drop, confirm compressor running amps within nameplate rating, and test condensate drain flow.',
  },
  'Masonry & Tiling': {
    provider: 'Construction Skill Development Council of India (CSDCI)',
    standardCode: 'IS 2212 Brickwork, IS 15477 Tile Adhesive & Laser Datum Standard',
    mrDomain: 'गवंडीकाम, लादी (टायलिंग) व ग्रॅनाइट फिटिंग',
    hiDomain: 'राजमिस्त्री, टाइलिंग एवं ग्रेनाइट फिटिंग कौशल',
    coreTools: ['360° Green-Beam Laser Level & Plumb Bob', 'Notched Tile Trowel (8mm/10mm) & Wet Tile Cutter', 'Rubber Mallet & Suction Lifter', 'Tile Leveling Clips/Wedges & Spirit Level'],
    consumables: ['Polymer-Modified C2TE Tile Adhesive', '2mm/3mm Tile Spacers & Epoxy Grout', 'SBR Waterproofing Latex & Curing Hessian'],
    safetyProtocol: 'Wear knee pads, cut-resistant gloves, eye goggles, and dust respirator during granite/vitrified wet cutting; inspect scaffolding planks and guardrails.',
    measurementMethod: 'Snap orthogonal chalk reference lines to eliminate sliver cuts (<1/3 tile) at doorways, and set wet-area bathroom floor slope at 1:80 toward nahani trap.',
    commonDefect: 'Spot-bonding ("dot and dab") leaving hollow voids under large tiles that crack under load, uneven lippage at tile corners, or water ponding in bathrooms.',
    qaVerification: 'Tap-test 100% of laid tiles for zero hollow sound (>95% back-buttered adhesive coverage), verify <0.5mm lippage, and perform 24-hour ponding slope check.',
  },
  'Painting & Waterproofing': {
    provider: 'Construction Skill Development Council of India (CSDCI — Painting)',
    standardCode: 'IS 2395 Architectural Coating & Polymer Damp-Proofing SOP',
    mrDomain: 'रंगकाम, टेक्सचर व वॉटरप्रूफिंग कौशल्य',
    hiDomain: 'पेंटिंग, टेक्सचर एवं वॉटरप्रूफिंग कौशल',
    coreTools: ['Digital Wall Moisture Meter', 'Vacuum-Attached Orbital Sander', 'Airless Paint Sprayer & Microfiber Rollers', 'V-Groove Crack Chisel & Putty Blades'],
    consumables: ['2-Component Acrylic Polymer Waterproof Coating', '45-GSM Alkali-Resistant Glass Fiber Mesh', 'Acrylic Wall Putty, Alkali Primer & Low-VOC Emulsion'],
    safetyProtocol: 'Mask furniture/switches thoroughly, use dust-extraction sanding + organic-vapor/particulate mask for PU/spray coats, and secure extension ladders or harnesses.',
    measurementMethod: 'Test substrate moisture (<12%–15% on moisture meter) and surface pH Cure before priming; apply waterproofing in 2 perpendicular coats at prescribed sq.ft/litre coverage.',
    commonDefect: 'Applying putty/paint over active efflorescence/dampness causing blistering within weeks, or skipping glass-fiber mesh over terrace parapet cove joints.',
    qaVerification: 'Inspect raking-light wall smoothness before topcoat, verify uniform sheen without roller lap marks, and run 48-hour terrace flood check on waterproofing.',
  },
  'Agriculture, Drip Irrigation & Nursery': {
    provider: 'Agriculture Skill Council of India (ASCI)',
    standardCode: 'BIS IS 13488 Micro-Irrigation & Good Agricultural Practices (IndGAP)',
    mrDomain: 'ठिबक सिंचन, पॉलीहाऊस व आधुनिक कृषी कौशल्य',
    hiDomain: 'ड्रिप सिंचाई, पॉलीहाउस एवं आधुनिक कृषि कौशल',
    coreTools: ['Water Pressure Gauge & EC/pH Soil-Water Meter', '16mm Lateral Punch & Grommet Tool', 'Bypass Secateurs & Grafting Knife (Sterilized)', 'PPE Chemical Spray Kit'],
    consumables: ['ISI Inline Drip Laterals & Venturi Injector', 'Disc/Screen Filter Cartridges', 'Grafting Tape, Cocopeat & Trichoderma Bio-Inputs'],
    safetyProtocol: 'Wear nitrile gloves, respirator mask, and goggles during foliar/drone spraying, spray strictly with wind direction in cool morning/evening hours, and sanitize grafting blades.',
    measurementMethod: 'Check emitter discharge uniformity (>90% Christiansen coefficient) at tail-end pressure (1.0–1.2 kg/cm²), and monitor root-zone EC/pH before fertigation.',
    commonDefect: 'Clogged inline emitters due to skipped acid/chlorine filter flushing, girdled graft unions, or over-irrigation causing root rot in polyhouse beds.',
    qaVerification: 'Verify pressure differential across hydrocyclone/disc filter (<0.5 kg/cm²), flush lateral end-caps clear, and log crop stage & fertigation schedule.',
  },
  'CNC, Lathe & Industrial Machining': {
    provider: 'Capital Goods & Strategic Skill Council (CGSSC — Machining)',
    standardCode: 'ISO 2768 Machining Tolerances & Shop-Floor CNC Safety SOP',
    mrDomain: 'सीएनसी (CNC), लेथ मशीन व इंडस्ट्रियल मशीनिंग',
    hiDomain: 'सीएनसी (CNC), लेथ एवं इंडस्ट्रियल मशीनिंग कौशल',
    coreTools: ['Digital Vernier Caliper (0.01mm) & Outside Micrometer (0.001mm)', 'Dial Test Indicator & Magnetic Base', 'Carbide Turning/Milling Inserts & Torque Key', 'Bore Gauge & Thread Pitch Gauge'],
    consumables: ['Water-Soluble Cutting Coolant (Refractometer Checked)', 'Carbide Insert Tips (CNMG/WNMG)', 'Deburring Knife & Rust-Preventive Oil'],
    safetyProtocol: 'Never wear loose sleeves, rings, or gloves near rotating spindles/chucks, remove chuck key immediately, wear ANSI impact goggles, and dry-run G-code in single-block mode.',
    measurementMethod: 'Zero workpiece WCS (G54) and tool-length/wear offsets accurately, verify first-off piece dimensions across OD, ID, concentricity, and Ra surface finish.',
    commonDefect: 'Tool crash from incorrect Z-offset sign, taper/chatter from excessive overhang, or out-of-tolerance drift from thermal insert wear across batch runs.',
    qaVerification: 'Complete SPC in-process inspection every 5–10 parts, deburr sharp edges cleanly, and record calibrated micrometer readings on batch route card.',
  },
  'Retail Billing, Data Entry & Inventory': {
    provider: 'Retailers Association’s Skill Council of India (RASCI) & BFSI SSC',
    standardCode: 'GST E-Invoicing / HSN Compliance & FIFO Inventory Control',
    mrDomain: 'टॅली जीएसटी बिलिंग, डेटा एन्ट्री व साठा व्यवस्थापन',
    hiDomain: 'टैली जीएसटी बिलिंग, डेटा एंट्री एवं इन्वेंटरी प्रबंधन',
    coreTools: ['Tally Prime / GST POS Terminal', '2D Barcode Scanner & Thermal Receipt Printer', 'Spreadsheet (Excel/Sheets) Pivot & VLOOKUP Templates', 'UPI/POS Settlement Register'],
    consumables: ['Thermal POS Rolls & Barcode SKU Labels', 'GRN (Goods Receipt Note) Binders', 'Batch/Expiry Shelf Tags'],
    safetyProtocol: 'Lock POS screen when stepping away, never share operator login PINs, verify UPI settlement reference IDs in merchant app (not screenshots alone), and maintain ergonomic posture.',
    measurementMethod: 'Cross-verify supplier GSTIN, 6/8-digit HSN code, CGST+SGST vs IGST tax slab, batch MRP, and physical received qty against Purchase Order before posting GRN.',
    commonDefect: 'Duplicate invoice entry, wrong tax-rate mapping causing GSTR-1/GSTR-2B mismatch, or FEFO (First-Expiry-First-Out) neglect leading to expired shelf stock.',
    qaVerification: 'Reconcile physical cash drawer + UPI + card batch totals to ₹0 variance at shift close, and run weekly cycle-count audit on fast-moving SKUs.',
  },
  'Commercial Driving, Delivery & Logistics': {
    provider: 'Logistics Sector Skill Council (LSC)',
    standardCode: 'Motor Vehicles Act Defensive Driving & Cold-Chain/E-Way Bill SOP',
    mrDomain: 'व्यावसायिक ड्रायव्हिंग, ईव्ही कार्गो व लॉजिस्टिक्स',
    hiDomain: 'कमर्शियल ड्राइविंग, ईवी कार्गो एवं लॉजिस्टिक्स कौशल',
    coreTools: ['Commercial LMV / EV Cargo Vehicle', 'Tire Pressure Gauge & Emergency Breakdown Kit', 'GPS Navigation & E-Way Bill / POD App', 'Ratchet Load Straps & Fire Extinguisher'],
    consumables: ['Reflective Safety Triangles & High-Vis Vest', 'Tamper-Evident Cargo Seals', 'Coolant, Brake Fluid & Windshield Wash'],
    safetyProtocol: 'Complete 360° pre-trip inspection (brakes, tires, lights, mirrors, battery/fuel), wear seatbelt strictly, maintain 3-second following distance, and never use handheld phone while driving.',
    measurementMethod: 'Distribute cargo weight evenly over axle center-of-gravity, secure fragile/cold-chain crates with ratchet straps, and verify E-Way Bill & invoice validity before dispatch.',
    commonDefect: 'Harsh braking/acceleration draining EV range or damaging fragile goods, unverified delivery OTP/POD signatures, or driving on under-inflated tires.',
    qaVerification: 'Capture damage-free digital Proof of Delivery (POD), log trip odometer/SOC efficiency, and report any vehicle warning codes at shift end.',
  },
  'Housekeeping & Facility Sanitization': {
    provider: 'Domestic Workers & Management Facility Skill Council (DWSSC)',
    standardCode: 'Color-Coded Cross-Contamination Control & MSDS Dilution SOP',
    mrDomain: 'हाउसकीपिंग, डीप क्लीनिंग व निर्जंतुकीकरण कौशल्य',
    hiDomain: 'हाउसकीपिंग, डीप क्लीनिंग एवं सैनिटाइजेशन कौशल',
    coreTools: ['Single-Disc Floor Scrubber & Wet/Dry Vacuum Extractor', 'Upholstery Injection-Extraction Machine', 'High-Pressure Jet & UV Tank Lamp', 'Color-Coded Microfiber Cloths & Caution Cones'],
    consumables: ['pH-Neutral Stone/Wood Cleaner', 'Hospital-Grade Quaternary Disinfectant', 'Heavy-Duty Nitrile Gloves, Gumboots & Goggles'],
    safetyProtocol: 'Place wet-floor caution cones first, never mix acid descalers with bleach/chlorine (toxic chlorine gas hazard), ventilate confined water tanks before entry, and wear chemical PPE.',
    measurementMethod: 'Measure chemical concentrates using calibrated dosing caps (e.g., 20ml per litre) and follow strict color coding (Red: washrooms, Blue: glass/desks, Green: kitchen, Yellow: clinical).',
    commonDefect: 'Using acidic toilet cleaner on marble/granite floors causing permanent etching, over-wetting sofa foam causing mildew odor, or streaky glass residue.',
    qaVerification: 'Conduct white-glove dust check on high ledges/vents, verify dry slip-free floors, confirm odor-free sanitization, and clear waste segregated into wet/dry.',
  },
  'Photography, Videography & Event Rigging': {
    provider: 'Media & Entertainment Skills Council (MESC)',
    standardCode: 'MESC Live-Event Electrical/Truss Rigging & Digital Imaging SOP',
    mrDomain: 'फोटोग्राफी, व्हिडिओग्राफी व इव्हेंट साऊंड/एलईडी रिगिंग',
    hiDomain: 'फोटोग्राफी, वीडियोग्राफी एवं इवेंट साउंड/एलईडी रिगिंग',
    coreTools: ['Full-Frame Mirrorless Camera & 3-Axis Gimbal', 'DGCA-Compliant Camera Drone', 'Aluminum Box Truss, Chain Hoists & DMX/Audio Mixer', 'Dual-Card Backup SSDs & Color-Calibrated Monitor'],
    consumables: ['Secondary Steel Safety Cables (for Truss Lights)', 'Gaffer Tape & Rubber Cable Ramps', 'Balanced XLR & Neutrik PowerCON Cables'],
    safetyProtocol: 'Attach secondary steel safety bonds to every overhead PAR/moving-head fixture and LED cabinet, cover floor cables with yellow/black ramps, earth generator supply, and follow DGCA drone height/no-fly rules.',
    measurementMethod: 'Set custom Kelvin white balance and dual-slot RAW recording so zero event moments are lost; balance 3-axis gimbal roll/pitch/yaw before powering motors.',
    commonDefect: 'Clipped bridal highlight exposure, ground-loop hum in PA audio, single-SD-card corruption without backup, or unballasted outdoor LED truss in wind.',
    qaVerification: 'Verify dual-copy checksum backup on site, test PA/mic gain before crowd arrival, and deliver color-consistent Culled gallery on promised schedule.',
  },
  'Security, Fire Safety & Facility Guard': {
    provider: 'Management & Entrepreneurship and Professional Skills Council (MEPSC)',
    standardCode: 'PSARA 2005 Compliance & NBC Part-4 Fire Life-Safety Drill',
    mrDomain: 'सुरक्षा रक्षक, अग्निसुरक्षा व प्रवेश नियंत्रण कौशल्य',
    hiDomain: 'सिक्योरिटी गार्ड, अग्नि सुरक्षा एवं एक्सेस कंट्रोल कौशल',
    coreTools: ['ABC Dry Powder, CO2 & Foam Fire Extinguishers', 'Fire Hydrant Hose, Branch Pipe & Alarm Panel', 'Handheld Metal Detector & Visitor Management App', 'First-Aid Trauma Kit & Two-Way Radio'],
    consumables: ['Tamper-Proof Gate Passes & Material Challan Register', 'Reflective Patrol Baton', 'Emergency Assembly Point Signage'],
    safetyProtocol: 'Never use water/foam extinguishers on live electrical panels (use CO2/Dry Powder only), keep fire exits unlocked and unobstructed 24x7, and maintain respectful, lawful visitor screening.',
    measurementMethod: 'Check fire extinguisher pressure gauge needle in green zone monthly, log vehicle number + challan qty + timestamp on inward/outward gate register, and patrol blind spots on schedule.',
    commonDefect: 'Blocked staircase fire doors, unverified vendor entry without resident/office approval, or panic during alarm due to unpracticed PASS extinguisher drill.',
    qaVerification: 'Demonstrate PASS technique (Pull, Aim, Squeeze, Sweep), audit shift handover occurrence book, and verify emergency contact speed-dial readiness.',
  },
  'Pottery, Ceramic & Eco-Sculpture Craft': {
    provider: 'Handicrafts and Carpet Sector Skill Council (HCSSC)',
    standardCode: 'CPCB Eco-Friendly Shadu Clay Idol Guidelines & Lead-Free Ceramic Glaze SOP',
    mrDomain: 'कुंभारकाम, सिरॅमिक ग्लेझिंग व शाडू माती मूर्तिकला',
    hiDomain: 'पॉटरी, सिरेमिक ग्लेजिंग एवं इको-फ्रेंडली शाडू मिट्टी शिल्पकला',
    coreTools: ['Variable-Speed Electric Potter’s Wheel', 'Sculpting Wire Loop, Rib & Wooden Modeling Tools', 'Pyrometric Cones & Electric/Gas Kiln', 'Wet Sponge & Calipers'],
    consumables: ['Wedged Natural Shadu / Stoneware Clay', 'Food-Safe Lead-Free Glazes & Natural Mineral Pigments', 'Plaster Bats & Damp Curing Cloths'],
    safetyProtocol: 'Wipe clay studio dust with wet sponges (never dry-sweep silica dust), wear N95 respirator when mixing dry glaze powders, and wear heat-resistant gloves + UV shade glasses near hot kilns.',
    measurementMethod: 'Spiral-wedge clay thoroughly to expel all air pockets, center clay evenly on wheel head, maintain uniform 5–7mm wall thickness, and slow-dry greenware under breathable wraps.',
    commonDefect: 'Kiln explosions from trapped air pockets or moisture-laden bone-dry greenware, S-cracks in pot bases from uneven drying, or glaze crazing/pinholing.',
    qaVerification: 'Confirm uniform wall weight, smooth foot-ring trimming, zero water-soluble toxic paint on eco-idols, and shock-safe honeycomb packaging.',
  },
  'Fitness, Yoga & Physiotherapy Wellness': {
    provider: 'Sports, Physical Education, Fitness & Leisure Skills Council (SPEFL-SC) & YCB',
    standardCode: 'AYUSH Yoga Certification Board (YCB) & PAR-Q Client Screening Protocol',
    mrDomain: 'योग, प्राणायाम व फिजिओथेरपी फिटनेस प्रशिक्षण',
    hiDomain: 'योग, प्राणायाम एवं फिजियोथेरेपी वेलनेस प्रशिक्षण',
    coreTools: ['Non-Slip Alignment Yoga Mat, Cork Blocks & Cotton Strap', 'Resistance TheraBands & Stability Ball', 'Pulse Oximeter & Posture Grid', 'Client PAR-Q Health Intake Sheet'],
    consumables: ['Mat Disinfectant Spray', 'Bolsters & Cushioned Knee Pads', 'Weekly Mobility Progress Tracker'],
    safetyProtocol: 'Complete PAR-Q medical contraindication screening (BP, hernia, disc prolapse, pregnancy trimester, recent surgery) before any session; never force joints past pain-free range of motion.',
    measurementMethod: 'Assess baseline posture, joint range of motion, and resting heart rate; structure every 60-min session into Joint Warm-up (10m) → Core Asana/Rehab (35m) → Pranayama & Cool-down (15m).',
    commonDefect: 'Teaching Kapalbhati/inversions to hypertensive or prenatal clients, lumbar hyperextension due to disengaged core, or skipping progressive regression props.',
    qaVerification: 'Confirm pain-free biomechanical alignment, check post-session recovery comfort, and log measurable flexibility/strength progress every 2 weeks.',
  },
};

function getDomainSpec(category: string): DomainCurriculumSpec {
  if (DOMAIN_SPECS[category]) return DOMAIN_SPECS[category];
  const low = (category || '').toLowerCase();
  for (const [key, spec] of Object.entries(DOMAIN_SPECS)) {
    if (low.includes(key.toLowerCase()) || key.toLowerCase().includes(low)) {
      return spec;
    }
  }
  return {
    provider: 'NSDC / Skill India Open Vocational Academy',
    standardCode: 'National Skills Qualifications Framework (NSQF) Level 4 SOP',
    mrDomain: `${category} व्यावसायिक कौशल्य`,
    hiDomain: `${category} व्यावसायिक कौशल`,
    coreTools: [`Calibrated ${category} Primary Toolset`, 'Digital Measurement & Inspection Gauge', 'Workplace PPE & Safety Kit', 'Client Scope & Quality Checklist'],
    consumables: ['Certified Grade Raw Materials', 'Safety & Hygiene Supplies', 'Labeling & Handover Tags'],
    safetyProtocol: `Inspect workplace hazards, wear domain-appropriate PPE, verify equipment calibration, and isolate energy/process sources before executing ${category} tasks.`,
    measurementMethod: `Measure baseline dimensions, tolerances, and customer specifications accurately before commencing ${category} execution.`,
    commonDefect: 'Rushed surface preparation, uncalibrated measurements, or skipping intermediate quality verification before final assembly.',
    qaVerification: 'Perform end-to-end functional test against customer specifications, clean work zone thoroughly, and document verified output.',
  };
}

/**
 * Additional specialist skills referenced in AI Target-Role Skill Gap Analyzer
 * so 100% of skills mentioned anywhere in KaushalSetu have dedicated 4-module courses.
 */
export const SPECIALIST_ROLE_SKILLS: Array<{ name: string; category: string }> = [
  { name: 'Motor Control & Starters', category: 'Electrical' },
  { name: 'MCCB & Distribution Panels', category: 'Electrical' },
  { name: 'PLC & Relay Basics', category: 'Electrical' },
  { name: 'Blueprint Reading', category: 'Electrical' },
  { name: 'Battery Bank Commissioning', category: 'Solar & Inverter' },
  { name: 'Multimeter & Clamp Testing', category: 'Solar & Inverter' },
  { name: 'Working at Heights Safety', category: 'Solar & Inverter' },
  { name: 'Precision Measurement & 2D Layout', category: 'Carpentry' },
  { name: 'Power Router & Edge Banding', category: 'Carpentry' },
  { name: 'Moisture & Termite Treatment', category: 'Carpentry' },
  { name: 'Solar Water Heater Integration', category: 'Plumbing' },
  { name: 'Submersible Pump & Booster Setup', category: 'Plumbing' },
  { name: 'Drainage Gradient Reading', category: 'Plumbing' },
  { name: 'Oxy-Acetylene Cutting', category: 'Welding & Fabrication' },
  { name: 'Weld Joint Inspection', category: 'Welding & Fabrication' },
  { name: 'PPE & Arc Flash Safety', category: 'Welding & Fabrication' },
  { name: 'Aari & Surface Embroidery Finishing', category: 'Tailoring, Boutique & Garment Craft' },
  { name: 'Client Measurement & Trial Fitting', category: 'Tailoring, Boutique & Garment Craft' },
  { name: 'Boutique Order Costing', category: 'Tailoring, Boutique & Garment Craft' },
  { name: 'Emergency First-Aid & CPR', category: 'Home Healthcare, Nursing & Elder Care' },
  { name: 'Cyber-Safe NVR Remote Setup', category: 'Computer, Networking & CCTV Tech' },
  { name: 'High-Voltage Insulation Safety', category: 'Automotive & EV Mechanics' },
  { name: 'Lithium Pack Cell Balancing', category: 'Automotive & EV Mechanics' },
];

/**
 * Builds a complete, domain-grounded 4-module curriculum document for ANY skill.
 */
export function buildSkillCurriculum(skillName: string, category: string, skillId?: string) {
  const cleanSkill = skillName.trim();
  const cleanCategory = (category || 'General Skilled Trade').trim();
  const spec = getDomainSpec(cleanCategory);

  const modules: SkillLearningModule[] = [
    {
      moduleNumber: 1,
      title: `Foundations, Tools & Safety Compliance for ${cleanSkill}`,
      durationMinutes: 40,
      stageLabel: 'Module 01 · Foundation & Safety',
      objective: `Understand ${spec.standardCode} requirements, select and inspect the right tools/materials, and establish a safe workspace before performing ${cleanSkill}.`,
      topics: [
        `Core principles of ${cleanSkill} within ${cleanCategory} (${spec.standardCode}).`,
        `Selecting, inspecting, and calibrating primary instruments: ${spec.coreTools.slice(0, 3).join(', ')}.`,
        `Material grade verification and genuine consumable selection: ${spec.consumables.join(', ')}.`,
        `Mandatory safety & hygiene protocol: ${spec.safetyProtocol}`,
      ],
      toolsAndMaterials: [...spec.coreTools.slice(0, 3), ...spec.consumables.slice(0, 2)],
      practicalExercise: `Lay out your ${cleanSkill} kit, inspect every tool/lead for damage or calibration drift, verify consumable grade markings, and perform a 3-minute pre-work safety walkthrough.`,
      checklist: [
        `PPE and workplace safety setup verified per ${spec.standardCode}`,
        `Primary tools (${spec.coreTools[0]}, ${spec.coreTools[1]}) inspected and ready`,
        `Consumable specifications matched to client work scope`,
      ],
      quiz: {
        question: `Before starting ${cleanSkill} on a customer site or workshop bench, which step comes FIRST?`,
        options: [
          spec.safetyProtocol,
          'Skip tool and safety checks to finish in half the time',
          'Use unverified substitute materials without informing the client',
          'Begin final finishing before baseline measurements are taken',
        ],
        correctIndex: 0,
        explanation: `Following "${spec.safetyProtocol}" protects both the professional and the client while preventing costly damage.`,
      },
    },
    {
      moduleNumber: 2,
      title: `Step-by-Step Practical Execution: ${cleanSkill}`,
      durationMinutes: 55,
      stageLabel: 'Module 02 · Hands-On Technique',
      objective: `Execute ${cleanSkill} from initial measurement and layout through precision assembly/operation with clean professional workmanship.`,
      topics: [
        `Baseline measurement & layout precision: ${spec.measurementMethod}`,
        `Stage-by-stage workflow for ${cleanSkill}: preparation, primary operation, alignment, and secure finishing.`,
        `Handling real-world site/client variations (uneven surfaces, tight spaces, urgent timelines, or delicate materials).`,
        `Maintaining neatness, ergonomic speed, and zero collateral damage to surrounding customer property.`,
      ],
      toolsAndMaterials: spec.coreTools,
      practicalExercise: `Complete one full practice sample or supervised task of ${cleanSkill} while recording your baseline measurements, execution time, and intermediate alignment check.`,
      checklist: [
        `Baseline layout and tolerances verified (${spec.measurementMethod.slice(0, 75)}...)`,
        `Core ${cleanSkill} sequence completed without shortcuts`,
        `Intermediate alignment / stability verified before final sealing or finishing`,
      ],
      quiz: {
        question: `Which measurement and preparation habit ensures accurate, repeatable quality in ${cleanSkill}?`,
        options: [
          spec.measurementMethod,
          'Estimating all dimensions by eye without measuring instruments',
          'Forcing mismatched parts or settings to fit under pressure',
          'Skipping intermediate checks until the client complains',
        ],
        correctIndex: 0,
        explanation: `Accurate baseline measurement (${spec.measurementMethod}) eliminates rework and material wastage.`,
      },
    },
    {
      moduleNumber: 3,
      title: `Quality Inspection, Troubleshooting & Defect Prevention in ${cleanSkill}`,
      durationMinutes: 50,
      stageLabel: 'Module 03 · Diagnostics & QA',
      objective: `Diagnose common faults rapidly, prevent repeat defects, and verify ${cleanSkill} output against professional quality benchmarks.`,
      topics: [
        `Preventing the #1 field defect in ${cleanCategory}: ${spec.commonDefect}`,
        `Systematic root-cause troubleshooting using ${spec.coreTools[0]} rather than guesswork part replacement.`,
        `End-to-end quality verification procedure: ${spec.qaVerification}`,
        `Corrective rework standards when an inherited site has poor prior workmanship.`,
      ],
      toolsAndMaterials: [spec.coreTools[0], spec.coreTools[2] || spec.coreTools[1], 'Inspection Checklist Log'],
      practicalExercise: `Inspect a completed ${cleanSkill} setup (or practice assembly), run the full diagnostic check (${spec.qaVerification}), and log 3 quality checkpoints.`,
      checklist: [
        `Zero presence of common defect (${spec.commonDefect.slice(0, 70)}...)`,
        `Full QA verification passed: ${spec.qaVerification.slice(0, 75)}...`,
        `Durability and safety under normal operating load confirmed`,
      ],
      quiz: {
        question: `Before declaring a ${cleanSkill} job complete, how should you verify workmanship quality?`,
        options: [
          spec.qaVerification,
          'Pack tools immediately without testing under actual operating conditions',
          'Cover up minor leaks, loose joints, or alignment gaps with tape',
          'Leave diagnostic testing to the customer next week',
        ],
        correctIndex: 0,
        explanation: `Performing "${spec.qaVerification}" builds high repeat-hire trust and 5-star verified reviews on KaushalSetu.`,
      },
    },
    {
      moduleNumber: 4,
      title: `Fair Costing, Client Handover & Skill Passport Readiness (${cleanSkill})`,
      durationMinutes: 35,
      stageLabel: 'Module 04 · Estimation & Certification',
      objective: `Estimate fair daily wages and material quantities transparently, conduct a professional client handover, and prepare for KaushalSetu Skill Verification.`,
      topics: [
        `Calculating transparent estimates for ${cleanSkill}: separating skilled daily labor from itemized genuine material BOQ.`,
        `Clean site handover etiquette: clearing debris/scraps, demonstrating safe operation, and sharing maintenance tips.`,
        `Documenting before-and-after portfolio photos (with client consent) to strengthen your KaushalSetu profile.`,
        `Readiness review for passing KaushalSetu's AI Scenario Assessment & upgrading your Digital Skill Passport.`,
      ],
      toolsAndMaterials: ['Itemized Estimate Sheet / KaushalSetu Wage Estimator', 'Smartphone Camera for Portfolio Proof', 'Digital Skill Passport QR'],
      practicalExercise: `Prepare a sample 1-page customer scope & material estimate for a typical ${cleanSkill} assignment in your city, and review all 3 prior module checklists.`,
      checklist: [
        `Transparent labor + material scope explained clearly prior to work`,
        `Work area cleaned and live handover walkthrough demonstrated to client`,
        `Ready to attempt KaushalSetu Skill Assessment / add ${cleanSkill} to Digital Skill Passport`,
      ],
      quiz: {
        question: `What is the best way to earn higher wages and repeat hiring requests with ${cleanSkill} on KaushalSetu?`,
        options: [
          'Combine transparent upfront scope/material estimation, clean QA-verified handover, and an Assessed badge on your Digital Skill Passport',
          'Quote an artificially low price first and demand unagreed surprise charges at the end',
          'Leave leftover scrap and untested work without briefing the customer',
          'Keep skills unverified and avoid written work agreements',
        ],
        correctIndex: 0,
        explanation: 'Transparent agreements, verified skill badges, and spotless handovers directly boost your Bayesian Reputation Score and repeat hires.',
      },
    },
  ];

  const totalMinutes = modules.reduce((sum, m) => sum + m.durationMinutes, 0);
  const durationHours = Number((totalMinutes / 60).toFixed(1));

  return {
    skillId: skillId || null,
    title: `${cleanSkill} — 4-Module Practical Mastery Course`,
    category: cleanCategory,
    targetSkill: cleanSkill,
    language: 'Multilingual',
    languagesAvailable: ['English', 'Marathi', 'Hindi'],
    provider: spec.provider,
    standardCode: spec.standardCode,
    level: 'Beginner to Advanced',
    durationHours,
    modulesCount: 4,
    format: '4 Interactive Modules + Checklists + Knowledge Checks',
    summary: `Structured 4-module practical training for ${cleanSkill} (${cleanCategory}): covers ${spec.standardCode} safety & tools, step-by-step execution, fault diagnostics, and fair client handover.`,
    localizedSummary: {
      en: `Master ${cleanSkill} across 4 hands-on modules: (1) Tools, materials & ${spec.standardCode} safety, (2) Step-by-step practical execution, (3) Quality testing & defect prevention, and (4) Fair costing & Digital Skill Passport readiness.`,
      mr: `${spec.mrDomain} अंतर्गत "${cleanSkill}" साठी ४ पूर्ण प्रॅक्टिकल मॉड्यूल्स: (१) साधने, साहित्य व सुरक्षा नियम (${spec.standardCode}), (२) प्रत्यक्ष कामाची अचूक पद्धत, (३) गुणवत्ता तपासणी व दोष निवारण, आणि (४) योग्य मजुरी अंदाज व डिजिटल स्किल पासपोर्ट तयारी.`,
      hi: `${spec.hiDomain} के अंतर्गत "${cleanSkill}" के लिए ४ प्रैक्टिकल मॉड्यूल: (१) सही औजार, सामग्री एवं सुरक्षा मानक (${spec.standardCode}), (२) चरण-दर-चरण कार्य निष्पादन, (३) गुणवत्ता जांच व फॉल्ट सुधार, तथा (४) उचित मजदूरी आकलन व डिजिटल स्किल पासपोर्ट तैयारी।`,
    },
    modules,
  };
}

/**
 * Ensures every single skill mentioned in `skills`, `worker_skills`, `jobs.requiredSkills`,
 * and `SPECIALIST_ROLE_SKILLS` has a complete 4-module structured course in `learning_resources`.
 */
export async function ensureSkillLearningCatalog(): Promise<void> {
  const now = new Date().toISOString();

  // 1. Ensure specialist target-role skills exist in canonical `skills` collection
  const existingSkills = await db.find('skills');
  const skillByLowerName = new Map<string, any>();
  for (const sk of existingSkills) {
    if (sk.name) skillByLowerName.set(String(sk.name).trim().toLowerCase(), sk);
  }

  const missingCanonical: any[] = [];
  for (const sp of SPECIALIST_ROLE_SKILLS) {
    const key = sp.name.trim().toLowerCase();
    if (!skillByLowerName.has(key)) {
      const doc = {
        _id: newObjectId(),
        name: sp.name,
        category: sp.category,
        translations: { mr: sp.name, hi: sp.name },
        createdAt: now,
      };
      missingCanonical.push(doc);
      skillByLowerName.set(key, doc);
    }
  }

  // Also scan `worker_skills` and `jobs.requiredSkills` so ZERO mentioned skills are ever left out
  const allWorkerSkills = await db.find('worker_skills');
  for (const ws of allWorkerSkills) {
    const nm = String(ws.name || '').trim();
    if (!nm) continue;
    const key = nm.toLowerCase();
    if (!skillByLowerName.has(key)) {
      const doc = {
        _id: newObjectId(),
        name: nm,
        category: ws.category || 'General Skilled Trade',
        translations: { mr: nm, hi: nm },
        createdAt: now,
      };
      missingCanonical.push(doc);
      skillByLowerName.set(key, doc);
    }
  }

  const allJobs = await db.find('jobs');
  for (const jb of allJobs) {
    for (const reqSk of jb.requiredSkills || []) {
      const nm = String(reqSk || '').trim();
      if (!nm) continue;
      const key = nm.toLowerCase();
      if (!skillByLowerName.has(key)) {
        const doc = {
          _id: newObjectId(),
          name: nm,
          category: jb.category || 'General Skilled Trade',
          translations: { mr: nm, hi: nm },
          createdAt: now,
        };
        missingCanonical.push(doc);
        skillByLowerName.set(key, doc);
      }
    }
  }

  if (missingCanonical.length > 0) {
    await db.insertMany('skills', missingCanonical);
  }

  // 2. Inspect existing `learning_resources` — upgrade any legacy 0-module record and bulk-create missing skill courses
  const existingResources = await db.find('learning_resources');
  const coveredSkillKeys = new Set<string>();

  for (const res of existingResources) {
    const tSkill = String(res.targetSkill || '').trim();
    if (!tSkill) continue;
    const key = tSkill.toLowerCase();
    coveredSkillKeys.add(key);

    // Upgrade legacy seed entries that did not yet have `modules` array
    if (!Array.isArray(res.modules) || res.modules.length < 4) {
      const matchedSk = skillByLowerName.get(key);
      const upgraded = buildSkillCurriculum(tSkill, res.category || matchedSk?.category || 'Electrical', matchedSk?._id);
      await db.updateOne(
        'learning_resources',
        { _id: res._id },
        {
          modules: upgraded.modules,
          modulesCount: upgraded.modulesCount,
          durationHours: upgraded.durationHours,
          standardCode: upgraded.standardCode,
          level: upgraded.level,
          languagesAvailable: upgraded.languagesAvailable,
          localizedSummary: upgraded.localizedSummary,
          format: upgraded.format,
        }
      );
    }
  }

  const newCoursesBatch: any[] = [];
  for (const [key, skDoc] of skillByLowerName.entries()) {
    if (!coveredSkillKeys.has(key)) {
      const course = buildSkillCurriculum(skDoc.name, skDoc.category || 'Electrical', skDoc._id);
      newCoursesBatch.push({
        _id: newObjectId(),
        ...course,
        createdAt: now,
      });
      coveredSkillKeys.add(key);
    }
  }

  if (newCoursesBatch.length > 0) {
    await db.insertMany('learning_resources', newCoursesBatch);
  }
}

/**
 * Ensures a single skill (including brand-new custom skills entered by workers/employers)
 * immediately gets a 4-module learning resource in MongoDB.
 */
export async function ensureSingleSkillCourse(skillName: string, category: string): Promise<any> {
  const cleanName = String(skillName || '').trim();
  if (!cleanName) return null;
  const cleanCategory = String(category || 'General Skilled Trade').trim() || 'General Skilled Trade';

  const allRes = await db.find('learning_resources');
  const existing = allRes.find(
    (r) => String(r.targetSkill || '').trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (existing && Array.isArray(existing.modules) && existing.modules.length >= 4) {
    return existing;
  }

  // Ensure skill exists in canonical `skills` collection too
  const allSkills = await db.find('skills');
  let skDoc = allSkills.find((s) => String(s.name || '').trim().toLowerCase() === cleanName.toLowerCase());
  if (!skDoc) {
    skDoc = await db.insertOne('skills', {
      name: cleanName,
      category: cleanCategory,
      translations: { mr: cleanName, hi: cleanName },
      createdAt: new Date().toISOString(),
    });
  }

  const course = buildSkillCurriculum(cleanName, cleanCategory, skDoc._id);
  if (existing) {
    return db.updateOne('learning_resources', { _id: existing._id }, course);
  }
  return db.insertOne('learning_resources', {
    ...course,
    createdAt: new Date().toISOString(),
  });
}
