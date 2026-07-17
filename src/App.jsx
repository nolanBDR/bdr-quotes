import { useState, useCallback, useRef, useEffect } from "react";
import { CUSTOMER_PROFILES } from "./customerProfiles.js";
import { ZIP3_CENTROIDS } from "./zip3Zones.js";

const ANTHROPIC_KEY   = (() => { try { return import.meta.env.VITE_ANTHROPIC_KEY  || ""; } catch(e) { return ""; } })();

// Polyfill window.storage with localStorage when running outside Claude preview
if (!window.storage) {
  window.storage = {
    get:    (k)    => Promise.resolve(localStorage.getItem(k) ? { value: localStorage.getItem(k) } : null),
    set:    (k, v) => { localStorage.setItem(k, v); return Promise.resolve(); },
    delete: (k)    => { localStorage.removeItem(k); return Promise.resolve(); },
    list:   (prefix) => Promise.resolve({ keys: Object.keys(localStorage).filter(k => k.startsWith(prefix)) }),
  };
}

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
  "ON|Knoxville|TN":     [400,450,525,600,675,750,825,900,975,1050,1125,1200,1275,1375,1450,1525,1600,1675,1750,1825,1900,3000],
  "ON|Chattanooga|TN":   [400,450,525,600,675,750,825,900,975,1050,1125,1200,1275,1375,1450,1525,1600,1675,1750,1825,1900,3000],
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
  "QC|Knoxville|TN":     [500,600,725,850,975,1100,1225,1350,1475,1600,1725,1850,1975,2125,2250,2375,2500,2625,2750,2875,3000,3800],
  "QC|Chattanooga|TN":   [500,600,725,850,975,1100,1225,1350,1475,1600,1725,1850,1975,2125,2250,2375,2500,2625,2750,2875,3000,3800],
};

// Areas that should never be quoted at all. Entry types:
//  - lat/lon + radiusMi: circular exclusion (e.g. Laredo)
//  - zip3: list of excluded 3-digit ZIP prefixes
//  - state + minLat: everything in that state north of a latitude line
// Add more entries here as BDR identifies areas it doesn't want to service.
const UNSERVICED_ZONES = [
  { label: "Laredo, TX", lat: 27.506, lon: -99.508, radiusMi: 100 },
  // No service north of the Mackinac Bridge (MI Upper Peninsula). The lat line
  // handles geocoded destinations; zip3 catches 498/499 (most of the UP) when
  // only a ZIP is known. Eastern-UP 497xx ZIPs span the bridge, so those rely
  // on the ZIP3 centroid latitude check below.
  { label: "north of the Mackinac Bridge (Upper Peninsula)", state: "MI", minLat: 45.79, zip3: ["498","499"] },
];

// Pockets OUTSIDE the serviced states that BDR does service anyway — quoted via
// their nearest anchor city and zone tier like anywhere else. Verified by
// distance to the named anchor, using shipment coords or the ZIP3 centroid.
const SERVICED_STATE_EXCEPTIONS = [
  { label: "Northern MS (Memphis area)", state: "MS", nearCity: "Memphis", maxMiles: 100 },
  { label: "AR across from Memphis", state: "AR", nearCity: "Memphis", maxMiles: 50 },
];

// Beyond this distance (miles) from a shipment's resolved rate zone, block
// the quote outright instead of just charging the highest zone-tier surcharge.
const MAX_ZONE_MILES = 300;

// Returns a complete, human-readable reason (not just a label) when a
// destination shouldn't be quoted at all — displayed as-is in the UI.
function isUnserviced(city, state, lat, lon, zip, zoneMiles) {
  const zip3 = (zip || "").slice(0, 3);
  const where = city && state ? `${city}, ${state}` : city || "This destination";
  const st = (state || "").toUpperCase().trim();
  // Best coordinates available: the shipment's own, else its ZIP3 centroid.
  const centroid = ZIP3_CENTROIDS[zip3];
  const effLat = lat || (centroid ? centroid[0] : null);
  const effLon = lon || (centroid ? centroid[1] : null);

  if (st && !SERVICED_STATES.has(st)) {
    const exc = SERVICED_STATE_EXCEPTIONS.find(e => e.state === st);
    const anchor = exc && RATE_CITIES.find(c => c.city === exc.nearCity);
    const excused = anchor && effLat && effLon && haversine(effLat, effLon, anchor.lat, anchor.lon) <= exc.maxMiles;
    if (!excused) return `${where} is in a state BDR doesn't currently service.`;
  }
  for (const z of UNSERVICED_ZONES) {
    if (z.zip3?.length && zip3 && z.zip3.includes(zip3)) return `${where} is in an excluded ZIP zone (${z.label}).`;
    if (z.state && z.minLat != null) {
      if (st === z.state && effLat && effLat > z.minLat) return `${where} is ${z.label} — BDR doesn't service there.`;
      continue;
    }
    if (lat && lon && z.lat != null && z.lon != null) {
      if (haversine(lat, lon, z.lat, z.lon) <= z.radiusMi) return `${where} is within ${z.radiusMi} miles of ${z.label}.`;
    } else if (city && z.label) {
      // fallback: exact city name match when coords unavailable
      if (city.trim().toLowerCase() === z.label.split(",")[0].toLowerCase()) return `${where} is within ${z.radiusMi} miles of ${z.label}.`;
    }
  }
  if (zoneMiles != null && zoneMiles > MAX_ZONE_MILES) return `${where} is ${zoneMiles} mi from the nearest rate zone — outside our normal service area.`;
  return null;
}

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
  { city:"Knoxville",   state:"TN", lat:35.961, lon:-83.921 },
  { city:"Chattanooga", state:"TN", lat:35.046, lon:-85.310 },
];

// Only these states have rate lanes today — any destination outside them is
// unserviced regardless of distance to the nearest anchor. Derived from
// RATE_CITIES so adding a city to a new state automatically opens it up.
const SERVICED_STATES = new Set(RATE_CITIES.map(c => c.state));

