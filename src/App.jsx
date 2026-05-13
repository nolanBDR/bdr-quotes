import { useState, useCallback, useRef, useEffect } from "react";

const ANTHROPIC_KEY = (() => { try { return import.meta.env.VITE_ANTHROPIC_KEY || ""; } catch(e) { return ""; } })();

// ── Rate Sheet ────────────────────────────────────────────────
const RATES = {
  "ON|Houston|TX":       [375,475,575,675,800,950,1080,1215,1350,1485,1620,1755,1890,2025,2160,2295,2430,2565,2700,2835,2970,3100],
  "ON|Dallas|TX":        [375,475,575,675,800,925,1050,1150,1300,1400,1525,1650,1775,1900,2000,2125,2250,2375,2500,2600,2725,3600],
  "ON|San Antonio|TX":   [400,500,600,700,850,1000,1125,1275,1425,1575,1700,1875,2000,2150,2300,2450,2575,2725,2875,3025,3175,3800],
  "ON|Detroit|MI":       [350,375,425,450,500,550,600,625,650,675,700,725,750,775,800,825,850,875,900,925,950,1100],
  "ON|Lansing|MI":       [375,400,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100,1150,1200,1250,1300,1350,1400],
  "ON|Grand Rapids|MI":  [400,425,475,525,575,625,700,775,850,925,975,1050,1125,1200,1275,1350,1400,1450,1500,1550,1600,1650],
  "ON|Toledo|OH":        [375,400,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100,1150,1200,1250,1300,1350,1400],
  "ON|Cleveland|OH":     [400,425,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100,1150,1200,1250,1300,1350,1600],
  "ON|Cincinnati|OH":    [400,450,500,525,575,625,700,775,850,925,1000,1075,1125,1200,1275,1350,1400,1450,1500,1550,1600,1800],
  "ON|Columbus|OH":      [400,450,500,525,575,625,700,775,850,925,1000,1075,1125,1200,1275,1350,1400,1450,1500,1550,1600,1800],
  "ON|Louisville|KY":    [375,425,475,525,600,650,700,750,800,850,900,950,1000,1050,1100,1150,1200,1250,1300,1350,1400,2000],
  "ON|Chicago|IL":       [375,400,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100,1150,1200,1250,1300,1375,1800],
  "ON|Indianapolis|IN":  [375,425,475,525,575,625,675,725,775,825,875,925,975,1025,1075,1125,1175,1225,1275,1325,1375,1800],
  "ON|St Louis|MO":      [375,425,475,525,600,675,750,825,900,975,1050,1125,1200,1275,1350,1425,1500,1575,1650,1725,1800,2400],
  "ON|Kansas City|KS":   [400,450,500,550,625,700,775,850,925,1000,1075,1150,1225,1300,1375,1450,1525,1600,1675,1750,1825,3000],
  "ON|Nashville|TN":     [375,425,475,525,575,650,725,800,875,950,1025,1100,1175,1250,1325,1400,1475,1550,1625,1700,1775,2400],
  "ON|Memphis|TN":       [400,450,525,600,675,750,825,900,975,1050,1125,1200,1275,1375,1450,1525,1600,1675,1750,1825,1900,3000],
  "QC|Houston|TX":       [475,625,775,925,1100,1300,1600,1800,1975,2175,2350,2550,2725,2900,3100,3300,3475,3650,3825,4050,4200,6000],
  "QC|Dallas|TX":        [475,625,775,925,1100,1275,1450,1625,1800,1950,2125,2300,2475,2650,2800,2975,3150,3325,3500,3650,3825,5800],
  "QC|San Antonio|TX":   [500,650,800,950,1150,1350,1525,1725,1925,2125,2300,2525,2700,2900,3100,3300,3475,3675,3875,4075,4275,6800],
  "QC|Detroit|MI":       [450,525,625,700,800,900,1000,1075,1150,1225,1300,1375,1450,1525,1600,1675,1750,1825,1900,1975,2050,2500],
  "QC|Lansing|MI":       [475,550,650,750,850,950,1050,1150,1250,1350,1450,1550,1650,1750,1850,1950,2050,2150,2250,2350,2450,2800],
  "QC|Grand Rapids|MI":  [500,575,675,775,875,975,1100,1225,1350,1475,1575,1700,1825,1950,2075,2200,2300,2400,2500,2600,2700,3200],
  "QC|Toledo|OH":        [475,550,650,750,850,950,1050,1150,1250,1350,1450,1550,1650,1750,1850,1950,2050,2150,2250,2350,2450,2800],
  "QC|Cleveland|OH":     [500,575,650,750,850,950,1075,1175,1300,1400,1500,1600,1700,1800,1900,2000,2150,2250,2350,2450,2550,3400],
  "QC|Cincinnati|OH":    [500,600,700,775,875,975,1100,1225,1350,1475,1600,1725,1825,1950,2075,2200,2300,2400,2500,2600,2700,3400],
  "QC|Columbus|OH":      [500,600,700,775,875,975,1100,1225,1350,1475,1600,1725,1825,1950,2075,2200,2300,2400,2500,2600,2700,3400],
  "QC|Louisville|KY":    [475,575,675,775,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,3400],
  "QC|Chicago|IL":       [475,575,675,775,900,1000,1050,1150,1250,1350,1450,1550,1650,1750,1850,1950,2050,2150,2250,2350,2450,3200],
  "QC|Indianapolis|IN":  [475,575,675,775,900,1000,1050,1150,1250,1350,1450,1550,1650,1750,1850,1950,2050,2150,2250,2350,2450,3200],
  "QC|St Louis|MO":      [475,575,675,775,900,1025,1150,1275,1400,1525,1650,1775,1900,2025,2150,2275,2400,2525,2650,2775,2900,3600],
  "QC|Kansas City|KS":   [500,600,700,800,925,1050,1175,1300,1425,1550,1675,1800,1925,2050,2175,2300,2425,2550,2675,2800,2925,4100],
  "QC|Nashville|TN":     [475,575,675,775,900,1025,1150,1275,1400,1525,1650,1775,1900,2025,2150,2275,2400,2525,2650,2775,2900,3600],
  "QC|Memphis|TN":       [500,600,725,850,975,1100,1225,1350,1475,1600,1725,1850,1975,2125,2250,2375,2500,2625,2750,2875,3000,3800],
};

const RATE_CITIES = [
  { city:"Houston",     state:"TX", lat:29.760, lon:-95.370 },
  { city:"Dallas",      state:"TX", lat:32.779, lon:-96.800 },
  { city:"San Antonio", state:"TX", lat:29.424, lon:-98.494 },
  { city:"Detroit",     state:"MI", lat:42.331, lon:-83.046 },
  { city:"Lansing",     state:"MI", lat:42.732, lon:-84.555 },
  { city:"Grand Rapids",state:"MI", lat:42.963, lon:-85.668 },
  { city:"Toledo",      state:"OH", lat:41.663, lon:-83.555 },
  { city:"Cleveland",   state:"OH", lat:41.499, lon:-81.695 },
  { city:"Cincinnati",  state:"OH", lat:39.103, lon:-84.512 },
  { city:"Columbus",    state:"OH", lat:39.961, lon:-82.999 },
  { city:"Louisville",  state:"KY", lat:38.252, lon:-85.759 },
  { city:"Chicago",     state:"IL", lat:41.878, lon:-87.630 },
  { city:"Indianapolis",state:"IN", lat:39.768, lon:-86.158 },
  { city:"St Louis",    state:"MO", lat:38.627, lon:-90.199 },
  { city:"Kansas City", state:"KS", lat:39.099, lon:-94.578 },
  { city:"Nashville",   state:"TN", lat:36.162, lon:-86.781 },
  { city:"Memphis",     state:"TN", lat:35.149, lon:-90.048 },
];

