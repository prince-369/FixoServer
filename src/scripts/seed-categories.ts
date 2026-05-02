/**
 * Seed script — Run once to populate all service categories.
 * Usage:  npx ts-node src/scripts/seed-categories.ts
 *
 * • Skips any category whose slug already exists (won't duplicate).
 * • Safe to re-run — only inserts missing ones.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Category from '../models/Category';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixo';

const categories = [
  // ──────────────── 1. Plumber ────────────────
  {
    name: 'Plumber',
    slug: 'plumber',
    tagline: 'Expert plumbers for every leak, clog & fitting — available today',
    description:
      'From minor tap leaks to full bathroom plumbing, our verified plumbers deliver quick, clean and reliable solutions. All work uses quality fittings and comes with a service guarantee.',
    priceStartsFrom: 149,
    order: 2,
    highlights: [
      'Verified & Experienced Plumbers',
      '30-Day Service Guarantee',
      'Quality Fittings & Materials',
      'Transparent Pricing — No Hidden Costs',
      'Same-Day Availability',
      'Clean & Mess-Free Work',
    ],
    services: [
      { title: 'Tap & Mixer Repair', description: 'Leaking tap fix, mixer replacement, tap installation for kitchen & bathroom' },
      { title: 'Pipe Leak & Burst Fix', description: 'PVC/CPVC pipe repair, joint sealing, concealed pipe leak detection' },
      { title: 'Toilet & Commode Repair', description: 'Flush tank repair, seat replacement, blockage clearing, new installation' },
      { title: 'Basin & Sink Installation', description: 'Wash basin fitting, kitchen sink installation, drain pipe connection' },
      { title: 'Drainage & Blockage', description: 'Choked drain cleaning, sewer line clearing, floor trap cleaning' },
      { title: 'Water Tank Services', description: 'Tank cleaning, overflow valve fix, float valve replacement, connection setup' },
      { title: 'Geyser & Water Heater Plumbing', description: 'Hot/cold water line connection, geyser inlet-outlet piping' },
      { title: 'Bathroom Fittings', description: 'Shower installation, health faucet fitting, towel rod & accessories mounting' },
      { title: 'Water Pump Installation', description: 'Motor pump fitting, pressure pump setup, pipeline connection' },
      { title: 'Overhead & Underground Tank Connection', description: 'New pipeline from tank, valve installation, pressure balancing' },
    ],
    faqs: [
      { question: 'What is the minimum service charge?', answer: 'The basic visit and inspection starts at ₹149. Final cost depends on the repair type and materials needed. You get a clear quote before work starts.' },
      { question: 'Do plumbers bring their own materials?', answer: 'Yes, our plumbers carry commonly needed items like taps, pipes, valves, washers, and fittings. You can use ours or provide your own.' },
      { question: 'How long does a typical plumbing job take?', answer: 'Small fixes like tap repair take 20-40 minutes. Bigger jobs like pipe replacement or new fitting installation may take 1-3 hours.' },
      { question: 'Can you fix concealed pipe leaks?', answer: 'Yes, our plumbers can detect and fix concealed pipe leaks. This may require minor wall opening which they will handle carefully.' },
      { question: 'Do you provide same-day service?', answer: 'Yes! Based on availability in your area, we offer same-day plumber visits. Book early for best time slots.' },
      { question: 'Is there a warranty on plumbing work?', answer: 'Yes, all plumbing work comes with a 30-day service guarantee. If the same issue recurs, we fix it free of charge.' },
    ],
  },

  // ──────────────── 2. Carpenter ────────────────
  {
    name: 'Carpenter',
    slug: 'carpenter',
    tagline: 'Skilled carpenters for furniture, doors, and all woodwork needs',
    description:
      'Professional carpentry services for your home — from furniture assembly and repair to custom woodwork. Our carpenters are experienced, carry their own tools, and deliver neat, durable results.',
    priceStartsFrom: 199,
    order: 3,
    highlights: [
      'Skilled & Verified Carpenters',
      'Own Tools & Equipment',
      '30-Day Workmanship Guarantee',
      'Furniture Assembly & Disassembly',
      'Custom Woodwork Available',
      'Neat & Clean Finishing',
    ],
    services: [
      { title: 'Furniture Assembly', description: 'Bed, wardrobe, table, chair, bookshelf — new furniture assembly from flat-pack or delivered items' },
      { title: 'Furniture Repair', description: 'Broken chair fix, table leg repair, drawer alignment, loose joint tightening' },
      { title: 'Door & Lock Repair', description: 'Door alignment, hinge replacement, lock fitting, latch repair, door closer installation' },
      { title: 'Window & Frame Repair', description: 'Window frame fix, glass pane fitting, sliding window track repair, mosquito net frame' },
      { title: 'Curtain Rod & Blinds', description: 'Curtain rod installation, bracket mounting, roller blind fitting' },
      { title: 'Wall Shelf & Mount', description: 'Floating shelf mounting, TV wall mount, picture frame hanging, bracket installation' },
      { title: 'Kitchen Cabinet Work', description: 'Cabinet door repair, hinge replacement, new shelf fitting, soft-close installation' },
      { title: 'Bed & Mattress Support', description: 'Plywood replacement, bed slat repair, headboard fix, under-bed storage box' },
      { title: 'Wooden Partition & False Ceiling', description: 'Wooden partition wall, false ceiling framework, PVC panel support' },
      { title: 'Custom Woodwork', description: 'Small custom furniture, wooden rack, shoe rack, pooja mandir, study table modifications' },
    ],
    faqs: [
      { question: 'What is the minimum charge for a carpenter?', answer: 'Basic service starts at ₹199. The final rate depends on the complexity and time required. You will always get a quote before work begins.' },
      { question: 'Does the carpenter bring tools?', answer: 'Yes, all our carpenters come fully equipped with their own professional tools and basic hardware items.' },
      { question: 'Can the carpenter assemble IKEA-style furniture?', answer: 'Absolutely! Our carpenters are experienced with flat-pack furniture assembly from any brand.' },
      { question: 'How long does furniture assembly take?', answer: 'A single item like a bed or wardrobe typically takes 1-2 hours. Multiple items may take half a day.' },
      { question: 'Do you handle custom furniture orders?', answer: 'Our carpenters can do small custom jobs and modifications. For large custom furniture, discuss requirements during booking.' },
      { question: 'Is there a guarantee on the work?', answer: 'Yes, all carpentry work is backed by a 30-day workmanship guarantee. Any issues within that period are fixed free.' },
    ],
  },

  // ──────────────── 3. AC Service & Repair ────────────────
  {
    name: 'AC Service & Repair',
    slug: 'ac-service-repair',
    tagline: 'AC installation, servicing & repair by certified technicians',
    description:
      'Keep your home cool with professional AC services. Our trained technicians handle all brands and types — split, window, cassette. From routine servicing to gas refill and full installation, we ensure your AC runs at peak performance.',
    priceStartsFrom: 299,
    order: 4,
    highlights: [
      'All Brands — Split, Window & Cassette',
      'Certified AC Technicians',
      '30-Day Service Guarantee',
      'Genuine Spare Parts',
      'Gas Leak Detection & Refill',
      'Same-Day Service Available',
    ],
    services: [
      { title: 'AC Regular Service', description: 'Filter cleaning, coil wash, drain check, gas pressure test, and performance optimization' },
      { title: 'AC Deep Cleaning', description: 'Complete foam/jet wash of indoor & outdoor unit, coil deep clean, anti-bacterial treatment' },
      { title: 'AC Gas Refill', description: 'Refrigerant gas top-up (R32/R410A/R22), leak detection, pressure testing' },
      { title: 'AC Installation', description: 'New split/window AC installation including copper piping, bracket, drain pipe, and electrical connection' },
      { title: 'AC Uninstallation', description: 'Safe removal of indoor and outdoor units, gas recovery, pipe disconnection' },
      { title: 'AC Repair', description: 'Compressor issue, PCB board repair, fan motor replacement, thermostat fix, strange noise diagnosis' },
      { title: 'AC Shifting / Relocation', description: 'Uninstall from old location and reinstall at new location with piping and bracket' },
      { title: 'Stabilizer Installation', description: 'Voltage stabilizer setup for AC, wiring connection, wall mounting' },
      { title: 'Duct & Cassette AC Service', description: 'Commercial duct/cassette AC servicing, filter replacement, coil cleaning' },
      { title: 'AC Rental & AMC', description: 'Annual maintenance contract setup, seasonal pre-check, priority service scheduling' },
    ],
    faqs: [
      { question: 'How often should I service my AC?', answer: 'We recommend servicing your AC every 3-4 months for optimal cooling and energy efficiency. At minimum, do it twice a year — before and after summer.' },
      { question: 'What is included in AC regular service?', answer: 'Regular service includes filter cleaning, evaporator coil check, drain pipe clearing, gas pressure check, and overall performance test.' },
      { question: 'How is deep cleaning different from regular service?', answer: 'Deep cleaning involves foam/jet washing of coils, thorough drain flush, and anti-bacterial spray. It removes deep dirt that regular service cannot.' },
      { question: 'How do I know if my AC needs gas refill?', answer: 'Signs include weak cooling, ice formation on pipes, hissing sounds, or the AC taking longer than usual to cool the room.' },
      { question: 'Do you service all AC brands?', answer: 'Yes — our technicians service all major brands including LG, Samsung, Daikin, Voltas, Blue Star, Hitachi, Carrier, and more.' },
      { question: 'How long does AC installation take?', answer: 'A standard split AC installation takes 1.5 to 2.5 hours depending on piping length and site conditions.' },
      { question: 'Is there warranty on repairs?', answer: 'Yes, all AC repairs come with a 30-day guarantee on the service. Spare parts carry the manufacturer warranty.' },
    ],
  },

  // ──────────────── 4. Painter ────────────────
  {
    name: 'Painter',
    slug: 'painter',
    tagline: 'Professional painting services — fresh walls, fresh vibes',
    description:
      'Transform your home with professional painting services. Our verified painters handle everything from single wall touch-ups to full home painting. We use premium paints, ensure clean edges, and protect your furniture throughout the process.',
    priceStartsFrom: 999,
    order: 5,
    highlights: [
      'Experienced & Verified Painters',
      'Premium Paints (Asian, Berger, Nerolac)',
      'Free Color Consultation',
      'Furniture & Floor Protection',
      'Clean Edges & Smooth Finish',
      'No Hidden Charges',
    ],
    services: [
      { title: 'Interior Wall Painting', description: 'Full room or full home interior painting with primer, putty, and 2-coat finish' },
      { title: 'Exterior Wall Painting', description: 'Weatherproof exterior painting with primer and 2 coats of exterior emulsion' },
      { title: 'Single Wall / Accent Wall', description: 'Feature wall painting, accent color, or contrast wall for living room or bedroom' },
      { title: 'Texture Painting', description: 'Decorative texture finish — roller texture, spatula texture, metallic finishes' },
      { title: 'Wall Putty & Primer', description: 'Wall preparation — crack filling, putty application, sanding, and primer coating' },
      { title: 'Waterproofing', description: 'Dr. Fixit or equivalent waterproof coating for bathroom walls, terrace, and external walls' },
      { title: 'Wood & Metal Painting', description: 'Door painting, window frame painting, railing enamel paint, furniture polish' },
      { title: 'Ceiling Painting', description: 'Ceiling whitewash, emulsion coat, false ceiling painting' },
      { title: 'Stencil & Design Work', description: 'Wall stencil patterns, geometric designs, kids room themes' },
      { title: 'Touch-Up & Patch Work', description: 'Small area touch-up, stain cover, patch repair and paint matching' },
    ],
    faqs: [
      { question: 'What is the rate for painting per sq ft?', answer: 'Rates vary by paint type and finish. Basic emulsion starts around ₹12-18/sq ft including material and labor. Premium paints cost ₹20-35/sq ft. Get an exact quote during booking.' },
      { question: 'Do I need to provide the paint?', answer: 'You can choose to provide your own paint or we can include it in the service. Our painters work with all major brands — Asian Paints, Berger, Nerolac, etc.' },
      { question: 'How long does it take to paint a 2BHK?', answer: 'A full 2BHK interior painting (with putty and primer) typically takes 5-7 days depending on wall condition and coats needed.' },
      { question: 'Will my furniture be protected?', answer: 'Yes, painters cover all furniture, floors, and switchboards with protective sheets before starting work.' },
      { question: 'Do you do waterproofing for bathrooms?', answer: 'Yes! We offer waterproofing solutions for bathroom walls, wet areas, terraces, and external walls using Dr. Fixit and similar products.' },
      { question: 'Can I get a color consultation?', answer: 'Absolutely! Our painters can suggest color combinations based on your room, lighting, and preferences at no extra charge.' },
    ],
  },

  // ──────────────── 5. Home Cleaning ────────────────
  {
    name: 'Home Cleaning',
    slug: 'home-cleaning',
    tagline: 'Spotless homes, happy families — professional deep cleaning',
    description:
      'Professional home cleaning services to make every corner of your home sparkle. Our trained cleaners use eco-friendly products and professional-grade equipment for a thorough, hygienic clean.',
    priceStartsFrom: 499,
    order: 6,
    highlights: [
      'Trained & Background-Verified Staff',
      'Eco-Friendly Cleaning Products',
      'Professional Equipment Used',
      'All Rooms Covered',
      'Flexible Scheduling',
      'Satisfaction Guarantee',
    ],
    services: [
      { title: 'Full Home Deep Cleaning', description: 'Complete cleaning of all rooms — dusting, mopping, scrubbing, cobweb removal, fan cleaning' },
      { title: 'Bathroom Deep Cleaning', description: 'Tile scrubbing, grout cleaning, fixture polishing, mirror cleaning, drain clearing' },
      { title: 'Kitchen Deep Cleaning', description: 'Chimney exterior, cabinet cleaning, gas stove degreasing, countertop scrub, sink cleaning' },
      { title: 'Sofa & Upholstery Cleaning', description: 'Fabric/leather sofa shampooing, stain removal, cushion cleaning, drying' },
      { title: 'Carpet & Rug Cleaning', description: 'Deep vacuum, shampoo wash, stain treatment, deodorizing' },
      { title: 'Mattress Cleaning', description: 'Dust mite removal, stain cleaning, anti-bacterial treatment, UV sanitization' },
      { title: 'Balcony & Terrace Cleaning', description: 'Floor scrubbing, railing wipe, cobweb removal, drainage cleaning' },
      { title: 'Move-In / Move-Out Cleaning', description: 'Complete home cleaning for shifting — walls wipe, floor scrub, all rooms deep cleaned' },
      { title: 'Office / Commercial Cleaning', description: 'Workspace cleaning, desk sanitization, conference room, washroom deep clean' },
      { title: 'Post-Construction Cleaning', description: 'Cement/paint stain removal, debris clearing, full home wipe-down after renovation' },
    ],
    faqs: [
      { question: 'How long does a full home deep cleaning take?', answer: 'For a 2BHK, it typically takes 3-5 hours with a team of 2 cleaners. Larger homes or very dirty spaces may take longer.' },
      { question: 'Do you bring your own cleaning supplies?', answer: 'Yes, our team brings all cleaning products and equipment. We use eco-friendly, non-toxic products that are safe for kids and pets.' },
      { question: 'Do I need to be home during cleaning?', answer: 'We recommend being home during the first visit. After that, many customers provide access and our verified team handles the rest.' },
      { question: 'How often should I get deep cleaning done?', answer: 'We recommend deep cleaning once every 2-3 months. For kitchens and bathrooms, monthly deep cleaning is ideal.' },
      { question: 'Can I book for just one room?', answer: 'Yes! You can book bathroom-only, kitchen-only, or any specific area. Pricing adjusts accordingly.' },
      { question: 'What about sofa cleaning for leather sofas?', answer: 'Yes, we handle both fabric and leather sofas with appropriate products. Leather sofas get special conditioning treatment.' },
    ],
  },

  // ──────────────── 6. Appliance Repair ────────────────
  {
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    tagline: 'Quick & reliable repair for all home appliances',
    description:
      'Don\'t replace — repair! Our skilled technicians fix washing machines, refrigerators, microwaves, geysers, and more. We service all major brands and use genuine spare parts for lasting results.',
    priceStartsFrom: 199,
    order: 7,
    highlights: [
      'All Major Brands Serviced',
      'Genuine Spare Parts',
      '30-Day Repair Guarantee',
      'Experienced Technicians',
      'On-the-Spot Diagnosis',
      'Affordable & Transparent Pricing',
    ],
    services: [
      { title: 'Washing Machine Repair', description: 'Drum issue, water leak, spin problem, timer fault, motor repair for top/front load' },
      { title: 'Refrigerator Repair', description: 'Not cooling, gas leak, compressor issue, thermostat fix, door seal replacement' },
      { title: 'Microwave Repair', description: 'Not heating, turntable issue, door latch fix, magnetron replacement, panel repair' },
      { title: 'Geyser / Water Heater Repair', description: 'No hot water, thermostat issue, element replacement, tank leak, safety valve fix' },
      { title: 'Chimney Repair & Service', description: 'Suction problem, motor issue, filter cleaning, auto-clean malfunction, light fix' },
      { title: 'Dishwasher Repair', description: 'Not draining, spray arm issue, detergent dispenser fix, door leak' },
      { title: 'Induction Cooktop Repair', description: 'Not turning on, error code display, coil issue, touch panel malfunction' },
      { title: 'Mixer / Grinder Repair', description: 'Motor burn, jar leak, blade replacement, switch fix, speed control issue' },
      { title: 'Air Cooler Repair', description: 'Pump not working, fan issue, water leakage, pad replacement, motor repair' },
      { title: 'Iron & Small Appliance Repair', description: 'Steam iron, water purifier dispenser, room heater, exhaust fan repair' },
    ],
    faqs: [
      { question: 'Which brands do you service?', answer: 'We service all major brands — LG, Samsung, Whirlpool, Bosch, IFB, Godrej, Haier, Voltas, and many more.' },
      { question: 'What if the appliance can\'t be repaired?', answer: 'Our technician will diagnose the issue first. If repair isn\'t cost-effective, they\'ll honestly advise you and you only pay the inspection fee.' },
      { question: 'Do you use genuine spare parts?', answer: 'Yes, we use genuine or high-quality compatible parts. The technician will show you the part and price before replacing.' },
      { question: 'How quickly can you send a technician?', answer: 'We offer same-day service based on availability. Most requests are fulfilled within 2-4 hours of booking.' },
      { question: 'Is there a warranty on repairs?', answer: 'Yes — 30-day warranty on service work. Spare parts carry their own manufacturer warranty (typically 3-6 months).' },
      { question: 'What is the inspection/visit charge?', answer: 'Basic inspection starts at ₹199. This is adjusted against the final repair bill if you proceed with the repair.' },
    ],
  },

  // ──────────────── 7. RO / Water Purifier ────────────────
  {
    name: 'RO / Water Purifier',
    slug: 'ro-water-purifier',
    tagline: 'Clean water, healthy family — RO service & filter replacement',
    description:
      'Professional RO and water purifier services for all brands. From annual maintenance to filter changes and new installation, our technicians ensure your water is always pure and safe to drink.',
    priceStartsFrom: 199,
    order: 8,
    highlights: [
      'All Brands — Kent, Aquaguard, Pureit & More',
      'Genuine Filters & Membranes',
      '30-Day Service Guarantee',
      'TDS Testing Included',
      'Same-Day Service',
      'Annual Maintenance Plans',
    ],
    services: [
      { title: 'RO Full Service', description: 'Complete servicing — filter check, membrane flush, sanitization, TDS calibration, leak check' },
      { title: 'Filter Replacement', description: 'Sediment filter, carbon filter, UF membrane, post-carbon filter replacement' },
      { title: 'RO Membrane Replacement', description: 'Worn-out RO membrane replacement with genuine/compatible membrane' },
      { title: 'New RO Installation', description: 'Wall mounting, inlet connection, drain pipe setup, tank connection, TDS setting' },
      { title: 'RO Uninstallation & Shifting', description: 'Safe removal and reinstallation at new location' },
      { title: 'UV Lamp Replacement', description: 'UV purifier lamp replacement, chamber cleaning, flow sensor check' },
      { title: 'Water Leakage Fix', description: 'Pipe joint leak, tank overflow, tap drip, tube connector replacement' },
      { title: 'TDS Controller Repair', description: 'TDS adjuster fix, bypass valve replacement, mineral cartridge change' },
      { title: 'Annual Maintenance (AMC)', description: 'Covers 3-4 services per year with filter replacements and priority support' },
    ],
    faqs: [
      { question: 'How often should I service my RO?', answer: 'Every 3-4 months is recommended. Filters should be changed every 6-12 months depending on water quality and usage.' },
      { question: 'How do I know if the membrane needs replacing?', answer: 'Signs include bad taste, low water flow, high TDS readings, or the purifier running longer than usual. Our technician will test and advise.' },
      { question: 'Which RO brands do you service?', answer: 'We service Kent, Aquaguard, Pureit, Livpure, Havells, Blue Star, AO Smith, and all other brands.' },
      { question: 'Do you provide genuine filters?', answer: 'Yes, we use genuine or high-quality compatible filters. The technician shows you the parts before installation.' },
      { question: 'What is included in a full RO service?', answer: 'Full service includes filter cleaning/replacement check, membrane flush, tank sanitization, TDS testing, leak inspection, and external cleaning.' },
      { question: 'Can you install a new RO purifier?', answer: 'Yes! We handle complete new installation including wall mounting, plumbing connection, drain setup, and TDS calibration.' },
    ],
  },

  // ──────────────── 8. CCTV & Security ────────────────
  {
    name: 'CCTV & Security',
    slug: 'cctv-security',
    tagline: 'Secure your home & business — CCTV installation & surveillance',
    description:
      'Professional CCTV camera installation, DVR/NVR setup, and security system services. Our technicians handle wired, wireless, and IP camera systems for homes, shops, and offices.',
    priceStartsFrom: 499,
    order: 9,
    highlights: [
      'All Camera Types — Dome, Bullet, PTZ, IP',
      'DVR/NVR Setup & Configuration',
      'Mobile App Setup for Remote Viewing',
      'Wired & Wireless Solutions',
      'Night Vision & HD Quality',
      '30-Day Installation Guarantee',
    ],
    services: [
      { title: 'CCTV Camera Installation', description: 'Dome/bullet/IP camera mounting, cable routing, power connection at home or shop' },
      { title: 'DVR / NVR Setup', description: 'Hard disk installation, channel configuration, recording schedule setup' },
      { title: 'Mobile App Configuration', description: 'Remote viewing setup on phone — live feed, playback, motion alerts, cloud access' },
      { title: 'WiFi / Wireless Camera Setup', description: 'Smart camera installation, WiFi pairing, cloud storage configuration' },
      { title: 'Camera Repair & Replacement', description: 'Blurry image fix, night vision issue, cable fault, camera swap' },
      { title: 'Additional Camera Addition', description: 'Adding new cameras to existing DVR/NVR system, cable extension' },
      { title: 'Video Door Phone / Intercom', description: 'Video doorbell installation, intercom system wiring, screen mounting' },
      { title: 'Alarm & Sensor System', description: 'Motion sensor, door sensor, intruder alarm installation and configuration' },
      { title: 'CCTV AMC & Maintenance', description: 'Annual maintenance — cleaning, cable check, HDD health, firmware update' },
    ],
    faqs: [
      { question: 'How many cameras do I need for a home?', answer: 'A typical home needs 4-6 cameras — covering main gate, parking, back door, and corridor. Our technician will suggest the best placement on-site.' },
      { question: 'Can I view cameras on my phone?', answer: 'Yes! We set up remote viewing on your phone so you can watch live feed, playback recordings, and get motion alerts from anywhere.' },
      { question: 'Wired or wireless — which is better?', answer: 'Wired cameras give more reliable, high-quality footage. Wireless is easier to install and flexible. We help you choose based on your needs.' },
      { question: 'How much storage do I need?', answer: 'A 1TB hard disk stores about 7-15 days of footage for 4 cameras. We recommend 2TB for extended recording or more cameras.' },
      { question: 'Do cameras work at night?', answer: 'Yes, all our recommended cameras have infrared night vision that works in complete darkness up to 20-30 meters.' },
      { question: 'How long does installation take?', answer: 'A 4-camera home setup typically takes 3-5 hours including cabling, mounting, DVR setup, and phone app configuration.' },
    ],
  },

  // ──────────────── 9. Bike Service ────────────────
  {
    name: 'Bike Service',
    slug: 'bike-service',
    tagline: 'Doorstep bike servicing — ride smooth, ride safe',
    description:
      'Get your bike serviced at your doorstep! Our trained mechanics handle everything from basic servicing to brake repair and engine tuning. All popular bike brands covered.',
    priceStartsFrom: 299,
    order: 10,
    highlights: [
      'Doorstep Service — No Garage Visit',
      'All Brands — Honda, TVS, Bajaj, RE & More',
      'Trained Two-Wheeler Mechanics',
      'Genuine Oil & Spare Parts',
      '30-Day Service Guarantee',
      'Quick Turnaround — 1-2 Hours',
    ],
    services: [
      { title: 'General / Periodic Service', description: 'Engine oil change, air filter clean, chain lubrication, brake check, overall inspection' },
      { title: 'Oil & Filter Change', description: 'Engine oil replacement (synthetic/semi-synthetic), oil filter change' },
      { title: 'Brake Pad & Disc Service', description: 'Front/rear brake pad replacement, disc cleaning, brake fluid top-up, cable adjustment' },
      { title: 'Chain & Sprocket', description: 'Chain cleaning, lubrication, tension adjustment, chain-sprocket set replacement' },
      { title: 'Battery Service', description: 'Battery testing, terminal cleaning, electrolyte top-up, new battery installation' },
      { title: 'Tyre & Puncture', description: 'Tubeless puncture repair, tyre replacement, wheel balancing, air pressure check' },
      { title: 'Carburetor / FI Cleaning', description: 'Carburetor tuning, fuel injector cleaning, idle speed adjustment' },
      { title: 'Clutch & Cable Adjustment', description: 'Clutch plate check, cable replacement, free play adjustment, lever fix' },
      { title: 'Engine Tuning', description: 'Spark plug replacement, valve clearance adjustment, compression check' },
      { title: 'Full Body Wash & Polish', description: 'Foam wash, wax polish, chrome polish, chain lube, tyre shine' },
    ],
    faqs: [
      { question: 'Do you service at my home?', answer: 'Yes! Our mechanics come to your doorstep with all necessary tools and supplies. No need to visit a garage.' },
      { question: 'How long does a general service take?', answer: 'A basic service takes about 1-1.5 hours. More involved work like brake or chain replacement may take 2-3 hours.' },
      { question: 'Which engine oil brands do you use?', answer: 'We use Motul, Castrol, Shell, and other reputed brands. You can choose your preferred oil grade and brand.' },
      { question: 'Do you service electric scooters?', answer: 'Currently we focus on petrol-powered two-wheelers. Electric scooter support is coming soon!' },
      { question: 'Can I get my bike washed along with service?', answer: 'Yes, you can add a full body wash and polish to any service booking at a discounted combo price.' },
      { question: 'Is there a warranty on spare parts?', answer: 'Yes, all spare parts carry manufacturer warranty. Service work has a 30-day guarantee.' },
    ],
  },

  // ──────────────── 10. 4 Wheeler Service ────────────────
  {
    name: '4 Wheeler Service',
    slug: '4-wheeler-service',
    tagline: 'Car servicing & detailing — at your parking, not the garage',
    description:
      'Professional car service at your doorstep. From periodic maintenance to detailing and minor repairs, our trained mechanics keep your car running smooth without the hassle of garage visits.',
    priceStartsFrom: 499,
    order: 11,
    highlights: [
      'Doorstep Car Service',
      'All Brands — Maruti, Hyundai, Tata, Honda & More',
      'Trained Four-Wheeler Mechanics',
      'Genuine Oil & Filters',
      '30-Day Service Guarantee',
      'Interior & Exterior Detailing',
    ],
    services: [
      { title: 'Periodic / General Service', description: 'Engine oil change, oil filter, air filter, coolant top-up, multi-point inspection' },
      { title: 'Car Washing & Detailing', description: 'Foam wash, interior vacuum, dashboard polish, tyre dressing, glass cleaning' },
      { title: 'Brake Service', description: 'Brake pad replacement, disc cleaning/turning, brake fluid change, handbrake adjustment' },
      { title: 'Battery Replacement', description: 'Battery health check, terminal cleaning, jump start, new battery installation (Amaron, Exide)' },
      { title: 'AC Service & Gas Refill', description: 'Cabin filter replacement, AC gas top-up, vent cleaning, cooling check' },
      { title: 'Tyre & Wheel Service', description: 'Tyre rotation, puncture repair, wheel alignment check, tyre replacement, nitrogen fill' },
      { title: 'Engine Oil & Filter Change', description: 'Synthetic/semi-synthetic oil change with filter — Castrol, Shell, Mobil brands' },
      { title: 'Wiper & Light Replacement', description: 'Wiper blade change, headlight/taillight bulb replacement, fog lamp fitting' },
      { title: 'Interior Deep Cleaning', description: 'Seat shampooing, floor mat wash, roof cleaning, AC vent sanitization' },
      { title: 'Ceramic Coating & Paint Protection', description: 'Ceramic coating application, paint sealant, scratch removal, headlight restoration' },
    ],
    faqs: [
      { question: 'How is doorstep car service done?', answer: 'Our mechanic arrives at your location with all tools and supplies. Basic services like oil change, wash, and detailing are done in your parking or driveway.' },
      { question: 'How long does a general car service take?', answer: 'A standard periodic service takes about 2-3 hours. Detailing or major services may take 4-6 hours.' },
      { question: 'Which car brands do you cover?', answer: 'We service all popular brands — Maruti, Hyundai, Tata, Honda, Toyota, Kia, MG, Mahindra, Volkswagen, Skoda, and more.' },
      { question: 'Can you handle diesel and CNG cars?', answer: 'Yes, our mechanics are trained for petrol, diesel, and CNG vehicles.' },
      { question: 'Do you provide genuine spare parts?', answer: 'We use genuine or OEM-equivalent parts. Every part is shown to you with price before replacement.' },
      { question: 'Is there any warranty on the service?', answer: 'Yes — 30-day service guarantee. Spare parts carry manufacturer warranty (3-12 months depending on the part).' },
    ],
  },

  // ──────────────── 11. Interior Design Consultation ────────────────
  {
    name: 'Interior Design Consultation',
    slug: 'interior-design-consultation',
    tagline: 'Turn your space into a masterpiece — expert interior guidance',
    description:
      'Get professional interior design advice for your home or office. Our designers help with space planning, color schemes, furniture selection, modular kitchen design, and complete home makeovers — all within your budget.',
    priceStartsFrom: 999,
    order: 12,
    highlights: [
      'Experienced Interior Designers',
      'Budget-Friendly Solutions',
      '3D Layout & Visualization',
      'Modular Kitchen & Wardrobe Design',
      'Material & Vendor Guidance',
      'End-to-End Project Support',
    ],
    services: [
      { title: 'Home Interior Consultation', description: 'On-site visit, space analysis, style discussion, budget planning, concept proposal' },
      { title: 'Living Room Design', description: 'Layout planning, furniture selection, TV unit design, lighting, color palette' },
      { title: 'Bedroom Design', description: 'Wardrobe planning, bed placement, study corner, false ceiling, accent wall design' },
      { title: 'Modular Kitchen Design', description: 'L/U/Parallel kitchen layout, cabinet material, countertop, chimney, backsplash design' },
      { title: 'Bathroom Design', description: 'Tile selection, vanity design, shower partition, fixture placement, storage solutions' },
      { title: 'Pooja Room / Mandir Design', description: 'Custom mandir unit, lighting, jali work, back panel, storage drawer design' },
      { title: 'Kids Room Design', description: 'Theme-based design, study desk, bunk bed layout, storage, safety features' },
      { title: 'Office / Commercial Interior', description: 'Workspace layout, cabin design, reception area, conference room planning' },
      { title: 'False Ceiling & Lighting Design', description: 'Ceiling layout, cove lighting, LED strip planning, chandelier selection' },
      { title: 'Complete Home Makeover', description: 'Full home redesign — all rooms, furniture, paint, electrical, false ceiling, decor' },
    ],
    faqs: [
      { question: 'What happens in the first consultation?', answer: 'The designer visits your space, discusses your requirements, lifestyle, and budget. They then propose a concept with layout ideas and material suggestions.' },
      { question: 'Do you provide 3D designs?', answer: 'Yes, for detailed projects we provide 3D renderings so you can visualize how your space will look before execution begins.' },
      { question: 'How much does a full home interior cost?', answer: 'It varies widely based on size, materials, and finishes. A basic 2BHK can start from ₹3-5 lakhs. The designer will give a detailed estimate after understanding your needs.' },
      { question: 'Do you handle execution too?', answer: 'Yes! We can manage the complete execution — carpentry, painting, electrical, plumbing, and installation — through our verified workers.' },
      { question: 'Can I get design for just one room?', answer: 'Absolutely! Many customers start with just a kitchen or living room. You can get consultation for as little as one room.' },
      { question: 'How long does a full home interior project take?', answer: 'A typical 2-3BHK interior project takes 30-60 days from design approval to final installation, depending on customizations.' },
    ],
  },

  // ──────────────── 12. Welding & Fabrication ────────────────
  {
    name: 'Welding & Fabrication',
    slug: 'welding-fabrication',
    tagline: 'Strong welds, solid structures — gates, grills & custom metalwork',
    description:
      'Professional welding and fabrication services for your home. Our skilled welders handle gate repair, window grills, railing work, MS fabrication, and custom metalwork with precision and durability.',
    priceStartsFrom: 299,
    order: 13,
    highlights: [
      'Experienced & Verified Welders',
      'Arc, MIG & Spot Welding',
      'MS, SS & Aluminium Work',
      'On-Site & Workshop Fabrication',
      'Anti-Rust Coating Available',
      '30-Day Workmanship Guarantee',
    ],
    services: [
      { title: 'Gate Repair & Fabrication', description: 'Main gate welding, hinge repair, latch fix, new MS/SS gate fabrication' },
      { title: 'Window Grill Installation', description: 'Safety grill fabrication, mosquito mesh frame, decorative grill design' },
      { title: 'Railing & Handrail', description: 'Staircase railing, balcony railing, terrace railing — MS, SS, or glass' },
      { title: 'Iron Door & Frame', description: 'Iron safety door, collapsible gate, frame welding, shutter repair' },
      { title: 'Shed & Roof Structure', description: 'Parking shed, terrace shade, tin/polycarbonate roofing, support structure' },
      { title: 'Tank Stand & Rack', description: 'Water tank stand, overhead structure, wall-mounted rack, heavy-duty shelving' },
      { title: 'Furniture Welding', description: 'Metal chair/table repair, bed frame welding, metal almirah fix' },
      { title: 'Custom Fabrication', description: 'Custom metal structures — plant stands, signboards, hooks, brackets' },
      { title: 'Anti-Rust Treatment', description: 'Rust removal, primer coating, anti-corrosion paint for existing metalwork' },
    ],
    faqs: [
      { question: 'Do welders come to my location?', answer: 'Yes, for repairs and installation our welders come to your home. For large fabrication, work may be done at a workshop and installed on-site.' },
      { question: 'What types of welding do you offer?', answer: 'Our welders are skilled in arc welding, MIG welding, and spot welding for MS, SS, and aluminum materials.' },
      { question: 'Can you fabricate a new gate from scratch?', answer: 'Yes! Provide your design or dimensions, and our fabricator will build a custom gate — MS or SS — installed with anti-rust coating.' },
      { question: 'How long does grill installation take?', answer: 'A standard window grill takes 1-2 hours per window for installation. Fabrication (if needed) takes 1-3 days at the workshop.' },
      { question: 'Do you provide anti-rust coating?', answer: 'Yes, we offer anti-rust primer and paint coating for all metalwork to ensure long-lasting protection against corrosion.' },
      { question: 'What is the starting price?', answer: 'Simple welding repairs start at ₹299. Custom fabrication is priced based on material, size, and complexity — you get a quote before work begins.' },
    ],
  },

  // ──────────────── 13. Computer / Laptop Repair ────────────────
  {
    name: 'Computer / Laptop Repair',
    slug: 'computer-laptop-repair',
    tagline: 'Fast & reliable computer repair — at your home or office',
    description:
      'Professional computer and laptop repair services at your doorstep. Our certified technicians fix hardware issues, software problems, virus removal, data recovery, and more for all brands.',
    priceStartsFrom: 199,
    order: 14,
    highlights: [
      'All Brands — Dell, HP, Lenovo, Apple & More',
      'Hardware & Software Repair',
      'Data Safety — Your Privacy Matters',
      'On-the-Spot Diagnosis',
      'Genuine Parts & Licensed Software',
      '30-Day Repair Guarantee',
    ],
    services: [
      { title: 'Laptop Not Turning On', description: 'Power issue diagnosis, motherboard check, adapter test, charging port repair' },
      { title: 'Slow Performance Fix', description: 'RAM upgrade, HDD to SSD upgrade, startup optimization, bloatware removal' },
      { title: 'Virus & Malware Removal', description: 'Complete system scan, virus cleanup, security software installation, browser cleanup' },
      { title: 'OS Installation / Reinstall', description: 'Windows 10/11, Linux, or macOS clean install with drivers and essential software setup' },
      { title: 'Screen Replacement', description: 'Cracked or dead display replacement for laptops — LED/LCD/IPS panel' },
      { title: 'Keyboard & Trackpad Repair', description: 'Key replacement, full keyboard swap, trackpad malfunction fix' },
      { title: 'Data Recovery', description: 'Recover files from corrupted HDD/SSD, formatted drives, crashed systems' },
      { title: 'WiFi & Connectivity Issues', description: 'WiFi not connecting, Bluetooth fix, LAN port repair, driver installation' },
      { title: 'Battery Replacement', description: 'Laptop battery health check, genuine battery replacement, calibration' },
      { title: 'Desktop Assembly & Repair', description: 'Custom PC build, component upgrade (RAM, GPU, SSD), power supply replacement' },
      { title: 'Printer Setup & Repair', description: 'Printer installation, WiFi printing setup, cartridge/toner replacement, paper jam fix' },
    ],
    faqs: [
      { question: 'Do you repair at home or take the laptop?', answer: 'Most repairs like software fix, virus removal, RAM/SSD upgrade are done on-site. Hardware repairs like screen or motherboard may need 1-2 days at our service center.' },
      { question: 'Which brands do you service?', answer: 'All brands — Dell, HP, Lenovo, Asus, Acer, Apple MacBook, MSI, Samsung, and assembled PCs.' },
      { question: 'Is my data safe during repair?', answer: 'Absolutely. Data privacy is our top priority. We never access personal files and recommend backups before major repairs.' },
      { question: 'How long does a typical repair take?', answer: 'Software fixes take 1-2 hours on-site. Hardware repairs like screen replacement take 1-2 business days.' },
      { question: 'Can you upgrade my old laptop?', answer: 'Yes! RAM upgrade and HDD to SSD swap can dramatically improve your laptop\'s speed. Our technician will check compatibility and do it on-site.' },
      { question: 'Do you set up new laptops?', answer: 'Yes, we offer fresh laptop setup — OS activation, essential software installation, data transfer from old laptop, printer & email configuration.' },
    ],
  },
];

async function seed() {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected!\n');

    let inserted = 0;
    let updated = 0;

    for (const cat of categories) {
      const { slug, ...data } = cat;
      const result = await Category.findOneAndUpdate(
        { slug },
        { $set: { slug, ...data } },
        { upsert: true, new: true }
      );
      // If createdAt and updatedAt are very close, it's a new doc
      const isNew = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;
      if (isNew) {
        console.log(`✅ Created: ${cat.name}`);
        inserted++;
      } else {
        console.log(`🔄 Updated: ${cat.name}`);
        updated++;
      }
    }

    console.log(`\n🎉 Done! ${inserted} created, ${updated} updated.`);
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

seed();