const DEFAULT_DRIVERS = [
  {id:"drv_new_1779127321319_mbb9",name:"Abraham Rempel Fehr",truckNumber:"183",departureDays:[1,2,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Detroit, MI"],category:"crossborder"},
  {id:"drv_new_1779127321321_me21",name:"Blair Dodd",truckNumber:"1199",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Grand Rapids, MI"],category:"crossborder"},
  {id:"drv_new_1779127321321_bxbt",name:"Blake Filby",truckNumber:"319",departureDays:[2],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX"],category:"crossborder"},
  {id:"drv_new_1779127321322_aoot",name:"Bogdan Michalczyk",truckNumber:"1118",departureDays:[1,2,3,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_13",name:"Brad Watson",truckNumber:"263",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_11",name:"Brad Wright",truckNumber:"270",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["St Louis, MO","Kansas City, KS"],category:"crossborder"},
  {id:"drv_new_1779127321334_4335",name:"Brian Kilgour",truckNumber:"7000",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_10",name:"Brian Murley",truckNumber:"264",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["St Louis, MO","Kansas City, KS"],category:"crossborder"},
  {id:"drv_27",name:"Bruce Reimer",truckNumber:"1170",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Cleveland, OH","Detroit, MI","Lansing, MI","Grand Rapids, MI","Toledo, OH","Cincinnati, OH"],category:"crossborder"},
  {id:"drv_new_1779127321335_wusj",name:"Bryan Devos",truckNumber:"1192",departureDays:[1,2,3,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Detroit, MI"],category:"crossborder"},
  {id:"drv_new_1779127321335_tn59",name:"Charles Sherman",truckNumber:"178",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX"],category:"local_tx"},
  {id:"drv_new_1779127321338_cmf5",name:"Chifuniro Taulo",truckNumber:"112",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127321339_rjjx",name:"Cornelius Blatz",truckNumber:"1135",departureDays:[1,2,3,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_28",name:"Cornelius Peters",truckNumber:"1070",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Columbus, OH"],category:"crossborder"},
  {id:"drv_new_1779127134148_zv43",name:"Cornelius Sawatzky",truckNumber:"304",departureDays:[2],driverType:"company",partTime:false,worksDock:true,outOfService:false,lanes:["St Louis, MO"],category:"crossborder"},
  {id:"drv_new_1779127134148_3pio",name:"Daniel Bellehumeur",truckNumber:"1176",departureDays:[1,3],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779127134148_4odb",name:"Daniel Bennett",truckNumber:"111",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127134149_t7pc",name:"Darren Gofton",truckNumber:"69",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"sprinter"},
  {id:"drv_new_1779127134149_6fnk",name:"Darren Shepherd",truckNumber:"1150",departureDays:[2,1,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127134149_77v4",name:"Darren Zavitz",truckNumber:"173",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_16",name:"David Filby",truckNumber:"242",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Nashville, TN","Louisville, KY","Memphis, TN","Kansas City, KS","St Louis, MO","Indianapolis, IN"],category:"crossborder"},
  {id:"drv_new_1779127134149_mt1b",name:"David Gingrich",truckNumber:"106",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127134150_fpgx",name:"Dawid Stralka",truckNumber:"121",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127134150_vogp",name:"Derek Krawczyk",truckNumber:"1129",departureDays:[1,3],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Grand Rapids, MI"],category:"crossborder"},
  {id:"drv_35",name:"Derrick Gibbons",truckNumber:"289",departureDays:[1],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Louisville, KY","Nashville, TN","Memphis, TN"],category:"crossborder"},
  {id:"drv_new_1779127134166_f07t",name:"Diedrich Klassen",truckNumber:"317",departureDays:[2],driverType:"company",partTime:false,worksDock:true,outOfService:false,lanes:["Nashville, TN"],category:"crossborder"},
  {id:"drv_8",name:"Doug Stewart",truckNumber:"306",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Chicago, IL","St Louis, MO"],category:"crossborder"},
  {id:"drv_32",name:"Elmer Loewen",truckNumber:"1198",departureDays:[1,4],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Indianapolis, IN"],category:"crossborder"},
  {id:"drv_new_1779127134167_0hyj",name:"Elmer Martens",truckNumber:"104",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127134168_4s66",name:"Ernest Fehr",truckNumber:"1169",departureDays:[1,2,3,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Detroit, MI"],category:"crossborder"},
  {id:"drv_new_1779127134168_wbt0",name:"Ethan Renner-Bell",truckNumber:"TBD",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127134168_psrn",name:"Evgueni Tourkov",truckNumber:"1164",departureDays:[1,3],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Grand Rapids, MI"],category:["crossborder"]},
  {id:"drv_1779126108339",name:"Frank Zacharias",truckNumber:"1168",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Detroit, MI","Lansing, MI","Grand Rapids, MI"],category:"crossborder"},
  {id:"drv_33",name:"Gabriel Adams",truckNumber:"1154",departureDays:[2,4],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Indianapolis, IN"],category:"crossborder"},
  {id:"drv_new_1779127134168_avjm",name:"Gabriel Ponce",truckNumber:"109",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX","San Antonio, TX"],category:"local_tx"},
  {id:"drv_21",name:"Gamdoor Mann",truckNumber:"1172",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Chicago, IL","Indianapolis, IN"],category:"crossborder"},
  {id:"drv_new_1779127134169_qirr",name:"Gary Crosby",truckNumber:"186",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"local"},
  {id:"drv_new_1779127134169_2v11",name:"Gary Crossett",truckNumber:"305",departureDays:[2],driverType:"company",partTime:false,worksDock:true,outOfService:false,lanes:["Indianapolis, IN"],category:"crossborder"},
  {id:"drv_new_1779127134169_vsjc",name:"George Parrow",truckNumber:"101",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779127134169_b6ek",name:"Gerhard Friesen Wieler",truckNumber:"107",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_29",name:"Gilbert Toews",truckNumber:"1200",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Chicago, IL","Indianapolis, IN","Cincinnati, OH","Columbus, OH"],category:"crossborder"},
  {id:"drv_new_1779127134169_ucx9",name:"Grzegorz Machala",truckNumber:"1182",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Grand Rapids, MI","Lansing, MI","Detroit, MI","Toledo, OH","Cleveland, OH","Cincinnati, OH","Columbus, OH","Indianapolis, IN","Chicago, IL"],category:["crossborder"]},
  {id:"drv_22",name:"Gurpreet Bhathal",truckNumber:"1144",departureDays:[1],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Cincinnati, OH"],category:"crossborder"},
  {id:"drv_new_1779127134170_px26",name:"Gurpreet Singh Chahal",truckNumber:"1149",departureDays:[1,2,3,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Detroit, MI"],category:["crossborder"]},
  {id:"drv_20",name:"Harjot Gill",truckNumber:"1184",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Chicago, IL","Indianapolis, IN","Cincinnati, OH","Cleveland, OH","Columbus, OH"],category:"crossborder"},
  {id:"drv_new_1779127134170_znpe",name:"Heinrich Knelsen",truckNumber:"316",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_23",name:"Herman Neufeld",truckNumber:"1081",departureDays:[1,4],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Cincinnati, OH","Louisville, KY"],category:"crossborder"},
  {id:"drv_new_1779127134170_h75k",name:"Himanshu Sharma",truckNumber:"120",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779127134170_6e78",name:"Hugo Paz Valencia",truckNumber:"1188",departureDays:[1,3,2,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779127134170_98wv",name:"Jackson D'Aguiar",truckNumber:"7001",departureDays:[1,2,3,5,4],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779127134171_ttts",name:"Jacob Froese",truckNumber:"1160",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779127134171_jx36",name:"Jacob Hildebrandt",truckNumber:"1087",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779127134171_ro25",name:"Jacob Klassen",truckNumber:"256",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779127134171_4wcw",name:"Jacob Sawatzky",truckNumber:"1103",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_31",name:"Jacobo Wiebe",truckNumber:"1177",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Chicago, IL","Indianapolis, IN","Columbus, OH","Cincinnati, OH","Detroit, MI","Lansing, MI","Grand Rapids, MI","Toledo, OH","Cleveland, OH"],category:"crossborder"},
  {id:"drv_26",name:"Jagdeep Farmah",truckNumber:"1158",departureDays:[1],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Detroit, MI","Lansing, MI","Grand Rapids, MI"],category:"crossborder"},
  {id:"drv_38",name:"James Peters",truckNumber:"250",departureDays:[1],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Louisville, KY","St Louis, MO","Kansas City, KS","Nashville, TN","Memphis, TN","Indianapolis, IN"],category:"crossborder"},
  {id:"drv_30",name:"James Webber",truckNumber:"1156",departureDays:[1,3],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Chicago, IL","Grand Rapids, MI","Lansing, MI","Detroit, MI"],category:"crossborder"},
  {id:"drv_new_1779127134171_1nax",name:"James Woolley",truckNumber:"103",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779127134181_rgo0",name:"Jamie Barclay",truckNumber:"",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779127134181_f7fg",name:"Jan Czuba",truckNumber:"1174",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_2",name:"Jeff Kummer",truckNumber:"291",departureDays:[6],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Nashville, TN","Memphis, TN"],category:"crossborder"},
  {id:"drv_1",name:"Jeff Montgomery",truckNumber:"SPARE",departureDays:[],driverType:"company",partTime:true,worksDock:false,outOfService:false,lanes:["Indianapolis, IN"],category:"crossborder"},
  {id:"drv_new_1779126929227_ce9p",name:"Jeffrey Malcolm",truckNumber:"262",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779126929264_mon2",name:"Jeffrey Taysa",truckNumber:"1153",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_15",name:"Jeremy Ellis",truckNumber:"298",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Indianapolis, IN","St Louis, MO","Kansas City, KS"],category:"crossborder"},
  {id:"drv_9",name:"Jeremy Randle",truckNumber:"258",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["St Louis, MO","Indianapolis, IN","Kansas City, KS"],category:"crossborder"},
  {id:"drv_new_1779126929264_gc2k",name:"Joby Benchamin",truckNumber:"1189",departureDays:[1,3,2,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929264_f2v8",name:"Joe Bright",truckNumber:"7002",departureDays:[1,3,2,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_34",name:"Johan Bergen",truckNumber:"296",departureDays:[1],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Louisville, KY","Nashville, TN","Memphis, TN"],category:"crossborder"},
  {id:"drv_new_1779126929264_yg1b",name:"Johan Friesen",truckNumber:"1109",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779126929264_oxgf",name:"Johann Peters",truckNumber:"1139",departureDays:[1,2,3,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929265_oyzx",name:"John Coleman",truckNumber:"113",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929265_4mqc",name:"John Enns",truckNumber:"1151",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:true,lanes:[],category:"crossborder"},
  {id:"drv_6",name:"John Mercer",truckNumber:"301",departureDays:[0],driverType:"company",partTime:false,worksDock:true,outOfService:false,lanes:["Louisville, KY"],category:"crossborder"},
  {id:"drv_36",name:"John Thiessen",truckNumber:"290",departureDays:[1],driverType:"company",partTime:false,worksDock:true,outOfService:false,lanes:["Nashville, TN"],category:"crossborder"},
  {id:"drv_5",name:"Jordan Grey",truckNumber:"303",departureDays:[0],driverType:"company",partTime:false,worksDock:true,outOfService:false,lanes:["Indianapolis, IN"],category:"crossborder"},
  {id:"drv_new_1779126929265_zdmu",name:"Jose Klassen",truckNumber:"318",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779126929266_vymz",name:"Kenneth Beadle",truckNumber:"1187",departureDays:[1,2,4,3,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929268_se3y",name:"Kent Dowling",truckNumber:"114",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929269_opys",name:"Mark Dube",truckNumber:"181",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929269_j3q1",name:"Marten Martens",truckNumber:"1191",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_12",name:"Martin Spence",truckNumber:"243",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_17",name:"Matthew Fortin",truckNumber:"272",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Nashville, TN"],category:"crossborder"},
  {id:"drv_1779126228380",name:"Navpreet Singh",truckNumber:"1181",departureDays:[1,3,2,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779126929269_inhj",name:"Peter Blatz",truckNumber:"SPARE",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_39",name:"Peter Harder",truckNumber:"268",departureDays:[1],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Dallas, TX"],category:"crossborder"},
  {id:"drv_37",name:"Peter Peters",truckNumber:"302",departureDays:[1,3],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Indianapolis, IN"],category:"crossborder"},
  {id:"drv_24",name:"Peter Sawatzky",truckNumber:"1095R",departureDays:[1],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Cleveland, OH"],category:"crossborder"},
  {id:"drv_25",name:"Peter Thiessen",truckNumber:"1147",departureDays:[1,4],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:["Cleveland, OH"],category:"crossborder"},
  {id:"drv_new_1779126929269_c63y",name:"Peter Wall",truckNumber:"185",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929276_oykl",name:"Ramninder Singh Hans",truckNumber:"1178",departureDays:[1,2,3,4,5],driverType:"owner_op",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929276_dhic",name:"Richard Scheerer",truckNumber:"1179",departureDays:[1,2,3,4,5],driverType:"company",partTime:true,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929276_em95",name:"Robert Laur",truckNumber:"108",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_new_1779126929276_b9j1",name:"Roman Myszkal",truckNumber:"1196",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_18",name:"Ryan Buck",truckNumber:"300",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Nashville, TN","Memphis, TN"],category:"crossborder"},
  {id:"drv_40",name:"Sabu Adayattu",truckNumber:"314",departureDays:[1],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX"],category:"crossborder"},
  {id:"drv_new_1779126929277_nerq",name:"Sajan Rakhra",truckNumber:"1179",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_7",name:"Sara Wolek",truckNumber:"299",departureDays:[0],driverType:"company",partTime:false,worksDock:true,outOfService:false,lanes:["St Louis, MO"],category:"crossborder"},
  {id:"drv_14",name:"Scott O'Neill",truckNumber:"267",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_19",name:"Shawn Donaldson",truckNumber:"297",departureDays:[0],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Louisville, KY","Nashville, TN","Memphis, TN","Houston, TX"],category:"crossborder"},
  {id:"drv_new_1779126929279_kkij",name:"Thomas Lee",truckNumber:"105",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX","San Antonio, TX"],category:["local_tx"]},
  {id:"drv_4",name:"Tracy Rastall",truckNumber:"307",departureDays:[6],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX","Dallas, TX"],category:"crossborder"},
  {id:"drv_new_1779126929280_d4nu",name:"Waldemar Drelich",truckNumber:"1124",departureDays:[1,3],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Grand Rapids, MI"],category:["crossborder"]},
  {id:"drv_new_1779126929281_rttm",name:"Walter Calanche",truckNumber:"110",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX","San Antonio, TX"],category:["local_tx"]},
  {id:"drv_new_1779126929281_q355",name:"William Dyck",truckNumber:"1162",departureDays:[],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:"crossborder"},
  {id:"drv_new_1779126929281_bw7c",name:"William Klassen",truckNumber:"1186",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
  {id:"drv_3",name:"William Todd McGugan",truckNumber:"294",departureDays:[6],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:["Houston, TX","Dallas, TX"],category:"crossborder"},
  {id:"drv_new_1779126929281_y9xn",name:"Witold Janick",truckNumber:"182",departureDays:[1,2,3,4,5],driverType:"company",partTime:false,worksDock:false,outOfService:false,lanes:[],category:["local"]},
];

const DEFAULT_RECURRING_TRUCKS = [
  { id:"recur_default_1", dayOfWeek:6, route:"Houston, TX",      numTrucks:2, driver:"" },
  { id:"recur_default_2", dayOfWeek:6, route:"Nashville, TN",    numTrucks:1, driver:"" },
  { id:"recur_default_3", dayOfWeek:0, route:"Indianapolis, IN", numTrucks:1, driver:"Jordan Grey" },
  { id:"recur_default_4", dayOfWeek:0, route:"Louisville, KY",   numTrucks:1, driver:"John Mercer" },
  { id:"recur_default_5", dayOfWeek:0, route:"St. Louis, MO",    numTrucks:1, driver:"Sara Wolek" },
  { id:"recur_default_6", dayOfWeek:0, route:"St. Louis, MO",    numTrucks:1, driver:"Doug Stewart" },
];

const SKID_LABELS = ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","FTL"];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8, r = Math.PI / 180;
  const a = Math.sin(((lat2-lat1)*r)/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(((lon2-lon1)*r)/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// Cities that always use a specific rate point regardless of distance.
// Knoxville/Chattanooga used to be forced to Memphis here — now that they're
// their own RATE_CITIES anchors (with Memphis's rates), they resolve naturally
// through the normal nearest-anchor + zone-tier logic instead, so this is empty.
const RATE_CITY_OVERRIDES = {};

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

// Flat percentage surcharge tiers based on distance (miles) from a shipment's
// resolved rate-zone anchor. Core = no surcharge; each ring beyond that adds a
// flat percentage, capped at the last tier beyond its breakpoint. Tunable —
// a starting point to confirm against real quotes, not locked-in numbers.
const ZONE_TIERS = [
  { maxMiles: 25,  pct: 0,    label: "Core zone" },
  { maxMiles: 75,  pct: 0.05, label: "+5%" },
  { maxMiles: 150, pct: 0.10, label: "+10%" },
  { maxMiles: 250, pct: 0.15, label: "+15%" },
];
function zoneTier(miles) {
  if (miles == null) return { pct: 0, label: null };
  for (const t of ZONE_TIERS) if (miles <= t.maxMiles) return t;
  return ZONE_TIERS[ZONE_TIERS.length - 1];
}

// Validates a US ZIP (5-digit, optionally +4) and returns its 3-digit prefix, or null.
function toZip3(zip) {
  const s = (zip || "").trim();
  return /^\d{5}(-\d{4})?$/.test(s) ? s.slice(0, 3) : null;
}

// Resolves which rate-zone anchor + distance applies to a destination, in
// priority order: (1) RATE_CITY_OVERRIDES by city name — wins regardless of
// ZIP, same as findNearestRateCity; (2) a ZIP3 centroid lookup, deterministic
// and independent of live geocoding; (3) the existing geographic
// nearest-anchor fallback, with `zoneMiles: null` so NO zone tier is applied —
// any shipment without a usable ZIP behaves exactly as it always has.
function resolveZone(destZip, lat, lon, destCity) {
  const zip3 = toZip3(destZip);
  const centroid = zip3 ? ZIP3_CENTROIDS[zip3] : null;
  // Prefer the shipment's own geocoded lat/lon; fall back to the ZIP3 centroid
  // when geocoding hasn't resolved yet, so an override's distance is never NaN.
  const distLat = lat || (centroid ? centroid[0] : null);
  const distLon = lon || (centroid ? centroid[1] : null);

  if (destCity) {
    const key = destCity.toUpperCase().trim();
    const overrideCity = RATE_CITY_OVERRIDES[key];
    if (overrideCity) {
      const match = RATE_CITIES.find(c => c.city === overrideCity);
      if (match) {
        const miles = (distLat && distLon) ? Math.round(haversine(distLat, distLon, match.lat, match.lon)) : null;
        return { ...match, distance: miles, overridden: true, zoneMiles: miles, zoneSource: "override" };
      }
    }
  }

  if (centroid) {
    const [zLat, zLon] = centroid;
    let nearest = null, nearestDist = Infinity;
    for (const c of RATE_CITIES) {
      const d = haversine(zLat, zLon, c.lat, c.lon);
      if (d < nearestDist) { nearestDist = d; nearest = c; }
    }
    const miles = Math.round(nearestDist);
    return { ...nearest, distance: miles, zoneMiles: miles, zoneSource: "zip3" };
  }

  const geo = findNearestRateCity(lat, lon, destCity);
  return { ...geo, zoneMiles: null, zoneSource: "geo" };
}

const LBS_PER_SKID = 1700;
const r5 = v => Math.round(v / 5) * 5;  // round to nearest $5

const PIE_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316","#06b6d4","#ec4899","#84cc16","#a855f7"];

function LanePieChart({ slices }) {
  if (!slices.length) return null;
  const total = slices.reduce((s, x) => s + x.count, 0);
  const cx = 70, cy = 70, r = 60;
  let angle = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const sweep = (s.count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = slices.length === 1
      ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r*2} 0 a ${r} ${r} 0 1 1 -${r*2} 0`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { d, color: PIE_COLORS[i % PIE_COLORS.length], label: s.lane, count: s.count };
  });
  return (
    <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
      <svg width={140} height={140} style={{ flexShrink:0 }}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth={1.5}/>)}
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {paths.map((p, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:p.color, flexShrink:0 }}/>
            <span style={{ color:"#374151", fontWeight:500 }}>{p.label}</span>
            <span style={{ color:"#9ca3af", fontSize:11 }}>({p.count} quote{p.count!==1?"s":""})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const { pct: zonePct, label: zoneTierLabel } = zoneTier(rateCity.zoneMiles);

  if (skids === "FTL") {
    const rawBase = table[21];
    return { base: r5(rawBase * (1 + zonePct)), rawBase, zonePct, zoneTierLabel, table, key, orig, chargeIdx: 21, skidIdx: 21, weightIdx: 21, dimIdx: 21, footageIdx: 21, basisLabel: "FTL", dimBasis: null };
  }

  const footageVal    = parseFloat(footage) || 0;
  const hasSkids      = skids != null && skids !== "" && !isNaN(parseInt(skids));
  const hasDims       = lineItems && lineItems.length > 0 && lineItems.some(li => li.dim_l || li.dim_w || li.dim_h);
  // Use footage as basis whenever footage is provided and no actual dimensions exist
  const useFootageBasis = footageVal > 0 && !hasDims;
  const footageOnly     = footageVal > 0 && !hasSkids && !hasDims; // footage with no skid count at all

  // Standard skid: 48"L × 40"W → 2 ft per skid (divisor 24, no stacking assumed)
  const STD_FT_PER_SKID = 2;
  const skidCount   = hasSkids ? Math.max(parseInt(skids) || 1, 1) : (useFootageBasis ? Math.ceil(footageVal / 2) : 1);
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

  if (useFootageBasis) {
    // Footage provided (no dims). If skid count also given, charge on whichever is higher.
    const footageOrSkidIdx = hasSkids ? Math.max(footageIdx, skidIdx) : footageIdx;
    chargeIdx  = Math.max(footageOrSkidIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > footageOrSkidIdx ? "weight"
               : hasSkids && skidIdx > footageIdx ? "skids"
               : "footage";
  } else if (hasDimBasis) {
    chargeIdx  = Math.max(dimIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > dimIdx ? "weight" : "dimensions";
  } else {
    // No footage, no dims: assume standard 48×40" skids (2 ft/skid)
    chargeIdx  = Math.max(skidIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > skidIdx ? "weight" : "skids";
  }

  const rawBase = table[chargeIdx];
  return { base: r5(rawBase * (1 + zonePct)), rawBase, zonePct, zoneTierLabel, table, key, orig, chargeIdx, skidIdx, weightIdx, dimIdx, footageIdx, basisLabel, dimBasis, footageOnly, useFootageBasis };
}

// ── API queue — max 2 concurrent Anthropic calls, 300ms between slots ─────
// Geocoding uses OSM Nominatim (not Claude) so doesn't consume slots here.
let _claudeActive = 0;
const _claudeQueue = [];
function claudeFetch(bodyObj) {
  return new Promise((resolve, reject) => {
    _claudeQueue.push({ bodyObj, resolve, reject });
    _drainClaudeQueue();
  });
}
async function _drainClaudeQueue() {
  if (_claudeActive >= 2 || _claudeQueue.length === 0) return;
  _claudeActive++;
  const { bodyObj, resolve, reject } = _claudeQueue.shift();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ANTHROPIC_KEY ? { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } : {}) },
      body: JSON.stringify(bodyObj),
    });
    resolve(r);
  } catch(e) { reject(e); }
  finally {
    _claudeActive--;
    setTimeout(_drainClaudeQueue, 800); // 800ms gap before next slot opens
  }
}

async function parseEmailWithClaude(text) {
  let res, attempts = 0;
  while (attempts < 3) {
    res = await claudeFetch({
      model:"claude-haiku-4-5-20251001", max_tokens:1500,
      system:`You are a parser for a Canadian LTL freight carrier (GTA/Montreal pickup). Classify the email then extract all shipment data. Return ONLY valid JSON with no markdown or extra text.

SCHEMA:
{
  "email_type": "quote_request|booking|tracking|check_in|invoice|spam|other",
  "broker_name": "full name or null",
  "broker_first_name": "first name only or null",
  "broker_company": "company name or null",
  "confidence": "high|medium|low",
  "shipments": [
    {
      "origin": "Ontario or Quebec",
      "pickup_location": "full city/address. Default: GTA, Ontario or Montreal, Quebec",
      "pickup_lat": number, "pickup_lon": number,
      "dest_city": "city name", "dest_state": "2-letter state/province code",
      "dest_lat": number, "dest_lon": number,
      "dest_zip": "5-digit US ZIP code or null — see ZIP RULES below",
      "skids": number or "FTL" or null,
      "footage": number or null,
      "weight_lbs": number or null,
      "line_items": [{"skids":number,"dim_l":number,"dim_w":number,"dim_h":number,"stack_height":number or null}],
      "additional_pickups": [{"location":"string","lat":number,"lon":number}],
      "additional_deliveries": [{"location":"string","lat":number,"lon":number}],
      "pickup_date": "YYYY-MM-DD or descriptive string or null",
      "delivery_date": "YYYY-MM-DD or descriptive string or null",
      "consignee": "name of the company or person receiving the shipment or null",
      "delivery_address": "full street address of the delivery location or null",
      "commodity": "string or null",
      "notes": "any special requirements, time constraints, or flags",
      "missing_info": ["list missing critical fields"]
    }
  ]
}

ZIP RULES:
- dest_zip: extract ONLY if a literal 5-digit ZIP code appears in the source text (e.g. in the delivery address). NEVER infer, guess, or fill in a plausible ZIP for a named city the way you do for dest_lat/dest_lon — an incorrect guessed ZIP silently misroutes pricing, which is worse than leaving it null.

EMAIL TYPE RULES:
- quote_request: asking for a rate/price. Needs at minimum origin + destination + some quantity.
- booking: confirming they want to book, sending load sheet/dispatch, confirming a quoted price.
- tracking: asking for ETA, delivery status, POD request.
- check_in: checking availability or following up with no specific shipment details.
- invoice: billing, payment, invoice-related.
- spam: promotional, newsletter, automated system email.
- other: anything else.
ALWAYS populate shipments[] whenever any shipment details are present (destination, quantity, weight, dimensions, etc.), regardless of email type. Only leave shipments:[] for emails with absolutely no freight details (tracking only, invoice only, spam, check_in with no load info).

ORIGIN RULES:
- Default to "Ontario" unless pickup is clearly in Quebec.
- Ontario cities: Toronto, Scarborough, Mississauga, Brampton, Hamilton, Oakville, Burlington, Pickering, Ajax, Oshawa, Markham, Richmond Hill, Vaughan, Barrie, Kitchener, London, Windsor, Guelph, Cambridge.
- Quebec cities: Montreal, Laval, Longueuil, Brossard, Dorval, Verdun, Saint-Laurent, Gatineau, Quebec City.

DESTINATION RULES:
- Always provide dest_lat and dest_lon coordinates for the destination city.
- Convert full state/province names to 2-letter codes: Michigan→MI, Ohio→OH, Indiana→IN, Illinois→IL, Texas→TX, Tennessee→TN, Kentucky→KY, Missouri→MO, Kansas→KS, etc.
- If "IN" appears after a US city name, it means Indiana (state abbreviation), not "inbound".

WEIGHT RULES:
- Always convert to pounds (lbs).
- kg to lbs: multiply by 2.205. "500 kg" = 1103 lbs.
- Tonnes/metric tons to lbs: multiply by 2205. "1 tonne" = 2205 lbs.
- "2,000 lbs" = 2000. Strip commas.

SKID/PALLET TERMINOLOGY:
- "skid", "pallet", "plt", "skd", "plt" all mean skids.
- "pieces" or "units" with dimensions = treat each as a skid.
- "FTL" or "full truck" or "full load" → skids = "FTL".

DIMENSION RULES — use line_items when full L×W×H is given:
- Formats: "48 x 40 x 60", "48L x 40W x 60H", "48" L x 40" W x 60" H", "L48 W40 H60"
- dim_l, dim_w, dim_h are ALWAYS in inches.
- If height is missing, set dim_h = null.
- If only length and width are given, set dim_h = null.
- When using line_items, set footage = null.
- Each numbered item (e.g. "1. 48x40x60") = 1 skid (skids:1) unless stated otherwise.
- "3 skids 48x40x60" → one line_item with skids:3.
- Total shipment skids = sum of all line_items[].skids.
- stack_height: "stackable"=2, "double stack"/"stack 3 high"=3, "not stackable"/"no stack"/"fragile"=null, unstated=null.

FOOTAGE RULES — use when only length is given without width/height:
- CASE 1: Broker gives total linear feet directly → use that number as footage.
  Examples: "22 linear feet", "20 ft", "15 running feet", "half a trailer (30ft)" → footage = that number.
- CASE 2: Broker gives per-skid LENGTH only (no width/height) → calculate footage as:
  footage = (skid_count × length_inches) / 24
  This assumes standard width (≤48"), 2 skids across. Divisor is 24 (inches per foot × skids-across).
  Examples:
    "2 skids 105 inch length" → footage = (2 × 105) / 24 = 8.75
    "3 skids 96L" → footage = (3 × 96) / 24 = 12.0
    "1 skid 72 inches long" → footage = (1 × 72) / 24 = 3.0
  If broker specifies width > 48", use divisor 12 (1 across): footage = (count × length_inches) / 12.
- Leave footage = null ONLY when skid count is given with no length or dimension info at all.

MULTIPLE SHIPMENTS:
- Different destinations = separate entries in shipments[].
- Same destination, different dates with clearly distinct loads = separate entries.
- Same destination, same date = one entry.

COORDINATES: Always include accurate lat/lon for both pickup and destination. Use your knowledge of city coordinates.`,
      messages:[{role:"user",content:`Parse this:\n\n${text}`}],
    });
  if (res.status === 529 || res.status === 503 || res.status === 429) {
    attempts++;
    await new Promise(r => setTimeout(r, 8000 * attempts)); // 8s, 16s, 24s backoff
    continue;
  }
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `API error ${res.status}`;
    throw new Error(msg);
  }
  if (!data.content?.length) throw new Error("Empty response from API.");
  const rawText = data.content.map(b=>b.text||"").join("");
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response.");
  let result;
  try {
    result = JSON.parse(cleanJson(jsonMatch[0]));
  } catch(jsonErr) {
    console.error("JSON parse failed. Raw response:\n", rawText);
    throw new Error(`JSON parse error: ${jsonErr.message}`);
  }
  return (result.shipments||[result]).map(s => ({
    ...s,
    broker_name: s.broker_name || result.broker_name,
    broker_first_name: s.broker_first_name || result.broker_first_name,
    broker_company: s.broker_company || result.broker_company,
    email_type: result.email_type || "quote_request",
  }));
  }
  throw new Error("API overloaded after 3 attempts. Please try again.");
}

async function parsePDFWithClaude(base64Data, cacheKey) {
  // Cache by attachment content hash (first 64 chars of base64 is a good proxy)
  const ck = cacheKey || `bdr_pdf:${(base64Data||"").slice(0, 64)}`;
  try {
    const hit = localStorage.getItem(ck);
    if (hit) return JSON.parse(hit);
  } catch(e) {}

  const SYSTEM = `You are a parser for a Canadian LTL freight carrier (GTA/Montreal pickup). Extract all shipment data from this PDF document. Return ONLY valid JSON with no markdown or extra text.

SCHEMA:
{
  "email_type": "quote_request|booking|tracking|check_in|invoice|spam|other",
  "broker_name": "full name or null",
  "broker_first_name": "first name only or null",
  "broker_company": "company name or null",
  "confidence": "high|medium|low",
  "shipments": [
    {
      "origin": "Ontario or Quebec",
      "pickup_location": "full city/address. Default: GTA, Ontario or Montreal, Quebec",
      "pickup_lat": number, "pickup_lon": number,
      "dest_city": "city name", "dest_state": "2-letter state/province code",
      "dest_lat": number, "dest_lon": number,
      "dest_zip": "5-digit US ZIP code or null — see ZIP RULES below",
      "skids": number or "FTL" or null,
      "footage": number or null,
      "weight_lbs": number or null,
      "line_items": [{"skids":number,"dim_l":number,"dim_w":number,"dim_h":number,"stack_height":number or null}],
      "additional_pickups": [{"location":"string","lat":number,"lon":number}],
      "additional_deliveries": [{"location":"string","lat":number,"lon":number}],
      "pickup_date": "YYYY-MM-DD or descriptive string or null",
      "delivery_date": "YYYY-MM-DD or descriptive string or null",
      "consignee": "name of company or person receiving the shipment or null",
      "delivery_address": "full street address of delivery location or null",
      "commodity": "string or null",
      "reference_number": "PO#, order#, or reference# or null",
      "notes": "any special requirements, time constraints, or flags",
      "missing_info": ["list missing critical fields"]
    }
  ]
}

RULES:
- dest_lat/dest_lon: always include accurate coordinates for the delivery city.
- State codes: Michigan→MI, Ohio→OH, Indiana→IN, Illinois→IL, Texas→TX, Tennessee→TN, Kentucky→KY, Missouri→MO, Kansas→KS.
- Weight always in lbs. Convert: kg×2.205, tonnes×2205.
- origin: "Ontario" unless pickup is clearly in Quebec.
- Pieces/pallets/skids/units/PLT all count as skids.

ZIP RULES:
- dest_zip: extract ONLY if a literal 5-digit ZIP code appears in the document (e.g. in the delivery address block). NEVER infer or guess a ZIP for a named city — an incorrect guessed ZIP silently misroutes pricing, worse than leaving it null.`;

  let attempts = 0;
  while (attempts < 3) {
    const res = await claudeFetch({
        model:"claude-sonnet-4-6", max_tokens:4096,
        system: SYSTEM,
        messages:[{role:"user",content:[
          {type:"document",source:{type:"base64",media_type:"application/pdf",data:base64Data}},
          {type:"text",text:"Extract all shipment information from this PDF document."}
        ]}],
      });
    if (res.status===529||res.status===503||res.status===429){attempts++;await new Promise(r=>setTimeout(r,3000*attempts));continue;}
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message||`API error ${res.status}`);
    const rawText = data.content.map(b=>b.text||"").join("");
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in PDF response.");
    const parsed = JSON.parse(cleanJson(jsonMatch[0]));
    const result = parsed.shipments ? parsed : {shipments:[parsed], broker_name:parsed.broker_name, broker_company:parsed.broker_company};
    try { localStorage.setItem(ck, JSON.stringify(result)); } catch(e) {}
    return result;
  }
  throw new Error("API overloaded after 3 attempts.");
}

// ── Geocode via OSM Nominatim (free, no key, no Claude quota) ─────────────
// Results cached in localStorage forever — same city is never looked up twice.
async function geocodeCity(city, state) {
  if (!city) return null;
  const cacheKey = `bdr_geo:${(city + (state||"")).toLowerCase().replace(/\s+/g,"")}`;
  try {
    const hit = localStorage.getItem(cacheKey);
    if (hit) return JSON.parse(hit);
  } catch(e) {}
  try {
    const q = encodeURIComponent(`${city}${state ? ", " + state : ""}, USA`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us,ca`,
      { headers: { "Accept-Language": "en", "User-Agent": "BDR-Quotes/1.0" } }
    );
    const data = await res.json();
    if (!data[0]) return null;
    const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(e) {}
    return result;
  } catch(e) { return null; }
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

function cleanJson(str) {
  // Fix Python literals and trailing commas first
  str = str
    .replace(/:\s*None\b/g, ": null")
    .replace(/:\s*True\b/g,  ": true")
    .replace(/:\s*False\b/g, ": false")
    .replace(/,\s*([}\]])/g, "$1");
  // Walk char-by-char to escape raw newlines/tabs inside JSON strings
  let out = "", inStr = false, i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (inStr) {
      if (ch === "\\")  { out += ch + (str[i+1]||""); i += 2; continue; }
      if (ch === '"')   { inStr = false; }
      else if (ch === "\n") { out += "\\n"; i++; continue; }
      else if (ch === "\r") { out += "\\r"; i++; continue; }
      else if (ch === "\t") { out += "\\t"; i++; continue; }
    } else {
      if (ch === '"') inStr = true;
    }
    out += ch; i++;
  }
  return out;
}

const FSC_OPTS = [{v:0,l:"None"},{v:0.08,l:"8%"},{v:0.15,l:"15%"},{v:0.18,l:"18%"},{v:0.20,l:"20%"},{v:0.30,l:"30%"},{v:0.40,l:"40%"}];
const ACC_OPTS = [{id:"da",l:"Driver Assist",n:"from $75"},{id:"lg",l:"Liftgate",n:"from $75"},{id:"nc",l:"No Crossdock",n:"from $150"},{id:"fl",l:"Floorload",n:"+10% markup"},{id:"st",l:"Straight Truck",n:"$100"}];
const DIRECTION_OPTS = [{v:"outbound",l:"Outbound (ON/QC → US)"},{v:"inbound",l:"Inbound (US → ON/QC)"}];

// BDR's own signature — quotes are signed with this regardless of who fills the form.
const BDR_SIGNATURE = { name: "Nolan Giesbrecht", company: "BDR International Ltd", phone: "519-469-9361 ext 113" };

function routeQuoteEmail(dest_state, direction) {
  if (dest_state === "TX") return "texas@bdrint.ca";
  if ((direction || "outbound") === "inbound") return "inbound@bdrint.ca";
  return "outbound@bdrint.ca";
}

// ── Design tokens — BDR International branding (colours pulled from bdrint.ca) ──
const C = {
  bg: "#F2EFE9",          // BDR cream section background
  card: "#ffffff",
  border: "#e3dccd",      // warm tan border
  navy: "#1B232E",        // BDR heading/footer navy
  navyLight: "#2c3646",
  amber: "#641833",       // BDR burgundy (primary brand colour)
  amberLight: "#f7e9ed",
  green: "#16a34a",
  greenLight: "#f0fdf4",
  text: "#1B232E",
  muted: "#5c5f66",
  subtle: "#9b969e",
  error: "#dc2626",
  errorLight: "#fef2f2",
  highlight: "#f7e9ed",
  surface: "#efe8dc",     // warm neutral surface for inactive buttons/tables
  surfaceLight: "#f7f4ee",// near-white warm surface for subtle panels
};

const input = { width:"100%", boxSizing:"border-box", padding:"10px 14px", fontSize:14, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, background:"#fff", outline:"none", fontFamily:"inherit" };
const label = { display:"block", fontSize:12, fontWeight:600, color:"#444", marginBottom:5, letterSpacing:"0.02em" };
const card  = { background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:24, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.07)" };

function AutocompleteInput({ value, onChange, suggestions, placeholder, inputStyle }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(-1);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 12);
  const show = open && filtered.length > 0;
  return (
    <div style={{ position:"relative" }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHovered(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {show && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, minWidth:"100%", background:"#fff",
          border:"1px solid #e7dfd2", borderRadius:10, boxShadow:"0 8px 28px rgba(0,0,0,0.13)", zIndex:200,
          maxHeight:240, overflowY:"auto", padding:"4px 0" }}>
          {filtered.map((s, i) => {
            const parts = s.split(", ");
            const city = parts[0];
            const state = parts[1];
            return (
              <div key={i} onMouseDown={() => { onChange(s); setOpen(false); }} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(-1)}
                style={{ padding:"9px 14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between",
                  background: hovered===i ? C.amberLight : "transparent",
                  borderLeft: hovered===i ? `3px solid ${C.amber}` : "3px solid transparent",
                  transition:"background 0.1s" }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>{city}</span>
                {state && <span style={{ fontSize:12, fontWeight:700, color:C.navy, background:"#efe8dc", padding:"2px 7px", borderRadius:5 }}>{state}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [step, setStep]             = useState("input");
  const [email, setEmail]           = useState("");
  const [parsed, setParsed]         = useState(null);
  const [rateCity, setRateCity]     = useState(null);
  const [rateResult, setRateResult] = useState(null);
  const [geocoding, setGeocoding]   = useState(false);
  const [shipments, setShipments]   = useState([]);      // all parsed shipments
  const [activeIdx, setActiveIdx]   = useState(0);       // currently viewed shipment
  const [quoteTexts, setQuoteTexts]       = useState([]);   // generated quote per shipment
  const [allShipmentRates, setAllShipmentRates] = useState([]); // [{base,total,rateCity,rateResult}]
  const [quoteTimestamps, setQuoteTimestamps] = useState([]); // saveQuote's timestamp per shipment, for Send Email
  const [copiedIdx, setCopiedIdx]         = useState(null);
  const [allCopied, setAllCopied]         = useState(false);
  const [fsc, setFsc]               = useState(0.18);
  const [accs, setAccs]             = useState({});
  const [customAcc, setCustomAcc]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError]           = useState(null);
  const [quoteText, setQuoteText]   = useState("");
  const [copied, setCopied]         = useState(false);
  const [brokerCompany, setBrokerCompany] = useState("");
  const [brokerName, setBrokerName]       = useState("");
  const [brokerPhone, setBrokerPhone]     = useState("");
  const [brokerEmail, setBrokerEmail]     = useState("");
  const [emailSendState, setEmailSendState] = useState({}); // {[shipmentIdx]: "sending"|"sent"|"error"}
  const debounce                    = useRef(null);
  const [tab, setTab]               = useState("quote");   // quote | history

  // ── Capacity / Truck planning state ──────────────────────────
  const [truckDays, setTruckDays]           = useState([]);
  const [truckDaysLoaded, setTruckDaysLoaded] = useState(false);
  const [recurringTrucks, setRecurringTrucks] = useState([]);
  const [newRecurDow,    setNewRecurDow]    = useState("6"); // Saturday
  const [newRecurRoute,  setNewRecurRoute]  = useState("");
  const [newRecurCount,  setNewRecurCount]  = useState(1);
  const [newRecurDriver, setNewRecurDriver] = useState("");
  const [drivers,        setDrivers]        = useState([]);
  const [newDriverName,  setNewDriverName]  = useState("");
  const [newDriverLanes, setNewDriverLanes] = useState([]);
  const [driverFormOpen,  setDriverFormOpen]  = useState(false);
  const [newDriverDays,     setNewDriverDays]     = useState([]);
  const [newDriverPartTime, setNewDriverPartTime] = useState(false);
  const [newDriverTruck,    setNewDriverTruck]    = useState("");
  const [newDriverType,     setNewDriverType]     = useState("company");
  const [newDriverDock,     setNewDriverDock]     = useState(false);
  const [newDriverCategory, setNewDriverCategory] = useState(["crossborder"]);
  const [editDriverCategory,setEditDriverCategory]= useState(["crossborder"]);
  const [newDriverOOS,        setNewDriverOOS]        = useState(false);
  const [editDriverOOS,       setEditDriverOOS]       = useState(false);
  const [newDriverTruckType,  setNewDriverTruckType]  = useState("semi");
  const [editDriverTruckType, setEditDriverTruckType] = useState("semi");
  const [editingDriverId,     setEditingDriverId]     = useState(null);
  const [editingTruckDayId,   setEditingTruckDayId]   = useState(null);
  const [editTruckCount,      setEditTruckCount]      = useState(1);
  const [editTruckRoute,      setEditTruckRoute]      = useState("");
  const [truckExclusions,     setTruckExclusions]     = useState({});
  const [slotDrivers,         setSlotDrivers]         = useState({});
  const [editDriverName,    setEditDriverName]    = useState("");
  const [editDriverDays,    setEditDriverDays]    = useState([]);
  const [editDriverPartTime,setEditDriverPartTime]= useState(false);
  const [editDriverTruck,    setEditDriverTruck]   = useState("");
  const [editDriverDock,     setEditDriverDock]    = useState(false);
  const [editDriverLanes,    setEditDriverLanes]   = useState([]);
  const [editDriverType,     setEditDriverType]    = useState("company");

  const [history, setHistory]       = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [histSearch, setHistSearch] = useState("");
  const [historyView, setHistoryView] = useState("quotes"); // "quotes" | "pipeline" | "customers"
  const [brokers, setBrokers]         = useState([]);
  const [brokersLoaded, setBrokersLoaded] = useState(false);
  const [expandedBroker, setExpandedBroker] = useState(null);
  const [counterInputs, setCounterInputs] = useState({}); // {timestamp: amountString}
  const [viewingQuote, setViewingQuote] = useState(null);
  const [customers, setCustomers]     = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [plSearch,   setPlSearch]     = useState("");
  const [matchedCustomer, setMatchedCustomer] = useState(null); // auto-matched on parse

  // ── Agent state ───────────────────────────────────────────────
  const [agentOpen,     setAgentOpen]     = useState(false);
  const [agentMessages, setAgentMessages] = useState([]);
  const [agentInput,    setAgentInput]    = useState("");
  const [agentLoading,  setAgentLoading]  = useState(false);
  const [agentAlerts,   setAgentAlerts]   = useState([]);

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

      try {
        const tdKeys = await window.storage.list("bdr_truckday:");
        const tds = await Promise.all(
          tdKeys.keys.map(async k => {
            try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
            catch(e) { return null; }
          })
        );
        setTruckDays(tds.filter(Boolean).sort((a,b) => a.date.localeCompare(b.date)));
      } catch(e) { setTruckDays([]); }
      setTruckDaysLoaded(true);

      try {
        const rtKeys = await window.storage.list("bdr_recur:");
        const rts = await Promise.all(
          rtKeys.keys.map(async k => {
            try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
            catch(e) { return null; }
          })
        );
        const loadedRts = rts.filter(Boolean);
        if (loadedRts.length === 0) {
          await Promise.all(DEFAULT_RECURRING_TRUCKS.map(rt => window.storage.set(`bdr_recur:${rt.id}`, JSON.stringify(rt))));
          setRecurringTrucks([...DEFAULT_RECURRING_TRUCKS]);
        } else {
          setRecurringTrucks(loadedRts.sort((a,b) => a.dayOfWeek - b.dayOfWeek));
        }
      } catch(e) { setRecurringTrucks([]); }

      try {
        const dKeys = await window.storage.list("bdr_driver:");
        const drs = await Promise.all(
          dKeys.keys.map(async k => {
            try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
            catch(e) { return null; }
          })
        );
        const loaded = drs.filter(Boolean);
        if (loaded.length === 0) {
          await Promise.all(DEFAULT_DRIVERS.map(d => window.storage.set(`bdr_driver:${d.id}`, JSON.stringify(d))));
          setDrivers([...DEFAULT_DRIVERS].sort((a,b) => a.name.localeCompare(b.name)));
        } else {
          setDrivers(loaded.sort((a,b) => a.name.localeCompare(b.name)));
        }
      } catch(e) { setDrivers([]); }

      try {
        const excl = await window.storage.get("bdr_truck_exclusions");
        if (excl) setTruckExclusions(JSON.parse(excl.value));
      } catch(e) {}
      try {
        const sd = await window.storage.get("bdr_slot_drivers");
        if (sd) setSlotDrivers(JSON.parse(sd.value));
      } catch(e) {}

    })();
  }, []);

  // Reconcile with the server (Postgres) — picks up outcomes changed by an
  // emailed Accept/Decline click, and quotes generated on other devices/browsers.
  // Fires on load and whenever the History tab is opened. Best-effort: the app
  // must keep working fully offline / before the backend is deployed.
  useEffect(() => {
    if (!historyLoaded) return;
    (async () => {
      try {
        const res = await fetch("/api/quotes");
        const data = await res.json();
        if (!data.ok) return;
        const serverQuotes = data.quotes.map(q => ({ ...q, timestamp: Number(q.client_timestamp) }));
        setHistory(prev => {
          const byTs = new Map(prev.map(q => [q.timestamp, q]));
          for (const sq of serverQuotes) {
            const local = byTs.get(sq.timestamp);
            if (local) {
              if (local.outcome !== sq.outcome) {
                const merged = { ...local, outcome: sq.outcome };
                byTs.set(sq.timestamp, merged);
                window.storage.set(`bdr_quote:${sq.timestamp}`, JSON.stringify(merged)).catch(()=>{});
              }
            } else {
              byTs.set(sq.timestamp, sq);
            }
          }
          return [...byTs.values()].sort((a,b) => b.timestamp - a.timestamp);
        });
      } catch(e) { console.error("Could not reconcile quotes from server:", e); }
    })();
  }, [historyLoaded, tab]);

  // Lazy-load the broker/customer directory the first time that view is opened.
  useEffect(() => {
    if (historyView !== "customers" || brokersLoaded) return;
    (async () => {
      try {
        const res = await fetch("/api/brokers");
        const data = await res.json();
        if (data.ok) setBrokers(data.brokers);
      } catch(e) { console.error("Could not load customers:", e); }
      finally { setBrokersLoaded(true); }
    })();
  }, [historyView, brokersLoaded]);

  const QUOTE_LIMIT = 500;

  const updateQuoteOutcome = async (timestamp, outcome) => {
    try {
      const key = `bdr_quote:${timestamp}`;
      const r = await window.storage.get(key);
      if (!r) return;
      const updated = { ...JSON.parse(r.value), outcome };
      await window.storage.set(key, JSON.stringify(updated));
      setHistory(prev => prev.map(q => q.timestamp === timestamp ? updated : q));
    } catch(e) {}
  };

  const updateQuoteFields = async (timestamp, fields) => {
    try {
      const key = `bdr_quote:${timestamp}`;
      const r = await window.storage.get(key);
      if (!r) return;
      const updated = { ...JSON.parse(r.value), ...fields };
      await window.storage.set(key, JSON.stringify(updated));
      setHistory(prev => prev.map(q => q.timestamp === timestamp ? updated : q));
    } catch(e) {}
  };

  const saveTruckDay = async (td) => {
    try {
      await window.storage.set(`bdr_truckday:${td.id}`, JSON.stringify(td));
      setTruckDays(prev => {
        const without = prev.filter(t => t.id !== td.id);
        return [...without, td].sort((a,b) => a.date.localeCompare(b.date));
      });
    } catch(e) {}
  };

  const deleteTruckDay = async (id) => {
    try {
      await window.storage.delete(`bdr_truckday:${id}`);
      setTruckDays(prev => prev.filter(t => t.id !== id));
    } catch(e) {}
  };

  const saveRecurringTruck = async (rt) => {
    try {
      await window.storage.set(`bdr_recur:${rt.id}`, JSON.stringify(rt));
      setRecurringTrucks(prev => [...prev.filter(r => r.id !== rt.id), rt].sort((a,b) => a.dayOfWeek - b.dayOfWeek));
    } catch(e) {}
  };

  const toggleTruckExclusion = async (tdId, loadTimestamp) => {
    const key = `${tdId}:${loadTimestamp}`;
    setTruckExclusions(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      window.storage.set("bdr_truck_exclusions", JSON.stringify(next));
      return next;
    });
  };

  const deleteRecurringTruck = async (id) => {
    try {
      await window.storage.delete(`bdr_recur:${id}`);
      setRecurringTrucks(prev => prev.filter(r => r.id !== id));
    } catch(e) {}
  };

  const saveDriver = async (dr) => {
    try {
      await window.storage.set(`bdr_driver:${dr.id}`, JSON.stringify(dr));
      setDrivers(prev => [...prev.filter(d => d.id !== dr.id), dr].sort((a,b) => a.name.localeCompare(b.name)));
    } catch(e) {}
  };

  const deleteDriver = async (id) => {
    try {
      await window.storage.delete(`bdr_driver:${id}`);
      setDrivers(prev => prev.filter(d => d.id !== id));
    } catch(e) {}
  };

  const saveQuote = async (quoteData) => {
    const data = { outcome: "waiting", ...quoteData };
    try {
      const key = `bdr_quote:${data.timestamp}`;
      await window.storage.set(key, JSON.stringify(data));
      setHistory(prev => {
        const updated = [data, ...prev.filter(q => q.timestamp !== data.timestamp)];
        if (updated.length > QUOTE_LIMIT) {
          const toDelete = updated.slice(QUOTE_LIMIT);
          toDelete.forEach(q => window.storage.delete(`bdr_quote:${q.timestamp}`).catch(()=>{}));
          return updated.slice(0, QUOTE_LIMIT);
        }
        return updated;
      });
    } catch(e) { console.error("Could not save quote:", e); }

    // Dual-write to Postgres so history/customer visibility survives across
    // devices/browsers — best-effort, never blocks the local-first UI.
    fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(e => console.error("Could not sync quote to server:", e));
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
    fetch(`/api/quotes?timestamp=${timestamp}`, { method: "DELETE" }).catch(e => console.error("Could not delete quote from server:", e));
  };

  const resolveRate = (p) => {
    if (!p?.dest_zip && (!p?.dest_lat || !p?.dest_lon)) return null;
    const rc = resolveZone(p.dest_zip, p.dest_lat, p.dest_lon, p.dest_city);
    const r  = getRate(p.origin, rc, p.skids, p.weight_lbs, p.line_items, p.footage);
    setRateCity(rc); setRateResult(r);
    return r;
  };

  const normalizeShipment = (s) => ({
    ...s,
    line_items:            Array.isArray(s.line_items)            ? s.line_items            : [],
    additional_pickups:    Array.isArray(s.additional_pickups)    ? s.additional_pickups    : [],
    additional_deliveries: Array.isArray(s.additional_deliveries) ? s.additional_deliveries : [],
    missing_info:          Array.isArray(s.missing_info)          ? s.missing_info          : [],
  });

  const handleParse = useCallback(async () => {
    if (!email.trim()) return;
    setLoading(true); setError(null);
    try {
      const raw_list   = await parseEmailWithClaude(email);
      const parsed_list = raw_list.map(normalizeShipment).filter(s => s.email_type === "quote_request" || s.dest_city || s.skids || s.weight_lbs || s.footage);
      if (!parsed_list.length) {
        const emailType = raw_list[0]?.email_type || "unknown";
        const typeLabels = { tracking:"a tracking request", check_in:"a check-in", invoice:"an invoice", spam:"spam", booking:"a booking confirmation", other:"a non-quote email" };
        setError(`This looks like ${typeLabels[emailType] || "a non-quote email"} — no shipment details were found to rate. Paste a quote request email with a destination and quantity.`);
        return;
      }
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
      if (first.broker_name) setBrokerName(prev => prev || first.broker_name);
      if (first.broker_company) setBrokerCompany(prev => prev || first.broker_company);
    } catch(e) { setError(e?.message || "Could not parse email. Check your connection and try again."); }
    finally { setLoading(false); }
  }, [email]);

  const handlePDFUpload = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") { setError("Please select a PDF file."); return; }
    setPdfLoading(true); setError(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await parsePDFWithClaude(base64);
      const parsed_list = (result.shipments || [result]).map(normalizeShipment);
      if (result.broker_name) parsed_list.forEach(s => { if (!s.broker_name) s.broker_name = result.broker_name; });
      if (result.broker_company) parsed_list.forEach(s => { if (!s.broker_company) s.broker_company = result.broker_company; });
      setShipments(parsed_list);
      setActiveIdx(0);
      const first = parsed_list[0];
      setParsed(first);
      resolveRate(first);
      setQuoteTexts([]);
      setStep("review");
      const match = matchCustomer(result.broker_company, result.broker_name);
      setMatchedCustomer(match);
      if (match?.default_fsc != null) setFsc(match.default_fsc);
      if (result.broker_name) setBrokerName(prev => prev || result.broker_name);
      if (result.broker_company) setBrokerCompany(prev => prev || result.broker_company);
    } catch(e) { setError(e?.message || "Could not read PDF. Try again."); }
    finally { setPdfLoading(false); }
  }, []);

  const handleFieldChange = (key, value, current) => {
    const updated = { ...current, [key]: value };
    setParsed(updated);
    if (key === "skids" || key === "origin") {
      setRateResult(getRate(updated.origin, rateCity, updated.skids, updated.weight_lbs, updated.line_items, updated.footage));
      return;
    }
    if (key === "dest_zip") {
      // Synchronous local table lookup — recompute immediately, no geocode debounce needed.
      const rc = resolveZone(updated.dest_zip, updated.dest_lat, updated.dest_lon, updated.dest_city);
      setRateCity(rc);
      setRateResult(getRate(updated.origin, rc, updated.skids, updated.weight_lbs, updated.line_items, updated.footage));
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
            const rc = resolveZone(updated.dest_zip, coords.lat, coords.lon, updated.dest_city);
            setRateCity(rc);
            setRateResult(getRate(updated.origin, rc, updated.skids, updated.weight_lbs, updated.line_items, updated.footage));
          }
        } catch(e) {} finally { setGeocoding(false); }
      }, 800);
    }
  };

  const buildQuoteText = (s, rc, rr, fscRate, accsMap, customAccStr, ctct, cmp, ph, isFirst = true) => {
    const base        = rr.base;
    const floorloaded = !!accsMap["fl"];
    const subtotal    = base * (1 + fscRate);
    const afterFloor  = floorloaded ? subtotal * 1.10 : subtotal;
    const pStops = (s.additional_pickups   || []).map(x => ({ ...x, ...stopCharge(x.lat, x.lon, s.pickup_lat, s.pickup_lon) }));
    const dStops = (s.additional_deliveries|| []).map(x => ({ ...x, ...stopCharge(x.lat, x.lon, s.dest_lat,   s.dest_lon  ) }));
    const total   = r5(afterFloor + [...pStops,...dStops].reduce((sum,x)=>sum+x.charge,0));
    const accList = ACC_OPTS.filter(a => accsMap[a.id] && a.id !== "fl");
    return [
      isFirst ? `Hi ${s.broker_first_name || (s.broker_name || "[Broker Name]").split(" ")[0]},` : null,
      isFirst ? "" : null,
      isFirst ? "Thank you for reaching out. Please find our rate below." : "Please see the additional quote below.",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "FREIGHT QUOTE", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `Pickup:        ${s.pickup_location || s.origin}`,
      ...pStops.map((x,i) => `Add. Pickup ${i+1}: ${x.location} (+$${x.charge}${x.km!=null?` — ${x.km}km from origin`:""})`),
      `Destination:   ${s.dest_city}, ${s.dest_state}`,
      ...dStops.map((x,i) => `Add. Delivery ${i+1}: ${x.location} (+$${x.charge}${x.km!=null?` — ${x.km}km from dest`:""})`),
      `Skids:         ${s.skids}${rr.basisLabel==="weight"?` (charged at ${SKID_LABELS[rr.chargeIdx]} skids — weight basis)`:rr.basisLabel==="dimensions"?` (charged at ${SKID_LABELS[rr.chargeIdx]} skids — dimension basis)`:rr.basisLabel==="footage"&&!rr.footageOnly?` (rated on ${s.footage} ft customer footage)`:rr.basisLabel==="skids"?` (std 48×40")`:``}`,
      s.weight_lbs  ? `Weight:        ${Number(s.weight_lbs).toLocaleString()} lbs` : null,
      s.commodity   ? `Commodity:     ${s.commodity}` : null,
      s.pickup_date ? `Pickup Date:   ${s.pickup_date}` : null,
      TRANSIT_TIMES[s.dest_state?.toUpperCase()] ? `Transit Time:  Approx. ${TRANSIT_TIMES[s.dest_state.toUpperCase()]}` : null,

      floorloaded ? `Floorload (+10%): $${r5(subtotal*0.10)}` : null,
      ...pStops.map(x => `Add. Pickup:   $${x.charge} (${x.km!=null&&x.km>STOP_RADIUS_KM?">50km":"≤50km"})`),
      ...dStops.map(x => `Add. Delivery: $${x.charge} (${x.km!=null&&x.km>STOP_RADIUS_KM?">50km":"≤50km"})`),
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `TOTAL:         $${total} CAD`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ...(accList.length||customAccStr ? ["","Accessorials (if applicable):",...accList.map(a=>`  • ${a.l}: ${a.n}`),customAccStr?`  • ${customAccStr}`:null].filter(Boolean) : []),
      "","Quote valid for 24 hours. Transit times subject to availability.","",
      ctct||null, cmp||null, ph||null,
    ].filter(l => l !== null).join("\n");
  };

  const handleQuote = () => {
    if (!rateResult?.base) { setError("No rate found. Check origin and destination."); return; }
    setError(null);

    // Pre-compute zone + unserviced status for every shipment so isFirst can be
    // determined cleanly, and so the zone (once resolved) isn't recomputed below.
    // Zone/ZIP lookup only ever applies to the outbound destination side — inbound
    // shipments rate off the pickup side, which has no zip concept, so pass no zip.
    const shipmentZones = shipments.map((s, i) => {
      // The active shipment's `shipments[i]` entry goes stale the moment the user
      // edits a field in the Review step — handleFieldChange only updates `parsed`/
      // `rateCity`, never the shipments array. Reuse that live state here so the
      // unserviced/zone check matches what's actually being shown and quoted.
      if (i === activeIdx && rateCity) {
        const pIsInbound = (parsed?.direction || "outbound") === "inbound";
        // Inbound rates off the pickup (US) side — dest_state there is the Canadian
        // destination (ON/QC), not a US state, so it must never feed the state check.
        const pCity  = pIsInbound ? parsed?.pickup_location : parsed?.dest_city;
        const pState = pIsInbound ? null : parsed?.dest_state;
        const pLat   = pIsInbound ? parsed?.pickup_lat : parsed?.dest_lat;
        const pLon   = pIsInbound ? parsed?.pickup_lon : parsed?.dest_lon;
        const pZip   = pIsInbound ? null : parsed?.dest_zip;
        return { rc: rateCity, unserviced: isUnserviced(pCity, pState, pLat, pLon, pZip, rateCity.zoneMiles) };
      }
      const dir = s.direction || "outbound";
      const isInbound = dir === "inbound";
      const lat = isInbound ? s.pickup_lat : s.dest_lat;
      const lon = isInbound ? s.pickup_lon : s.dest_lon;
      const destCity = isInbound ? s.pickup_location : s.dest_city;
      const destState = isInbound ? null : s.dest_state;
      const destZip = isInbound ? null : s.dest_zip;
      const rc = (lat && lon) || destZip ? resolveZone(destZip, lat, lon, destCity) : null;
      const unserviced = isUnserviced(destCity, destState, lat, lon, destZip, rc?.zoneMiles);
      return { rc, unserviced };
    });
    const unservicedFlags = shipmentZones.map(z => z.unserviced);
    const firstServiceableIdx = unservicedFlags.findIndex(z => !z);

    // Resolve rates + build text for every shipment at once
    // Unserviced shipments are included but marked — they show a notice instead of a quote
    const results = shipments.map((s, i) => {
      const unservicedZone = unservicedFlags[i];
      if (unservicedZone) return { qt: "", rr: null, rc: null, unserviced: unservicedZone };
      const dir = s.direction || "outbound";
      const isFirst = i === firstServiceableIdx;
      // For the active shipment, reuse the already-resolved rate
      if (i === activeIdx && rateResult?.base) {
        const qt = buildQuoteText(s, rateCity, rateResult, fsc, accs, customAcc, BDR_SIGNATURE.name, BDR_SIGNATURE.company, BDR_SIGNATURE.phone, isFirst);
        return { qt, rr: rateResult, rc: rateCity };
      }
      const rc = shipmentZones[i].rc;
      if (!rc) return { qt: "", rr: null, rc: null };
      const origin = dir === "inbound" ? (s.dest_state === "QC" ? "Quebec" : "Ontario") : s.origin;
      const rr = getRate(origin, rc, s.skids, s.weight_lbs, s.line_items, s.footage, dir);
      if (!rr?.base) return { qt: "", rr, rc };
      const qt = buildQuoteText(s, rc, rr, fsc, accs, customAcc, BDR_SIGNATURE.name, BDR_SIGNATURE.company, BDR_SIGNATURE.phone, isFirst);
      return { qt, rr, rc };
    });

    const allQts   = results.map(r => r.qt);
    const allRates = results.map(r => ({ base: r.rr?.base, total: r.rr ? r5(r.rr.base*(1+fsc)) : null, rateCity: r.rc, rateResult: r.rr, unserviced: r.unserviced || null }));
    const baseTimestamp = Date.now();
    const timestamps = shipments.map((_, i) => baseTimestamp + i);
    setQuoteTexts(allQts);
    setAllShipmentRates(allRates);
    setQuoteTimestamps(timestamps);
    setQuoteText(allQts[activeIdx] || allQts[0] || "");
    setStep("result");

    results.forEach(({ qt, rr, rc }, i) => {
      if (!qt || !rr) return;
      const s = shipments[i];
      saveQuote({
        timestamp: timestamps[i],
        date: new Date().toLocaleDateString("en-CA"),
        time: new Date().toLocaleTimeString("en-CA", {hour:"2-digit",minute:"2-digit"}),
        broker_name: s.broker_name || brokerName || "—", broker_company: s.broker_company || brokerCompany || "",
        broker_email: brokerEmail || "", broker_phone: brokerPhone || "",
        origin: s.origin || "", dest_city: s.dest_city || "", dest_state: s.dest_state || "",
        direction: s.direction || "outbound",
        skids: s.skids, weight_lbs: s.weight_lbs,
        base_rate: rr.base, fsc, total: r5(rr.base*(1+fsc)),
        rate_city: rc?.city, basis_label: rr.basisLabel, charge_skids: SKID_LABELS[rr.chargeIdx],
        zone_tier: rr.zoneTierLabel || null, zone_pct: rr.zonePct || 0, zone_miles: rc?.zoneMiles ?? null, zone_source: rc?.zoneSource || null,
        quote_text: qt,
      });
    });
  };

  const sendQuoteEmail = async (idx) => {
    const s   = (shipments.length > 0 ? shipments : [parsed])[idx];
    const asr = allShipmentRates[idx] || {};
    const qt  = quoteTexts[idx] || "";
    const timestamp = quoteTimestamps[idx];
    if (!s || !timestamp || !qt) return;

    setEmailSendState(prev => ({ ...prev, [idx]: "sending" }));
    try {
      const res = await fetch("/api/send-quote-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp,
          date: new Date().toLocaleDateString("en-CA"),
          time: new Date().toLocaleTimeString("en-CA", {hour:"2-digit",minute:"2-digit"}),
          broker_name: s.broker_name || brokerName || "—",
          broker_company: s.broker_company || brokerCompany || "",
          broker_email: brokerEmail || "",
          broker_phone: brokerPhone || "",
          origin: s.origin || "", dest_city: s.dest_city || "", dest_state: s.dest_state || "",
          direction: s.direction || "outbound",
          skids: s.skids, weight_lbs: s.weight_lbs,
          base_rate: asr.base, fsc, total: asr.total,
          rate_city: asr.rateCity?.city, basis_label: asr.rateResult?.basisLabel,
          zone_tier: asr.rateResult?.zoneTierLabel || null, zone_pct: asr.rateResult?.zonePct || 0,
          zone_miles: asr.rateCity?.zoneMiles ?? null, zone_source: asr.rateCity?.zoneSource || null,
          quote_text: qt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "send_failed");
      setEmailSendState(prev => ({ ...prev, [idx]: "sent" }));
    } catch (e) {
      console.error("Could not send quote email:", e);
      setEmailSendState(prev => ({ ...prev, [idx]: "error" }));
    }
  };

  const base        = rateResult?.base;
  const floorloaded   = !!accs["fl"];
  const subtotal      = base ? r5(base*(1+fsc)) : null;
  const afterFloorB   = subtotal ? (floorloaded ? r5(subtotal*1.10) : subtotal) : null;
  const extraPickupsB  = (parsed?.additional_pickups||[]).map(s=>stopCharge(s.lat,s.lon,parsed?.pickup_lat,parsed?.pickup_lon).charge).reduce((a,b)=>a+b,0);
  const extraDeliveriesB = (parsed?.additional_deliveries||[]).map(s=>stopCharge(s.lat,s.lon,parsed?.dest_lat,parsed?.dest_lon).charge).reduce((a,b)=>a+b,0);
  const total         = afterFloorB ? r5(afterFloorB + extraPickupsB + extraDeliveriesB) : null;
  const isNearest = rateCity && parsed?.dest_city && rateCity.city.toLowerCase() !== (parsed.dest_city||"").trim().toLowerCase();

  // ── Capacity alerts ───────────────────────────────────────────
  useEffect(() => {
    const TRUCK_FT = 53;
    const boardLoads = history.filter(q => q.outcome === "received" || q.outcome === "broker_sending" || q.outcome === "accepted");
    const alerts = [];
    // Unassigned loads alert
    if (boardLoads.length > 0 && truckDays.length === 0 && recurringTrucks.length === 0) {
      alerts.push({ id:"no_trucks", type:"warn", text:`${boardLoads.length} loads on board but no trucks scheduled` });
    }
    setAgentAlerts(alerts);
  }, [history, truckDays, recurringTrucks]);

  // ── Agent chat ────────────────────────────────────────────────
  const callAgent = useCallback(async (userMessage) => {
    const DAYS_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const boardLoads = history.filter(q => q.outcome === "received" || q.outcome === "broker_sending" || q.outcome === "accepted");
    const confirmed  = boardLoads.filter(q => q.outcome === "received" || q.outcome === "accepted");
    const incoming   = boardLoads.filter(q => q.outcome === "broker_sending");
    const systemPrompt = `You are a freight dispatch AI assistant for BDR International, a Canadian LTL freight carrier (Aylmer, ON, est. 1989). Help the dispatcher manage their board efficiently.

CURRENT BOARD STATE (${new Date().toLocaleString()}):
Confirmed loads (${confirmed.length}):
${confirmed.map(q=>`• ${q.dest_city||"?"}, ${q.dest_state||"?"} | ${q.skids} skids | ${q.broker_name||"?"} | $${q.total||"?"} | pickup: ${q.pickup_date||q.date||"?"}`).join("\n")||"  None"}

Incoming loads (${incoming.length}):
${incoming.map(q=>`• ${q.dest_city||"?"}, ${q.dest_state||"?"} | ${q.skids} skids | ${q.broker_name||"?"} | $${q.total||"?"}`).join("\n")||"  None"}

Scheduled trucks (${truckDays.length}):
${truckDays.map(td=>`• ${td.date} | ${td.route} | ${td.numTrucks} truck(s)${td.driver?" | "+td.driver:""}`).join("\n")||"  None"}

Recurring weekly trucks (${recurringTrucks.length}):
${recurringTrucks.map(rt=>`• Every ${DAYS_NAMES[rt.dayOfWeek]} | ${rt.route} | ${rt.numTrucks} truck(s)${rt.driver?" | "+rt.driver:""}`).join("\n")||"  None"}

Drivers (${drivers.length}):
${drivers.map(dr=>`• ${dr.name}${dr.truckNumber?" (Truck #"+dr.truckNumber+")":""}${dr.defaultDay!=null?" | Departs "+DAYS_NAMES[dr.defaultDay]:""}${(dr.lanes||[]).length?" | Lanes: "+dr.lanes.join(", "):""}${dr.partTime?" | Part-time":""}${dr.worksDock?" | Works dock":""}`).join("\n")||"  None"}

Be concise and actionable. When asked for recommendations, be specific about which driver/truck fits which load and why. You can add recurring weekly trucks to the schedule — if the user says something like "add a truck every Tuesday to Detroit" use the add_weekly_truck tool immediately without asking for confirmation.`;

    const newMessages = [...agentMessages, { role:"user", content: userMessage }];
    setAgentMessages(newMessages);
    setAgentLoading(true);

    const TOOLS = [
      {
        name: "add_weekly_truck",
        description: "Add a recurring weekly truck to the capacity schedule. Use when the user asks to add a truck that runs every week on a specific day.",
        input_schema: {
          type: "object",
          properties: {
            dayOfWeek: { type:"number", description:"Day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday" },
            route:     { type:"string", description:"The route or lane, e.g. 'Ontario → Indianapolis, IN' or 'ON → Detroit, MI'" },
            numTrucks: { type:"number", description:"Number of trucks (default 1)" },
            driver:    { type:"string", description:"Driver name (optional, leave blank if not specified)" },
          },
          required: ["dayOfWeek", "route"]
        }
      }
    ];

    const apiCall = async (msgs) => {
      const res = await claudeFetch({ model:"claude-sonnet-4-6", max_tokens:1024, system:systemPrompt, tools:TOOLS, messages:msgs });
      return res.json();
    };

    try {
      let msgs = newMessages;
      let data = await apiCall(msgs);
      msgs = [...msgs, { role:"assistant", content: data.content }];

      // Handle tool use
      const toolUses = (data.content||[]).filter(b=>b.type==="tool_use");
      if (toolUses.length > 0) {
        const toolResults = await Promise.all(toolUses.map(async tu => {
          if (tu.name === "add_weekly_truck") {
            const { dayOfWeek, route, numTrucks = 1, driver = "" } = tu.input;
            const rt = {
              id: `recur_agent_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
              dayOfWeek: parseInt(dayOfWeek),
              route: route || "",
              numTrucks: parseInt(numTrucks) || 1,
              driver: driver || "",
            };
            await saveRecurringTruck(rt);
            return { type:"tool_result", tool_use_id:tu.id, content:`Weekly truck added: every ${DAYS_NAMES[rt.dayOfWeek]}, route "${rt.route}", ${rt.numTrucks} truck(s)${rt.driver ? `, driver: ${rt.driver}` : ""}.` };
          }
          return { type:"tool_result", tool_use_id:tu.id, content:"Unknown tool." };
        }));
        msgs = [...msgs, { role:"user", content: toolResults }];
        data = await apiCall(msgs);
        msgs = [...msgs, { role:"assistant", content: data.content }];
      }
      setAgentMessages(msgs);
    } catch(e) {
      setAgentMessages(prev => [...prev, { role:"assistant", content:[{type:"text",text:`Sorry, I hit an error: ${e.message}`}] }]);
    } finally {
      setAgentLoading(false);
    }
  }, [agentMessages, history, truckDays, recurringTrucks, drivers, saveRecurringTruck]);

  const Step = ({ n, label, active, done }) => (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{
        width:28, height:28, borderRadius:"50%",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:13, fontWeight:700,
        background: active ? C.amber : done ? C.green : C.border,
        color: active||done ? "#fff" : "#999",
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize:14, fontWeight:active?700:500, color:active?C.amber:done?C.green:"#999" }}>{label}</span>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color:C.text, WebkitFontSmoothing:"antialiased" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        *{box-sizing:border-box}
        body{margin:0;background:${C.bg}}
        textarea:focus,input:focus{border-color:${C.amber}!important;box-shadow:0 0 0 3px rgba(100,24,51,0.14)!important;outline:none}
        button{transition:all 0.15s}
        button:hover{opacity:0.9}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:#c9bfae;border-radius:3px}
        .nav-link-btn:hover{color:${C.amber}!important}
      `}</style>

      {/* ── TOP HEADER — white, full width, like bdrint.ca ── */}
      <header style={{ background:"#fff", borderBottom:`3px solid ${C.navy}`, boxShadow:"0 2px 8px rgba(0,0,0,0.06)", position:"sticky", top:0, zIndex:100 }}>
        {/* Top utility bar */}
        <div style={{ background:C.amber, padding:"5px 32px" }}>
          <div style={{ maxWidth:1400, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.85)", letterSpacing:"0.05em" }}>Transportation Specialists · Aylmer, ON · Est. 1989</span>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.85)" }}>2026 Rate Sheet &nbsp;·&nbsp; ON &amp; QC → US</span>
              <button onClick={async () => {
                const { keys } = await window.storage.list("bdr_");
                const data = {};
                for (const k of keys) { const r = await window.storage.get(k); if (r) data[k] = r.value; }
                const blob = new Blob([JSON.stringify(data)], { type:"application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = `bdr-backup-${new Date().toISOString().slice(0,10)}.json`;
                a.click(); URL.revokeObjectURL(url);
              }} style={{ fontSize:11, padding:"2px 8px", background:"rgba(255,255,255,0.2)", color:"#fff", border:"1px solid rgba(255,255,255,0.4)", borderRadius:4, cursor:"pointer" }}>
                ⬇ Export
              </button>
              <label style={{ fontSize:11, padding:"2px 8px", background:"rgba(255,255,255,0.2)", color:"#fff", border:"1px solid rgba(255,255,255,0.4)", borderRadius:4, cursor:"pointer" }}>
                ⬆ Import
                <input type="file" accept=".json" style={{ display:"none" }} onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const text = await file.text();
                  const data = JSON.parse(text);
                  for (const [k, v] of Object.entries(data)) await window.storage.set(k, v);
                  window.location.reload();
                }}/>
              </label>
            </div>
          </div>
        </div>
        {/* Main nav bar */}
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:72 }}>
          {/* Logo */}
          <img src="https://bdrint.ca/wp-content/themes/bdr-international/images/logos/bdr-international-logo.png" alt="BDR International Ltd." style={{ height:56, objectFit:"contain" }}/>
          {/* Nav links */}
          <nav style={{ display:"flex", alignItems:"center", gap:4 }}>
            {[["quote","Quote"],["history","History"]].map(([t,l]) => (
              <button key={t} onClick={()=>setTab(t)} className="nav-link-btn" style={{
                padding:"8px 20px", background:"none", border:"none",
                borderBottom: tab===t ? `3px solid ${C.amber}` : "3px solid transparent",
                color: tab===t ? C.amber : C.navy,
                fontSize:15, fontWeight: tab===t ? 700 : 500,
                cursor:"pointer", letterSpacing:"0.01em",
                transition:"all 0.15s", marginBottom:-1,
              }}>{l}</button>
            ))}
            <div style={{ width:1, height:24, background:C.border, margin:"0 8px" }}/>
            <div style={{ fontSize:13, color:C.muted, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ color:C.amber, fontWeight:700 }}>●</span> Freight Quote Tool
            </div>
          </nav>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div style={{ background:C.bg }}>

      {tab === "history" ? (
        /* ══ HISTORY / PIPELINE TAB ══ */
        <div style={{ padding:"28px 32px" }}>
          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:C.navy }}>
                {historyView === "pipeline" ? "Delivery Pipeline" : historyView === "customers" ? "Customers" : "Quote History"}
              </div>
              <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>
                {historyView === "pipeline"
                  ? `${history.filter(q=>q.outcome==="received").length} received · ${history.filter(q=>q.outcome==="pending").length} pending`
                  : historyView === "customers"
                  ? `${brokers.length} customer${brokers.length!==1?"s":""} tracked`
                  : `${history.length} of 500 quotes saved`}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {(historyView === "quotes" || historyView === "customers") && (
                <input value={histSearch} onChange={e=>setHistSearch(e.target.value)} placeholder={historyView==="customers" ? "Search customer, email…" : "Search broker, city, state…"}
                  style={{ ...input, width:220, fontSize:14 }}/>
              )}
              <div style={{ display:"flex", border:`1.5px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                {[["quotes","📋 Quotes"],["pipeline","📦 Pipeline"],["customers","👥 Customers"]].map(([v,l]) => (
                  <button key={v} onClick={()=>setHistoryView(v)}
                    style={{ padding:"8px 18px", fontSize:13, fontWeight:historyView===v?700:400, background:historyView===v?C.navy:"#fff", color:historyView===v?"#fff":C.muted, border:"none", cursor:"pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!historyLoaded && <div style={{ color:C.muted, fontSize:14 }}>Loading…</div>}

          {/* ── PIPELINE VIEW ── */}
          {historyView === "pipeline" && historyLoaded && (() => {
            const received = history.filter(q => q.outcome === "received" || q.outcome === "accepted").sort((a,b) => (a.pickup_date||"").localeCompare(b.pickup_date||"") || a.timestamp - b.timestamp);
            const counters = history.filter(q => q.outcome === "counter").sort((a,b) => b.counter_at - a.counter_at);
            const pending  = history.filter(q => q.outcome === "pending" || q.outcome === "waiting" || q.outcome === "broker_sending").sort((a,b) => b.timestamp - a.timestamp).slice(0, 20);
            const declined = history.filter(q => q.outcome === "declined");
            const totalSkids = received.reduce((s,q) => s + (parseInt(q.skids)||0), 0);
            const totalRev   = received.reduce((s,q) => s + (q.total||0), 0);
            return (
              <>
                {/* Summary bar */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                  {[
                    ["Received Orders", received.length, C.green],
                    ["Waiting / Broker Sending", `${history.filter(q=>q.outcome==="waiting").length} / ${history.filter(q=>q.outcome==="broker_sending").length}`, "#7c3aed"],
                    ["Revenue", `$${r5(totalRev).toLocaleString()}`, C.amber],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ ...card, textAlign:"center", padding:"16px 20px", marginBottom:0 }}>
                      <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:28, fontWeight:800, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* ── Counter-offer alerts ── */}
                {counters.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#b45309", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em", display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ background:"#b45309", color:"#fff", borderRadius:99, width:20, height:20, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800 }}>{counters.length}</span>
                      Counter Offers Pending
                    </div>
                    {counters.map(q => (
                      <div key={q.timestamp} style={{ ...card, padding:0, overflow:"hidden", marginBottom:10, border:"2px solid #f59e0b", boxShadow:"0 0 0 3px #fef3c7" }}>
                        <div style={{ background:"linear-gradient(90deg,#fffbeb,#fef9ee)", borderBottom:"1px solid #fde68a", padding:"12px 18px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                          <span style={{ fontSize:20 }}>🔄</span>
                          <div style={{ flex:1, minWidth:200 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:"#92400e" }}>{q.broker_name}{q.broker_company ? ` · ${q.broker_company}` : ""}</div>
                            <div style={{ fontSize:12, color:"#78350f" }}>{q.origin} → {q.dest_city}, {q.dest_state} · {q.skids} skids</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:11, color:"#a16207", textTransform:"uppercase", letterSpacing:"0.05em" }}>Our Quote</div>
                            <div style={{ fontSize:16, fontWeight:700, color:"#b45309", textDecoration:"line-through" }}>${r5(q.total)}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:11, color:"#a16207", textTransform:"uppercase", letterSpacing:"0.05em" }}>Their Counter</div>
                            <div style={{ fontSize:20, fontWeight:800, color:"#d97706" }}>{q.counter_offer ? `$${q.counter_offer}` : "—"}</div>
                          </div>
                        </div>
                        {q.counter_reply_text && (
                          <div style={{ padding:"10px 18px", fontSize:12, color:C.muted, fontStyle:"italic", borderBottom:"1px solid #fde68a", background:"#fffdf5" }}>
                            "{q.counter_reply_text.slice(0, 200)}{q.counter_reply_text.length > 200 ? "…" : ""}"
                          </div>
                        )}
                        <div style={{ padding:"12px 18px", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", background:"#fff" }}>
                          <button onClick={()=>respondToCounter(q,"accept")}
                            style={{ padding:"8px 18px", fontSize:13, fontWeight:700, borderRadius:6, cursor:"pointer", background:C.green, color:"#fff", border:"none" }}>
                            ✓ Accept ${q.counter_offer}
                          </button>
                          <button onClick={()=>respondToCounter(q,"decline")}
                            style={{ padding:"8px 18px", fontSize:13, fontWeight:700, borderRadius:6, cursor:"pointer", background:"#fff", color:C.error, border:`1.5px solid #fca5a5` }}>
                            ✗ Decline
                          </button>
                          <div style={{ display:"flex", gap:6, alignItems:"center", marginLeft:"auto" }}>
                            <span style={{ fontSize:12, color:C.muted }}>Counter with:</span>
                            <span style={{ fontSize:13, color:C.muted }}>$</span>
                            <input
                              type="number"
                              placeholder="amount"
                              value={counterInputs[q.timestamp] || ""}
                              onChange={e => setCounterInputs(prev => ({ ...prev, [q.timestamp]: e.target.value }))}
                              style={{ ...input, width:90, fontSize:13, padding:"6px 8px" }}
                            />
                            <button
                              disabled={!counterInputs[q.timestamp]}
                              onClick={() => {
                                respondToCounter(q, "counter", parseFloat(counterInputs[q.timestamp]));
                                setCounterInputs(prev => { const n={...prev}; delete n[q.timestamp]; return n; });
                              }}
                              style={{ padding:"7px 14px", fontSize:13, fontWeight:700, borderRadius:6, cursor:"pointer", background:"#f59e0b", color:"#fff", border:"none", opacity:counterInputs[q.timestamp]?1:0.4 }}>
                              Send Counter
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Received orders */}
                {received.length === 0 ? (
                  <div style={{ ...card, textAlign:"center", padding:40, color:C.muted }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>📦</div>
                    <div style={{ fontWeight:600, color:C.navy }}>No received orders yet</div>
                    <div style={{ fontSize:13, marginTop:4 }}>Mark quotes as "Received" in the Quotes view to track them here.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Confirmed Orders</div>
                    {received.map(q => (
                      <div key={q.timestamp} style={{ ...card, padding:0, overflow:"hidden", marginBottom:8, border:`1.5px solid #bbf7d0` }}>
                        <div style={{ display:"flex", alignItems:"stretch" }}>
                          <div style={{ width:5, background:C.green, flexShrink:0 }}/>
                          <div style={{ flex:1, padding:"12px 18px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                            <div style={{ minWidth:110 }}>
                              <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Pickup Date</div>
                              <div style={{ fontSize:14, fontWeight:700, color:C.navy }}>{q.pickup_date || q.date}</div>
                            </div>
                            <div style={{ minWidth:140 }}>
                              <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Broker</div>
                              <div style={{ fontSize:13, fontWeight:600 }}>{q.broker_name}</div>
                              {q.broker_company && <div style={{ fontSize:11, color:C.muted }}>{q.broker_company}</div>}
                            </div>
                            <div style={{ minWidth:180 }}>
                              <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Lane</div>
                              <div style={{ fontSize:13, fontWeight:600 }}>{q.origin} → {q.dest_city}, {q.dest_state}</div>
                            </div>
                            <div style={{ minWidth:60 }}>
                              <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Skids</div>
                              <div style={{ fontSize:16, fontWeight:800, color:C.navy }}>{q.skids}</div>
                            </div>
                            <div style={{ minWidth:80 }}>
                              <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Total</div>
                              <div style={{ fontSize:16, fontWeight:800, color:C.green }}>${r5(q.total)}</div>
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", padding:"0 16px", borderLeft:`1px solid ${C.border}` }}>
                            <button onClick={()=>updateQuoteOutcome(q.timestamp,"pending")}
                              style={{ padding:"6px 14px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#efe8dc", color:C.muted, border:`1px solid ${C.border}` }}>
                              Undo
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Pending quotes (recent 20) */}
                {pending.length > 0 && (
                  <div style={{ marginTop:24 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Awaiting Response</div>
                    {pending.map(q => (
                      <div key={q.timestamp} style={{ ...card, padding:0, overflow:"hidden", marginBottom:8 }}>
                        <div style={{ display:"flex", alignItems:"stretch" }}>
                          <div style={{ width:5, background:q.outcome==="waiting" ? "#fed7aa" : q.outcome==="broker_sending" ? "#ddd6fe" : "#e7dfd2", flexShrink:0 }}/>
                          <div style={{ flex:1, padding:"10px 18px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                            <div style={{ minWidth:80, fontSize:12, color:C.muted }}>{q.date}</div>
                            <div style={{ minWidth:140, fontSize:13, fontWeight:600 }}>{q.broker_name} {q.broker_company ? <span style={{ fontWeight:400, color:C.muted }}>· {q.broker_company}</span> : ""}</div>
                            <div style={{ minWidth:180, fontSize:13 }}>{q.origin} → {q.dest_city}, {q.dest_state}</div>
                            <div style={{ minWidth:50, fontSize:13, color:C.muted }}>{q.skids} skids</div>
                            <div style={{ minWidth:70, fontSize:15, fontWeight:700, color:C.amber }}>${r5(q.total)}</div>
                            {q.outcome === "broker_sending" && (
                              <span style={{ fontSize:11, fontWeight:700, color:"#7c3aed", background:"#f5f3ff", padding:"2px 8px", borderRadius:10, border:`1px solid #ddd6fe` }}>📬 Broker Sending</span>
                            )}
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems:"center", padding:"0 14px", borderLeft:`1px solid ${C.border}` }}>
                            <button onClick={()=>updateQuoteOutcome(q.timestamp,"received")}
                              style={{ padding:"6px 12px", fontSize:12, fontWeight:700, borderRadius:6, cursor:"pointer", background:C.green, color:"#fff", border:"none" }}>
                              ✓ Received
                            </button>
                            {q.outcome !== "waiting" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"waiting")}
                                style={{ padding:"6px 12px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#fff7ed", color:"#c2410c", border:`1px solid #fed7aa` }}>
                                ⏳ Waiting
                              </button>
                            )}
                            {q.outcome !== "broker_sending" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"broker_sending")}
                                style={{ padding:"6px 12px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f5f3ff", color:"#7c3aed", border:`1px solid #ddd6fe` }}>
                                📬 Broker Sending
                              </button>
                            )}
                            <button onClick={()=>updateQuoteOutcome(q.timestamp,"lost")}
                              style={{ padding:"6px 12px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#fff", color:C.error, border:`1px solid #fca5a5` }}>
                              ✗ Lost
                            </button>
                            <button onClick={()=>updateQuoteOutcome(q.timestamp,"declined")}
                              style={{ padding:"6px 12px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f7f4ee", color:"#6b7280", border:`1px solid #d9d0c2` }}>
                              ✗ Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Sent Loads ── */}
                {(() => {
                  const sentLoads = history.filter(q => q.outcome === "sent_load").sort((a,b) => (a.pickup_date||"").localeCompare(b.pickup_date||"") || b.timestamp - a.timestamp);
                  return (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0369a1", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>🚛 Sent Loads</div>
                    {sentLoads.length === 0 ? (
                      <div style={{ ...card, textAlign:"center", padding:"24px", color:C.muted, fontSize:13 }}>
                        No sent loads yet. Carrier confirmation emails with PDF attachments will appear here automatically.
                      </div>
                    ) : (
                      sentLoads.map(q => (
                        <div key={q.timestamp} style={{ ...card, padding:0, overflow:"hidden", marginBottom:8, border:"1.5px solid #bae6fd" }}>
                          <div style={{ display:"flex", alignItems:"stretch" }}>
                            <div style={{ width:5, background:"#0ea5e9", flexShrink:0 }}/>
                            <div style={{ flex:1, padding:"12px 18px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                              <div style={{ minWidth:110 }}>
                                <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Pickup Date</div>
                                <div style={{ fontSize:14, fontWeight:700, color:C.navy }}>{q.pickup_date || q.date}</div>
                              </div>
                              {q.delivery_date && (
                                <div style={{ minWidth:110 }}>
                                  <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Delivery Date</div>
                                  <div style={{ fontSize:13, fontWeight:600 }}>{q.delivery_date}</div>
                                </div>
                              )}
                              <div style={{ minWidth:140 }}>
                                <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Broker</div>
                                <div style={{ fontSize:13, fontWeight:600 }}>{q.broker_name}</div>
                                {q.broker_company && <div style={{ fontSize:11, color:C.muted }}>{q.broker_company}</div>}
                              </div>
                              <div style={{ minWidth:180 }}>
                                <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Lane</div>
                                <div style={{ fontSize:13, fontWeight:600 }}>{q.origin} → {q.dest_city}, {q.dest_state}</div>
                                {q.delivery_address && <div style={{ fontSize:11, color:C.muted }}>{q.delivery_address}</div>}
                              </div>
                              {q.consignee && (
                                <div style={{ minWidth:140 }}>
                                  <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Consignee</div>
                                  <div style={{ fontSize:13 }}>{q.consignee}</div>
                                </div>
                              )}
                              <div style={{ minWidth:80 }}>
                                <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Skids</div>
                                <div style={{ fontSize:13 }}>{q.skids}{q.footage ? ` · ${q.footage}ft` : ""}</div>
                              </div>
                              {q.reference_number && (
                                <div style={{ minWidth:100 }}>
                                  <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Ref #</div>
                                  <div style={{ fontSize:13, fontWeight:600 }}>{q.reference_number}</div>
                                </div>
                              )}
                              {q.total && (
                                <div style={{ minWidth:80 }}>
                                  <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase" }}>Rate</div>
                                  <div style={{ fontSize:15, fontWeight:700, color:"#0369a1" }}>${r5(q.total)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  );
                })()}
              </>
            );
          })()}

          {/* ── CUSTOMERS VIEW — internal only, brokers never see this ── */}
          {historyView === "customers" && (
            <>
              {!brokersLoaded && <div style={{ color:C.muted, fontSize:14 }}>Loading…</div>}
              {brokersLoaded && brokers.length === 0 && (
                <div style={{ ...card, textAlign:"center", padding:48, color:C.muted }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>👥</div>
                  <div style={{ fontSize:16, fontWeight:600, color:C.navy }}>No customers tracked yet</div>
                  <div style={{ fontSize:14, marginTop:4 }}>Customers who request a quote will show up here automatically.</div>
                </div>
              )}
              {brokers
                .filter(b => {
                  if (!histSearch) return true;
                  const s = histSearch.toLowerCase();
                  return [b.company_name, b.primary_contact_name, b.primary_email].some(f => (f||"").toLowerCase().includes(s));
                })
                .map(b => {
                  const isOpen = expandedBroker === b.id;
                  const brokerQuotes = history.filter(q => (q.broker_email||"").toLowerCase() === (b.primary_email||"").toLowerCase()
                    || (q.broker_company||"").toLowerCase().includes((b.company_name||"").toLowerCase()));
                  return (
                    <div key={b.id} style={{ ...card, marginBottom:10, padding:0, overflow:"hidden" }}>
                      <div style={{ display:"flex", alignItems:"stretch" }}>
                        <div style={{ width:4, background:C.amber, flexShrink:0 }}/>
                        <div style={{ flex:1, padding:"14px 18px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                          <div style={{ minWidth:160 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Customer</div>
                            <div style={{ fontSize:14, fontWeight:700, color:C.navy }}>{b.company_name}</div>
                            {b.primary_contact_name && <div style={{ fontSize:12, color:C.muted }}>{b.primary_contact_name}</div>}
                          </div>
                          <div style={{ minWidth:160 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Email / Phone</div>
                            <div style={{ fontSize:13, color:C.text }}>{b.primary_email || "—"}</div>
                            {b.phone && <div style={{ fontSize:12, color:C.muted }}>{b.phone}</div>}
                          </div>
                          <div style={{ minWidth:80 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Quotes</div>
                            <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{b.quote_count}</div>
                          </div>
                          <div style={{ minWidth:80 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Won</div>
                            <div style={{ fontSize:14, fontWeight:600, color:C.green }}>{b.won_count}</div>
                          </div>
                          <div style={{ minWidth:100 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Lifetime Revenue</div>
                            <div style={{ fontSize:18, fontWeight:800, color:C.amber }}>${r5(Number(b.lifetime_revenue)||0)}</div>
                          </div>
                          <div style={{ minWidth:100 }}>
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Last Quote</div>
                            <div style={{ fontSize:13, color:C.text }}>{b.last_quote_at ? new Date(b.last_quote_at).toLocaleDateString("en-CA") : "—"}</div>
                          </div>
                          <button onClick={()=>setExpandedBroker(isOpen ? null : b.id)}
                            style={{ marginLeft:"auto", padding:"6px 14px", fontSize:12, fontWeight:600, borderRadius:6, cursor:"pointer", background:"#efe8dc", color:C.navy, border:`1px solid ${C.border}` }}>
                            {isOpen ? "▲ Hide" : `▼ View ${brokerQuotes.length} quote${brokerQuotes.length!==1?"s":""}`}
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding:"0 18px 14px 22px", borderTop:`1px solid ${C.border}` }}>
                          {brokerQuotes.length === 0 && <div style={{ fontSize:13, color:C.muted, paddingTop:12 }}>No local quotes matched — this customer may have quoted from another device.</div>}
                          {brokerQuotes.map(q => (
                            <div key={q.timestamp} style={{ display:"flex", alignItems:"center", gap:16, padding:"10px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                              <div style={{ color:C.muted, minWidth:80 }}>{q.date}</div>
                              <div style={{ flex:1 }}>{q.origin} → {q.dest_city}, {q.dest_state} · {q.skids} skids</div>
                              <div style={{ fontWeight:700, color:C.navy }}>${r5(q.total)}</div>
                              <div style={{ color:C.muted, textTransform:"capitalize" }}>{q.outcome}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}

          {/* ── QUOTES VIEW ── */}
          {historyView === "quotes" && (
            <>
              {historyLoaded && history.length === 0 && (
                <div style={{ ...card, textAlign:"center", padding:48, color:C.muted }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
                  <div style={{ fontSize:16, fontWeight:600, color:C.navy }}>No quotes yet</div>
                  <div style={{ fontSize:14, marginTop:4 }}>Quotes you generate will appear here automatically.</div>
                </div>
              )}
              {history
                .filter(q => {
                  if (!histSearch) return true;
                  const s = histSearch.toLowerCase();
                  return [q.broker_name, q.broker_company, q.dest_city, q.dest_state, q.origin].some(f => (f||"").toLowerCase().includes(s));
                })
                .map(q => {
                  const outcomeColor = q.outcome==="accepted" ? "#0369a1" : q.outcome==="received" ? C.green : q.outcome==="lost" ? C.error : q.outcome==="waiting" ? "#c2410c" : q.outcome==="broker_sending" ? "#7c3aed" : q.outcome==="declined" ? "#6b7280" : C.amber;
                  const outcomeBg    = q.outcome==="accepted" ? "#eff6ff" : q.outcome==="received" ? "#f0fdf4" : q.outcome==="lost" ? "#fef2f2" : q.outcome==="waiting" ? "#fff7ed" : q.outcome==="broker_sending" ? "#f5f3ff" : q.outcome==="declined" ? "#f7f4ee" : C.card;
                  return (
                    <div key={q.timestamp} style={{ ...card, marginBottom:10, padding:0, overflow:"hidden", background:outcomeBg }}>
                      <div style={{ display:"flex", alignItems:"stretch" }}>
                        <div style={{ width:4, background:outcomeColor, flexShrink:0 }}/>
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
                            <div style={{ fontSize:11, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em" }}>Total</div>
                            <div style={{ fontSize:18, fontWeight:800, color:outcomeColor }}>${r5(q.total)}</div>
                          </div>
                          {/* Outcome buttons inline */}
                          <div style={{ display:"flex", gap:5, marginLeft:"auto" }}>
                            {q.outcome !== "received" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"received")}
                                style={{ padding:"5px 11px", fontSize:12, fontWeight:700, borderRadius:6, cursor:"pointer", background:C.green, color:"#fff", border:"none" }}>
                                ✓ Received
                              </button>
                            )}
                            {q.outcome !== "waiting" && q.outcome !== "received" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"waiting")}
                                style={{ padding:"5px 11px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#fff7ed", color:"#c2410c", border:`1px solid #fed7aa` }}>
                                ⏳ Waiting
                              </button>
                            )}
                            {q.outcome !== "broker_sending" && q.outcome !== "received" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"broker_sending")}
                                style={{ padding:"5px 11px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f5f3ff", color:"#7c3aed", border:`1px solid #ddd6fe` }}>
                                📬 Broker Sending
                              </button>
                            )}
                            {q.outcome !== "lost" && q.outcome !== "received" && q.outcome !== "declined" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"lost")}
                                style={{ padding:"5px 11px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#fff", color:C.error, border:`1px solid #fca5a5` }}>
                                ✗ Lost
                              </button>
                            )}
                            {q.outcome !== "declined" && q.outcome !== "received" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"declined")}
                                style={{ padding:"5px 11px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f7f4ee", color:"#6b7280", border:`1px solid #d9d0c2` }}>
                                ✗ Decline
                              </button>
                            )}
                            {q.outcome !== "waiting" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"waiting")}
                                style={{ padding:"5px 11px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#efe8dc", color:C.muted, border:`1px solid ${C.border}` }}>
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
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
                      {viewingQuote?.timestamp === q.timestamp && (
                        <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px 22px", background:"#fafafa" }}>
                          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
                            <button onClick={()=>{ const ta=document.createElement("textarea"); ta.value=q.quote_text; ta.style.position="fixed"; ta.style.top="0"; ta.style.left="0"; ta.style.width="2em"; ta.style.height="2em"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); try{document.execCommand("copy");}catch(e){} document.body.removeChild(ta); }}
                              style={{ padding:"6px 16px", background:C.amber, color:"#fff", border:"none", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                              Copy Quote
                            </button>
                          </div>
                          {q.zone_pct > 0 && (
                            <div style={{ fontSize:12, color:C.amber, fontWeight:700, marginBottom:8 }}>
                              Zone: {q.zone_tier} ({q.zone_miles} mi from {q.rate_city})
                            </div>
                          )}
                          <pre style={{ fontFamily:"'Courier New',monospace", fontSize:13, color:C.text, lineHeight:1.7, margin:0, whiteSpace:"pre-wrap" }}>{q.quote_text}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </>
          )}
        </div>

      ) : (
      <>
      {/* ── Step bar ── */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"14px 32px", display:"flex", gap:28, alignItems:"center" }}>
          <Step n="1" label="Paste Email"    active={step==="input"}  done={step!=="input"} />
          <div style={{ flex:1, height:1, background:C.border }}/>
          <Step n="2" label="Review & Rate"  active={step==="review"} done={step==="result"} />
          <div style={{ flex:1, height:1, background:C.border }}/>
          <Step n="3" label="Copy Quote"     active={step==="result"} done={false} />
        </div>
      </div>

      <div style={{ maxWidth:1400, margin:"0 auto", padding:"28px 32px" }}>

        {/* ══ STEP 1 ══ */}
        {step === "input" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:24, alignItems:"start" }}>
            <div>
              {/* Broker details */}
              <div style={card}>
                <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:16 }}>Broker Details</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:16 }}>
                  {[["Company",brokerCompany,setBrokerCompany],["Contact Name",brokerName,setBrokerName],["Phone",brokerPhone,setBrokerPhone]].map(([l,v,s]) => (
                    <div key={l}>
                      <label style={label}>{l}</label>
                      <input value={v} onChange={e=>s(e.target.value)} placeholder={l} style={input}/>
                    </div>
                  ))}
                  <div>
                    <label style={label}>Email *</label>
                    <input value={brokerEmail} onChange={e=>setBrokerEmail(e.target.value)} placeholder="Email *" type="email"
                      style={{ ...input, border:`1px solid ${!brokerEmail.trim() ? "#e3c9d1" : C.border}` }}/>
                  </div>
                </div>
              </div>

              {/* Email paste */}
              <div style={card}>
                <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:6 }}>Broker Quote Request</div>
                <div style={{ fontSize:14, color:C.muted, marginBottom:14 }}>Paste the broker email below, or upload a PDF document directly.</div>

                {/* PDF upload zone */}
                <label style={{ display:"block", marginBottom:14, cursor:"pointer" }}>
                  <input type="file" accept="application/pdf" style={{ display:"none" }}
                    onChange={e => { if (e.target.files[0]) handlePDFUpload(e.target.files[0]); e.target.value=""; }}
                  />
                  <div style={{ border:`2px dashed ${pdfLoading?C.amber:"#e3c9d1"}`, borderRadius:10, padding:"18px 20px", background:pdfLoading?C.amberLight:"#f7f4ee",
                    display:"flex", alignItems:"center", gap:14, transition:"all 0.2s" }}>
                    <div style={{ fontSize:28, lineHeight:1 }}>{pdfLoading ? "⏳" : "📄"}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:pdfLoading?C.amber:C.navy }}>
                        {pdfLoading ? "Reading PDF…" : "Upload PDF (rate confirmation, load tender, BOL)"}
                      </div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                        {pdfLoading ? "Claude is extracting shipment details" : "Click to browse or drop a file — Claude reads it automatically"}
                      </div>
                    </div>
                    {!pdfLoading && <div style={{ marginLeft:"auto", padding:"6px 16px", background:C.amber, color:"#fff", borderRadius:7, fontSize:12, fontWeight:700 }}>Browse</div>}
                  </div>
                </label>

                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <div style={{ flex:1, height:1, background:C.border }}/>
                  <span style={{ fontSize:12, color:C.subtle, fontWeight:600 }}>OR PASTE EMAIL</span>
                  <div style={{ flex:1, height:1, background:C.border }}/>
                </div>

                <textarea value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder={"Example:\n\nHi, looking for a rate from Ontario to Dayton, OH.\n5 skids, approximately 8,500 lbs.\nPickup June 23rd. Commodity: auto parts.\n\nPlease advise. Thanks"}
                  style={{ ...input, height:160, resize:"vertical", lineHeight:1.6, fontSize:14 }}
                />
                {error && <div style={{ marginTop:10, padding:"10px 14px", background:C.errorLight, border:`1px solid #fca5a5`, borderRadius:8, color:C.error, fontSize:14 }}>⚠ {error}</div>}
                <button onClick={handleParse} disabled={loading||!email.trim()}
                  style={{ marginTop:14, padding:"12px 28px", background:loading||!email.trim()?"#d9d0c2":C.amber, color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:700, cursor:loading||!email.trim()?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:8 }}>
                  {loading ? <><span style={{ display:"inline-block", animation:"spin 0.8s linear infinite" }}>⟳</span> Parsing email…</> : "Parse Email →"}
                </button>
              </div>
            </div>

            <div>
              {/* Coverage */}
              <div style={{ ...card, background:"#fdf2f4", border:`1px solid #e8b4be` }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.amber, marginBottom:10 }}>Rate Sheet Coverage</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                  {[["TX","Houston · Dallas · San Antonio"],["MI","Detroit · Lansing · Grand Rapids"],["OH","Toledo · Cleveland · Cincinnati · Columbus"],["KY","Louisville"],["IL","Chicago"],["IN","Indianapolis"],["MO","St Louis · Kansas City"],["TN","Nashville · Memphis · Knoxville · Chattanooga"]].map(([st,cities]) => (
                    <div key={st} style={{ background:"#fff", borderRadius:8, padding:"10px 12px", border:`1px solid #e8b4be` }}>
                      <div style={{ fontSize:18, fontWeight:800, color:C.amber, marginBottom:2 }}>{st}</div>
                      <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>{cities}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:12, color:C.subtle, marginTop:10 }}>
                  For towns not listed above, the nearest rate-sheet city is used automatically. Destinations further from a city's core zone may carry a distance-based surcharge.
                </div>
              </div>
            </div>
          </div>
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
                    background: activeIdx===i ? C.navy : "#efe8dc",
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

            <div style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:24, alignItems:"start" }}>
              {/* LEFT COLUMN — shipment details + stops */}
              <div>
                {/* Matched customer banner */}
                {matchedCustomer && (
                  <div style={{ ...card, background:C.amberLight, border:`1px solid #e3c9d1`, padding:"12px 18px", display:"flex", alignItems:"center", gap:16, marginBottom:12 }}>
                    <div style={{ fontSize:20 }}>👥</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>{matchedCustomer.company}</div>
                      <div style={{ fontSize:12, color:C.muted }}>{matchedCustomer.contact_name}{matchedCustomer.email ? ` · ${matchedCustomer.email}` : ""}{matchedCustomer.notes ? ` · ${matchedCustomer.notes}` : ""}</div>
                    </div>
                    <div style={{ fontSize:12, color:C.muted }}>FSC pre-set to {(matchedCustomer.default_fsc*100).toFixed(0)}%</div>
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
                    {[["Origin Region","origin"],["Pickup Location","pickup_location"],["Destination City","dest_city"],["State","dest_state"],["Destination ZIP","dest_zip"],["Skids","skids"],["Footage (ft)","footage"],["Weight (lbs)","weight_lbs"],["Pickup Date","pickup_date"],["Delivery Date","delivery_date"],["Customer (Broker)","broker_name"],["Consignee","consignee"],["Commodity","commodity"]].map(([l,k]) => (
                      <div key={k}>
                        <label style={label}>{l}</label>
                        <input value={parsed[k]??""} onChange={e=>handleFieldChange(k,e.target.value,parsed)} style={input}/>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:16}}>
                    <label style={label}>Delivery Address</label>
                    <input value={parsed.delivery_address??""} onChange={e=>handleFieldChange("delivery_address",e.target.value,parsed)} placeholder="Street address of delivery location" style={{...input,width:"100%"}}/>
                  </div>

                  <div style={{marginTop:16}}>
                    <label style={label}>Direction</label>
                    <div style={{ display:"flex", gap:8 }}>
                      {DIRECTION_OPTS.map(o => (
                        <button key={o.v} onClick={()=>handleFieldChange("direction",o.v,parsed)} style={{
                          flex:1, padding:"9px 14px", fontSize:13, fontWeight:(parsed.direction||"outbound")===o.v?700:400,
                          borderRadius:8, cursor:"pointer",
                          background:(parsed.direction||"outbound")===o.v?C.navy:"#efe8dc",
                          color:(parsed.direction||"outbound")===o.v?"#fff":C.text,
                          border:`1.5px solid ${(parsed.direction||"outbound")===o.v?C.navy:C.border}`,
                        }}>{o.l}</button>
                      ))}
                    </div>
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
                            <tr style={{ background:"#efe8dc" }}>
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
                                <tr style={{ background: rateResult?.basisLabel==="dimensions" ? C.amberLight : "#f7f4ee" }}>
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
                        <div style={{ padding:"9px 14px", background: rateResult?.basisLabel==="dimensions" ? C.amberLight : "#f7f4ee", border:`1px solid ${rateResult?.basisLabel==="dimensions" ? C.amber : C.border}`, borderRadius:8, fontSize:13 }}>
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
              </div>

              {/* RIGHT COLUMN — rate summary + FSC + accessorials + generate */}
              <div>
                {/* Rate card */}
                {geocoding ? (
                  <div style={{ ...card, display:"flex", alignItems:"center", gap:12, color:C.muted }}>
                    <span style={{ fontSize:20, display:"inline-block", animation:"spin 0.8s linear infinite" }}>⟳</span>
                    <span style={{ fontSize:15 }}>Looking up coordinates for {parsed.dest_city}…</span>
                  </div>
                ) : base ? (
                  <div style={{ background:C.navy, borderRadius:12, padding:24, marginBottom:16 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom: rateResult?.basisLabel === "weight" ? 16 : 0 }}>
                      <div>
                        <div style={{ fontSize:11, color:"#aaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Rate Point</div>
                        <div style={{ fontSize:16, color:"#fff", fontWeight:700 }}>{rateCity?.city}, {rateCity?.state}</div>
                        {isNearest && <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>Nearest to {parsed.dest_city} ({rateCity?.distance} mi)</div>}
                        {rateResult?.zonePct > 0 && (
                          <div style={{ fontSize:11, color:C.amber, marginTop:2, fontWeight:700 }}>
                            Zone: {rateResult.zoneTierLabel} ({rateCity?.zoneMiles} mi from {rateCity?.city})
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:"#aaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Charged At</div>
                        <div style={{ fontSize:16, color:"#fff", fontWeight:700 }}>
                          {rateResult?.chargeIdx != null ? SKID_LABELS[rateResult.chargeIdx] : parsed.skids} skids
                        </div>
                        <div style={{ fontSize:11, color: rateResult?.basisLabel !== "skids" ? C.amber : "#aaa", marginTop:2, fontWeight: rateResult?.basisLabel !== "skids" ? 700 : 400 }}>
                          Basis: {rateResult?.basisLabel === "weight" ? "⚖ weight" : rateResult?.basisLabel === "dimensions" ? "📐 dimensions" : rateResult?.basisLabel === "footage" ? "📏 footage" : "📦 skids (std 48×40\""}
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
                        {rateResult?.basisLabel === "footage" && rateResult?.footageOnly && <>📏 Footage provided: {parsed.footage} ft → charged at {SKID_LABELS[rateResult.chargeIdx]} skids</>}
                        {rateResult?.basisLabel === "footage" && !rateResult?.footageOnly && <>📏 Customer footage used: {parsed.footage} ft ({parsed.skids} skids stated, no dims) → charged at {SKID_LABELS[rateResult.chargeIdx]} skids</>}
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
                          <tr style={{ background:"#efe8dc" }}>
                            {SKID_LABELS.map((l,i) => {
                              const isCharge = i === rateResult.chargeIdx;
                              const isSkid   = i === rateResult.skidIdx && rateResult.skidIdx !== rateResult.chargeIdx;
                              return <th key={l} style={{ padding:"6px 8px", textAlign:"center", fontWeight:600, whiteSpace:"nowrap", border:`1px solid ${C.border}`,
                                background: isCharge ? C.navy : isSkid ? "#e8e8e8" : "#efe8dc",
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

                {/* FSC */}
                <div style={card}>
                  <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:14 }}>Fuel Surcharge</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {FSC_OPTS.map(o => (
                      <button key={o.v} onClick={()=>setFsc(o.v)} style={{ padding:"9px 18px", fontSize:14, fontWeight:fsc===o.v?700:400, borderRadius:8, cursor:"pointer", background:fsc===o.v?C.navy:"#efe8dc", color:fsc===o.v?"#fff":C.text, border:`1.5px solid ${fsc===o.v?C.navy:C.border}` }}>
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
                      <button key={a.id} onClick={()=>setAccs(p=>({...p,[a.id]:!p[a.id]}))} style={{ padding:"9px 18px", fontSize:14, borderRadius:8, cursor:"pointer", fontWeight:accs[a.id]?600:400, background:accs[a.id]?C.navy:"#efe8dc", color:accs[a.id]?"#fff":C.text, border:`1.5px solid ${accs[a.id]?C.navy:C.border}` }}>
                        {a.l} <span style={{ color:C.subtle, fontWeight:400, fontSize:12 }}>({a.n})</span>
                      </button>
                    ))}
                  </div>
                  <input value={customAcc} onChange={e=>setCustomAcc(e.target.value)} placeholder="Add a custom accessorial charge…" style={input}/>
                </div>

                {/* Generate Quote button */}
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <button onClick={handleQuote} disabled={geocoding||!base||!brokerEmail.trim()} style={{ padding:"14px 28px", fontSize:15, fontWeight:700, borderRadius:8, cursor:"pointer", background:geocoding||!base||!brokerEmail.trim()?"#d9d0c2":C.navy, color:"#fff", border:"none", width:"100%" }}>
                    {geocoding ? "Resolving location…" : "Generate Quote →"}
                  </button>
                  {!brokerEmail.trim() && <div style={{ fontSize:12, color:C.amber, textAlign:"center" }}>Broker email is required before generating a quote.</div>}
                  <button onClick={()=>{setStep("input");setError(null);}} style={{ padding:"11px 22px", fontSize:14, borderRadius:8, cursor:"pointer", background:"#efe8dc", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500, width:"100%" }}>
                    ← Back
                  </button>
                  {error && <div style={{ fontSize:14, color:C.error }}>⚠ {error}</div>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ STEP 3 ══ */}
        {step === "result" && (
          <>
            {/* Top action bar */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:4 }}>
              {shipments.length > 1 && quoteTexts.filter(Boolean).length > 1 && (
                <button onClick={()=>{
                  const all = quoteTexts.filter((qt, i) => qt && !allShipmentRates[i]?.unserviced).join("\n\n" + "─".repeat(40) + "\n\n");
                  const ta = document.createElement("textarea"); ta.value = all;
                  ta.style.position="fixed"; ta.style.top="0"; ta.style.left="0"; ta.style.width="2em"; ta.style.height="2em"; ta.style.opacity="0";
                  document.body.appendChild(ta); ta.focus(); ta.select();
                  try { document.execCommand("copy"); } catch(e) {}
                  document.body.removeChild(ta);
                  setAllCopied(true); setTimeout(()=>setAllCopied(false),2500);
                }} style={{ padding:"13px 24px", fontSize:15, fontWeight:700, borderRadius:8, cursor:"pointer", background:allCopied?C.green:C.amber, color:"#fff", border:"none", transition:"background 0.3s" }}>
                  {allCopied ? "✓ All Copied!" : `Copy All ${quoteTexts.filter((qt,i) => qt && !allShipmentRates[i]?.unserviced).length} Quotes`}
                </button>
              )}
              <button onClick={()=>{setStep("review");setError(null);}} style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:"#efe8dc", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500 }}>
                ← Adjust
              </button>
              <button onClick={()=>{ setStep("input"); setEmail(""); setParsed(null); setShipments([]); setRateCity(null); setRateResult(null); setQuoteText(""); setQuoteTexts([]); setAllShipmentRates([]); setError(null); }}
                style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:"#efe8dc", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500 }}>
                New Quote
              </button>
            </div>

            {/* Stacked quote cards - one per shipment */}
            {(shipments.length > 0 ? shipments : [parsed]).map((s, i) => {
              const asr = allShipmentRates[i] || {};
              const qt = quoteTexts[i] || "";
              const isUnservicedCard = !!asr.unserviced;
              return (
                <div key={i} style={{ ...card, border:`1.5px solid ${isUnservicedCard ? "#fca5a5" : C.border}`, marginBottom:12, background: isUnservicedCard ? "#fff8f8" : C.card }}>
                  {/* Lane header */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${isUnservicedCard ? "#fca5a5" : C.border}` }}>
                    <div>
                      {shipments.length > 1 && (
                        <div style={{ fontSize:12, fontWeight:700, color: isUnservicedCard ? C.error : C.green, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>
                          Shipment {i+1} of {shipments.length}
                        </div>
                      )}
                      <div style={{ fontSize:18, fontWeight:800, color:C.navy }}>
                        {s.pickup_location || s.origin} → {s.dest_city}, {s.dest_state}
                      </div>
                      <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>
                        {s.skids} skids
                        {asr.rateCity ? ` · Rate via ${asr.rateCity.city}, ${asr.rateCity.state}${asr.isNearest ? ` (${asr.rateCity.distance} mi from delivery)` : ""}` : ""}
                        {asr.rateResult?.zonePct > 0 ? ` · Zone: ${asr.rateResult.zoneTierLabel} (${asr.rateCity?.zoneMiles} mi)` : ""}
                      </div>
                    </div>
                    {asr.total && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:32, fontWeight:800, color:C.green }}>${asr.total}</div>
                        <div style={{ fontSize:12, color:C.muted }}>CAD</div>
                      </div>
                    )}
                  </div>

                  {isUnservicedCard ? (
                    <div style={{ padding:"18px 20px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, color:C.error, fontSize:14, fontWeight:500 }}>
                      ✗ We do not service this area — {asr.unserviced}
                    </div>
                  ) : (
                    <>
                      <textarea value={qt} onChange={e=>{ setQuoteTexts(prev=>{ const u=[...prev]; u[i]=e.target.value; if(i===activeIdx) setQuoteText(e.target.value); return u; }); }}
                        style={{ ...input, height:260, resize:"vertical", lineHeight:1.75, fontFamily:"'Courier New', monospace", fontSize:13, background:"#f7f4ee" }}
                      />
                      <button onClick={()=>{
                        const ta = document.createElement("textarea"); ta.value = qt;
                        ta.style.position="fixed"; ta.style.top="0"; ta.style.left="0"; ta.style.width="2em"; ta.style.height="2em"; ta.style.opacity="0";
                        document.body.appendChild(ta); ta.focus(); ta.select();
                        try { document.execCommand("copy"); } catch(e) {}
                        document.body.removeChild(ta);
                        setCopiedIdx(i); setTimeout(()=>setCopiedIdx(null),2500);
                      }} style={{ marginTop:10, padding:"10px 22px", fontSize:14, fontWeight:700, borderRadius:8, cursor:"pointer", background:copiedIdx===i?C.green:C.amber, color:"#fff", border:"none", transition:"background 0.3s" }}>
                        {copiedIdx===i ? "✓ Copied!" : shipments.length>1 ? `Copy Quote ${i+1}` : "Copy Quote"}
                      </button>
                      <button onClick={()=>sendQuoteEmail(i)} disabled={emailSendState[i]==="sending"||!brokerEmail.trim()} style={{
                        marginTop:10, marginLeft:10, padding:"10px 22px", fontSize:14, fontWeight:700, borderRadius:8,
                        cursor: emailSendState[i]==="sending"||!brokerEmail.trim() ? "not-allowed" : "pointer",
                        background: emailSendState[i]==="sent" ? C.green : emailSendState[i]==="error" ? C.error : C.navy,
                        color:"#fff", border:"none", transition:"background 0.3s",
                      }}>
                        {emailSendState[i]==="sending" ? "Sending…" : emailSendState[i]==="sent" ? "✓ Sent" : emailSendState[i]==="error" ? "✗ Failed — retry" : "Send Email"}
                      </button>
                      <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
                        → {routeQuoteEmail(s.dest_state, s.direction)}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      </>
      )}
      </div>

      {/* ── Floating Agent Button ── */}
      <div style={{ position:"fixed", bottom:28, right:28, zIndex:1000, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:12 }}>

        {/* Chat panel */}
        {agentOpen && (
          <div style={{ width:380, height:520, background:"#fff", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.18)", display:"flex", flexDirection:"column", overflow:"hidden", border:"1px solid #e7dfd2" }}>
            {/* Header */}
            <div style={{ background:C.navy, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:C.amber, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🤖</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>BDR Dispatch Agent</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>Powered by Claude</div>
                </div>
              </div>
              <button onClick={()=>setAgentOpen(false)} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:20, lineHeight:1, padding:"2px 6px" }}>×</button>
            </div>

            {/* Alerts bar */}
            {agentAlerts.length > 0 && (
              <div style={{ background:"#fffbeb", borderBottom:"1px solid #fde68a", padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13 }}>⚠️</span>
                <span style={{ fontSize:12, fontWeight:600, color:"#92400e" }}>{agentAlerts[0].text}</span>
              </div>
            )}

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
              {agentMessages.length === 0 && (
                <div style={{ textAlign:"center", color:C.muted, fontSize:13, marginTop:40 }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>👋</div>
                  <div style={{ fontWeight:600, marginBottom:6 }}>Hi, I'm your dispatch assistant</div>
                  <div style={{ lineHeight:1.6 }}>Ask me about your loads, get truck recommendations, or check capacity.</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:16 }}>
                    {["What loads are on the board?","Which driver fits this week's loads?","Any capacity issues I should know about?"].map(s=>(
                      <button key={s} onClick={()=>{ setAgentInput(""); callAgent(s); }}
                        style={{ padding:"7px 12px", background:"#f7f4ee", border:"1px solid #e7dfd2", borderRadius:8, fontSize:12, fontWeight:600, color:C.navy, cursor:"pointer", textAlign:"left" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {agentMessages.map((msg, i) => {
                if (msg.role === "user" && typeof msg.content === "string") {
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:"flex-end" }}>
                      <div style={{ maxWidth:"80%", background:C.amber, color:"#fff", borderRadius:"14px 14px 4px 14px", padding:"9px 13px", fontSize:13, lineHeight:1.5 }}>
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                if (msg.role === "assistant") {
                  const text = (Array.isArray(msg.content) ? msg.content : []).filter(b=>b.type==="text").map(b=>b.text).join("");
                  if (!text) return null;
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:"flex-start" }}>
                      <div style={{ maxWidth:"85%", background:"#efe8dc", color:C.text, borderRadius:"14px 14px 14px 4px", padding:"9px 13px", fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                        {text}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
              {agentLoading && (
                <div style={{ display:"flex", justifyContent:"flex-start" }}>
                  <div style={{ background:"#efe8dc", borderRadius:"14px 14px 14px 4px", padding:"9px 14px", display:"flex", gap:5, alignItems:"center" }}>
                    {[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.muted, animation:"bounce 1.2s infinite", animationDelay:`${i*0.2}s` }}/>)}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding:"10px 12px", borderTop:"1px solid #e7dfd2", display:"flex", gap:8 }}>
              <input
                value={agentInput}
                onChange={e=>setAgentInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey&&agentInput.trim()){ e.preventDefault(); const msg=agentInput.trim(); setAgentInput(""); callAgent(msg); }}}
                placeholder="Ask about loads, trucks, drivers…"
                disabled={agentLoading}
                style={{ flex:1, padding:"9px 12px", border:"1px solid #e7dfd2", borderRadius:10, fontSize:13, outline:"none", background: agentLoading?"#f7f4ee":"#fff" }}
              />
              <button
                onClick={()=>{ const msg=agentInput.trim(); if(msg){ setAgentInput(""); callAgent(msg); }}}
                disabled={agentLoading||!agentInput.trim()}
                style={{ padding:"9px 14px", background: agentLoading||!agentInput.trim()?"#e7dfd2":C.amber, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor: agentLoading||!agentInput.trim()?"not-allowed":"pointer" }}>
                ↑
              </button>
            </div>
          </div>
        )}

        {/* FAB button */}
        <button onClick={()=>setAgentOpen(v=>!v)}
          style={{ width:56, height:56, borderRadius:"50%", background: agentOpen?"#475569":C.amber, color:"#fff", border:"none", boxShadow:"0 4px 16px rgba(0,0,0,0.22)", cursor:"pointer", fontSize:24, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
          {agentOpen ? "×" : "🤖"}
          {!agentOpen && agentAlerts.length > 0 && (
            <div style={{ position:"absolute", top:0, right:0, width:18, height:18, borderRadius:"50%", background:"#ef4444", border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700 }}>
              {agentAlerts.length}
            </div>
          )}
        </button>
      </div>

    </div>
  );
}