const SKID_LABELS = ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","FTL"];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8, r = Math.PI / 180;
  const a = Math.sin(((lat2-lat1)*r)/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(((lon2-lon1)*r)/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// Cities that always use a specific rate point regardless of distance
const RATE_CITY_OVERRIDES = {
  "KNOXVILLE":    "Memphis",
  "CHATTANOOGA":  "Memphis",
};

function findNearestRateCity(lat, lon, destCity) {
  // Check for explicit override first
  if (destCity) {
    const key = destCity.toUpperCase().trim();
    const overrideCity = RATE_CITY_OVERRIDES[key];
    if (overrideCity) {
      const match = RATE_CITIES.find(c => c.city === overrideCity);
      if (match) return { ...match, distance: Math.round(haversine(lat, lon, match.lat, match.lon)), overridden: true };
    }
  }
  let nearest = null, nearestDist = Infinity;
  for (const c of RATE_CITIES) {
    const d = haversine(lat, lon, c.lat, c.lon);
    if (d < nearestDist) { nearestDist = d; nearest = c; }
  }
  return { ...nearest, distance: Math.round(nearestDist) };
}
const LBS_PER_SKID = 1700;
const r5 = v => Math.round(v / 5) * 5;  // round to nearest $5

// ── Footage rules ─────────────────────────────────────────────
// Format is L×W×H as written by the broker (positional — first number is always L)
// Width ≤ 48": two skids fit side by side → divisor = 24
// Width > 48": single file only           → divisor = 12
// Raw footage = (L × skids) ÷ divisor
// Stacked    = raw ÷ stackHeight (2 if "stackable" with no number, 1 if not stackable)
// Total footage across all line items → ceil(total ÷ 2) = effective skids for rate

function calcLineItem(skids, dimL, dimW, dimH, stackHeight) {
  if (!dimL && !dimW && !dimH) return null;
  const L        = dimL || 0;   // first number = Length (as written by broker)
  const W        = dimW || 0;   // second number = Width
  const H        = dimH || 0;   // third number = Height
  const divisor  = W > 48 ? 12 : W < 32 ? 36 : 24;
  const rawFt    = (L * skids) / divisor;
  const stackH   = stackHeight || 1;
  const netFt    = rawFt / stackH;
  return { skids, L, W, dimH: H, divisor, stackH, rawFt: +rawFt.toFixed(2), netFt: +netFt.toFixed(2) };
}

// Calculate combined dim basis across all line items
function calcDimBasis(lineItems) {
  if (!lineItems || lineItems.length === 0) return null;
  const calculated = lineItems.map(li =>
    calcLineItem(li.skids, li.dim_l, li.dim_w, li.dim_h, li.stack_height)
  ).filter(Boolean);
  if (calculated.length === 0) return null;
  const totalFt  = calculated.reduce((sum, li) => sum + li.netFt, 0);
  const effSkids = Math.ceil(totalFt / 2);
  return { lines: calculated, totalFt: +totalFt.toFixed(2), effSkids };
}

function getRate(origin, rateCity, skids, weightLbs, lineItems, footage) {
  const orig = (origin||"").toUpperCase().includes("QC") || (origin||"").toUpperCase().includes("QUEBEC") || (origin||"").toUpperCase().includes("MONTREAL") ? "QC" : "ON";
  const key = `${orig}|${rateCity.city}|${rateCity.state}`;
  const table = RATES[key];
  if (!table) return null;

  if (skids === "FTL") {
    return { base: table[21], table, key, orig, chargeIdx: 21, skidIdx: 21, weightIdx: 21, dimIdx: 21, footageIdx: 21, basisLabel: "FTL", dimBasis: null };
  }

  // Footage-only mode: broker gave footage, no skid count or dimensions
  const footageVal    = parseFloat(footage) || 0;
  const hasSkids      = skids != null && skids !== "" && !isNaN(parseInt(skids));
  const hasDims       = lineItems && lineItems.length > 0 && lineItems.some(li => li.dim_l || li.dim_w || li.dim_h);
  const footageOnly   = footageVal > 0 && !hasSkids && !hasDims;

  const skidCount   = hasSkids ? Math.max(parseInt(skids) || 1, 1) : (footageOnly ? Math.ceil(footageVal / 2) : 1);
  const skidIdx     = Math.min(skidCount - 1, 20);

  // Footage basis (when broker provides footage directly)
  const footageSkids = footageVal > 0 ? Math.ceil(footageVal / 2) : 0;
  const footageIdx   = footageVal > 0 ? Math.min(footageSkids - 1, 20) : skidIdx;

  // Weight basis
  const weight      = parseFloat(weightLbs) || 0;
  const weightSkids = weight > 0 ? Math.ceil(weight / 1700) : 0;
  const weightIdx   = weight > 0 ? Math.min(weightSkids - 1, 20) : skidIdx;

  // Dimension basis — across all line items
  const dimBasis    = calcDimBasis(lineItems);
  const dimIdx      = dimBasis ? Math.min(dimBasis.effSkids - 1, 20) : skidIdx;

  // Charge logic:
  // - Dimensions provided → use dim footage vs weight (skid count is irrelevant — stacking may reduce space)
  // - Footage only → use footage vs weight
  // - No dimensions → use skid count vs weight
  const hasDimBasis  = dimBasis !== null;
  let chargeIdx;
  let basisLabel;

  if (footageOnly) {
    chargeIdx  = Math.max(footageIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > footageIdx ? "weight" : "footage";
  } else if (hasDimBasis) {
    chargeIdx  = Math.max(dimIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > dimIdx ? "weight" : "dimensions";
  } else {
    chargeIdx  = Math.max(skidIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > skidIdx ? "weight" : "skids";
  }

  return { base: table[chargeIdx], table, key, orig, chargeIdx, skidIdx, weightIdx, dimIdx, footageIdx, basisLabel, dimBasis, footageOnly };
}

async function parseEmailWithClaude(text) {
  let res, attempts = 0;
  while (attempts < 3) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json",...(ANTHROPIC_KEY ? {"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"} : {})},
    body: JSON.stringify({
      model:"claude-3-5-haiku-20241022", max_tokens:2048,
      system:`Parse LTL freight quote emails for a Canadian carrier (GTA/Montreal pickup).
An email may contain ONE or MULTIPLE separate shipment requests. Return ONLY JSON, no markdown:
{
  "broker_name": "string or null",
  "broker_first_name": "first name only",
  "broker_company": "string or null",
  "confidence": "high|medium|low",
  "shipments": [
    {
      "origin": "Ontario or Quebec",
      "pickup_location": "full pickup address or city. If not specified use GTA, Ontario or Montreal, Quebec",
      "pickup_lat": number,
      "pickup_lon": number,
      "dest_city": "city name",
      "dest_state": "2-letter state",
      "dest_lat": number,
      "dest_lon": number,
      "skids": number or "FTL" or null,
      "footage": number or null,
      "weight_lbs": number or null,
      "line_items": [{"skids":number,"dim_l":number,"dim_w":number,"dim_h":number,"stack_height":number or null}],
      "additional_pickups": [{"location":"string","lat":number,"lon":number}],
      "additional_deliveries": [{"location":"string","lat":number,"lon":number}],
      "pickup_date": "string or null",
      "commodity": "string or null",
      "notes": "string or null",
      "missing_info": []
    }
  ]
}
RULES:
- Multiple destinations, different dates, or clearly separate loads = separate shipments[] entries.
- dim format L x W x H, preserve broker order exactly.
- footage divisor: W < 32" = 36 (3 skids across), W <= 48" = 24 (2 across), W > 48" = 12 (1 across).
- stack_height: stackable=2, stackable 3 high=3, not stackable=null.
- footage: only if broker gives footage with no skid count or dimensions.
- line_items: each numbered item (e.g. "1. 89L x 45W x 67H") is 1 skid. The number before the dot is the item sequence, NOT the skid count. Always set skids=1 for each numbered line item unless the broker explicitly says otherwise (e.g. "2 skids 89L x 45W x 67H").
- skids at shipment level = total count of all line_items combined.`,
      messages:[{role:"user",content:`Parse this:\n\n${text}`}],
    }),
  });
  if (res.status === 529 || res.status === 503) {
    attempts++;
    await new Promise(r => setTimeout(r, 2000 * attempts));
    continue;
  }
  const data = await res.json();
  const result = JSON.parse(data.content.map(b=>b.text||"").join("").replace(/[`]{3}json|[`]{3}/g,"").trim());
  return (result.shipments||[result]).map(s => ({
    ...s,
    broker_name: s.broker_name || result.broker_name,
    broker_first_name: s.broker_first_name || result.broker_first_name,
    broker_company: s.broker_company || result.broker_company,
  }));
  }
  throw new Error("API overloaded after 3 attempts. Please try again.");
}

async function geocodeCity(city, state) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json",...(ANTHROPIC_KEY ? {"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"} : {})},
    body: JSON.stringify({
      model:"claude-3-5-haiku-20241022", max_tokens:60,
      system:`Return ONLY {"lat":number,"lon":number} for the city. No markdown.`,
      messages:[{role:"user",content:`Coordinates for ${city}${state?", "+state:""}, USA`}],
    }),
  });
  const data = await res.json();
  return JSON.parse(data.content.map(b=>b.text||"").join("").replace(/[`]{3}json|[`]{3}/g,"").trim());
}

const TRANSIT_TIMES = {
  MI: "1 day",
  OH: "1–2 days",
  KY: "1–2 days",
  IN: "1–3 days",
  IL: "2–4 days",
  MO: "2–4 days",
  TN: "2–4 days",
  TX: "3–7 days",
};

const STOP_CHARGE_NEARBY = 75;   // additional stop within 50km
const STOP_CHARGE_DISTANT = 150;  // additional stop over 50km
const STOP_RADIUS_KM      = 50;

