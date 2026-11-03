import heroTradesImg from '../assets/images/hero_skilled_trades_india_1793633954278.jpg';
import electricianAvatar from '../assets/images/worker_avatar_electrician_1793633956434.jpg';
import carpenterAvatar from '../assets/images/worker_avatar_carpenter_1793633957458.jpg';
import solarTechAvatar from '../assets/images/worker_avatar_solar_tech_1793633958286.jpg';
import plumberAvatar from '../assets/images/worker_avatar_plumber_1793633960143.jpg';
import tailorWomanAvatar from '../assets/images/worker_avatar_tailor_woman_1793635960283.jpg';
import nurseWomanAvatar from '../assets/images/worker_avatar_nurse_woman_1793635961532.jpg';
import itWomanAvatar from '../assets/images/worker_avatar_it_woman_1793635962312.jpg';
import mechanicManAvatar from '../assets/images/worker_avatar_mechanic_man_1793635961947.jpg';

export const HERO_TRADES_IMAGE = heroTradesImg;

const AVATAR_MAP: Record<string, string> = {
  electrician: electricianAvatar,
  carpenter: carpenterAvatar,
  solar_tech: solarTechAvatar,
  plumber: plumberAvatar,
  tailor_woman: tailorWomanAvatar,
  nurse_woman: nurseWomanAvatar,
  it_woman: itWomanAvatar,
  mechanic_man: mechanicManAvatar,
};

/**
 * Resolves worker avatar strictly from uploaded photo or explicit gender-matched avatarKey
 * so portraits never mismatch gender or repeat monotonously across 500 profiles.
 */
export function resolveWorkerAvatar(
  profile?: { avatarDataUrl?: string; avatarKey?: string; category?: string; gender?: string } | null
): string | null {
  if (!profile) return null;
  if (profile.avatarDataUrl) return profile.avatarDataUrl;
  if (profile.avatarKey && AVATAR_MAP[profile.avatarKey]) {
    return AVATAR_MAP[profile.avatarKey];
  }
  return null;
}

export function getWorkerInitials(name?: string): string {
  if (!name) return 'KS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

const MONOGRAM_SURFACES = [
  'bg-navy-900 text-white',
  'bg-teal-800 text-white',
  'bg-slate-800 text-white',
  'bg-cyan-900 text-white',
  'bg-emerald-900 text-white',
  'bg-stone-800 text-white',
];

export function getMonogramSurface(name?: string): string {
  const s = name || 'KaushalSetu';
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 997;
  }
  return MONOGRAM_SURFACES[hash % MONOGRAM_SURFACES.length];
}

export const TRADE_CATEGORIES = [
  'Electrical',
  'Solar & Inverter',
  'Tailoring, Boutique & Garment Craft',
  'Home Healthcare, Nursing & Elder Care',
  'Computer, Networking & CCTV Tech',
  'Plumbing',
  'Carpentry',
  'Beauty, Salon & Bridal Styling',
  'Culinary, Catering & Bakery',
  'Automotive & EV Mechanics',
  'Welding & Fabrication',
  'Handloom, Embroidery & Artisan Craft',
  'Childcare & Domestic Management',
  'Appliance & Mobile Electronics Repair',
  'HVAC & Refrigeration',
  'Masonry & Tiling',
  'Painting & Waterproofing',
  'Agriculture, Drip Irrigation & Nursery',
  'CNC, Lathe & Industrial Machining',
  'Retail Billing, Data Entry & Inventory',
  'Commercial Driving, Delivery & Logistics',
  'Housekeeping & Facility Sanitization',
  'Photography, Videography & Event Rigging',
  'Security, Fire Safety & Facility Guard',
  'Pottery, Ceramic & Eco-Sculpture Craft',
  'Fitness, Yoga & Physiotherapy Wellness',
] as const;

export const MAHARASHTRA_CITIES = [
  'Latur',
  'Pune',
  'Mumbai',
  'Navi Mumbai',
  'Thane',
  'Nagpur',
  'Nashik',
  'Chhatrapati Sambhajinagar',
  'Solapur',
  'Kolhapur',
  'Nanded',
  'Satara',
  'Sangli',
  'Amravati',
  'Akola',
  'Ahmednagar',
  'Jalgaon',
  'Ratnagiri',
] as const;