// Haversine in KM
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, r = Math.PI / 180;
  const a = Math.sin(((lat2-lat1)*r)/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(((lon2-lon1)*r)/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function stopCharge(stopLat, stopLon, baseLat, baseLon) {
  if (!stopLat || !stopLon || !baseLat || !baseLon) return { charge: STOP_CHARGE_NEARBY, km: null };
  const km = haversineKm(baseLat, baseLon, stopLat, stopLon);
  return { charge: km <= STOP_RADIUS_KM ? STOP_CHARGE_NEARBY : STOP_CHARGE_DISTANT, km: Math.round(km) };
}

const FSC_OPTS = [{v:0,l:"None"},{v:0.08,l:"8%"},{v:0.15,l:"15%"},{v:0.18,l:"18%"},{v:0.20,l:"20%"},{v:0.30,l:"30%"},{v:0.40,l:"40%"}];
const ACC_OPTS = [{id:"da",l:"Driver Assist",n:"from $75"},{id:"lg",l:"Liftgate",n:"from $75"},{id:"nc",l:"No Crossdock",n:"from $150"},{id:"fl",l:"Floorload",n:"+10% markup"},{id:"st",l:"Straight Truck",n:"$100"}];

// ── Design tokens — BDR International branding ────────────────
const C = {
  bg: "#f2f2f3",
  card: "#ffffff",
  border: "#e0e0e2",
  navy: "#1e1e1e",        // BDR charcoal header
  navyLight: "#2e2e2e",
  amber: "#8B1C32",       // BDR burgundy — primary action color
  amberLight: "#fdf2f4",
  green: "#16a34a",
  greenLight: "#f0fdf4",
  text: "#1a1a1a",
  muted: "#5f5f6a",
  subtle: "#9a9aaa",
  error: "#dc2626",
  errorLight: "#fef2f2",
  highlight: "#fce8ec",   // light burgundy tint
};

const input = { width:"100%", boxSizing:"border-box", padding:"10px 14px", fontSize:15, border:`1.5px solid ${C.border}`, borderRadius:8, color:C.text, background:C.card, outline:"none", fontFamily:"inherit" };
const label = { display:"block", fontSize:12, fontWeight:600, color:C.muted, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" };
const card = { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:16 };

export default function App() {
  const [step, setStep]             = useState("input");
  const [email, setEmail]           = useState("");
  const [parsed, setParsed]         = useState(null);
  const [rateCity, setRateCity]     = useState(null);
  const [rateResult, setRateResult] = useState(null);
  const [geocoding, setGeocoding]   = useState(false);
  const [shipments, setShipments]   = useState([]);      // all parsed shipments
  const [activeIdx, setActiveIdx]   = useState(0);       // currently viewed shipment
  const [quoteTexts, setQuoteTexts] = useState([]);      // generated quote per shipment
  const [copiedIdx, setCopiedIdx]   = useState(null);    // which quote was just copied
  const [allCopied, setAllCopied]   = useState(false);
  const [fsc, setFsc]               = useState(0.18);
  const [accs, setAccs]             = useState({});
  const [customAcc, setCustomAcc]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [quoteText, setQuoteText]   = useState("");
  const [copied, setCopied]         = useState(false);
  const [company, setCompany]       = useState("BDR International LTD");
  const [contact, setContact]       = useState("Nolan Giesbrecht");
  const [phone, setPhone]           = useState("519-469-9361 ext 113");
  const debounce                    = useRef(null);
  const [tab, setTab]               = useState("quote");   // quote | history | customers
  const [history, setHistory]       = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [histSearch, setHistSearch] = useState("");
  const [viewingQuote, setViewingQuote] = useState(null);
  const [customers, setCustomers]     = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null); // null | "new" | {id,...}
  const [custSearch, setCustSearch]   = useState("");
  const [matchedCustomer, setMatchedCustomer] = useState(null); // auto-matched on parse

  // Load history from storage on mount
  useEffect(() => {
    (async () => {
      // Load customers
      try {
        const ck = await window.storage.list("bdr_customer:");
        const custs = await Promise.all(
          ck.keys.map(async k => {
            try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
            catch(e) { return null; }
          })
        );
        setCustomers(custs.filter(Boolean).sort((a,b)=>(a.company||"").localeCompare(b.company||"")));
      } catch(e) { setCustomers([]); }
      setCustomersLoaded(true);

      try {
        const keys = await window.storage.list("bdr_quote:");
        const quotes = await Promise.all(
          keys.keys.map(async k => {
            try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
            catch(e) { return null; }
          })
        );
        setHistory(quotes.filter(Boolean).sort((a,b) => b.timestamp - a.timestamp));
      } catch(e) { setHistory([]); }
      setHistoryLoaded(true);
    })();
  }, []);

  const QUOTE_LIMIT = 500;

  const saveQuote = async (quoteData) => {
    try {
      const key = `bdr_quote:${quoteData.timestamp}`;
      await window.storage.set(key, JSON.stringify(quoteData));
      setHistory(prev => {
        const updated = [quoteData, ...prev.filter(q => q.timestamp !== quoteData.timestamp)];
        if (updated.length > QUOTE_LIMIT) {
          const toDelete = updated.slice(QUOTE_LIMIT);
          toDelete.forEach(q => window.storage.delete(`bdr_quote:${q.timestamp}`).catch(()=>{}));
          return updated.slice(0, QUOTE_LIMIT);
        }
        return updated;
      });
    } catch(e) { console.error("Could not save quote:", e); }
  };

  const saveCustomer = async (cust) => {
    const record = { ...cust, id: cust.id || `cust_${Date.now()}`, updated: Date.now() };
    try {
      await window.storage.set(`bdr_customer:${record.id}`, JSON.stringify(record));
      setCustomers(prev => {
        const updated = [record, ...prev.filter(c => c.id !== record.id)];
        return updated.sort((a,b) => (a.company||"").localeCompare(b.company||""));
      });
      setEditingCustomer(null);
    } catch(e) { console.error("Could not save customer:", e); }
  };

  const deleteCustomer = async (id) => {
    try {
      await window.storage.delete(`bdr_customer:${id}`);
      setCustomers(prev => prev.filter(c => c.id !== id));
      if (editingCustomer?.id === id) setEditingCustomer(null);
    } catch(e) {}
  };

  // Auto-match broker company to saved customer profile
  const matchCustomer = (brokerCompany, brokerName) => {
    if (!brokerCompany && !brokerName) return null;
    const q = (brokerCompany||brokerName||"").toLowerCase();
    return customers.find(c =>
      (c.company||"").toLowerCase().includes(q) ||
      q.includes((c.company||"").toLowerCase())
    ) || null;
  };

  const deleteQuote = async (timestamp) => {
    try {
      await window.storage.delete(`bdr_quote:${timestamp}`);
      setHistory(prev => prev.filter(q => q.timestamp !== timestamp));
      if (viewingQuote?.timestamp === timestamp) setViewingQuote(null);
    } catch(e) {}
  };

  const resolveRate = (p) => {
    if (!p?.dest_lat || !p?.dest_lon) return null;
    const rc = findNearestRateCity(p.dest_lat, p.dest_lon, p.dest_city);
    const r  = getRate(p.origin, rc, p.skids, p.weight_lbs, p.line_items, p.footage);
    setRateCity(rc); setRateResult(r);
    return r;
  };

  const handleParse = useCallback(async () => {
    if (!email.trim()) return;
    setLoading(true); setError(null);
    try {
      const parsed_list = await parseEmailWithClaude(email);
      setShipments(parsed_list);
      setActiveIdx(0);
      const first = parsed_list[0];
      setParsed(first);
      resolveRate(first);
      setQuoteTexts([]);
      setStep("review");
      const match = matchCustomer(first.broker_company, first.broker_name);
      setMatchedCustomer(match);
      if (match?.default_fsc != null) setFsc(match.default_fsc);
    } catch(e) { setError("Could not parse email. Check your connection and try again."); }
    finally { setLoading(false); }
  }, [email]);

  const handleFieldChange = (key, value, current) => {
    const updated = { ...current, [key]: value };
    setParsed(updated);
    if (key === "skids" || key === "origin") {
      setRateResult(getRate(updated.origin, rateCity, updated.skids, updated.weight_lbs, updated.line_items, updated.footage));
      return;
    }
    if ((key === "dest_city" || key === "dest_state") && (updated.dest_city||"").length > 2) {
      clearTimeout(debounce.current);
      setGeocoding(true);
      debounce.current = setTimeout(async () => {
        try {
          const coords = await geocodeCity(updated.dest_city, updated.dest_state);
          if (coords?.lat && coords?.lon) {
            const withCoords = { ...updated, dest_lat:coords.lat, dest_lon:coords.lon };
            setParsed(withCoords);
            const rc = findNearestRateCity(coords.lat, coords.lon, updated.dest_city);
            setRateCity(rc);
            setRateResult(getRate(updated.origin, rc, updated.skids, updated.weight_lbs, updated.line_items, updated.footage));
          }
        } catch(e) {} finally { setGeocoding(false); }
      }, 800);
    }
  };

  const handleQuote = () => {
    if (!rateResult?.base) { setError("No rate found. Check origin and destination."); return; }
    const base        = rateResult.base;
    const floorloaded = !!accs["fl"];
    const subtotal    = base * (1 + fsc);
    const afterFloor  = floorloaded ? subtotal * 1.10 : subtotal;

    // Calculate stop charges
    const extraPickups    = (parsed.additional_pickups || []);
    const extraDeliveries = (parsed.additional_deliveries || []);
    const pickupStops = extraPickups.map(s => {
      const sc = stopCharge(s.lat, s.lon, parsed.pickup_lat, parsed.pickup_lon);
      return { ...s, ...sc, type: "pickup" };
    });
    const deliveryStops = extraDeliveries.map(s => {
      const sc = stopCharge(s.lat, s.lon, parsed.dest_lat, parsed.dest_lon);
      return { ...s, ...sc, type: "delivery" };
    });
    const allStops      = [...pickupStops, ...deliveryStops];
    const stopTotal     = allStops.reduce((sum, s) => sum + s.charge, 0);
    const total         = r5(afterFloor + stopTotal);

    const accList = ACC_OPTS.filter(a => accs[a.id] && a.id !== "fl");
    const isNearest = rateCity && parsed?.dest_city && rateCity.city.toLowerCase() !== parsed.dest_city.trim().toLowerCase();
    const lines = [
      `Hi ${parsed.broker_first_name || (parsed.broker_name || "[Broker Name]").split(" ")[0]},`,
      "",
      "Thank you for reaching out. Please find our rate below.",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "FREIGHT QUOTE",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `Pickup:        ${parsed.pickup_location || parsed.origin}`,
      ...pickupStops.map((s,i) => `Add. Pickup ${i+1}: ${s.location} (+$${s.charge}${s.km!=null?` — ${s.km}km from origin`:""})` ),
      `Destination:   ${parsed.dest_city}, ${parsed.dest_state}`,
      ...deliveryStops.map((s,i) => `Add. Delivery ${i+1}: ${s.location} (+$${s.charge}${s.km!=null?` — ${s.km}km from dest`:""})` ),
      `Skids:         ${parsed.skids}${rateResult?.basisLabel==="weight" ? ` (charged at ${SKID_LABELS[rateResult.chargeIdx]} skids — weight basis)` : rateResult?.basisLabel==="dimensions" ? ` (charged at ${SKID_LABELS[rateResult.chargeIdx]} skids — dimension basis)` : ""}`,
      parsed.weight_lbs  ? `Weight:        ${Number(parsed.weight_lbs).toLocaleString()} lbs` : null,
      parsed.commodity   ? `Commodity:     ${parsed.commodity}` : null,
      parsed.pickup_date ? `Pickup Date:   ${parsed.pickup_date}` : null,
      TRANSIT_TIMES[parsed.dest_state?.toUpperCase()] ? `Transit Time:  Approx. ${TRANSIT_TIMES[parsed.dest_state.toUpperCase()]}` : null,
      "",
      floorloaded ? `Floorload (+10%): $${r5(subtotal*0.10)}` : null,
      ...pickupStops.map(s => `Add. Pickup:   $${s.charge} (${s.km!=null&&s.km>STOP_RADIUS_KM?">50km":"+50km"})` ),
      ...deliveryStops.map(s => `Add. Delivery: $${s.charge} (${s.km!=null&&s.km>STOP_RADIUS_KM?">50km":"≤50km"})` ),
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `TOTAL:         $${r5(total)} CAD`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ...(accList.length||customAcc ? ["","Accessorials (if applicable):",...accList.map(a=>`  • ${a.l}: ${a.n}`),customAcc?`  • ${customAcc}`:null].filter(Boolean) : []),
      "","Quote valid for 24 hours. Transit times subject to availability.","",
      contact||null, company||null, phone||null,
    ].filter(l => l !== null);
    const qt = lines.join("\n");
    setQuoteText(qt);
    // Store this quote for its shipment index
    setQuoteTexts(prev => {
      const updated = [...prev];
      updated[activeIdx] = qt;
      return updated;
    });
    setError(null);
    // If all shipments have been quoted, go to result — otherwise move to next shipment
    setStep("result");
    // Save to history
    const quoteRecord = {
      timestamp: Date.now(),
      date: new Date().toLocaleDateString("en-CA"),
      time: new Date().toLocaleTimeString("en-CA", {hour:"2-digit",minute:"2-digit"}),
      broker_name: parsed.broker_name || "—",
      broker_company: parsed.broker_company || "",
      origin: parsed.origin || "",
      dest_city: parsed.dest_city || "",
      dest_state: parsed.dest_state || "",
      skids: parsed.skids,
      weight_lbs: parsed.weight_lbs,
      base_rate: base,
      fsc: fsc,
      total: r5(base*(1+fsc)),
      rate_city: rateCity?.city,
      basis_label: rateResult?.basisLabel,
      charge_skids: SKID_LABELS[rateResult?.chargeIdx],
      quote_text: qt,
    };
    saveQuote(quoteRecord);
  };

  const base        = rateResult?.base;
  const floorloaded   = !!accs["fl"];
  const subtotal      = base ? r5(base*(1+fsc)) : null;
  const afterFloorB   = subtotal ? (floorloaded ? r5(subtotal*1.10) : subtotal) : null;
  const extraPickupsB  = (parsed?.additional_pickups||[]).map(s=>stopCharge(s.lat,s.lon,parsed?.pickup_lat,parsed?.pickup_lon).charge).reduce((a,b)=>a+b,0);
  const extraDeliveriesB = (parsed?.additional_deliveries||[]).map(s=>stopCharge(s.lat,s.lon,parsed?.dest_lat,parsed?.dest_lon).charge).reduce((a,b)=>a+b,0);
  const total         = afterFloorB ? r5(afterFloorB + extraPickupsB + extraDeliveriesB) : null;
  const isNearest = rateCity && parsed?.dest_city && rateCity.city.toLowerCase() !== (parsed.dest_city||"").trim().toLowerCase();

  const Step = ({ n, label, active, done }) => (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, background:active?C.navy:done?C.green:"#e2e6ea", color:active||done?"#fff":C.subtle }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize:14, fontWeight:active?600:400, color:active?C.navy:done?C.green:C.subtle }}>{label}</span>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color:C.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} textarea:focus,input:focus{border-color:#2d4270!important;box-shadow:0 0 0 3px rgba(45,66,112,0.1)} button:hover{opacity:0.9}`}</style>

      {/* BDR Header */}
      <div style={{ background:C.navy }}>
        <div style={{ background:"#111", padding:"7px 32px", textAlign:"center" }}>
          <span style={{ fontSize:11, color:"#777", letterSpacing:"0.12em", textTransform:"uppercase" }}>Transportation Specialists · Aylmer, ON · Est. 1989</span>
        </div>
        <div style={{ maxWidth:860, margin:"0 auto", padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:68 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ background:C.amber, padding:"5px 11px", borderRadius:4 }}>
              <span style={{ fontSize:22, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", fontFamily:"Georgia,serif" }}>BDR</span>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"#fff" }}>BDR International Ltd.</div>
              <div style={{ fontSize:11, color:"#777", letterSpacing:"0.03em" }}>Freight Quote Tool · 2026 Rate Sheet</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:12, color:"#666", display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ color:C.amber, fontSize:8 }}>●</span> Ontario &amp; Quebec to US
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {[["quote","⊕ Quote"],["customers","👥 Customers"],["history","📋 History"]].map(([t,l]) => (
                <button key={t} onClick={()=>setTab(t)} style={{ padding:"6px 16px", background:tab===t?C.amber:"rgba(255,255,255,0.1)", color:"#fff", border:`1px solid ${tab===t?C.amber:"rgba(255,255,255,0.2)"}`, borderRadius:6, fontSize:13, fontWeight:tab===t?700:400, cursor:"pointer" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {tab === "customers" ? (
        /* ══ CUSTOMERS TAB ══ */
        <div style={{ maxWidth:960, margin:"0 auto", padding:"28px 32px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:C.navy }}>Customer Profiles</div>
              <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>{customers.length} profile{customers.length!==1?"s":""} saved</div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <input value={custSearch} onChange={e=>setCustSearch(e.target.value)} placeholder="Search company or contact…"
                style={{ ...input, width:240, fontSize:14 }}/>
              <button onClick={()=>setEditingCustomer({ company:"", contact_name:"", email:"", phone:"", default_fsc:0.18, typical_lanes:"", notes:"" })}
                style={{ padding:"10px 20px", background:C.amber, color:"#fff", border:"none", borderRadius:8, fontSize:14, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                + New Profile
              </button>
            </div>
          </div>

          {/* Edit / New form */}
          {editingCustomer && (
            <div style={{ ...card, border:`2px solid ${C.amber}`, marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:16 }}>
                {editingCustomer.id ? `Editing — ${editingCustomer.company}` : "New Customer Profile"}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                {[["Company Name","company"],["Primary Contact","contact_name"],["Email","email"],["Phone","phone"]].map(([l,k]) => (
                  <div key={k}>
                    <label style={label}>{l}</label>
                    <input value={editingCustomer[k]||""} onChange={e=>setEditingCustomer(p=>({...p,[k]:e.target.value}))} style={input}/>
                  </div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div>
                  <label style={label}>Default FSC</label>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {FSC_OPTS.map(o => (
                      <button key={o.v} onClick={()=>setEditingCustomer(p=>({...p,default_fsc:o.v}))}
                        style={{ padding:"7px 14px", fontSize:13, borderRadius:6, cursor:"pointer", fontWeight:editingCustomer.default_fsc===o.v?700:400, background:editingCustomer.default_fsc===o.v?C.navy:"#f1f5f9", color:editingCustomer.default_fsc===o.v?"#fff":C.text, border:`1.5px solid ${editingCustomer.default_fsc===o.v?C.navy:C.border}` }}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={label}>Typical Lanes</label>
                  <input value={editingCustomer.typical_lanes||""} onChange={e=>setEditingCustomer(p=>({...p,typical_lanes:e.target.value}))} placeholder="e.g. Ontario → Columbus, OH" style={input}/>
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={label}>Notes / Special Instructions</label>
                <input value={editingCustomer.notes||""} onChange={e=>setEditingCustomer(p=>({...p,notes:e.target.value}))} placeholder="e.g. Always needs liftgate, prefers morning pickups" style={input}/>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>saveCustomer(editingCustomer)}
                  style={{ padding:"10px 24px", background:C.amber, color:"#fff", border:"none", borderRadius:8, fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  Save Profile
                </button>
                <button onClick={()=>setEditingCustomer(null)}
                  style={{ padding:"10px 20px", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, cursor:"pointer" }}>
                  Cancel
                </button>
                {editingCustomer.id && (
                  <button onClick={()=>deleteCustomer(editingCustomer.id)}
                    style={{ padding:"10px 20px", background:"#fff", color:C.error, border:`1.5px solid #fca5a5`, borderRadius:8, fontSize:14, cursor:"pointer", marginLeft:"auto" }}>
                    Delete Profile
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Customer list */}
          {!customersLoaded && <div style={{ color:C.muted, fontSize:14 }}>Loading…</div>}
          {customersLoaded && customers.length === 0 && !editingCustomer && (
            <div style={{ ...card, textAlign:"center", padding:48, color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:12 }}>👥</div>
              <div style={{ fontSize:16, fontWeight:600, color:C.navy }}>No profiles yet</div>
              <div style={{ fontSize:14, marginTop:4 }}>Profiles are auto-suggested when a known broker emails you. You can also create them manually above.</div>
            </div>
          )}
          <div>
            {customers
              .filter(c => {
                if (!custSearch) return true;
                const s = custSearch.toLowerCase();
                return (c.company||"").toLowerCase().includes(s) || (c.contact_name||"").toLowerCase().includes(s);
              })
              .map(c => {
                // Count quotes for this customer
                const qCount = history.filter(q =>
                  (q.broker_company||"").toLowerCase().includes((c.company||"").toLowerCase()) ||
                  (c.company||"").toLowerCase().includes((q.broker_company||"").toLowerCase())
                ).length;
                return (
                  <div key={c.id} style={{ ...card, marginBottom:10, padding:0, overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"stretch" }}>
                      <div style={{ width:4, background:C.amber, flexShrink:0 }}/>
                      <div style={{ flex:1, padding:"14px 20px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                        <div style={{ minWidth:180 }}>
                          <div style={{ fontSize:16, fontWeight:700, color:C.navy }}>{c.company}</div>
                          <div style={{ fontSize:13, color:C.muted }}>{c.contact_name}{c.email ? ` · ${c.email}` : ""}</div>
                        </div>
                        <div style={{ minWidth:80 }}>
                          <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Default FSC</div>
                          <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{c.default_fsc!=null?(c.default_fsc*100).toFixed(0)+"%":"—"}</div>
                        </div>
                        <div style={{ minWidth:80 }}>
                          <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Quotes</div>
                          <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{qCount}</div>
                        </div>
                        {c.typical_lanes && (
                          <div style={{ minWidth:160 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Typical Lanes</div>
                            <div style={{ fontSize:13, color:C.text }}>{c.typical_lanes}</div>
                          </div>
                        )}
                        {c.notes && (
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Notes</div>
                            <div style={{ fontSize:13, color:C.muted }}>{c.notes}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", borderLeft:`1px solid ${C.border}` }}>
                        <button onClick={()=>setEditingCustomer(c)}
                          style={{ flex:1, padding:"0 20px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.navy, fontWeight:600, borderBottom:`1px solid ${C.border}` }}>
                          Edit
                        </button>
                        <button onClick={()=>{ setTab("quote"); setStep("input"); }}
                          style={{ flex:1, padding:"0 20px", background:"none", border:"none", cursor:"pointer", fontSize:12, color:C.muted }}>
                          Quote
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      ) : tab === "history" ? (
        /* ══ HISTORY TAB ══ */
        <div style={{ maxWidth:960, margin:"0 auto", padding:"28px 32px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:C.navy }}>Quote History</div>
              <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>{history.length} of 500 quotes saved</div>
            </div>
            <input value={histSearch} onChange={e=>setHistSearch(e.target.value)} placeholder="Search broker, city, state…"
              style={{ ...input, width:260, fontSize:14 }}/>
          </div>

          {!historyLoaded && <div style={{ color:C.muted, fontSize:14 }}>Loading…</div>}

          {historyLoaded && history.length === 0 && (
            <div style={{ ...card, textAlign:"center", padding:48, color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:16, fontWeight:600, color:C.navy }}>No quotes yet</div>
              <div style={{ fontSize:14, marginTop:4 }}>Quotes you generate will appear here automatically.</div>
            </div>
          )}

          {/* Quote list */}
          {history
            .filter(q => {
              if (!histSearch) return true;
              const s = histSearch.toLowerCase();
              return [q.broker_name, q.broker_company, q.dest_city, q.dest_state, q.origin].some(f => (f||"").toLowerCase().includes(s));
            })
            .map(q => (
              <div key={q.timestamp} style={{ ...card, marginBottom:10, padding:0, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"stretch" }}>
                  {/* Colour bar */}
                  <div style={{ width:4, background:C.amber, flexShrink:0 }}/>
                  {/* Main content */}
                  <div style={{ flex:1, padding:"14px 18px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                    <div style={{ minWidth:120 }}>
                      <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Date</div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{q.date}</div>
                      <div style={{ fontSize:12, color:C.muted }}>{q.time}</div>
                    </div>
                    <div style={{ minWidth:140 }}>
                      <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Broker</div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{q.broker_name}</div>
                      {q.broker_company && <div style={{ fontSize:12, color:C.muted }}>{q.broker_company}</div>}
                    </div>
                    <div style={{ minWidth:160 }}>
                      <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Lane</div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{q.origin} → {q.dest_city}, {q.dest_state}</div>
                      <div style={{ fontSize:12, color:C.muted }}>via {q.rate_city} rate</div>
                    </div>
                    <div style={{ minWidth:80 }}>
                      <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Skids</div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{q.skids}</div>
                      {q.charge_skids && q.charge_skids !== String(q.skids) && <div style={{ fontSize:11, color:C.amber }}>charged {q.charge_skids}</div>}
                    </div>
                    <div style={{ minWidth:80 }}>
                      <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Base</div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text }}>${r5(q.base_rate)}</div>
                    </div>
                    <div style={{ minWidth:90 }}>
                      <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Total</div>
                      <div style={{ fontSize:18, fontWeight:800, color:C.amber }}>${r5(q.total)}</div>
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display:"flex", flexDirection:"column", borderLeft:`1px solid ${C.border}` }}>
                    <button onClick={()=>setViewingQuote(viewingQuote?.timestamp===q.timestamp?null:q)}
                      style={{ flex:1, padding:"0 18px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.navy, fontWeight:600, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>
                      {viewingQuote?.timestamp===q.timestamp ? "▲ Hide" : "▼ View"}
                    </button>
                    <button onClick={()=>deleteQuote(q.timestamp)}
                      style={{ flex:1, padding:"0 18px", background:"none", border:"none", cursor:"pointer", fontSize:12, color:C.subtle }}>
                      Delete
                    </button>
                  </div>
                </div>
                {/* Expanded quote text */}
                {viewingQuote?.timestamp === q.timestamp && (
                  <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px 22px", background:"#fafafa" }}>
                    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
                      <button onClick={()=>{
                      const ta = document.createElement("textarea");
                      ta.value = q.quote_text;
                      ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0";
                      ta.style.width = "2em"; ta.style.height = "2em"; ta.style.opacity = "0";
                      document.body.appendChild(ta); ta.focus(); ta.select();
                      try { document.execCommand("copy"); } catch(e) {}
                      document.body.removeChild(ta);
                    }}
                        style={{ padding:"6px 16px", background:C.amber, color:"#fff", border:"none", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                        Copy Quote
                      </button>
                    </div>
                    <pre style={{ fontFamily:"'Courier New',monospace", fontSize:13, color:C.text, lineHeight:1.7, margin:0, whiteSpace:"pre-wrap" }}>{q.quote_text}</pre>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      ) : (
      <>
      {/* ── Step bar ── */}
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:860, margin:"0 auto", padding:"16px 32px", display:"flex", gap:32, alignItems:"center" }}>
          <Step n="1" label="Paste Email"    active={step==="input"}  done={step!=="input"} />
          <div style={{ flex:1, height:1, background:C.border }}/>
          <Step n="2" label="Review & Rate"  active={step==="review"} done={step==="result"} />
          <div style={{ flex:1, height:1, background:C.border }}/>
          <Step n="3" label="Copy Quote"     active={step==="result"} done={false} />
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"28px 32px" }}>

        {/* ══ STEP 1 ══ */}
        {step === "input" && (
          <>
            {/* Sender info */}
            <div style={card}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:16 }}>Your Details</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                {[["Company Name",company,setCompany],["Your Name",contact,setContact],["Phone / Ext.",phone,setPhone]].map(([l,v,s]) => (
                  <div key={l}>
                    <label style={label}>{l}</label>
                    <input value={v} onChange={e=>s(e.target.value)} placeholder={l} style={input}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Email paste */}
            <div style={card}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:6 }}>Broker Quote Request</div>
              <div style={{ fontSize:14, color:C.muted, marginBottom:14 }}>Paste the email as-is — the tool will extract all shipment details automatically.</div>
              <textarea value={email} onChange={e=>setEmail(e.target.value)}
                placeholder={"Example:\n\nHi, looking for a rate from Ontario to Dayton, OH.\n5 skids, approximately 8,500 lbs.\nPickup June 23rd. Commodity: auto parts.\n\nPlease advise. Thanks"}
                style={{ ...input, height:180, resize:"vertical", lineHeight:1.6, fontSize:14 }}
              />
              {error && <div style={{ marginTop:10, padding:"10px 14px", background:C.errorLight, border:`1px solid #fca5a5`, borderRadius:8, color:C.error, fontSize:14 }}>⚠ {error}</div>}
              <button onClick={handleParse} disabled={loading||!email.trim()}
                style={{ marginTop:14, padding:"12px 28px", background:loading||!email.trim()?"#cbd5e1":C.navy, color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
                {loading ? <><span style={{ display:"inline-block", animation:"spin 0.8s linear infinite" }}>⟳</span> Parsing email…</> : "Parse Email →"}
              </button>
            </div>

            {/* Coverage */}
            <div style={{ ...card, background:"#fdf2f4", border:`1px solid #e8b4be` }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.amber, marginBottom:10 }}>Rate Sheet Coverage</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {[["TX","Houston · Dallas · San Antonio"],["MI","Detroit · Lansing · Grand Rapids"],["OH","Toledo · Cleveland · Cincinnati · Columbus"],["KY","Louisville"],["IL","Chicago"],["IN","Indianapolis"],["MO","St Louis · Kansas City"],["TN","Nashville · Memphis"]].map(([st,cities]) => (
                  <div key={st} style={{ background:"#fff", borderRadius:8, padding:"10px 12px", border:`1px solid #e8b4be` }}>
                    <div style={{ fontSize:18, fontWeight:800, color:C.amber, marginBottom:2 }}>{st}</div>
                    <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>{cities}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:C.subtle, marginTop:10 }}>
                For towns not listed above, the nearest rate-sheet city is used automatically.
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 2 ══ */}
        {step === "review" && parsed && (
          <>
            {/* Shipment tabs — shown when multiple shipments in one email */}
            {shipments.length > 1 && (
              <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
                {shipments.map((s, i) => (
                  <button key={i} onClick={() => {
                    setActiveIdx(i);
                    setParsed(s);
                    resolveRate(s);
                    setQuoteText(quoteTexts[i] || "");
                  }} style={{
                    padding:"8px 16px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:activeIdx===i?700:400,
                    background: activeIdx===i ? C.navy : "#f1f5f9",
                    color: activeIdx===i ? "#fff" : C.muted,
                    border: `1.5px solid ${activeIdx===i ? C.navy : C.border}`,
                    display:"flex", alignItems:"center", gap:8,
                  }}>
                    <span>Shipment {i+1}</span>
                    <span style={{ fontSize:11, opacity:0.7 }}>{s.dest_city}, {s.dest_state}</span>
                    {quoteTexts[i] && <span style={{ color: activeIdx===i?"#86efac":C.green, fontSize:12 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Matched customer banner */}
            {matchedCustomer && (
              <div style={{ ...card, background:"#f0f4ff", border:`1px solid #c7d4f5`, padding:"12px 18px", display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
                <div style={{ fontSize:20 }}>👥</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>{matchedCustomer.company}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{matchedCustomer.contact_name}{matchedCustomer.email ? ` · ${matchedCustomer.email}` : ""}{matchedCustomer.notes ? ` · ${matchedCustomer.notes}` : ""}</div>
                </div>
                <div style={{ fontSize:12, color:C.muted }}>FSC pre-set to {(matchedCustomer.default_fsc*100).toFixed(0)}%</div>
                <button onClick={()=>setTab("customers")} style={{ fontSize:12, padding:"4px 12px", background:"transparent", border:`1px solid #c7d4f5`, borderRadius:6, cursor:"pointer", color:C.navy }}>View Profile</button>
              </div>
            )}
            {/* Rate card */}
            {geocoding ? (
              <div style={{ ...card, display:"flex", alignItems:"center", gap:12, color:C.muted }}>
                <span style={{ fontSize:20, display:"inline-block", animation:"spin 0.8s linear infinite" }}>⟳</span>
                <span style={{ fontSize:15 }}>Looking up coordinates for {parsed.dest_city}…</span>
              </div>
            ) : base ? (
              <div style={{ background:C.navy, borderRadius:12, padding:24, marginBottom:16 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:20, marginBottom: rateResult?.basisLabel === "weight" ? 16 : 0 }}>
                  <div>
                    <div style={{ fontSize:11, color:"#aaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Rate Point</div>
                    <div style={{ fontSize:16, color:"#fff", fontWeight:700 }}>{rateCity?.city}, {rateCity?.state}</div>
                    {isNearest && <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>Nearest to {parsed.dest_city} ({rateCity?.distance} mi)</div>}
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:"#aaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Charged At</div>
                    <div style={{ fontSize:16, color:"#fff", fontWeight:700 }}>
                      {rateResult?.chargeIdx != null ? SKID_LABELS[rateResult.chargeIdx] : parsed.skids} skids
                    </div>
                    <div style={{ fontSize:11, color: rateResult?.basisLabel !== "skids" ? C.amber : "#aaa", marginTop:2, fontWeight: rateResult?.basisLabel !== "skids" ? 700 : 400 }}>
                      Basis: {rateResult?.basisLabel === "weight" ? "⚖ weight" : rateResult?.basisLabel === "dimensions" ? "📐 dimensions" : rateResult?.basisLabel === "footage" ? "📏 footage" : "📦 skid count"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:"#aaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Base Rate</div>
                    <div style={{ fontSize:16, color:"#fff", fontWeight:700 }}>${base.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:"#aaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Total incl. FSC ({(fsc*100).toFixed(0)}%)</div>
                    <div style={{ fontSize:28, color:C.amber, fontWeight:800 }}>${total.toFixed(2)}</div>
                  </div>
                </div>
                {rateResult?.basisLabel !== "skids" && (
                  <div style={{ background:"rgba(139,28,50,0.25)", border:"1px solid rgba(139,28,50,0.5)", borderRadius:8, padding:"8px 14px", fontSize:13, color:"#ffb3c0" }}>
                    {rateResult?.basisLabel === "weight" && <>⚖ Weight bump: {parsed.skids} skids stated but {Number(parsed.weight_lbs).toLocaleString()} lbs entered → charged at {SKID_LABELS[rateResult.chargeIdx]} skids</>}
                    {rateResult?.basisLabel === "dimensions" && <>📐 Dimension bump: {rateResult.dimBasis?.lines?.length} line item{rateResult.dimBasis?.lines?.length!==1?"s":""} = {rateResult.dimBasis?.totalFt} ft total → charged at {SKID_LABELS[rateResult.chargeIdx]} skids</>}
                    {rateResult?.basisLabel === "footage" && <>📏 Footage provided: {parsed.footage} ft → charged at {SKID_LABELS[rateResult.chargeIdx]} skids</>}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...card, background:C.errorLight, border:`1px solid #fca5a5`, color:C.error, fontSize:15 }}>
                ⚠ No rate found. Check the origin and destination fields below.
              </div>
            )}

            {/* Rate table */}
            {rateResult?.table && (
              <div style={card}>
                <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginBottom:12 }}>
                  Rate Table — {rateResult.orig === "ON" ? "Ontario" : "Quebec"} → {rateCity?.city}, {rateCity?.state}
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ borderCollapse:"collapse", fontSize:13, width:"100%" }}>
                    <thead>
                      <tr style={{ background:"#f1f5f9" }}>
                        {SKID_LABELS.map((l,i) => {
                          const isCharge = i === rateResult.chargeIdx;
                          const isSkid   = i === rateResult.skidIdx && rateResult.skidIdx !== rateResult.chargeIdx;
                          return <th key={l} style={{ padding:"6px 8px", textAlign:"center", fontWeight:600, whiteSpace:"nowrap", border:`1px solid ${C.border}`,
                            background: isCharge ? C.navy : isSkid ? "#e8e8e8" : "#f1f5f9",
                            color: isCharge ? "#fff" : C.muted }}>
                            {l}{isCharge && rateResult.basisLabel==="weight" ? " ⚖" : ""}
                          </th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {rateResult.table.map((r,i) => {
                          const isCharge = i === rateResult.chargeIdx;
                          const isSkid   = i === rateResult.skidIdx && rateResult.skidIdx !== rateResult.chargeIdx;
                          return <td key={i} style={{ padding:"6px 8px", textAlign:"center", border:`1px solid ${C.border}`,
                            background: isCharge ? C.highlight : isSkid ? "#f5f5f5" : "#fff",
                            fontWeight: isCharge ? 700 : 400,
                            color: isCharge ? C.navy : C.text }}>${r}</td>;
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Shipment details */}
            <div style={card}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:16 }}>Shipment Details</div>
              {parsed.missing_info?.length > 0 && (
                <div style={{ padding:"10px 14px", background:"#fffbeb", border:`1px solid #fcd34d`, borderRadius:8, color:"#92400e", fontSize:14, marginBottom:14 }}>
                  ⚠ Missing information: {parsed.missing_info.join(", ")}
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {[["Origin Region","origin"],["Pickup Location","pickup_location"],["Destination City","dest_city"],["State","dest_state"],["Skids","skids"],["Footage (ft)","footage"],["Weight (lbs)","weight_lbs"],["Pickup Date","pickup_date"],["Commodity","commodity"],["Broker Name","broker_name"]].map(([l,k]) => (
                  <div key={k}>
                    <label style={label}>{l}</label>
                    <input value={parsed[k]??""} onChange={e=>handleFieldChange(k,e.target.value,parsed)} style={input}/>
                  </div>
                ))}
              </div>

              {/* Line Items / Dimensions */}
              <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.navy }}>Skid Line Items <span style={{ fontSize:12, fontWeight:400, color:C.muted }}>(inches — W is always the second dimension as written)</span></div>
                  <button onClick={() => {
                    const items = [...(parsed.line_items||[]), { skids:1, dim_l:48, dim_w:48, dim_h:48, stack_height:null }];
                    handleFieldChange("line_items", items, parsed);
                  }} style={{ fontSize:12, padding:"4px 12px", background:C.navy, color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>+ Add line</button>
                </div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
                  W &lt; 32": ÷ 36 (3 across) &nbsp;|&nbsp; W ≤ 48": ÷ 24 (2 across) &nbsp;|&nbsp; W &gt; 48": ÷ 12 (1 across) &nbsp;|&nbsp; Stackable ÷ stack height
                </div>

                {/* Line item table */}
                {parsed.line_items?.length > 0 && (
                  <div style={{ overflowX:"auto", marginBottom:12 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ background:"#f1f5f9" }}>
                          {["Skids","L (in)","W (in)","H (in)","Stack high","Divisor","Raw ft","Net ft"].map(h => (
                            <th key={h} style={{ padding:"7px 10px", textAlign:"center", fontWeight:600, color:C.muted, border:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                          <th style={{ padding:"7px 10px", border:`1px solid ${C.border}` }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.line_items.map((li, i) => {
                          const calc = calcLineItem(li.skids, li.dim_l, li.dim_w, li.dim_h, li.stack_height);
                          return (
                            <tr key={i} style={{ background: i%2===0 ? "#fff" : "#fafafa" }}>
                              {[["skids",li.skids],["dim_l",li.dim_l],["dim_w",li.dim_w],["dim_h",li.dim_h],["stack_height",li.stack_height]].map(([k,v]) => (
                                <td key={k} style={{ padding:"4px 6px", border:`1px solid ${C.border}` }}>
                                  <input type="number" value={v??""} placeholder={k==="stack_height"?"—":"48"}
                                    onChange={e => {
                                      const items = parsed.line_items.map((x,j) => j===i ? {...x,[k]:e.target.value===''?null:parseFloat(e.target.value)} : x);
                                      handleFieldChange("line_items", items, parsed);
                                    }}
                                    style={{ width:"100%", border:"none", background:"transparent", fontSize:13, textAlign:"center", outline:"none", color:C.text }}
                                  />
                                </td>
                              ))}
                              <td style={{ padding:"4px 10px", textAlign:"center", border:`1px solid ${C.border}`, color:C.muted, fontSize:12 }}>{calc?.divisor||"—"}</td>
                              <td style={{ padding:"4px 10px", textAlign:"center", border:`1px solid ${C.border}`, color:C.text }}>{calc?.rawFt??""}</td>
                              <td style={{ padding:"4px 10px", textAlign:"center", border:`1px solid ${C.border}`, fontWeight:600, color:C.navy }}>{calc?.netFt??""}</td>
                              <td style={{ padding:"4px 8px", border:`1px solid ${C.border}` }}>
                                <button onClick={() => {
                                  const items = parsed.line_items.filter((_,j)=>j!==i);
                                  handleFieldChange("line_items", items, parsed);
                                }} style={{ background:"none", border:"none", color:C.subtle, cursor:"pointer", fontSize:16 }}>×</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {parsed.line_items.length > 1 && (() => {
                        const db = calcDimBasis(parsed.line_items);
                        return db ? (
                          <tfoot>
                            <tr style={{ background: rateResult?.basisLabel==="dimensions" ? C.amberLight : "#f8f9fb" }}>
                              <td colSpan={6} style={{ padding:"7px 10px", border:`1px solid ${C.border}`, fontWeight:600, color:C.muted, textAlign:"right" }}>Total</td>
                              <td style={{ padding:"7px 10px", border:`1px solid ${C.border}`, fontWeight:700, color:C.navy, textAlign:"center" }}>{db.totalFt} ft</td>
                              <td style={{ padding:"7px 10px", border:`1px solid ${C.border}`, fontWeight:700, color:C.amber, textAlign:"center" }}>{db.effSkids} eff. skids</td>
                              <td style={{ border:`1px solid ${C.border}` }}></td>
                            </tr>
                          </tfoot>
                        ) : null;
                      })()}
                    </table>
                  </div>
                )}

                {/* Single line item summary */}
                {parsed.line_items?.length === 1 && (() => {
                  const db = calcDimBasis(parsed.line_items);
                  return db ? (
                    <div style={{ padding:"9px 14px", background: rateResult?.basisLabel==="dimensions" ? C.amberLight : "#f8f9fb", border:`1px solid ${rateResult?.basisLabel==="dimensions" ? C.amber : C.border}`, borderRadius:8, fontSize:13 }}>
                      <span style={{ fontWeight:600, color: rateResult?.basisLabel==="dimensions" ? C.amber : C.muted }}>📐 </span>
                      ({db.lines[0].L}" × {db.lines[0].skids} skids) ÷ {db.lines[0].divisor}{db.lines[0].stackH > 1 ? ` ÷ ${db.lines[0].stackH} (stack)` : ""} = <strong>{db.totalFt} ft → {db.effSkids} effective skids</strong>
                      {rateResult?.basisLabel==="dimensions" ? <span style={{ color:C.amber }}> ← charging this</span> : <span style={{ color:C.subtle }}> (skid count or weight is higher)</span>}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Additional Stops */}
            <div style={card}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:4 }}>Additional Stops</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>
                Same area (≤50km): <strong>$75</strong> &nbsp;·&nbsp; Further (&gt;50km): <strong>$150</strong> per stop
              </div>

              {/* Additional Pickups */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.navy }}>Additional Pickups</div>
                  <button onClick={() => {
                    const stops = [...(parsed.additional_pickups||[]), { location:"", lat:null, lon:null }];
                    handleFieldChange("additional_pickups", stops, parsed);
                  }} style={{ fontSize:12, padding:"4px 12px", background:C.navy, color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>+ Add</button>
                </div>
                {(parsed.additional_pickups||[]).map((s,i) => {
                  const sc = stopCharge(s.lat, s.lon, parsed.pickup_lat, parsed.pickup_lon);
                  return (
                    <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                      <input value={s.location||""} placeholder="Address or city"
                        onChange={e => {
                          const stops = (parsed.additional_pickups||[]).map((x,j) => j===i ? {...x, location:e.target.value} : x);
                          handleFieldChange("additional_pickups", stops, parsed);
                        }}
                        style={{ ...input, flex:1 }}/>
                      <div style={{ minWidth:120, padding:"10px 12px", background: sc.km!=null&&sc.km>STOP_RADIUS_KM ? C.amberLight : "#f0fdf4", border:`1px solid ${sc.km!=null&&sc.km>STOP_RADIUS_KM ? C.amber : "#86efac"}`, borderRadius:8, fontSize:13, fontWeight:700, color: sc.km!=null&&sc.km>STOP_RADIUS_KM ? C.amber : C.green, textAlign:"center" }}>
                        ${sc.charge}{sc.km!=null ? ` (${sc.km}km)` : ""}
                      </div>
                      <button onClick={() => {
                        const stops = (parsed.additional_pickups||[]).filter((_,j)=>j!==i);
                        handleFieldChange("additional_pickups", stops, parsed);
                      }} style={{ background:"none", border:"none", color:C.subtle, cursor:"pointer", fontSize:18, padding:"0 4px" }}>×</button>
                    </div>
                  );
                })}
                {!(parsed.additional_pickups||[]).length && <div style={{ fontSize:13, color:C.subtle }}>No additional pickups</div>}
              </div>

              {/* Additional Deliveries */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.navy }}>Additional Deliveries</div>
                  <button onClick={() => {
                    const stops = [...(parsed.additional_deliveries||[]), { location:"", lat:null, lon:null }];
                    handleFieldChange("additional_deliveries", stops, parsed);
                  }} style={{ fontSize:12, padding:"4px 12px", background:C.navy, color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>+ Add</button>
                </div>
                {(parsed.additional_deliveries||[]).map((s,i) => {
                  const sc = stopCharge(s.lat, s.lon, parsed.dest_lat, parsed.dest_lon);
                  return (
                    <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                      <input value={s.location||""} placeholder="Address or city"
                        onChange={e => {
                          const stops = (parsed.additional_deliveries||[]).map((x,j) => j===i ? {...x, location:e.target.value} : x);
                          handleFieldChange("additional_deliveries", stops, parsed);
                        }}
                        style={{ ...input, flex:1 }}/>
                      <div style={{ minWidth:120, padding:"10px 12px", background: sc.km!=null&&sc.km>STOP_RADIUS_KM ? C.amberLight : "#f0fdf4", border:`1px solid ${sc.km!=null&&sc.km>STOP_RADIUS_KM ? C.amber : "#86efac"}`, borderRadius:8, fontSize:13, fontWeight:700, color: sc.km!=null&&sc.km>STOP_RADIUS_KM ? C.amber : C.green, textAlign:"center" }}>
                        ${sc.charge}{sc.km!=null ? ` (${sc.km}km)` : ""}
                      </div>
                      <button onClick={() => {
                        const stops = (parsed.additional_deliveries||[]).filter((_,j)=>j!==i);
                        handleFieldChange("additional_deliveries", stops, parsed);
                      }} style={{ background:"none", border:"none", color:C.subtle, cursor:"pointer", fontSize:18, padding:"0 4px" }}>×</button>
                    </div>
                  );
                })}
                {!(parsed.additional_deliveries||[]).length && <div style={{ fontSize:13, color:C.subtle }}>No additional deliveries</div>}
              </div>
            </div>

            {/* FSC */}
            <div style={card}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:14 }}>Fuel Surcharge</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {FSC_OPTS.map(o => (
                  <button key={o.v} onClick={()=>setFsc(o.v)} style={{ padding:"9px 18px", fontSize:14, fontWeight:fsc===o.v?700:400, borderRadius:8, cursor:"pointer", background:fsc===o.v?C.navy:"#f1f5f9", color:fsc===o.v?"#fff":C.text, border:`1.5px solid ${fsc===o.v?C.navy:C.border}` }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessorials */}
            <div style={card}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:14 }}>Accessorials</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                {ACC_OPTS.map(a => (
                  <button key={a.id} onClick={()=>setAccs(p=>({...p,[a.id]:!p[a.id]}))} style={{ padding:"9px 18px", fontSize:14, borderRadius:8, cursor:"pointer", fontWeight:accs[a.id]?600:400, background:accs[a.id]?"#eff6ff":"#f1f5f9", color:accs[a.id]?"#1d4ed8":C.text, border:`1.5px solid ${accs[a.id]?"#93c5fd":C.border}` }}>
                    {a.l} <span style={{ color:C.subtle, fontWeight:400, fontSize:12 }}>({a.n})</span>
                  </button>
                ))}
              </div>
              <input value={customAcc} onChange={e=>setCustomAcc(e.target.value)} placeholder="Add a custom accessorial charge…" style={input}/>
            </div>

            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <button onClick={()=>{setStep("input");setError(null);}} style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500 }}>
                ← Back
              </button>
              <button onClick={handleQuote} disabled={geocoding||!base} style={{ padding:"12px 28px", fontSize:15, fontWeight:700, borderRadius:8, cursor:"pointer", background:geocoding||!base?"#cbd5e1":C.navy, color:"#fff", border:"none" }}>
                {geocoding ? "Resolving location…" : "Generate Quote →"}
              </button>
              {error && <div style={{ fontSize:14, color:C.error }}>⚠ {error}</div>}
            </div>
          </>
        )}

        {/* ══ STEP 3 ══ */}
        {step === "result" && (
          <>
            {/* Multi-shipment header */}
            {shipments.length > 1 && (
              <div style={{ ...card, background:"#f0f4ff", border:`1px solid #c7d4f5`, padding:"14px 20px", marginBottom:8 }}>
                <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:4 }}>
                  {quoteTexts.filter(Boolean).length} of {shipments.length} quotes generated
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {shipments.map((s,i) => (
                    <button key={i} onClick={()=>{ setActiveIdx(i); setParsed(s); resolveRate(s); setQuoteText(quoteTexts[i]||""); }}
                      style={{ padding:"5px 14px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:activeIdx===i?700:400, background:activeIdx===i?C.navy:"#fff", color:activeIdx===i?"#fff":C.muted, border:`1.5px solid ${activeIdx===i?C.navy:C.border}` }}>
                      {i+1}. {s.dest_city}, {s.dest_state} {quoteTexts[i]?"✓":""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary bar */}
            <div style={{ ...card, background:C.greenLight, border:`1px solid #bbf7d0` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
                <div>
                  <div style={{ fontSize:13, color:C.green, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                    {shipments.length > 1 ? `Shipment ${activeIdx+1} of ${shipments.length}` : "Quote Ready"}
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:C.navy, marginTop:2 }}>{parsed.pickup_location || parsed.origin} → {parsed.dest_city}, {parsed.dest_state}</div>
                  <div style={{ fontSize:14, color:C.muted, marginTop:2 }}>{parsed.skids} skids · Rate via {rateCity?.city}, {rateCity?.state}{isNearest?` (${rateCity?.distance} mi from delivery)`:""}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:36, fontWeight:800, color:C.green }}>${total}</div>
                  <div style={{ fontSize:12, color:C.muted }}>CAD</div>
                </div>
              </div>
            </div>

            {/* Quote textarea */}
            <div style={card}>
              <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:6 }}>
                {shipments.length > 1 ? `Quote — Shipment ${activeIdx+1}: ${parsed.dest_city}, ${parsed.dest_state}` : "Quote Email"}
              </div>
              <div style={{ fontSize:14, color:C.muted, marginBottom:12 }}>Edit if needed, then copy and paste into your reply.</div>
              <textarea value={quoteText} onChange={e=>{ setQuoteText(e.target.value); setQuoteTexts(prev=>{ const u=[...prev]; u[activeIdx]=e.target.value; return u; }); }}
                style={{ ...input, height:300, resize:"vertical", lineHeight:1.75, fontFamily:"'Courier New', monospace", fontSize:13, background:"#f8f9fb" }}
              />
            </div>

            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {/* Copy this quote */}
              <button onClick={()=>{
                const ta = document.createElement("textarea"); ta.value = quoteText;
                ta.style.position="fixed"; ta.style.top="0"; ta.style.left="0"; ta.style.width="2em"; ta.style.height="2em"; ta.style.opacity="0";
                document.body.appendChild(ta); ta.focus(); ta.select();
                try { document.execCommand("copy"); } catch(e) {}
                document.body.removeChild(ta);
                setCopiedIdx(activeIdx); setTimeout(()=>setCopiedIdx(null),2500);
              }} style={{ padding:"13px 24px", fontSize:15, fontWeight:700, borderRadius:8, cursor:"pointer", background:copiedIdx===activeIdx?C.green:C.amber, color:"#fff", border:"none", transition:"background 0.3s" }}>
                {copiedIdx===activeIdx ? "✓ Copied!" : shipments.length>1 ? `Copy Quote ${activeIdx+1}` : "Copy Quote"}
              </button>

              {/* Copy all quotes (multi only) */}
              {shipments.length > 1 && quoteTexts.filter(Boolean).length > 1 && (
                <button onClick={()=>{
                  const all = quoteTexts.filter(Boolean).join("\n\n" + "\u2500".repeat(40) + "\n\n");
                  const ta = document.createElement("textarea"); ta.value = all;
                  ta.style.position="fixed"; ta.style.top="0"; ta.style.left="0"; ta.style.width="2em"; ta.style.height="2em"; ta.style.opacity="0";
                  document.body.appendChild(ta); ta.focus(); ta.select();
                  try { document.execCommand("copy"); } catch(e) {}
                  document.body.removeChild(ta);
                  setAllCopied(true); setTimeout(()=>setAllCopied(false),2500);
                }} style={{ padding:"13px 24px", fontSize:15, fontWeight:700, borderRadius:8, cursor:"pointer", background:allCopied?C.green:"#1d4ed8", color:"#fff", border:"none", transition:"background 0.3s" }}>
                  {allCopied ? "✓ All Copied!" : `Copy All ${quoteTexts.filter(Boolean).length} Quotes`}
                </button>
              )}

              {/* Next shipment button */}
              {shipments.length > 1 && activeIdx < shipments.length - 1 && (
                <button onClick={()=>{ const ni=activeIdx+1; setActiveIdx(ni); setParsed(shipments[ni]); resolveRate(shipments[ni]); setQuoteText(quoteTexts[ni]||""); setStep("review"); }}
                  style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:C.navy, color:"#fff", border:"none", fontWeight:600 }}>
                  Next Shipment →
                </button>
              )}

              <button onClick={()=>{setStep("review");setError(null);}} style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500 }}>
                ← Adjust
              </button>
              <button onClick={()=>{ setStep("input"); setEmail(""); setParsed(null); setShipments([]); setRateCity(null); setRateResult(null); setQuoteText(""); setQuoteTexts([]); setError(null); }}
                style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500 }}>
                New Quote
              </button>
            </div>
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}
