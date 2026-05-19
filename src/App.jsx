import { useState, useCallback, useRef, useEffect } from "react";
import { CUSTOMER_PROFILES } from "./customerProfiles.js";

const ANTHROPIC_KEY   = (() => { try { return import.meta.env.VITE_ANTHROPIC_KEY  || ""; } catch(e) { return ""; } })();
const GOOGLE_CLIENT_ID = (() => { try { return import.meta.env.VITE_GOOGLE_CLIENT_ID || ""; } catch(e) { return ""; } })();

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

const UNSERVICED_ZONES = [
  { label: "Laredo, TX", lat: 27.506, lon: -99.508, radiusMi: 100 },
];
function isUnserviced(city, state, lat, lon) {
  for (const z of UNSERVICED_ZONES) {
    if (lat && lon) {
      if (haversine(lat, lon, z.lat, z.lon) <= z.radiusMi) return z.label;
    } else if (city) {
      // fallback: exact city name match when coords unavailable
      if (city.trim().toLowerCase() === z.label.split(",")[0].toLowerCase()) return z.label;
    }
  }
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
];

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

  if (skids === "FTL") {
    return { base: table[21], table, key, orig, chargeIdx: 21, skidIdx: 21, weightIdx: 21, dimIdx: 21, footageIdx: 21, basisLabel: "FTL", dimBasis: null };
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
    // Footage provided (with or without skid count) and no dims → use footage
    chargeIdx  = Math.max(footageIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > footageIdx ? "weight" : "footage";
  } else if (hasDimBasis) {
    chargeIdx  = Math.max(dimIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > dimIdx ? "weight" : "dimensions";
  } else {
    // No footage, no dims: assume standard 48×40" skids (2 ft/skid)
    chargeIdx  = Math.max(skidIdx, weightIdx);
    basisLabel = chargeIdx === weightIdx && weightIdx > skidIdx ? "weight" : "skids";
  }

  return { base: table[chargeIdx], table, key, orig, chargeIdx, skidIdx, weightIdx, dimIdx, footageIdx, basisLabel, dimBasis, footageOnly, useFootageBasis };
}

async function parseEmailWithClaude(text) {
  let res, attempts = 0;
  while (attempts < 3) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json",...(ANTHROPIC_KEY ? {"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"} : {})},
    body: JSON.stringify({
      model:"claude-haiku-4-5-20251001", max_tokens:4096,
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
    }),
  });
  if (res.status === 529 || res.status === 503 || res.status === 429) {
    attempts++;
    await new Promise(r => setTimeout(r, 3000 * attempts));
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

async function parseLoadSheetWithClaude(text) {
  let res, attempts = 0;
  while (attempts < 3) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json",...(ANTHROPIC_KEY ? {"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"} : {})},
      body: JSON.stringify({
        model:"claude-haiku-4-5-20251001", max_tokens:1024,
        system:`You are a parser for a Canadian LTL freight carrier. Extract shipment details from a load sheet / order confirmation / rate confirmation / dispatch email. Return ONLY valid JSON with no markdown.

SCHEMA:
{
  "broker_name": "sender full name or null",
  "broker_first_name": "first name only or null",
  "broker_company": "company name or null",
  "origin": "Ontario or Quebec",
  "pickup_location": "shipper city or address",
  "dest_city": "delivery city name",
  "dest_state": "2-letter US state code",
  "dest_lat": number,
  "dest_lon": number,
  "skids": number or null,
  "weight_lbs": number or null,
  "commodity": "freight description or null",
  "pickup_date": "YYYY-MM-DD or null",
  "delivery_date": "YYYY-MM-DD or null",
  "reference_number": "PO#, order#, or reference# or null",
  "freight_charge": number or null
}

RULES:
- dest_lat/dest_lon: always include accurate coordinates for the delivery city.
- State codes: Michigan→MI, Ohio→OH, Indiana→IN, Illinois→IL, Texas→TX, Tennessee→TN, Kentucky→KY, Missouri→MO, Kansas→KS.
- Weight always in lbs. Convert: kg×2.205, tonnes×2205.
- origin: "Ontario" unless pickup is clearly in Quebec.
- Pieces/pallets/skids/units/PLT all count as skids.
- freight_charge: total freight amount in CAD if stated on the document, else null.`,
        messages:[{role:"user",content:`Parse this load sheet:\n\n${text}`}],
      }),
    });
    if (res.status === 529 || res.status === 503 || res.status === 429) { attempts++; await new Promise(r => setTimeout(r, 3000 * attempts)); continue; }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`);
    const rawText = data.content.map(b=>b.text||"").join("");
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in load sheet response.");
    return JSON.parse(cleanJson(jsonMatch[0]));
  }
  throw new Error("API overloaded after 3 attempts.");
}

async function parsePDFWithClaude(base64Data) {
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
- Pieces/pallets/skids/units/PLT all count as skids.`;

  let attempts = 0;
  while (attempts < 3) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json",...(ANTHROPIC_KEY?{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}:{})},
      body: JSON.stringify({
        model:"claude-sonnet-4-6", max_tokens:4096,
        system: SYSTEM,
        messages:[{role:"user",content:[
          {type:"document",source:{type:"base64",media_type:"application/pdf",data:base64Data}},
          {type:"text",text:"Extract all shipment information from this PDF document."}
        ]}],
      }),
    });
    if (res.status===529||res.status===503||res.status===429){attempts++;await new Promise(r=>setTimeout(r,3000*attempts));continue;}
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message||`API error ${res.status}`);
    const rawText = data.content.map(b=>b.text||"").join("");
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in PDF response.");
    const parsed = JSON.parse(cleanJson(jsonMatch[0]));
    return parsed.shipments ? parsed : {shipments:[parsed], broker_name:parsed.broker_name, broker_company:parsed.broker_company};
  }
  throw new Error("API overloaded after 3 attempts.");
}

async function geocodeCity(city, state) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json",...(ANTHROPIC_KEY ? {"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"} : {})},
    body: JSON.stringify({
      model:"claude-haiku-4-5-20251001", max_tokens:60,
      system:`Return ONLY {"lat":number,"lon":number} for the city. No markdown.`,
      messages:[{role:"user",content:`Coordinates for ${city}${state?", "+state:""}, USA`}],
    }),
  });
  const data = await res.json();
  const raw = data.content.map(b=>b.text||"").join("");
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
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

// ── Design tokens — BDR International branding ────────────────
const C = {
  bg: "#f4f4f4",
  card: "#ffffff",
  border: "#dde1e7",
  navy: "#1a1a1a",
  navyLight: "#2e2e2e",
  amber: "#8B1C32",       // BDR burgundy
  amberLight: "#fdf2f4",
  green: "#16a34a",
  greenLight: "#f0fdf4",
  text: "#222222",
  muted: "#5a5a6a",
  subtle: "#9a9aaa",
  error: "#dc2626",
  errorLight: "#fef2f2",
  highlight: "#fce8ec",
};

const input = { width:"100%", boxSizing:"border-box", padding:"10px 14px", fontSize:14, border:`1px solid #cdd1d8`, borderRadius:4, color:C.text, background:"#fff", outline:"none", fontFamily:"inherit" };
const label = { display:"block", fontSize:12, fontWeight:600, color:"#444", marginBottom:5, letterSpacing:"0.02em" };
const card  = { background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:24, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.07)" };

// ── Gmail helpers ─────────────────────────────────────────────
function getEmailBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) {
    try { return decodeURIComponent(escape(atob(payload.body.data.replace(/-/g,"+").replace(/_/g,"/")))); } catch(e) { return ""; }
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) {
        try { return decodeURIComponent(escape(atob(p.body.data.replace(/-/g,"+").replace(/_/g,"/")))); } catch(e) {}
      }
    }
    for (const p of payload.parts) { const b = getEmailBody(p); if (b) return b; }
  }
  return "";
}

function hasPdfAttachment(payload) {
  if (!payload) return false;
  for (const part of (payload.parts || [])) {
    if (part.mimeType === "application/pdf" || (part.filename || "").toLowerCase().endsWith(".pdf")) return true;
    if (part.parts && hasPdfAttachment(part)) return true;
  }
  return false;
}

function getPdfAttachmentPart(payload) {
  if (!payload) return null;
  for (const part of (payload.parts || [])) {
    if (part.mimeType === "application/pdf" || (part.filename || "").toLowerCase().endsWith(".pdf")) return part;
    const nested = getPdfAttachmentPart(part);
    if (nested) return nested;
  }
  return null;
}

async function fetchGmailPdfBase64(token, messageId, attachmentId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  // Gmail uses base64url — convert to standard base64 for Claude
  return (data.data || "").replace(/-/g, "+").replace(/_/g, "/");
}

const LOAD_SHEET_KEYWORDS = ["load sheet", "order confirmation", "load confirmation", "booking confirmation", "rate confirmation", "dispatch", "shipment confirmation", "carrier confirmation"];
const CARRIER_CONF_KEYWORDS = ["carrier confirmation"];

function isLoadSheetEmail(subject, body) {
  const text = (subject + " " + (body || "")).toLowerCase();
  return LOAD_SHEET_KEYWORDS.some(k => text.includes(k));
}

function buildReplyRaw(to, subject, body, threadId, inReplyTo) {
  const subj = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  const lines = [
    `To: ${to}`,
    `Subject: ${subj}`,
    `Content-Type: text/plain; charset=utf-8`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
    "",
    body,
  ];
  return btoa(unescape(encodeURIComponent(lines.join("\r\n"))))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

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
          border:"1px solid #e2e8f0", borderRadius:10, boxShadow:"0 8px 28px rgba(0,0,0,0.13)", zIndex:200,
          maxHeight:240, overflowY:"auto", padding:"4px 0" }}>
          {filtered.map((s, i) => {
            const parts = s.split(", ");
            const city = parts[0];
            const state = parts[1];
            return (
              <div key={i} onMouseDown={() => { onChange(s); setOpen(false); }} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(-1)}
                style={{ padding:"9px 14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between",
                  background: hovered===i ? "#f0f4ff" : "transparent",
                  borderLeft: hovered===i ? "3px solid #4f46e5" : "3px solid transparent",
                  transition:"background 0.1s" }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{city}</span>
                {state && <span style={{ fontSize:12, fontWeight:700, color:"#6366f1", background:"#eef2ff", padding:"2px 7px", borderRadius:5 }}>{state}</span>}
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
  const [company, setCompany]       = useState("BDR International LTD");
  const [contact, setContact]       = useState("Nolan Giesbrecht");
  const [phone, setPhone]           = useState("519-469-9361 ext 113");
  const debounce                    = useRef(null);
  const [tab, setTab]               = useState("quote");   // quote | history | customers | gmail | capacity

  // ── Capacity / Truck planning state ──────────────────────────
  const [truckDays, setTruckDays]           = useState([]);
  const [truckDaysLoaded, setTruckDaysLoaded] = useState(false);
  const [newTruckDate,  setNewTruckDate]    = useState("");
  const [newTruckRoute, setNewTruckRoute]   = useState("");
  const [newTruckCount, setNewTruckCount]   = useState(1);
  const [capacityTab, setCapacityTab]         = useState("planner");
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

  // ── Gmail state ───────────────────────────────────────────────
  const [gmailToken,    setGmailToken]    = useState(null);
  const [gmailUser,     setGmailUser]     = useState(null);
  const [gmailEmails,   setGmailEmails]   = useState([]);
  const [gmailLoading,  setGmailLoading]  = useState(false);
  const [gmailQuotes,   setGmailQuotes]   = useState({});
  const [gmailFilter,   setGmailFilter]   = useState("all");
  const [gmailExpandedId, setGmailExpandedId] = useState(null);
  const [sendingIds,    setSendingIds]    = useState(new Set());
  const [scanningAll,   setScanningAll]   = useState(false);
  const gmailClientRef = useRef(null);
  const [scanState, setScanState] = useState(null); // null | {status:"scanning"|"done", found, processed, added}
  const gmailTokenRef = useRef(null);
  const gmailQuotesRef = useRef({});
  const [history, setHistory]       = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [histSearch, setHistSearch] = useState("");
  const [historyView, setHistoryView] = useState("quotes"); // "quotes" | "pipeline"
  const [counterInputs, setCounterInputs] = useState({}); // {timestamp: amountString}
  const [viewingQuote, setViewingQuote] = useState(null);
  const [customers, setCustomers]     = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null); // null | "new" | {id,...}
  const [custSearch, setCustSearch]   = useState("");
  const [plSearch,   setPlSearch]     = useState("");
  const [matchedCustomer, setMatchedCustomer] = useState(null); // auto-matched on parse

  const historyRef  = useRef([]);
  const contactRef  = useRef("Nolan Giesbrecht");
  const phoneRef    = useRef("519-469-9361 ext 113");
  const gmailUserRef = useRef(null);
  const processGmailEmailRef = useRef(null);
  const fetchInboxRef = useRef(null);

  // ── Agent state ───────────────────────────────────────────────
  const [agentOpen,     setAgentOpen]     = useState(false);
  const [agentMessages, setAgentMessages] = useState([]);
  const [agentInput,    setAgentInput]    = useState("");
  const [agentLoading,  setAgentLoading]  = useState(false);
  const [agentAlerts,   setAgentAlerts]   = useState([]);

  // Keep refs in sync for use inside callbacks
  useEffect(() => {
    gmailQuotesRef.current = gmailQuotes;
    try { localStorage.setItem("bdr_gmail_quotes", JSON.stringify(gmailQuotes)); } catch(e) {}
  }, [gmailQuotes]);
  useEffect(() => { gmailTokenRef.current = gmailToken; }, [gmailToken]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { contactRef.current = contact; }, [contact]);
  useEffect(() => { phoneRef.current = phone; }, [phone]);
  useEffect(() => { gmailUserRef.current = gmailUser; }, [gmailUser]);

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

      // Restore Gmail session if token hasn't expired
      try {
        const raw = localStorage.getItem("bdr_gmail_session");
        if (raw) {
          const session = JSON.parse(raw);
          if (session.token && session.expiresAt > Date.now()) {
            setGmailToken(session.token);
            setGmailUser(session.user || "");
          } else {
            localStorage.removeItem("bdr_gmail_session");
          }
        }
      } catch(e) {}

      // Restore gmailQuotes so email cards keep their rates after refresh
      try {
        const gq = localStorage.getItem("bdr_gmail_quotes");
        if (gq) setGmailQuotes(JSON.parse(gq));
      } catch(e) {}
    })();
  }, []);

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
    } catch(e) { setError(e?.message || "Could not read PDF. Try again."); }
    finally { setPdfLoading(false); }
  }, []);

  // ── Gmail functions ───────────────────────────────────────────

  const fetchInbox = useCallback(async (token) => {
    setGmailLoading(true);
    try {
      const listRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=40",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const listData = await listRes.json();
      if (!listData.messages?.length) { setGmailEmails([]); return; }
      const messages = await Promise.all(
        listData.messages.map(({ id }) =>
          fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        )
      );
      const valid = messages.filter(m => m.id);
      setGmailEmails(valid);
      // Auto-process load sheets only (local keyword+attachment detection, no API quota)
      const unprocessedLoadSheets = valid.filter(m => {
        if (gmailQuotesRef.current[m.id]) return false;
        const headers = m.payload?.headers || [];
        const subject = headers.find(h => h.name === "Subject")?.value || "";
        const body = getEmailBody(m.payload);
        return hasPdfAttachment(m.payload) && isLoadSheetEmail(subject, body);
      });
      if (unprocessedLoadSheets.length > 0) {
        (async () => {
          for (const m of unprocessedLoadSheets) {
            await processGmailEmailRef.current?.(m);
            await new Promise(r => setTimeout(r, 1500));
          }
        })();
      }
    } catch(e) { console.error("Gmail fetch:", e); }
    finally { setGmailLoading(false); }
  }, []);

  const connectGmail = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) { alert("Add VITE_GOOGLE_CLIENT_ID to your .env and restart the server."); return; }
    const client = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
      callback: async (resp) => {
        if (!resp.access_token) return;
        setGmailToken(resp.access_token);
        const expiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3600000);
        try {
          const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${resp.access_token}` } });
          const ud = await u.json();
          setGmailUser(ud.email || "");
          localStorage.setItem("bdr_gmail_session", JSON.stringify({ token: resp.access_token, user: ud.email || "", expiresAt }));
        } catch(e) {
          localStorage.setItem("bdr_gmail_session", JSON.stringify({ token: resp.access_token, user: "", expiresAt }));
        }
        // fetchInbox is triggered by the gmailToken useEffect — no need to call it here too
      },
    });
    if (!client) { alert("Google Identity Services not loaded yet — wait a moment and try again."); return; }
    gmailClientRef.current = client;
    client.requestAccessToken();
  }, [fetchInbox]);

  const processGmailEmail = useCallback(async (email) => {
    const id = email.id;
    setGmailQuotes(prev => ({ ...prev, [id]: { status: "processing" } }));
    const headers = email.payload?.headers || [];
    const subject = headers.find(h => h.name === "Subject")?.value || "";
    const from    = headers.find(h => h.name === "From")?.value || "";
    const body    = getEmailBody(email.payload);

    // ── Carrier confirmation detection (sent loads) ──
    const isCarrierConf = hasPdfAttachment(email.payload) && CARRIER_CONF_KEYWORDS.some(k => (subject + " " + (body||"")).toLowerCase().includes(k));
    if (isCarrierConf) {
      setGmailQuotes(prev => ({ ...prev, [id]: { status: "processing" } }));
      try {
        const pdfPart = getPdfAttachmentPart(email.payload);
        let pdfBase64;
        if (pdfPart?.body?.attachmentId && gmailTokenRef.current) {
          pdfBase64 = await fetchGmailPdfBase64(gmailTokenRef.current, id, pdfPart.body.attachmentId);
        } else if (pdfPart?.body?.data) {
          pdfBase64 = pdfPart.body.data.replace(/-/g, "+").replace(/_/g, "/");
        }
        const pdfResult = pdfBase64 ? await parsePDFWithClaude(pdfBase64) : null;
        const parsed = pdfResult?.shipments?.[0] || pdfResult || {};
        const norm = normalizeShipment(parsed);
        const coords = (!norm.dest_lat && norm.dest_city) ? await geocodeCity(norm.dest_city, norm.dest_state) : null;
        if (coords) { norm.dest_lat = coords.lat; norm.dest_lon = coords.lon; }
        const now = Date.now();
        const senderName = from.replace(/<.*>/, "").trim() || from;
        const record = {
          timestamp: now,
          outcome: "sent_load",
          source: "carrier_confirmation",
          date: new Date().toLocaleDateString("en-CA"),
          time: new Date().toLocaleTimeString("en-CA", { hour:"2-digit", minute:"2-digit" }),
          broker_name: pdfResult?.broker_name || parsed.broker_name || senderName,
          broker_company: pdfResult?.broker_company || parsed.broker_company || "",
          broker_email: (from.match(/<(.+?)>/) || [])[1] || from,
          origin: norm.origin || "Ontario",
          pickup_location: norm.pickup_location || "",
          dest_city: norm.dest_city || "",
          dest_state: norm.dest_state || "",
          dest_lat: norm.dest_lat || null,
          dest_lon: norm.dest_lon || null,
          skids: norm.skids,
          footage: norm.footage,
          weight_lbs: norm.weight_lbs,
          commodity: norm.commodity,
          pickup_date: norm.pickup_date,
          delivery_date: norm.delivery_date,
          consignee: norm.consignee,
          delivery_address: norm.delivery_address,
          reference_number: norm.reference_number,
          carrier_name: parsed.carrier_name || "",
          base_rate: parsed.freight_charge || null,
          total: parsed.freight_charge || null,
          thread_id: email.threadId,
          email_subject: subject,
          gmail_msg_id: id,
          pdf_attachment_id: pdfPart?.body?.attachmentId || null,
        };
        await window.storage.set(`bdr_quote:${now}`, JSON.stringify(record));
        setHistory(prev => [record, ...prev]);
        setGmailQuotes(prev => ({ ...prev, [id]: { status: "sent_load", matchedTimestamp: now, brokerName: record.broker_name } }));
      } catch(e) {
        setGmailQuotes(prev => ({ ...prev, [id]: { status: "error", error: e.message } }));
      }
      return;
    }

    // ── Load sheet / order confirmation detection ──
    if (hasPdfAttachment(email.payload) && isLoadSheetEmail(subject, body)) {
      const brokerEmail = (from.match(/<(.+?)>/) || [])[1] || from;
      // Match to a quoted load: same thread first, then same broker email on waiting/broker_sending
      const matched = historyRef.current.find(h => h.thread_id === email.threadId)
        || historyRef.current.find(h => h.broker_email && h.broker_email.toLowerCase() === brokerEmail.toLowerCase()
            && (h.outcome === "waiting" || h.outcome === "broker_sending"));

      if (matched) {
        // Existing quote — just mark received
        setGmailQuotes(prev => ({ ...prev, [id]: { status: "load_sheet", matchedTimestamp: matched.timestamp, brokerName: matched.broker_name || (from.replace(/<.*>/, "").trim()) } }));
        await updateQuoteOutcome(matched.timestamp, "received");
      } else {
        // No prior quote — parse the load sheet and add directly to pipeline as received
        setGmailQuotes(prev => ({ ...prev, [id]: { status: "processing" } }));
        try {
          // Prefer reading the actual PDF attachment over just the email body
          const pdfPart = getPdfAttachmentPart(email.payload);
          let parsed;
          if (pdfPart?.body?.attachmentId && gmailTokenRef.current) {
            const pdfBase64 = await fetchGmailPdfBase64(gmailTokenRef.current, id, pdfPart.body.attachmentId);
            const pdfResult = await parsePDFWithClaude(pdfBase64);
            parsed = pdfResult.shipments?.[0] || pdfResult;
            if (!parsed.broker_name) parsed.broker_name = pdfResult.broker_name || from.replace(/<.*>/, "").trim();
            if (!parsed.broker_company) parsed.broker_company = pdfResult.broker_company || "";
          } else {
            parsed = await parseLoadSheetWithClaude(`From: ${from}\nSubject: ${subject}\n\n${body}`);
          }
          const now = Date.now();
          const brokerDisplayName = parsed.broker_name || from.replace(/<.*>/, "").trim() || "—";
          const norm_ls = normalizeShipment(parsed);
          const lsCoords = (!norm_ls.dest_lat && norm_ls.dest_city) ? await geocodeCity(norm_ls.dest_city, norm_ls.dest_state) : null;
          if (lsCoords) { norm_ls.dest_lat = lsCoords.lat; norm_ls.dest_lon = lsCoords.lon; }
          const lsRc = norm_ls.dest_lat ? findNearestRateCity(norm_ls.dest_lat, norm_ls.dest_lon, norm_ls.dest_city) : null;
          const lsRr = lsRc ? getRate(norm_ls.origin, lsRc, norm_ls.skids, norm_ls.weight_lbs, norm_ls.line_items, norm_ls.footage) : null;
          await saveQuote({
            timestamp: now,
            outcome: "received",
            source: "load_sheet",
            date: new Date().toLocaleDateString("en-CA"),
            time: new Date().toLocaleTimeString("en-CA", { hour:"2-digit", minute:"2-digit" }),
            broker_name: brokerDisplayName,
            broker_company: parsed.broker_company || "",
            broker_email: brokerEmail,
            origin: norm_ls.origin || "Ontario",
            pickup_location: norm_ls.pickup_location || "",
            dest_city: norm_ls.dest_city || "",
            dest_state: norm_ls.dest_state || "",
            dest_lat: norm_ls.dest_lat || null,
            dest_lon: norm_ls.dest_lon || null,
            skids: norm_ls.skids,
            footage: norm_ls.footage,
            weight_lbs: norm_ls.weight_lbs,
            commodity: norm_ls.commodity,
            pickup_date: norm_ls.pickup_date,
            delivery_date: norm_ls.delivery_date,
            consignee: norm_ls.consignee,
            delivery_address: norm_ls.delivery_address,
            reference_number: norm_ls.reference_number,
            base_rate: parsed.freight_charge || lsRr?.base || null,
            total: parsed.freight_charge || (lsRr?.base ? r5(lsRr.base * 1.18) : null),
            thread_id: email.threadId,
            email_subject: subject,
            quoted_at: now,
          });
          setGmailQuotes(prev => ({ ...prev, [id]: { status: "load_sheet", matchedTimestamp: now, brokerName: brokerDisplayName } }));
        } catch(e) {
          setGmailQuotes(prev => ({ ...prev, [id]: { status: "load_sheet", matchedTimestamp: null, brokerName: from.replace(/<.*>/, "").trim() } }));
        }
      }
      return;
    }

    try {
      const parsed_list = await parseEmailWithClaude(`From: ${from}\nSubject: ${subject}\n\n${body}`);
      const first = parsed_list[0];
      const emailType = first?.email_type || "quote_request";

      // Non-quote emails: classify, store, and move to BDR Non-Urgent label
      if (emailType !== "quote_request") {
        setGmailQuotes(prev => ({ ...prev, [id]: { status: "classified", email_type: emailType } }));
        return;
      }

      if (!first?.dest_city && !first?.skids && !first?.weight_lbs && !first?.footage) {
        setGmailQuotes(prev => ({ ...prev, [id]: { status: "not_quote" } })); return;
      }
      const unservicedZone = isUnserviced(first.dest_city, first.dest_state, first.dest_lat, first.dest_lon);
      if (unservicedZone) {
        setGmailQuotes(prev => ({ ...prev, [id]: { status: "unserviced", city: first.dest_city, state: first.dest_state, zone: unservicedZone } })); return;
      }
      const dir = first.direction || "outbound";
      const isInbound = dir === "inbound";
      const lat = isInbound ? first.pickup_lat : first.dest_lat;
      const lon = isInbound ? first.pickup_lon : first.dest_lon;
      const rc  = (lat && lon) ? findNearestRateCity(lat, lon, isInbound ? first.pickup_location : first.dest_city) : null;
      const origin = isInbound ? (first.dest_state === "QC" ? "Quebec" : "Ontario") : first.origin;
      const rr  = rc ? getRate(origin, rc, first.skids, first.weight_lbs, first.line_items, first.footage, dir) : null;
      let quoteText = "";
      if (rr?.base) {
        const total = r5(rr.base * 1.18);
        const td = TRANSIT_TIMES[(isInbound ? null : first.dest_state)?.toUpperCase()];
        quoteText = [
          `Hi ${first.broker_first_name || (first.broker_name||"").split(" ")[0] || "there"},`,
          "", "Thank you for reaching out. Please find our rate below.", "",
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          "FREIGHT QUOTE",
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          `Pickup:        ${first.pickup_location || first.origin}`,
          `Destination:   ${first.dest_city}, ${first.dest_state}`,
          `Skids:         ${first.skids}${rr.basisLabel==="weight"?` (charged at ${SKID_LABELS[rr.chargeIdx]} skids — weight basis)`:rr.basisLabel==="footage"&&!rr.footageOnly?` (rated on ${first.footage} ft customer footage)`:rr.basisLabel==="skids"?` (std 48×40")`:``}`,
          first.weight_lbs ? `Weight:        ${Number(first.weight_lbs).toLocaleString()} lbs` : null,
          first.commodity  ? `Commodity:     ${first.commodity}` : null,
          first.pickup_date ? `Pickup Date:   ${first.pickup_date}` : null,
          td ? `Transit Time:  Approx. ${td}` : null,
          null,
          "", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          `TOTAL:         $${total} CAD`,
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          "", "Quote valid for 24 hours. Transit times subject to availability.", "",
          "Nolan Giesbrecht", "BDR International Ltd.", "519-469-9361 ext 113",
        ].filter(l => l !== null).join("\n");
      }
      setGmailQuotes(prev => ({ ...prev, [id]: { status: "quote_ready", parsed: first, rateCity: rc, rateResult: rr, quoteText, emailFsc: 0.18, emailAccs: {}, emailCustomAcc: "" } }));
    } catch(e) {
      setGmailQuotes(prev => ({ ...prev, [id]: { status: "error", error: e.message } }));
    }
  }, []);

  const reparsePDFEmail = useCallback(async (email, existingTimestamp) => {
    const id = email.id;
    const pdfPart = getPdfAttachmentPart(email.payload);
    if (!pdfPart) { alert("No PDF attachment found in this email."); return; }
    setGmailQuotes(prev => ({ ...prev, [id]: { ...prev[id], reparsing: true } }));
    try {
      let pdfBase64;
      console.log("[PDF] pdfPart:", JSON.stringify({mimeType:pdfPart.mimeType, filename:pdfPart.filename, bodyKeys:Object.keys(pdfPart.body||{}), attachmentId:pdfPart.body?.attachmentId, dataLen:pdfPart.body?.data?.length}));
      if (pdfPart.body?.attachmentId && gmailTokenRef.current) {
        pdfBase64 = await fetchGmailPdfBase64(gmailTokenRef.current, id, pdfPart.body.attachmentId);
        console.log("[PDF] fetched attachment, base64 length:", pdfBase64?.length);
      } else if (pdfPart.body?.data) {
        pdfBase64 = pdfPart.body.data.replace(/-/g, "+").replace(/_/g, "/");
        console.log("[PDF] inline data, base64 length:", pdfBase64?.length);
      } else {
        alert("Could not retrieve PDF data — attachment has no data or ID. Check console for details.");
        setGmailQuotes(prev => ({ ...prev, [id]: { ...prev[id], reparsing: false } }));
        return;
      }
      console.log("[PDF] sending to Claude, base64 length:", pdfBase64?.length);
      const result = await parsePDFWithClaude(pdfBase64);
      console.log("[PDF] Claude result:", JSON.stringify(result).slice(0, 300));
      const parsed = result.shipments?.[0] || result;
      if (!parsed.broker_name) parsed.broker_name = result.broker_name;
      if (!parsed.broker_company) parsed.broker_company = result.broker_company;
      const norm = normalizeShipment(parsed);
      const coords = (!norm.dest_lat && norm.dest_city) ? await geocodeCity(norm.dest_city, norm.dest_state) : null;
      if (coords) { norm.dest_lat = coords.lat; norm.dest_lon = coords.lon; }
      const rc = norm.dest_lat ? findNearestRateCity(norm.dest_lat, norm.dest_lon, norm.dest_city) : null;
      const rr = rc ? getRate(norm.origin, rc, norm.skids, norm.weight_lbs, norm.line_items, norm.footage) : null;
      const updates = {
        origin: norm.origin || "Ontario",
        pickup_location: norm.pickup_location || "",
        dest_city: norm.dest_city || "",
        dest_state: norm.dest_state || "",
        dest_lat: norm.dest_lat || null,
        dest_lon: norm.dest_lon || null,
        skids: norm.skids,
        footage: norm.footage,
        weight_lbs: norm.weight_lbs,
        commodity: norm.commodity,
        pickup_date: norm.pickup_date,
        delivery_date: norm.delivery_date,
        consignee: norm.consignee,
        delivery_address: norm.delivery_address,
        reference_number: norm.reference_number,
        broker_name: norm.broker_name || parsed.broker_name || "",
        broker_company: norm.broker_company || parsed.broker_company || "",
        base_rate: parsed.freight_charge || rr?.base || null,
        total: parsed.freight_charge || (rr?.base ? r5(rr.base * 1.18) : null),
      };
      console.log("[PDF] existingTimestamp:", existingTimestamp, "historyLen:", historyRef.current.length);
      console.log("[PDF] updates:", JSON.stringify(updates).slice(0, 200));
      const existing = historyRef.current.find(h => h.timestamp === existingTimestamp);
      console.log("[PDF] existing record found:", !!existing);
      if (existing) {
        const updated = { ...existing, ...updates };
        await window.storage.set(`bdr_quote:${existingTimestamp}`, JSON.stringify(updated));
        setHistory(prev => prev.map(h => h.timestamp === existingTimestamp ? updated : h));
        console.log("[PDF] saved successfully:", updated.dest_city, updated.total);
      } else {
        // No existing record — create a new one
        const headers = email.payload?.headers || [];
        const from = headers.find(h=>h.name==="From")?.value || "";
        const subject = headers.find(h=>h.name==="Subject")?.value || "";
        const brokerEmail = (from.match(/<(.+?)>/) || [])[1] || from;
        const newRecord = {
          timestamp: existingTimestamp || Date.now(),
          outcome: "received",
          source: "load_sheet",
          date: new Date().toLocaleDateString("en-CA"),
          time: new Date().toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit"}),
          broker_email: brokerEmail,
          thread_id: email.threadId,
          email_subject: subject,
          quoted_at: Date.now(),
          ...updates,
        };
        await window.storage.set(`bdr_quote:${newRecord.timestamp}`, JSON.stringify(newRecord));
        setHistory(prev => [newRecord, ...prev.filter(h => h.timestamp !== newRecord.timestamp)]);
        setGmailQuotes(prev => ({ ...prev, [id]: { status:"load_sheet", matchedTimestamp:newRecord.timestamp, brokerName:updates.broker_name } }));
        console.log("[PDF] created new record:", newRecord.dest_city, newRecord.total);
      }
      setGmailQuotes(prev => ({ ...prev, [id]: { ...prev[id], reparsing: false } }));
    } catch(e) {
      setGmailQuotes(prev => ({ ...prev, [id]: { ...prev[id], reparsing: false } }));
      alert("Re-parse failed: " + e.message);
    }
  }, []);

  const scanAllEmails = useCallback(async () => {
    setScanningAll(true);
    const unprocessed = gmailEmails.filter(e => !gmailQuotes[e.id]);
    for (const email of unprocessed) {
      await processGmailEmail(email);
      await new Promise(r => setTimeout(r, 1500));
    }
    setScanningAll(false);
  }, [gmailEmails, gmailQuotes, processGmailEmail]);

  const sendGmailReply = useCallback(async (email, quoteText) => {
    const id = email.id;
    setSendingIds(prev => new Set([...prev, id]));
    try {
      const hdrs = email.payload?.headers || [];
      const from      = hdrs.find(h => h.name === "From")?.value || "";
      const subject   = hdrs.find(h => h.name === "Subject")?.value || "";
      const messageId = hdrs.find(h => h.name === "Message-ID")?.value;
      const raw = buildReplyRaw(from, subject, quoteText, email.threadId, messageId);
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${gmailToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw, threadId: email.threadId }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || "Send failed"); }
      setGmailQuotes(prev => ({ ...prev, [id]: { ...prev[id], status: "sent" } }));

      // Mark as read and archive
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${gmailToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ removeLabelIds: ["UNREAD", "INBOX"] }),
      }).catch(() => {});

      // Save quote to history with Gmail thread info for follow-up tracking
      const q = gmailQuotesRef.current[id];
      if (q?.parsed && q?.rateResult?.base) {
        const p   = q.parsed;
        const rr  = q.rateResult;
        const rc  = q.rateCity;
        const now = Date.now();
        // Extract raw email address from "Name <addr>" format
        const brokerEmail = (from.match(/<(.+?)>/) || [])[1] || from;
        await saveQuote({
          timestamp: now,
          date: new Date().toLocaleDateString("en-CA"),
          time: new Date().toLocaleTimeString("en-CA", {hour:"2-digit",minute:"2-digit"}),
          broker_name: p.broker_name || "—", broker_company: p.broker_company || "",
          origin: p.origin || p.pickup_location || "",
          dest_city: p.dest_city || "", dest_state: p.dest_state || "",
          skids: p.skids, weight_lbs: p.weight_lbs,
          base_rate: rr.base, fsc: q.emailFsc ?? 0.18, total: (() => {
            const fscV = q.emailFsc ?? 0.18;
            const accs = q.emailAccs || {};
            const sub  = r5(rr.base * (1 + fscV));
            const fl   = accs["fl"] ? r5(sub * 1.10) : sub;
            const fixed = (accs["da"]?75:0)+(accs["lg"]?75:0)+(accs["nc"]?150:0)+(accs["st"]?100:0)+(parseFloat(q.emailCustomAcc||"")||0);
            return r5(fl + fixed);
          })(),
          rate_city: rc?.city, basis_label: rr.basisLabel, charge_skids: SKID_LABELS[rr.chargeIdx],
          quote_text: quoteText,
          // Gmail tracking fields
          broker_email: brokerEmail,
          thread_id: email.threadId,
          email_subject: subject,
          quoted_at: now,
          followup_sent_at: null,
          last_reply_checked: null,
        });
      }
    } catch(e) { alert("Failed to send: " + e.message); }
    finally { setSendingIds(prev => { const s = new Set(prev); s.delete(id); return s; }); }
  }, [gmailToken]);

  useEffect(() => { processGmailEmailRef.current = processGmailEmail; }, [processGmailEmail]);
  useEffect(() => { fetchInboxRef.current = fetchInbox; }, [fetchInbox]);

  // Auto-poll Gmail every 5 minutes when connected; also fetch on token restore
  useEffect(() => {
    if (!gmailToken) return;
    fetchInboxRef.current?.(gmailToken);
    const id = setInterval(() => { if (gmailTokenRef.current) fetchInboxRef.current?.(gmailTokenRef.current); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [gmailToken]);

  const scanAllLoadSheets = useCallback(async () => {
    if (!gmailToken) return;
    setScanState({ status: "scanning", found: 0, processed: 0, added: 0 });
    try {
      const q = encodeURIComponent('has:attachment ("load sheet" OR "order confirmation" OR "rate confirmation" OR "rate conf" OR "dispatch" OR "shipment confirmation" OR "booking confirmation")');
      const allIds = [];
      let pageToken = null;
      do {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${gmailToken}` } });
        const data = await res.json();
        if (data.messages) allIds.push(...data.messages.map(m => m.id));
        pageToken = data.nextPageToken || null;
      } while (pageToken);

      setScanState(prev => ({ ...prev, found: allIds.length }));

      let added = 0;
      for (let i = 0; i < allIds.length; i++) {
        const msgId = allIds[i];
        setScanState(prev => ({ ...prev, processed: i + 1 }));

        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
          headers: { Authorization: `Bearer ${gmailToken}` }
        });
        const email = await msgRes.json();
        if (!email.id) continue;

        const headers = email.payload?.headers || [];
        const subject = headers.find(h => h.name === "Subject")?.value || "";
        const body    = getEmailBody(email.payload);
        if (!hasPdfAttachment(email.payload) || !isLoadSheetEmail(subject, body)) continue;

        const from = headers.find(h => h.name === "From")?.value || "";
        const brokerEmail = (from.match(/<(.+?)>/) || [])[1] || from;
        const alreadyTracked = historyRef.current.find(h =>
          h.thread_id === email.threadId ||
          (h.broker_email?.toLowerCase() === brokerEmail.toLowerCase() && h.source === "load_sheet" && h.email_subject === subject)
        );
        if (alreadyTracked) continue;

        await processGmailEmail(email);
        added++;
        setScanState(prev => ({ ...prev, added }));
        await new Promise(r => setTimeout(r, 1500));
      }
      setScanState(prev => ({ ...prev, status: "done" }));
    } catch(e) {
      setScanState(prev => ({ ...prev, status: "done" }));
      console.error("Scan failed:", e);
    }
  }, [gmailToken, processGmailEmail]);

  const sendDeclineReply = useCallback(async (email) => {
    const id = email.id;
    setSendingIds(prev => new Set([...prev, id]));
    try {
      const hdrs      = email.payload?.headers || [];
      const from      = hdrs.find(h => h.name === "From")?.value || "";
      const subject   = hdrs.find(h => h.name === "Subject")?.value || "";
      const messageId = hdrs.find(h => h.name === "Message-ID")?.value;
      const q         = gmailQuotesRef.current[id];
      const firstName = q?.parsed?.broker_first_name || (q?.parsed?.broker_name||"").split(" ")[0] || "there";
      const body = [
        `Hi ${firstName},`,
        "",
        "Thank you for reaching out. Unfortunately we are not servicing this area currently.",
        "",
        "We hope to work with you on future loads.",
        "",
        `Best regards,`,
        contactRef.current,
        "BDR International Ltd.",
        phoneRef.current,
      ].join("\n");
      const raw = buildReplyRaw(from, subject, body, email.threadId, messageId);
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${gmailToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw, threadId: email.threadId }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || "Send failed"); }
      setGmailQuotes(prev => ({ ...prev, [id]: { ...prev[id], status: "declined" } }));
    } catch(e) { alert("Failed to send decline: " + e.message); }
    finally { setSendingIds(prev => { const s = new Set(prev); s.delete(id); return s; }); }
  }, [gmailToken]);

  const updateGmailQuoteSettings = (emailId, newFsc, newAccs, newCustomAcc) => {
    const q = gmailQuotes[emailId];
    if (!q?.parsed || !q?.rateResult?.base) return;
    const qt = buildQuoteText(q.parsed, q.rateCity, q.rateResult, newFsc, newAccs, newCustomAcc, contact, company, phone);
    setGmailQuotes(prev => ({
      ...prev, [emailId]: { ...prev[emailId], emailFsc: newFsc, emailAccs: newAccs, emailCustomAcc: newCustomAcc, quoteText: qt }
    }));
  };

  // ── Auto follow-up & reply monitoring ────────────────────────

  const classifyBrokerReply = async (replyText) => {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 80,
          messages: [{ role: "user", content: `Classify this freight broker reply into exactly one of these JSON responses:\n{"type":"yes_sending"} — they confirm the load, send BOL, or ask for more time\n{"type":"no_not_coming"} — cancelled, not available, not going through\n{"type":"counter","amount":NUMBER} — they propose a different price (extract the dollar amount as a number, no $ sign)\n{"type":"unclear"}\n\nReply with ONLY valid JSON, nothing else.\n\nReply text: ${replyText.slice(0, 800)}` }]
        })
      });
      const data = await res.json();
      const raw = (data.content?.[0]?.text || "").trim();
      try { return JSON.parse(raw); } catch { return { type: raw.toLowerCase() }; }
    } catch(e) { return { type: "unclear" }; }
  };

  const sendFollowUpEmail = useCallback(async (quote) => {
    if (!gmailTokenRef.current || !quote.thread_id || !quote.broker_email) return false;
    const firstName = (quote.broker_name || "").split(" ")[0] || "there";
    const body = [
      `Hi ${firstName},`,
      "",
      `Just following up on the freight quote we sent for the shipment from ${quote.origin} to ${quote.dest_city}, ${quote.dest_state}.`,
      "",
      "Has the load been confirmed? Please let us know if you'd like to proceed or if the load is no longer available.",
      "",
      `Thank you,`,
      contactRef.current,
      "BDR International Ltd.",
      phoneRef.current,
    ].join("\n");
    const subj = quote.email_subject
      ? (quote.email_subject.startsWith("Re:") ? quote.email_subject : `Re: ${quote.email_subject}`)
      : "Re: Freight Quote Follow-up";
    const raw = buildReplyRaw(quote.broker_email, subj, body, quote.thread_id, null);
    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${gmailTokenRef.current}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw, threadId: quote.thread_id }),
      });
      return res.ok;
    } catch(e) { return false; }
  }, []);

  const checkThreadForReplies = useCallback(async (quote) => {
    if (!gmailTokenRef.current || !quote.thread_id) return;
    try {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${quote.thread_id}?format=full`, {
        headers: { Authorization: `Bearer ${gmailTokenRef.current}` }
      });
      const thread = await res.json();
      if (!thread.messages?.length) return;

      const lastCheck = quote.last_reply_checked || quote.followup_sent_at || quote.quoted_at || quote.timestamp;
      const myEmail   = (gmailUserRef.current || "").toLowerCase();

      // Find messages newer than lastCheck that aren't from us
      const newReplies = thread.messages.filter(m => {
        const ts = parseInt(m.internalDate || 0);
        const fromHdr = (m.payload?.headers || []).find(h => h.name === "From")?.value || "";
        const isFromMe = myEmail && fromHdr.toLowerCase().includes(myEmail);
        return ts > lastCheck && !isFromMe;
      });

      if (!newReplies.length) return;

      const latest    = newReplies[newReplies.length - 1];
      const replyBody = getEmailBody(latest.payload);
      if (!replyBody) return;

      const classification = await classifyBrokerReply(replyBody);
      const now = Date.now();
      await updateQuoteFields(quote.timestamp, { last_reply_checked: now });

      if (classification.type === "no_not_coming") {
        await updateQuoteOutcome(quote.timestamp, "lost");
        const hdrs       = latest.payload?.headers || [];
        const fromAddr   = hdrs.find(h => h.name === "From")?.value || quote.broker_email;
        const subject    = hdrs.find(h => h.name === "Subject")?.value || "";
        const inReplyTo  = hdrs.find(h => h.name === "Message-ID")?.value;
        const thankYou   = `Thank you for letting me know.\n\nBest regards,\n${contactRef.current}\nBDR International Ltd.\n${phoneRef.current}`;
        const raw        = buildReplyRaw(fromAddr, subject, thankYou, quote.thread_id, inReplyTo);
        await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${gmailTokenRef.current}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw, threadId: quote.thread_id }),
        }).catch(() => {});
      } else if (classification.type === "yes_sending") {
        await updateQuoteOutcome(quote.timestamp, "broker_sending");
      } else if (classification.type === "counter") {
        const hdrs      = latest.payload?.headers || [];
        const inReplyTo = hdrs.find(h => h.name === "Message-ID")?.value;
        await updateQuoteFields(quote.timestamp, {
          outcome: "counter",
          counter_offer: classification.amount || null,
          counter_reply_text: replyBody.slice(0, 800),
          counter_reply_to: inReplyTo,
          counter_at: now,
        });
      }
    } catch(e) {}
  }, []);

  const respondToCounter = useCallback(async (quote, action, counterAmount) => {
    if (!gmailTokenRef.current || !quote.thread_id) return;
    const firstName  = (quote.broker_name || "").split(" ")[0] || "there";
    const subj = quote.email_subject
      ? (quote.email_subject.startsWith("Re:") ? quote.email_subject : `Re: ${quote.email_subject}`)
      : "Re: Freight Quote";
    let body = "";
    if (action === "accept") {
      body = `Hi ${firstName},\n\nThank you — we can accept the rate of $${quote.counter_offer} CAD. Please send the BOL/load sheet when ready and we'll get it confirmed.\n\nBest regards,\n${contactRef.current}\nBDR International Ltd.\n${phoneRef.current}`;
      await updateQuoteFields(quote.timestamp, { outcome: "broker_sending", total: quote.counter_offer, base_rate: quote.counter_offer, counter_resolved: "accepted" });
    } else if (action === "decline") {
      body = `Hi ${firstName},\n\nThank you for the counter, however we are unable to accommodate that rate at this time. We appreciate the opportunity and hope to work together on a future load.\n\nBest regards,\n${contactRef.current}\nBDR International Ltd.\n${phoneRef.current}`;
      await updateQuoteFields(quote.timestamp, { outcome: "lost", counter_resolved: "declined" });
    } else if (action === "counter" && counterAmount) {
      body = `Hi ${firstName},\n\nThank you for coming back to us. Our best rate for this lane is $${counterAmount} CAD — we're not able to go lower given current capacity. Please let us know if that works.\n\nBest regards,\n${contactRef.current}\nBDR International Ltd.\n${phoneRef.current}`;
      await updateQuoteFields(quote.timestamp, { outcome: "waiting", total: counterAmount, base_rate: counterAmount, counter_resolved: "countered", last_reply_checked: Date.now() });
    }
    if (body) {
      const raw = buildReplyRaw(quote.broker_email, subj, body, quote.thread_id, quote.counter_reply_to || null);
      await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${gmailTokenRef.current}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw, threadId: quote.thread_id }),
      }).catch(() => {});
    }
  }, []);

  // Periodic check: runs every 5 minutes while Gmail is connected
  useEffect(() => {
    if (!gmailToken) return;
    const run = async () => {
      const now     = Date.now();
      const ONE_HR  = 3600000;
      const FOUR_HR = 14400000;
      for (const quote of historyRef.current) {
        // Auto follow-up disabled — enable when ready
        // Check for broker replies on waiting & broker_sending quotes
        if ((quote.outcome === "waiting" || quote.outcome === "broker_sending" || quote.outcome === "counter") && quote.thread_id) {
          await checkThreadForReplies(quote);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    };
    run(); // run immediately on connect
    const interval = setInterval(run, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [gmailToken, sendFollowUpEmail, checkThreadForReplies]);

  // Auto-refresh inbox every 10 seconds while connected
  useEffect(() => {
    if (!gmailToken) return;
    const interval = setInterval(() => fetchInbox(gmailToken), 10000);
    return () => clearInterval(interval);
  }, [gmailToken, fetchInbox]);

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

    // Pre-compute which shipments are unserviced so isFirst can be determined cleanly
    const unservicedFlags = shipments.map(s => isUnserviced(s.dest_city, s.dest_state, s.dest_lat, s.dest_lon));
    const firstServiceableIdx = unservicedFlags.findIndex(z => !z);

    // Resolve rates + build text for every shipment at once
    // Unserviced shipments are included but marked — they show a notice instead of a quote
    const results = shipments.map((s, i) => {
      const unservicedZone = unservicedFlags[i];
      if (unservicedZone) return { qt: "", rr: null, rc: null, unserviced: unservicedZone };
      const dir = s.direction || "outbound";
      const isInbound = dir === "inbound";
      const lat = isInbound ? s.pickup_lat : s.dest_lat;
      const lon = isInbound ? s.pickup_lon : s.dest_lon;
      const isFirst = i === firstServiceableIdx;
      // For the active shipment, reuse the already-resolved rate
      if (i === activeIdx && rateResult?.base) {
        const qt = buildQuoteText(s, rateCity, rateResult, fsc, accs, customAcc, contact, company, phone, isFirst);
        return { qt, rr: rateResult, rc: rateCity };
      }
      if (!lat || !lon) return { qt: "", rr: null, rc: null };
      const rc = findNearestRateCity(lat, lon, isInbound ? s.pickup_location : s.dest_city);
      const origin = isInbound ? (s.dest_state === "QC" ? "Quebec" : "Ontario") : s.origin;
      const rr = getRate(origin, rc, s.skids, s.weight_lbs, s.line_items, s.footage, dir);
      if (!rr?.base) return { qt: "", rr, rc };
      const qt = buildQuoteText(s, rc, rr, fsc, accs, customAcc, contact, company, phone, isFirst);
      return { qt, rr, rc };
    });

    const allQts   = results.map(r => r.qt);
    const allRates = results.map(r => ({ base: r.rr?.base, total: r.rr ? r5(r.rr.base*(1+fsc)) : null, rateCity: r.rc, rateResult: r.rr, unserviced: r.unserviced || null }));
    setQuoteTexts(allQts);
    setAllShipmentRates(allRates);
    setQuoteText(allQts[activeIdx] || allQts[0] || "");
    setStep("result");

    results.forEach(({ qt, rr, rc }, i) => {
      if (!qt || !rr) return;
      const s = shipments[i];
      saveQuote({
        timestamp: Date.now() + i,
        date: new Date().toLocaleDateString("en-CA"),
        time: new Date().toLocaleTimeString("en-CA", {hour:"2-digit",minute:"2-digit"}),
        broker_name: s.broker_name || "—", broker_company: s.broker_company || "",
        origin: s.origin || "", dest_city: s.dest_city || "", dest_state: s.dest_state || "",
        skids: s.skids, weight_lbs: s.weight_lbs,
        base_rate: rr.base, fsc, total: r5(rr.base*(1+fsc)),
        rate_city: rc?.city, basis_label: rr.basisLabel, charge_skids: SKID_LABELS[rr.chargeIdx],
        quote_text: qt,
      });
    });
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
    const boardLoads = history.filter(q => q.outcome === "received" || q.outcome === "broker_sending");
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
    const boardLoads = history.filter(q => q.outcome === "received" || q.outcome === "broker_sending");
    const confirmed  = boardLoads.filter(q => q.outcome === "received");
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

Be concise and actionable. When asked for recommendations, be specific about which driver/truck fits which load and why. You can trigger an inbox scan to check for new emails. You can also add recurring weekly trucks to the schedule — if the user says something like "add a truck every Tuesday to Detroit" use the add_weekly_truck tool immediately without asking for confirmation.`;

    const newMessages = [...agentMessages, { role:"user", content: userMessage }];
    setAgentMessages(newMessages);
    setAgentLoading(true);

    const TOOLS = [
      {
        name: "scan_inbox",
        description: "Scan Gmail inbox for new load sheet emails and auto-process them into the board",
        input_schema: { type:"object", properties:{} }
      },
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1024, system:systemPrompt, tools:TOOLS, messages:msgs }),
      });
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
          if (tu.name === "scan_inbox") {
            if (gmailTokenRef.current) fetchInboxRef.current?.(gmailTokenRef.current);
            else return { type:"tool_result", tool_use_id:tu.id, content:"Gmail not connected — user needs to sign in first." };
            return { type:"tool_result", tool_use_id:tu.id, content:"Inbox scan triggered. New load sheets will be auto-processed." };
          }
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
        background: active ? C.amber : done ? C.green : "#dde1e7",
        color: active||done ? "#fff" : "#999",
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize:14, fontWeight:active?700:500, color:active?C.amber:done?C.green:"#999" }}>{label}</span>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f4f4f4", fontFamily:"'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif", color:C.text, WebkitFontSmoothing:"antialiased" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        *{box-sizing:border-box}
        body{margin:0;background:#f4f4f4}
        textarea:focus,input:focus{border-color:${C.amber}!important;box-shadow:0 0 0 3px rgba(139,28,50,0.12)!important;outline:none}
        button{transition:all 0.15s}
        button:hover{opacity:0.9}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#f0f0f0}
        ::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}
        .nav-link-btn:hover{color:${C.amber}!important}
      `}</style>

      {/* ── TOP HEADER — white, full width, like bdrint.ca ── */}
      <header style={{ background:"#fff", borderBottom:"1px solid #e0e0e0", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", position:"sticky", top:0, zIndex:100 }}>
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
            {[["quote","Quote"],["gmail","Gmail"],["customers","Customers"],["history","History"],["capacity","Capacity"]].map(([t,l]) => (
              <button key={t} onClick={()=>setTab(t)} className="nav-link-btn" style={{
                padding:"8px 20px", background:"none", border:"none",
                borderBottom: tab===t ? `3px solid ${C.amber}` : "3px solid transparent",
                color: tab===t ? C.amber : "#333",
                fontSize:15, fontWeight: tab===t ? 700 : 500,
                cursor:"pointer", letterSpacing:"0.01em",
                transition:"all 0.15s", marginBottom:-1,
              }}>{l}</button>
            ))}
            <div style={{ width:1, height:24, background:"#e0e0e0", margin:"0 8px" }}/>
            <div style={{ fontSize:13, color:"#555", display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ color:C.amber, fontWeight:700 }}>●</span> Freight Quote Tool
            </div>
          </nav>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div style={{ background:"#f4f4f4" }}>

      {tab === "customers" ? (
        /* ══ CUSTOMERS TAB ══ */
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"28px 32px" }}>
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
                // Build lane slices from history — match on company, broker_name, or email
                const custQuotes = history.filter(q => {
                  const cc = (c.company||"").toLowerCase();
                  if (!cc) return false;
                  const bc  = (q.broker_company||"").toLowerCase();
                  const bn  = (q.broker_name||"").toLowerCase();
                  const be  = (q.broker_email||"").toLowerCase();
                  const ce  = (c.email||"").toLowerCase();
                  return bc.includes(cc) || cc.includes(bc) ||
                         bn.includes(cc) || cc.includes(bn) ||
                         (ce && be && be.includes(ce.split("@")[1]||"__"));
                });
                const laneMap = {};
                custQuotes.forEach(q => {
                  if (!q.dest_city || !q.dest_state) return;
                  const key = `${q.dest_city}, ${q.dest_state}`;
                  laneMap[key] = (laneMap[key] || 0) + 1;
                });
                const laneSlices = Object.entries(laneMap)
                  .sort((a,b) => b[1]-a[1])
                  .slice(0, 8)
                  .map(([lane, count]) => ({ lane, count }));

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
                    <div style={{ borderTop:`1px solid ${C.border}`, padding:"14px 20px", background:"#fafcff" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Top Lanes</div>
                      {laneSlices.length > 0
                        ? <LanePieChart slices={laneSlices} />
                        : <div style={{ fontSize:12, color:"#9ca3af" }}>No quote history found for this customer yet.</div>
                      }
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* ── P&L Insights (from BDR Jan–May 2026 report) ── */}
          <div style={{ marginTop:36 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:C.navy }}>P&amp;L Insights <span style={{ fontSize:12, fontWeight:400, color:C.muted }}>(Jan–May 2026 · {CUSTOMER_PROFILES.length} shippers)</span></div>
              </div>
              <input value={plSearch} onChange={e=>setPlSearch(e.target.value)} placeholder="Search shipper…"
                style={{ ...input, width:220, fontSize:14 }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px,1fr))", gap:12 }}>
              {CUSTOMER_PROFILES
                .filter(p => !plSearch || p.name.toLowerCase().includes(plSearch.toLowerCase()))
                .slice(0, plSearch ? 200 : 30)
                .map(p => (
                  <div key={p.name} style={{ background:"#fff", borderRadius:10, border:`1px solid ${C.border}`, padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.navy, marginBottom:8, lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                      <span style={{ fontSize:12, fontWeight:600, background:"#eff6ff", color:"#1d4ed8", borderRadius:5, padding:"3px 8px" }}>
                        {p.shipments} loads
                      </span>
                      <span style={{ fontSize:12, fontWeight:600, background:"#f0fdf4", color:"#15803d", borderRadius:5, padding:"3px 8px" }}>
                        ${p.totalRevenue.toLocaleString()} rev
                      </span>
                      <span style={{ fontSize:12, color:C.muted, background:"#f8fafc", borderRadius:5, padding:"3px 8px" }}>
                        avg ${p.avgRevPerShipment}/load
                      </span>
                    </div>
                    {p.pickupCities && p.pickupCities.length > 0 && (
                      <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>
                        <span style={{ fontWeight:600, color:C.text }}>Picks up from: </span>
                        {p.pickupCities.slice(0,4).join(", ")}{p.pickupCities.length>4?` +${p.pickupCities.length-4} more`:""}
                      </div>
                    )}
                    {p.destinations && p.destinations.length > 0 && (
                      <div style={{ fontSize:11, color:C.muted }}>
                        <span style={{ fontWeight:600, color:C.text }}>Delivers to: </span>
                        {p.destinations.slice(0,4).join(", ")}{p.destinations.length>4?` +${p.destinations.length-4} more`:""}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
            {!plSearch && CUSTOMER_PROFILES.length > 30 && (
              <div style={{ textAlign:"center", marginTop:12, fontSize:13, color:C.muted }}>
                Showing top 30 by revenue — search to find any of the {CUSTOMER_PROFILES.length} brokers
              </div>
            )}
          </div>

        </div>
      ) : tab === "history" ? (
        /* ══ HISTORY / PIPELINE TAB ══ */
        <div style={{ padding:"28px 32px" }}>
          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:C.navy }}>
                {historyView === "pipeline" ? "Delivery Pipeline" : "Quote History"}
              </div>
              <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>
                {historyView === "pipeline"
                  ? `${history.filter(q=>q.outcome==="received").length} received · ${history.filter(q=>q.outcome==="pending").length} pending`
                  : `${history.length} of 500 quotes saved`}
              </div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {historyView === "quotes" && (
                <input value={histSearch} onChange={e=>setHistSearch(e.target.value)} placeholder="Search broker, city, state…"
                  style={{ ...input, width:220, fontSize:14 }}/>
              )}
              <div style={{ display:"flex", border:`1.5px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                {[["quotes","📋 Quotes"],["pipeline","📦 Pipeline"]].map(([v,l]) => (
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
            const received = history.filter(q => q.outcome === "received").sort((a,b) => (a.pickup_date||"").localeCompare(b.pickup_date||"") || a.timestamp - b.timestamp);
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
                              style={{ padding:"6px 14px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f1f5f9", color:C.muted, border:`1px solid ${C.border}` }}>
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
                          <div style={{ width:5, background:q.outcome==="waiting" ? "#fed7aa" : q.outcome==="broker_sending" ? "#ddd6fe" : "#e2e8f0", flexShrink:0 }}/>
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
                              style={{ padding:"6px 12px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f9fafb", color:"#6b7280", border:`1px solid #d1d5db` }}>
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
                              {q.gmail_msg_id && q.pdf_attachment_id && (
                                <button onClick={async () => {
                                  if (!gmailToken) { alert("Connect Gmail to view PDF"); return; }
                                  try {
                                    const b64 = await fetchGmailPdfBase64(gmailToken, q.gmail_msg_id, q.pdf_attachment_id);
                                    const bin = atob(b64);
                                    const bytes = new Uint8Array(bin.length);
                                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                                    const blob = new Blob([bytes], { type: "application/pdf" });
                                    window.open(URL.createObjectURL(blob), "_blank");
                                  } catch(e) { alert("Could not load PDF: " + e.message); }
                                }} style={{ marginLeft:"auto", padding:"6px 14px", background:"#0369a1", color:"#fff", border:"none", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                                  📄 View PDF
                                </button>
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
                  const outcomeColor = q.outcome==="received" ? C.green : q.outcome==="lost" ? C.error : q.outcome==="waiting" ? "#c2410c" : q.outcome==="broker_sending" ? "#7c3aed" : q.outcome==="declined" ? "#6b7280" : C.amber;
                  const outcomeBg    = q.outcome==="received" ? "#f0fdf4" : q.outcome==="lost" ? "#fef2f2" : q.outcome==="waiting" ? "#fff7ed" : q.outcome==="broker_sending" ? "#f5f3ff" : q.outcome==="declined" ? "#f9fafb" : C.card;
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
                                style={{ padding:"5px 11px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f9fafb", color:"#6b7280", border:`1px solid #d1d5db` }}>
                                ✗ Decline
                              </button>
                            )}
                            {q.outcome !== "waiting" && (
                              <button onClick={()=>updateQuoteOutcome(q.timestamp,"waiting")}
                                style={{ padding:"5px 11px", fontSize:12, borderRadius:6, cursor:"pointer", background:"#f1f5f9", color:C.muted, border:`1px solid ${C.border}` }}>
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

      ) : tab === "gmail" ? (
        /* ══ GMAIL TAB ══ */
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"28px 32px" }}>
          {!gmailToken ? (
            <div style={{ textAlign:"center", padding:"80px 32px" }}>
              <div style={{ fontSize:52, marginBottom:16 }}>📬</div>
              <div style={{ fontSize:22, fontWeight:700, color:C.navy, marginBottom:8 }}>Connect Your Gmail</div>
              <div style={{ fontSize:15, color:C.muted, marginBottom:28, maxWidth:420, margin:"0 auto 28px" }}>
                Read quote requests from your inbox, auto-calculate rates, and send replies — all from here.
              </div>
              <button onClick={connectGmail}
                style={{ padding:"14px 36px", background:C.burgundy, color:"#fff", border:"none", borderRadius:8, fontSize:16, fontWeight:700, cursor:"pointer" }}>
                Connect Gmail Account
              </button>
              {!GOOGLE_CLIENT_ID && (
                <div style={{ marginTop:20, padding:"12px 20px", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:8, fontSize:13, color:"#92400e", maxWidth:480, margin:"20px auto 0" }}>
                  ⚠ Add your <strong>VITE_GOOGLE_CLIENT_ID</strong> to <code>.env</code> and restart the server first.
                </div>
              )}
            </div>
          ) : (() => {
            const quoteEmails = gmailEmails.filter(e => ["quote_ready","processing","unserviced"].includes(gmailQuotes[e.id]?.status));
            const sentEmails  = gmailEmails.filter(e => ["sent","load_sheet"].includes(gmailQuotes[e.id]?.status));
            const otherEmails = gmailEmails.filter(e => {
              const s = gmailQuotes[e.id]?.status;
              return !s || s === "error" || s === "not_quote" || s === "classified";
            });
            const CLASS_LABELS = { booking:"📦 Booking", tracking:"🔍 Tracking", check_in:"💬 Check-in", invoice:"🧾 Invoice", spam:"🗑 Spam", other:"📎 Other" };
            return (
              <>
                {/* Header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                  <div>
                    <div style={{ fontSize:20, fontWeight:700, color:C.navy }}>Gmail</div>
                    <div style={{ fontSize:13, color:C.muted }}>{gmailUser} · {gmailEmails.length} emails loaded</div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button onClick={scanAllEmails} disabled={scanningAll||gmailLoading}
                      style={{ padding:"9px 18px", background:C.navy, color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:700, cursor:scanningAll?"not-allowed":"pointer", opacity:scanningAll?0.7:1 }}>
                      {scanningAll ? "⟳ Scanning…" : "⚡ Scan All"}
                    </button>
                    <button onClick={()=>fetchInbox(gmailToken)} disabled={gmailLoading}
                      style={{ padding:"9px 16px", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, borderRadius:7, fontSize:13, cursor:"pointer" }}>
                      {gmailLoading ? "⟳" : "↻ Refresh"}
                    </button>
                    <button
                      onClick={scanAllLoadSheets}
                      disabled={scanState?.status === "scanning"}
                      style={{ padding:"9px 16px", background: scanState?.status === "scanning" ? "#e0e7ff" : "#eef2ff", color:"#4338ca", border:"1.5px solid #c7d2fe", borderRadius:7, fontSize:13, cursor: scanState?.status === "scanning" ? "default" : "pointer", fontWeight:600 }}>
                      {scanState?.status === "scanning"
                        ? `Scanning… ${scanState.processed}/${scanState.found}`
                        : scanState?.status === "done"
                        ? `✓ Scan done · ${scanState.added} added`
                        : "🔍 Scan All Emails"}
                    </button>
                    <button onClick={()=>{ setGmailToken(null); setGmailUser(null); setGmailEmails([]); setGmailQuotes({}); }}
                      style={{ padding:"9px 16px", background:"#fff", color:C.subtle, border:`1.5px solid ${C.border}`, borderRadius:7, fontSize:13, cursor:"pointer" }}>
                      Disconnect
                    </button>
                  </div>
                </div>

                {gmailLoading && !gmailEmails.length && (
                  <div style={{ textAlign:"center", padding:40, color:C.muted, fontSize:15 }}>
                    <span style={{ fontSize:24 }}>⟳</span>
                    <div style={{ marginTop:8 }}>Loading inbox…</div>
                  </div>
                )}

                {/* Two-column layout */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:20, alignItems:"start" }}>

                  {/* ── LEFT: Quote Requests ── */}
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                      📨 Quote Requests
                      <span style={{ fontSize:13, fontWeight:400, color:C.muted }}>({quoteEmails.length})</span>
                    </div>

                    {quoteEmails.length === 0 && !gmailLoading && (
                      <div style={{ ...card, textAlign:"center", padding:32, color:C.muted }}>
                        <div style={{ fontSize:24, marginBottom:8 }}>📭</div>
                        No quote requests in inbox
                      </div>
                    )}

                    {quoteEmails.map(email => {
                      const q        = gmailQuotes[email.id];
                      const hdrs     = email.payload?.headers || [];
                      const subject  = hdrs.find(h=>h.name==="Subject")?.value || "(no subject)";
                      const from     = hdrs.find(h=>h.name==="From")?.value || "";
                      const date     = hdrs.find(h=>h.name==="Date")?.value || "";
                      const fromName = from.replace(/<.*>/, "").trim() || from;
                      const isUnread = email.labelIds?.includes("UNREAD");
                      const isSending = sendingIds.has(email.id);
                      const expanded   = gmailExpandedId === email.id;
                      if (q?.status === "declined") return (
                        <div key={email.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"#f8fafc", border:`1px solid ${C.border}`, borderRadius:8, marginBottom:5, opacity:0.6 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <span style={{ fontSize:12, fontWeight:500, color:C.text }}>{fromName}</span>
                            <span style={{ fontSize:11, color:C.subtle, marginLeft:8 }}>{subject}</span>
                          </div>
                          <span style={{ fontSize:11, fontWeight:600, color:C.subtle, padding:"1px 7px", background:"#f1f5f9", borderRadius:10 }}>✗ Declined</span>
                        </div>
                      );
                      const fscVal   = q?.emailFsc ?? 0.18;
                      const accsVal  = q?.emailAccs || {};
                      const customAccVal = q?.emailCustomAcc || "";
                      const floorloaded = !!accsVal["fl"];
                      const calcSubtotal = q?.rateResult?.base ? r5(q.rateResult.base * (1 + fscVal)) : null;
                      const afterFloor   = calcSubtotal ? (floorloaded ? r5(calcSubtotal * 1.10) : calcSubtotal) : null;
                      const fixedAccs    = (accsVal["da"] ? 75 : 0) + (accsVal["lg"] ? 75 : 0) + (accsVal["nc"] ? 150 : 0) + (accsVal["st"] ? 100 : 0) + (parseFloat(customAccVal) || 0);
                      const calcTotal    = afterFloor ? r5(afterFloor + fixedAccs) : null;
                      const accList  = ACC_OPTS.filter(a => accsVal[a.id] && a.id !== "fl");

                      return (
                        <div key={email.id} style={{ ...card, padding:0, overflow:"hidden", marginBottom:10,
                          border:`1.5px solid ${expanded?"#93c5fd":q?.status==="quote_ready"?"#bbf7d0":q?.status==="unserviced"?"#fde68a":C.border}` }}>

                          {/* Collapsed header — always visible */}
                          <div onClick={()=>setGmailExpandedId(p => p===email.id ? null : email.id)}
                            style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", cursor:"pointer", background: expanded?"#f0f9ff":"#fff" }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2, flexWrap:"wrap" }}>
                                <span style={{ fontSize:13, fontWeight:isUnread?700:500, color:C.navy, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fromName}</span>
                                {q?.status === "processing" && <span style={{ fontSize:11, fontWeight:600, color:"#f59e0b", padding:"1px 7px", background:"#fffbeb", borderRadius:10 }}>Processing…</span>}
                                {q?.status === "quote_ready" && <span style={{ fontSize:11, fontWeight:600, color:C.green, padding:"1px 7px", background:"#f0fdf4", borderRadius:10 }}>Quote Ready</span>}
                                {q?.status === "unserviced" && <span style={{ fontSize:11, fontWeight:600, color:C.amber, padding:"1px 7px", background:"#fffbeb", borderRadius:10 }}>No Service</span>}
                              </div>
                              <div style={{ fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {subject} · {new Date(date).toLocaleDateString("en-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                              </div>
                              {q?.status === "quote_ready" && calcTotal && !expanded && (
                                <div style={{ fontSize:12, color:C.green, fontWeight:700, marginTop:2 }}>
                                  {q.parsed?.origin||q.parsed?.pickup_location} → {q.parsed?.dest_city}, {q.parsed?.dest_state} · {q.parsed?.skids} skids · <span style={{ color:C.amber }}>${calcTotal}</span>
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize:12, color:C.subtle, flexShrink:0 }}>{expanded ? "▲" : "▼"}</span>
                          </div>

                          {/* Expanded panel */}
                          {expanded && (
                            <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px 16px", background:"#fafcff" }}>

                              {q?.status === "processing" && (
                                <div style={{ textAlign:"center", padding:24, color:C.muted }}>⟳ Processing quote…</div>
                              )}

                              {q?.status === "unserviced" && (
                                <div style={{ padding:"12px 16px", background:"#fffbeb", borderRadius:8, color:"#92400e", fontSize:13 }}>
                                  ⚠ We don't service this area (near {q.zone||q.city}). No rate available.
                                </div>
                              )}

                              {q?.status === "quote_ready" && (
                                <>
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:16, alignItems:"start" }}>
                                  <div>{/* Left: quote controls */}
                                  {/* Shipment summary bar */}
                                  <div style={{ display:"flex", gap:14, flexWrap:"wrap", padding:"10px 14px", background:C.navy, borderRadius:8, marginBottom:14 }}>
                                    <div>
                                      <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Lane</div>
                                      <div style={{ fontSize:12, color:"#fff", fontWeight:600 }}>{q.parsed?.pickup_location||q.parsed?.origin} → {q.parsed?.dest_city}, {q.parsed?.dest_state}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Skids</div>
                                      <div style={{ fontSize:12, color:"#fff", fontWeight:600 }}>{q.parsed?.skids||"—"}</div>
                                    </div>
                                    {q.parsed?.weight_lbs && <div>
                                      <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Weight</div>
                                      <div style={{ fontSize:12, color:"#fff", fontWeight:600 }}>{Number(q.parsed.weight_lbs).toLocaleString()} lbs</div>
                                    </div>}
                                    <div>
                                      <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Base Rate</div>
                                      <div style={{ fontSize:12, color:"#fff", fontWeight:600 }}>${r5(q.rateResult.base)}</div>
                                    </div>
                                    {calcTotal && <div>
                                      <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Total ({(fscVal*100).toFixed(0)}% FSC{floorloaded?" +floor":""}) </div>
                                      <div style={{ fontSize:18, color:"#fbbf24", fontWeight:800 }}>${calcTotal} CAD</div>
                                    </div>}
                                  </div>

                                  {/* FSC selector */}
                                  <div style={{ marginBottom:12 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Fuel Surcharge (FSC)</div>
                                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                      {FSC_OPTS.map(o => (
                                        <button key={o.v} onClick={()=>updateGmailQuoteSettings(email.id, o.v, accsVal, customAccVal)}
                                          style={{ padding:"6px 12px", fontSize:12, fontWeight:fscVal===o.v?700:400, borderRadius:6, cursor:"pointer",
                                            background:fscVal===o.v?C.navy:"#f1f5f9", color:fscVal===o.v?"#fff":C.text, border:`1.5px solid ${fscVal===o.v?C.navy:C.border}` }}>
                                          {o.l}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Accessories */}
                                  <div style={{ marginBottom:12 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Accessorials</div>
                                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                      {ACC_OPTS.map(a => (
                                        <button key={a.id} onClick={()=>updateGmailQuoteSettings(email.id, fscVal, {...accsVal,[a.id]:!accsVal[a.id]}, customAccVal)}
                                          style={{ padding:"6px 12px", fontSize:12, borderRadius:6, cursor:"pointer", fontWeight:accsVal[a.id]?600:400,
                                            background:accsVal[a.id]?"#eff6ff":"#f1f5f9", color:accsVal[a.id]?"#1d4ed8":C.text, border:`1.5px solid ${accsVal[a.id]?"#93c5fd":C.border}` }}>
                                          {a.l} <span style={{ opacity:0.6, fontSize:11 }}>({a.n})</span>
                                        </button>
                                      ))}
                                    </div>
                                    <input value={customAccVal}
                                      onChange={e=>updateGmailQuoteSettings(email.id, fscVal, accsVal, e.target.value)}
                                      placeholder="Custom accessorial charge…"
                                      style={{ ...input, marginTop:6, fontSize:12 }}/>
                                  </div>

                                  {/* Editable quote text */}
                                  <textarea
                                    value={q.quoteText}
                                    onChange={e => setGmailQuotes(prev=>({...prev,[email.id]:{...prev[email.id],quoteText:e.target.value}}))}
                                    style={{ ...input, height:200, resize:"vertical", fontFamily:"'Courier New',monospace", fontSize:12, lineHeight:1.7, background:"#fff" }}
                                  />

                                  <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
                                    <button onClick={()=>sendGmailReply(email, q.quoteText)} disabled={isSending||!q.quoteText}
                                      style={{ padding:"10px 24px", background:isSending?"#94a3b8":C.green, color:"#fff", border:"none", borderRadius:7, fontSize:14, fontWeight:700, cursor:isSending?"not-allowed":"pointer" }}>
                                      {isSending ? "Sending…" : "Send Reply"}
                                    </button>
                                    <button onClick={()=>sendDeclineReply(email)} disabled={isSending}
                                      style={{ padding:"10px 18px", background:"#fff", color:C.error, border:`1.5px solid #fca5a5`, borderRadius:7, fontSize:13, fontWeight:600, cursor:isSending?"not-allowed":"pointer" }}>
                                      ✗ Decline
                                    </button>
                                    <button onClick={()=>processGmailEmail(email)}
                                      style={{ padding:"10px 16px", background:"#f1f5f9", color:C.muted, border:`1.5px solid ${C.border}`, borderRadius:7, fontSize:13, cursor:"pointer" }}>
                                      Re-process
                                    </button>
                                  </div>
                                  </div>{/* end left col */}

                                  {/* Right: original email body */}
                                  <div style={{ borderLeft:`2px solid ${C.border}`, paddingLeft:14 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Original Email</div>
                                    <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>
                                      <span style={{ fontWeight:600 }}>From:</span> {from}
                                    </div>
                                    <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>
                                      <span style={{ fontWeight:600 }}>Subject:</span> {subject}
                                    </div>
                                    <pre style={{ fontSize:11, color:C.text, whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily:"inherit", lineHeight:1.6, maxHeight:420, overflowY:"auto", background:"#f8fafc", border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 12px", margin:0 }}>
                                      {getEmailBody(email.payload) || "(No text body found)"}
                                    </pre>
                                  </div>
                                  </div>{/* end grid */}
                                </>
                              )}

                              {q?.status === "error" && (
                                <div style={{ padding:"10px 14px", background:"#fef2f2", borderRadius:8, fontSize:13, color:C.error }}>
                                  ⚠ {q.error}
                                  <button onClick={()=>processGmailEmail(email)} style={{ marginLeft:12, padding:"4px 10px", fontSize:12, background:"#fff", border:`1px solid #fca5a5`, borderRadius:5, cursor:"pointer", color:C.error }}>Retry</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Other emails — collapsed by default */}
                    {otherEmails.length > 0 && (
                      <div style={{ marginTop:16 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.subtle, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                          Other ({otherEmails.length})
                          {otherEmails.some(e => gmailQuotes[e.id]?.status === "error") && (
                            <button onClick={async () => {
                              const errored = otherEmails.filter(e => gmailQuotes[e.id]?.status === "error");
                              for (const e of errored) { await processGmailEmail(e); await new Promise(r => setTimeout(r, 1500)); }
                            }} style={{ fontSize:11, padding:"2px 8px", background:"#fef2f2", color:C.error, border:`1px solid #fca5a5`, borderRadius:5, cursor:"pointer", fontWeight:600 }}>
                              ↺ Retry All Errors
                            </button>
                          )}
                        </div>
                        {otherEmails.map(email => {
                          const q       = gmailQuotes[email.id];
                          const hdrs    = email.payload?.headers || [];
                          const subject = hdrs.find(h=>h.name==="Subject")?.value || "(no subject)";
                          const from    = hdrs.find(h=>h.name==="From")?.value || "";
                          const fromName = from.replace(/<.*>/, "").trim() || from;
                          const statusLabel = !q ? "Unprocessed" : q.status==="classified" ? (CLASS_LABELS[q.email_type]||q.email_type) : q.status==="not_quote" ? "Not a quote" : q.status==="error" ? "Error" : q.status;
                          const isError = q?.status === "error";
                          return (
                            <div key={email.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background: isError ? "#fef2f2" : "#f8fafc", border:`1px solid ${isError ? "#fca5a5" : C.border}`, borderRadius:8, marginBottom:5 }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <span style={{ fontSize:12, color:C.text, fontWeight:500 }}>{fromName}</span>
                                <span style={{ fontSize:11, color:C.subtle, marginLeft:8, overflow:"hidden", textOverflow:"ellipsis" }}>{subject}</span>
                                {isError && q.error && (
                                  <div style={{ fontSize:11, color:C.error, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>⚠ {q.error}</div>
                                )}
                              </div>
                              <span style={{ fontSize:11, color: isError ? C.error : C.subtle, whiteSpace:"nowrap", fontWeight: isError ? 600 : 400 }}>{statusLabel}</span>
                              {(!q || isError) && (
                                <button onClick={()=>processGmailEmail(email)}
                                  style={{ padding:"3px 10px", fontSize:11, background: isError ? C.error : C.navy, color:"#fff", border:"none", borderRadius:5, cursor:"pointer", flexShrink:0 }}>
                                  {isError ? "Retry" : "Process"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── RIGHT: Sent Loads ── */}
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                      📦 Sent Loads
                      <span style={{ fontSize:13, fontWeight:400, color:C.muted }}>({sentEmails.length})</span>
                    </div>

                    {sentEmails.length === 0 && (
                      <div style={{ ...card, textAlign:"center", padding:32, color:C.muted }}>
                        <div style={{ fontSize:24, marginBottom:8 }}>📤</div>
                        No quotes sent yet
                      </div>
                    )}

                    {sentEmails.map(email => {
                      const q        = gmailQuotes[email.id];
                      const hdrs     = email.payload?.headers || [];
                      const subject  = hdrs.find(h=>h.name==="Subject")?.value || "(no subject)";
                      const from     = hdrs.find(h=>h.name==="From")?.value || "";
                      const date     = hdrs.find(h=>h.name==="Date")?.value || "";
                      const fromName = from.replace(/<.*>/, "").trim() || from;
                      const isLoadSheet = q?.status === "load_sheet";
                      const isSentLoad  = q?.status === "sent_load";
                      // Match to history record by threadId or saved matchedTimestamp
                      const histMatch = (isLoadSheet || isSentLoad)
                        ? history.find(h => h.timestamp === q.matchedTimestamp) || history.find(h => h.thread_id === email.threadId)
                        : history.find(h => h.thread_id === email.threadId);
                      const outcome   = histMatch?.outcome;
                      const OUTCOME_INFO = {
                        waiting:        { label:"⏳ Waiting",         color:"#c2410c", bg:"#fff7ed" },
                        broker_sending: { label:"📬 Broker Sending",  color:"#7c3aed", bg:"#f5f3ff" },
                        received:       { label:"✓ Received",         color:C.green,   bg:"#f0fdf4" },
                        lost:           { label:"✗ Lost",             color:C.error,   bg:"#fef2f2" },
                        counter:        { label:"🔄 Counter Offer",   color:"#b45309", bg:"#fffbeb" },
                        sent_load:      { label:"🚛 Sent Load",        color:"#0369a1", bg:"#eff6ff" },
                      };
                      const oi = isSentLoad
                        ? { label:"🚛 Carrier Confirmation", color:"#0369a1", bg:"#eff6ff" }
                        : isLoadSheet
                        ? { label:"📄 Load Sheet", color:C.green, bg:"#f0fdf4" }
                        : outcome ? OUTCOME_INFO[outcome] : { label:"Sent", color:"#6366f1", bg:"#eef2ff" };
                      return (
                        <div key={email.id} style={{ ...card, padding:0, overflow:"hidden", marginBottom:8, background:oi.bg, border:`1.5px solid ${oi.color}22` }}>
                          <div style={{ display:"flex", alignItems:"stretch" }}>
                            <div style={{ width:4, background:oi.color, flexShrink:0 }}/>
                            <div style={{ flex:1, padding:"12px 14px" }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:4 }}>
                                <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>{fromName}</span>
                                <span style={{ fontSize:11, fontWeight:700, color:oi.color, whiteSpace:"nowrap" }}>{oi.label}</span>
                              </div>
                              {histMatch ? (
                                <>
                                  <div style={{ fontSize:12, color:C.text }}>{histMatch.origin} → {histMatch.dest_city}, {histMatch.dest_state}</div>
                                  <div style={{ display:"flex", gap:12, marginTop:4, alignItems:"center", flexWrap:"wrap" }}>
                                    <span style={{ fontSize:11, color:C.muted }}>{histMatch.skids} skids</span>
                                    <span style={{ fontSize:13, fontWeight:700, color:oi.color }}>${r5(histMatch.total)}</span>
                                    <span style={{ fontSize:11, color:C.subtle }}>{histMatch.date}</span>
                                    {isLoadSheet && hasPdfAttachment(email.payload) && (!histMatch.dest_city || !histMatch.total || parseFloat(histMatch.total)===0) && (
                                      <button onClick={()=>reparsePDFEmail(email, histMatch.timestamp)}
                                        disabled={q?.reparsing}
                                        style={{ padding:"3px 10px", fontSize:11, fontWeight:700, borderRadius:5, cursor:"pointer", background:"#4f46e5", color:"#fff", border:"none", opacity:q?.reparsing?0.6:1 }}>
                                        {q?.reparsing ? "⟳ Reading PDF…" : "📄 Re-parse PDF"}
                                      </button>
                                    )}
                                  </div>
                                  {/* Quick outcome buttons */}
                                  {outcome !== "received" && outcome !== "lost" && (
                                    <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
                                      <button onClick={()=>updateQuoteOutcome(histMatch.timestamp,"received")}
                                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, borderRadius:5, cursor:"pointer", background:C.green, color:"#fff", border:"none" }}>
                                        ✓ Received
                                      </button>
                                      {outcome !== "broker_sending" && (
                                        <button onClick={()=>updateQuoteOutcome(histMatch.timestamp,"broker_sending")}
                                          style={{ padding:"4px 10px", fontSize:11, borderRadius:5, cursor:"pointer", background:"#f5f3ff", color:"#7c3aed", border:`1px solid #ddd6fe` }}>
                                          📬 Broker Sending
                                        </button>
                                      )}
                                      <button onClick={()=>updateQuoteOutcome(histMatch.timestamp,"lost")}
                                        style={{ padding:"4px 10px", fontSize:11, borderRadius:5, cursor:"pointer", background:"#fff", color:C.error, border:`1px solid #fca5a5` }}>
                                        ✗ Lost
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ fontSize:11, color:C.subtle, marginTop:2 }}>{subject}</div>
                              )}
                              <div style={{ fontSize:11, color:C.subtle, marginTop:4 }}>{new Date(date).toLocaleDateString("en-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </>
            );
          })()}
        </div>

      ) : tab === "capacity" ? (
        /* ══ CAPACITY TAB ══ */
        (() => {
          const TRUCK_FT = 60;
          const boardLoads = history.filter(q => q.outcome === "received" || q.outcome === "broker_sending");

          const isFTL = (q) => q.skids === "FTL" || String(q.skids).toUpperCase() === "FTL";
          const getFootage = (q) => {
            if (isFTL(q)) return TRUCK_FT;
            if (q.footage && parseFloat(q.footage) > 0) return parseFloat(q.footage);
            return (parseInt(q.skids) || 1) * 2;
          };

          const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

          // Generate truck days from recurring schedule (next 3 weeks)
          const today = new Date();
          today.setHours(0,0,0,0);
          const generatedDays = [];
          for (let w = 0; w < 3; w++) {
            for (const rt of recurringTrucks) {
              const dow = parseInt(rt.dayOfWeek);
              const diff = (dow - today.getDay() + 7) % 7 + w * 7;
              if (diff === 0 && w === 0) { /* skip if today already passed for first week — still include it */ }
              const d = new Date(today); d.setDate(today.getDate() + diff);
              const dateStr = d.toISOString().slice(0,10);
              const alreadyManual = truckDays.some(td => td.date === dateStr && td.route.toLowerCase() === rt.route.toLowerCase());
              if (!alreadyManual) generatedDays.push({ id:`recur_${rt.id}_${dateStr}`, date:dateStr, route:rt.route, numTrucks:rt.numTrucks, driver:rt.driver||"", isRecurring:true });
            }
          }
          const allTruckDays = [...truckDays, ...generatedDays].sort((a,b) => a.date.localeCompare(b.date));

          const stateNames = {
            al:'alabama',ak:'alaska',az:'arizona',ar:'arkansas',ca:'california',
            co:'colorado',ct:'connecticut',de:'delaware',fl:'florida',ga:'georgia',
            hi:'hawaii',id:'idaho',il:'illinois',in:'indiana',ia:'iowa',
            ks:'kansas',ky:'kentucky',la:'louisiana',me:'maine',md:'maryland',
            ma:'massachusetts',mi:'michigan',mn:'minnesota',ms:'mississippi',
            mo:'missouri',mt:'montana',ne:'nebraska',nv:'nevada',nh:'new hampshire',
            nj:'new jersey',nm:'new mexico',ny:'new york',nc:'north carolina',
            nd:'north dakota',oh:'ohio',ok:'oklahoma',or:'oregon',pa:'pennsylvania',
            ri:'rhode island',sc:'south carolina',sd:'south dakota',tn:'tennessee',
            tx:'texas',ut:'utah',vt:'vermont',va:'virginia',wa:'washington',
            wv:'west virginia',wi:'wisconsin',wy:'wyoming',on:'ontario',qc:'quebec',
          };

          const routeScore = (load, td) => {
            const route = (td.route || "").toLowerCase();
            const abbr  = (load.dest_state || "").toLowerCase();
            const city  = (load.dest_city  || "").toLowerCase();
            const full  = stateNames[abbr] || abbr;
            if (route.includes(abbr) || route.includes(full)) return 2;
            if (city && route.includes(city)) return 1;
            return 0;
          };

          // Returns true if a truck day is driven by a Texas-local-only driver
          const isLocalTxDay = (td) => {
            if (!td.driver) return false;
            const dr = drivers.find(d => d.name.toLowerCase() === td.driver.toLowerCase());
            if (!dr) return false;
            const cats = Array.isArray(dr.category) ? dr.category : [dr.category || "crossborder"];
            return cats.includes("local_tx") && !cats.includes("crossborder");
          };

          // Global auto-assign: confirmed loads first, then highest value
          const truckSlots = {};
          allTruckDays.forEach(td => {
            truckSlots[td.id] = Array.from({length: td.numTrucks}, (_,i) => ({num:i+1, footage:0, loads:[]}));
          });

          const sortedLoads = [...boardLoads].sort((a,b) => {
            if (a.outcome !== b.outcome) return a.outcome === "received" ? -1 : 1;
            return (parseFloat(b.total)||0) - (parseFloat(a.total)||0);
          });

          // Deduplicate loads by timestamp so the same shipment can never be placed twice
          const seenTimestamps = new Set();
          const uniqueLoads = sortedLoads.filter(l => {
            if (seenTimestamps.has(l.timestamp)) return false;
            seenTimestamps.add(l.timestamp);
            return true;
          });

          const assignedSet = new Set();
          for (const load of uniqueLoads) {
            const ft = getFootage(load);
            const ftl = isFTL(load);
            const usedFt = Math.min(ft, TRUCK_FT);
            const pickupDate = load.pickup_date || load.date || "";
            const scored = allTruckDays
              .map(td => ({ td, score: routeScore(load, td) }))
              .filter(({td}) => !pickupDate || pickupDate <= td.date)
              .filter(({td}) => !truckExclusions[`${td.id}:${load.timestamp}`])
              .filter(({score}) => score > 0)
              .sort((a,b) => b.score - a.score || a.td.date.localeCompare(b.td.date));
            for (const {td} of scored) {
              const truck = truckSlots[td.id].find(t => {
                if (t.footage + usedFt > TRUCK_FT) return false; // LTL cap: 60ft per truck
                if (t.hasFTL) return false;
                if (ftl && t.footage > 0) return false;
                return true;
              });
              if (truck) {
                truck.footage += usedFt;
                truck.loads.push({...load, _ft: usedFt});
                if (ftl) truck.hasFTL = true;
                assignedSet.add(load.timestamp);
                break;
              }
            }
          }

          const unassigned = boardLoads.filter(l => !assignedSet.has(l.timestamp));

          const FtBar = ({used, total=TRUCK_FT}) => {
            const pct = Math.min(100,(used/total)*100);
            const color = pct>90?C.error:pct>70?"#f59e0b":C.green;
            return (
              <div style={{marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:3}}>
                  <span>{used.toFixed(1)} / {total} ft</span>
                  <span style={{color,fontWeight:700}}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{height:6,background:"#e2e8f0",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.3s"}}/>
                </div>
              </div>
            );
          };

          return (
            <div style={{maxWidth:1400,margin:"0 auto",padding:"28px 32px"}}>
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:16,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:22,fontWeight:800,color:C.navy}}>Capacity</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:2}}>
                    {history.filter(q=>q.outcome==="received").length} confirmed · {history.filter(q=>q.outcome==="broker_sending").length} incoming · {allTruckDays.reduce((s,t)=>s+t.numTrucks,0)} trucks scheduled · {drivers.length} drivers
                  </div>
                </div>
                {capacityTab === "planner" && (
                <div style={{...card,padding:"16px 20px",marginBottom:0,display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:4}}>Date</div>
                    <input type="date" value={newTruckDate} onChange={e=>setNewTruckDate(e.target.value)} style={{...input,width:150,fontSize:13}}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:4}}>Route / Destination</div>
                    <input value={newTruckRoute} onChange={e=>setNewTruckRoute(e.target.value)} placeholder="e.g. Tennessee"
                      style={{...input,width:180,fontSize:13}}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:4}}>Trucks</div>
                    <input type="number" min={1} max={20} value={newTruckCount} onChange={e=>setNewTruckCount(Math.max(1,parseInt(e.target.value)||1))}
                      style={{...input,width:70,fontSize:13}}/>
                  </div>
                  <button disabled={!newTruckDate} onClick={async () => {
                    if (!newTruckDate) return;
                    const td = {id:`td_${Date.now()}`,date:newTruckDate,route:newTruckRoute.trim()||newTruckDate,numTrucks:newTruckCount};
                    await saveTruckDay(td);
                    setNewTruckDate(""); setNewTruckRoute(""); setNewTruckCount(1);
                  }} style={{padding:"10px 20px",background:newTruckDate?C.navy:"#cbd5e1",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:newTruckDate?"pointer":"not-allowed"}}>
                    + Add Truck
                  </button>
                </div>
                )}
              </div>

              {/* Sub-tab bar */}
              <div style={{display:"flex",gap:4,marginBottom:20,background:"#f1f5f9",borderRadius:10,padding:4,width:"fit-content"}}>
                {[["planner","Planner"],["drivers",`Drivers (${drivers.length})`]].map(([t,l])=>(
                  <button key={t} onClick={()=>setCapacityTab(t)}
                    style={{padding:"7px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",border:"none",transition:"all 0.15s",
                      background:capacityTab===t?"#fff":"transparent",
                      color:capacityTab===t?C.navy:C.muted,
                      boxShadow:capacityTab===t?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>
                    {l}
                  </button>
                ))}
              </div>

              {capacityTab === "drivers" && <>
              <div style={{...card, marginBottom:20, padding:"18px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:drivers.length>0||driverFormOpen?12:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.navy}}>Drivers</div>
                  <button onClick={()=>setDriverFormOpen(v=>!v)}
                    style={{padding:"6px 14px",background:driverFormOpen?"#f1f5f9":C.navy,color:driverFormOpen?C.navy:"#fff",border:`1px solid ${driverFormOpen?C.border:"transparent"}`,borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {driverFormOpen ? "Cancel" : "+ Add Driver"}
                  </button>
                </div>

                {/* Driver list grouped by category */}
                {drivers.length > 0 && (
                  <div style={{marginBottom:driverFormOpen?16:0}}>
                    {[["crossborder","Cross-Border","#1e3a5f","#e8f0fe"],["local","Local","#14532d","#f0fdf4"],["local_tx","Local Texas","#7c2d12","#fff7ed"],["sprinter","Sprinter","#4a1d96","#f5f3ff"]].map(([cat,label,color,bg])=>{
                      const PRIORITY = ["crossborder","local_tx","sprinter","local"];
                      const getCats = d => Array.isArray(d.category) ? d.category : [d.category||"crossborder"];
                      const getPrimary = d => PRIORITY.find(c => getCats(d).includes(c)) || "crossborder";
                      const group = drivers.filter(d => getPrimary(d) === cat);
                      if (group.length===0) return null;
                      return (
                        <div key={cat} style={{marginBottom:16}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"6px 12px",background:bg,borderRadius:8,border:`1px solid ${color}20`}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                            <span style={{fontSize:12,fontWeight:800,color:color,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
                            <span style={{fontSize:11,color:color,opacity:0.7,fontWeight:600}}>· {group.length} driver{group.length!==1?"s":""}</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:5}}>
                            {group.map((dr,idx) => {
                      const isOO    = dr.driverType === "owner_op";
                      const isDock  = !!dr.worksDock;
                      const isOOS   = !!dr.outOfService;
                      const palette = ["#4f46e5","#0891b2","#059669","#d97706","#dc2626","#0284c7","#16a34a"];
                      const accent  = isOOS ? "#991b1b" : isOO ? "#7c3aed" : isDock ? "#0e7490" : palette[idx % palette.length];
                      const initials = dr.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
                      const rowBorder = editingDriverId===dr.id ? "#6366f1" : isOOS ? "#fca5a5" : isOO ? "#c4b5fd" : isDock ? "#67e8f9" : "#e2e8f0";
                      const rowBg     = isOOS ? "#fef2f2" : isOO ? "#faf5ff" : isDock ? "#ecfeff" : "#fff";
                      return (
                        <div key={dr.id} style={{borderRadius:10,overflow:"hidden",
                          border:`1.5px solid ${rowBorder}`,
                          background: rowBg}}>
                          {editingDriverId === dr.id ? (
                            /* ── Edit form ── */
                            <div style={{padding:"16px"}}>
                              <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:12}}>Edit Driver</div>
                              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:5}}>Name</div>
                                  <input value={editDriverName} onChange={e=>setEditDriverName(e.target.value)} style={{...input,width:200,fontSize:13}}/>
                                </div>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:5}}>Truck #</div>
                                  <input value={editDriverTruck} onChange={e=>setEditDriverTruck(e.target.value)} placeholder="e.g. 12"
                                    style={{...input,width:100,fontSize:13}}/>
                                </div>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:5}}>Driver Type</div>
                                  <div style={{display:"flex",gap:6}}>
                                    {[["company","Company Driver"],["owner_op","Owner Operator"]].map(([v,l])=>(
                                      <button key={v} onClick={()=>setEditDriverType(v)}
                                        style={{padding:"6px 12px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",border:`1.5px solid ${editDriverType===v?accent:"#e2e8f0"}`,background:editDriverType===v?accent:"#f8fafc",color:editDriverType===v?"#fff":"#64748b"}}>
                                        {l}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:5}}>Truck Type</div>
                                  <div style={{display:"flex",gap:6}}>
                                    {[["semi","Semi (53 ft)"],["straight","Straight Truck (24 ft)"]].map(([v,l])=>(
                                      <button key={v} onClick={()=>setEditDriverTruckType(v)}
                                        style={{padding:"6px 12px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",border:`1.5px solid ${editDriverTruckType===v?accent:"#e2e8f0"}`,background:editDriverTruckType===v?accent:"#f8fafc",color:editDriverTruckType===v?"#fff":"#64748b"}}>
                                        {l}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:5}}>Category</div>
                                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                    {[["crossborder","Cross-Border"],["local","Local"],["local_tx","Local Texas"],["sprinter","Sprinter"]].map(([v,l])=>{
                                      const on=(editDriverCategory||[]).includes(v);
                                      return (
                                        <button key={v} onClick={()=>setEditDriverCategory(prev=>{
                                          const arr=Array.isArray(prev)?prev:[prev||"crossborder"];
                                          return on?arr.filter(x=>x!==v):[...arr,v];
                                        })}
                                          style={{padding:"6px 12px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",
                                            border:`1.5px solid ${on?accent:"#e2e8f0"}`,
                                            background:on?accent:"#f8fafc",
                                            color:on?"#fff":"#64748b"}}>
                                          {l}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:5}}>Departure Days</div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                    {DAYS.map((d,i)=>{
                                      const on=(editDriverDays||[]).includes(i);
                                      return (
                                        <button key={i} onClick={()=>setEditDriverDays(prev=>(prev||[]).includes(i)?prev.filter(x=>x!==i):[...(prev||[]),i])}
                                          style={{padding:"5px 10px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",border:`1.5px solid ${on?accent:"#e2e8f0"}`,background:on?accent:"#f8fafc",color:on?"#fff":"#64748b"}}>
                                          {d.slice(0,3)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div style={{display:"flex",gap:14,marginTop:10}}>
                                    <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                                      <input type="checkbox" checked={editDriverPartTime} onChange={e=>setEditDriverPartTime(e.target.checked)} style={{width:15,height:15,accentColor:"#4f46e5"}}/>
                                      <span style={{fontSize:12,fontWeight:600,color:C.text}}>Part Time</span>
                                    </label>
                                    <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                                      <input type="checkbox" checked={editDriverDock} onChange={e=>setEditDriverDock(e.target.checked)} style={{width:15,height:15,accentColor:"#4f46e5"}}/>
                                      <span style={{fontSize:12,fontWeight:600,color:C.text}}>Works the Dock</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                              {(Array.isArray(editDriverCategory)?editDriverCategory:[editDriverCategory||"crossborder"]).includes("local") && !(Array.isArray(editDriverCategory)?editDriverCategory:[editDriverCategory||"crossborder"]).some(c=>["crossborder","local_tx","sprinter"].includes(c)) ? (
                                <div style={{marginBottom:12,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:16}}>🍁</span>
                                  <span style={{fontSize:13,fontWeight:700,color:"#14532d"}}>Ontario Only — no cross-border routes</span>
                                </div>
                              ) : (
                              <div style={{marginBottom:12}}>
                                <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:7}}>
                                  Preferred Lanes{(Array.isArray(editDriverCategory)?editDriverCategory:[editDriverCategory]).includes("local_tx")&&!(Array.isArray(editDriverCategory)?editDriverCategory:[editDriverCategory]).includes("crossborder")?" (Texas Only)":""}
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                                  {RATE_CITIES.filter(c=>{const ec=Array.isArray(editDriverCategory)?editDriverCategory:[editDriverCategory]; return (ec.includes("local_tx")&&!ec.includes("crossborder"))?c.state==="TX":true;}).map(c=>{
                                    const label=`${c.city}, ${c.state}`;
                                    const on=editDriverLanes.includes(label);
                                    return (
                                      <button key={label} onClick={()=>setEditDriverLanes(prev=>on?prev.filter(l=>l!==label):[...prev,label])}
                                        style={{padding:"4px 11px",fontSize:12,fontWeight:600,borderRadius:20,cursor:"pointer",transition:"all 0.15s",
                                          background:on?accent:"#f8fafc",color:on?"#fff":"#64748b",border:`1.5px solid ${on?accent:"#e2e8f0"}`}}>
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              )}
                              <div style={{display:"flex",gap:8}}>
                                <button onClick={async()=>{
                                  await saveDriver({...dr,name:editDriverName.trim()||dr.name,truckNumber:editDriverTruck.trim(),departureDays:editDriverDays,defaultDay:(editDriverDays||[])[0]??null,driverType:editDriverType,truckType:editDriverTruckType,category:editDriverCategory,outOfService:editDriverOOS,partTime:editDriverPartTime,worksDock:editDriverDock,lanes:editDriverLanes});
                                  setEditingDriverId(null);
                                }} style={{padding:"7px 18px",background:C.navy,color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                                  Save
                                </button>
                                <button onClick={()=>setEditingDriverId(null)}
                                  style={{padding:"7px 14px",background:"#f1f5f9",color:C.navy,border:"1px solid #e2e8f0",borderRadius:7,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                                  Cancel
                                </button>
                                <button onClick={()=>{ deleteDriver(dr.id); setEditingDriverId(null); }}
                                  style={{padding:"7px 14px",background:"none",color:C.error,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",marginLeft:"auto"}}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Compact view row ── */
                            <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px"}}>
                              {/* Accent dot + initials */}
                              <div style={{width:32,height:32,borderRadius:"50%",background:accent,display:"flex",alignItems:"center",
                                justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>
                                {initials}
                              </div>
                              {/* Name + truck # */}
                              <div style={{minWidth:140,flexShrink:0}}>
                                <div style={{fontSize:13,fontWeight:700,color:C.navy}}>{dr.name}</div>
                                {dr.truckNumber && <div style={{fontSize:11,color:C.muted}}>Truck #{dr.truckNumber}</div>}
                              </div>
                              {/* Meta badges */}
                              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                                {(dr.departureDays||[]).map(d=>(
                                  <span key={d} style={{fontSize:11,fontWeight:600,color:accent,background:`${accent}15`,padding:"2px 8px",borderRadius:20,border:`1px solid ${accent}30`}}>{DAYS[d].slice(0,3)}</span>
                                ))}
                                {!(dr.departureDays||[]).length && dr.defaultDay!=null && <span style={{fontSize:11,fontWeight:600,color:accent,background:`${accent}15`,padding:"2px 8px",borderRadius:20,border:`1px solid ${accent}30`}}>{DAYS[dr.defaultDay].slice(0,3)}</span>}
                                {isOOS && <span style={{fontSize:11,fontWeight:800,color:"#991b1b",background:"#fee2e2",padding:"2px 9px",borderRadius:20,border:"1px solid #fca5a5",letterSpacing:"0.03em"}}>OUT OF SERVICE</span>}
                                {!isOOS && dr.driverType==="owner_op" && <span style={{fontSize:11,fontWeight:700,color:"#7c3aed",background:"#ede9fe",padding:"2px 8px",borderRadius:20,border:"1px solid #c4b5fd"}}>O/O</span>}
                                {!isOOS && (Array.isArray(dr.category)?dr.category:[dr.category||"crossborder"]).includes("local")&&(Array.isArray(dr.category)?dr.category:[dr.category]).includes("crossborder") && <span style={{fontSize:11,fontWeight:700,color:"#14532d",background:"#dcfce7",padding:"2px 8px",borderRadius:20,border:"1px solid #86efac"}}>+ Local</span>}
                                {dr.partTime && <span style={{fontSize:11,fontWeight:600,color:"#d97706",background:"#fef3c7",padding:"2px 8px",borderRadius:20,border:"1px solid #fde68a"}}>PT</span>}
                                {dr.worksDock && <span style={{fontSize:11,fontWeight:600,color:"#0891b2",background:"#e0f2fe",padding:"2px 8px",borderRadius:20,border:"1px solid #bae6fd"}}>Dock</span>}
                                {dr.truckType==="straight" && <span style={{fontSize:11,fontWeight:700,color:"#b45309",background:"#fef3c7",padding:"2px 8px",borderRadius:20,border:"1px solid #fcd34d"}}>24 ft</span>}
                              </div>
                              {/* Lanes */}
                              <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
                                {(()=>{
                                  const cats = Array.isArray(dr.category) ? dr.category : [dr.category||"crossborder"];
                                  const isLocalOnly = cats.includes("local") && !cats.some(c=>["crossborder","local_tx","sprinter"].includes(c));
                                  return isLocalOnly
                                    ? <span style={{fontSize:11,fontWeight:700,color:"#14532d",background:"#dcfce7",padding:"2px 9px",borderRadius:20,border:"1px solid #86efac"}}>🍁 Ontario Only</span>
                                    : (dr.lanes||[]).map(l=>(
                                        <span key={l} style={{fontSize:11,fontWeight:600,color:accent,background:`${accent}12`,padding:"2px 8px",borderRadius:20,border:`1px solid ${accent}30`}}>{l}</span>
                                      ));
                                })()}
                              </div>
                              {/* OOS toggle */}
                              <button onClick={async()=>{ await saveDriver({...dr,outOfService:!isOOS}); }}
                                style={{padding:"4px 10px",background:isOOS?"#fee2e2":"#f1f5f9",color:isOOS?"#991b1b":C.muted,border:`1px solid ${isOOS?"#fca5a5":"#e2e8f0"}`,borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                                {isOOS ? "Restore" : "Out of Service"}
                              </button>
                              {/* Edit button */}
                              <button onClick={()=>{ setEditingDriverId(dr.id); setEditDriverName(dr.name); setEditDriverDays(dr.departureDays||(dr.defaultDay!=null?[dr.defaultDay]:[])); setEditDriverType(dr.driverType||"company"); setEditDriverTruckType(dr.truckType||"semi"); setEditDriverCategory(Array.isArray(dr.category)?dr.category:[dr.category||"crossborder"]); setEditDriverOOS(!!dr.outOfService); setEditDriverPartTime(!!dr.partTime); setEditDriverDock(!!dr.worksDock); setEditDriverTruck(dr.truckNumber||""); setEditDriverLanes(dr.lanes||[]); }}
                                style={{padding:"4px 12px",background:"#f1f5f9",color:C.navy,border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add driver form */}
                {driverFormOpen && (
                  <div style={{padding:"16px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10}}>
                    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:14}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:6}}>Driver Name</div>
                        <input value={newDriverName} onChange={e=>setNewDriverName(e.target.value)} placeholder="e.g. Mike Johnson"
                          style={{...input,width:220,fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:6}}>Truck #</div>
                        <input value={newDriverTruck} onChange={e=>setNewDriverTruck(e.target.value)} placeholder="e.g. 12"
                          style={{...input,width:100,fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:6}}>Driver Type</div>
                        <div style={{display:"flex",gap:6}}>
                          {[["company","Company Driver"],["owner_op","Owner Operator"]].map(([v,l])=>(
                            <button key={v} onClick={()=>setNewDriverType(v)}
                              style={{padding:"6px 12px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",border:`1.5px solid ${newDriverType===v?"#4f46e5":"#e2e8f0"}`,background:newDriverType===v?"#4f46e5":"#f8fafc",color:newDriverType===v?"#fff":"#64748b"}}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:6}}>Truck Type</div>
                        <div style={{display:"flex",gap:6}}>
                          {[["semi","Semi (53 ft)"],["straight","Straight Truck (24 ft)"]].map(([v,l])=>(
                            <button key={v} onClick={()=>setNewDriverTruckType(v)}
                              style={{padding:"6px 12px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",border:`1.5px solid ${newDriverTruckType===v?"#4f46e5":"#e2e8f0"}`,background:newDriverTruckType===v?"#4f46e5":"#f8fafc",color:newDriverTruckType===v?"#fff":"#64748b"}}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:6}}>Category</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {[["crossborder","Cross-Border"],["local","Local"],["local_tx","Local Texas"],["sprinter","Sprinter"]].map(([v,l])=>{
                            const on=(newDriverCategory||[]).includes(v);
                            return (
                              <button key={v} onClick={()=>setNewDriverCategory(prev=>{
                                const arr=Array.isArray(prev)?prev:[prev||"crossborder"];
                                return on?arr.filter(x=>x!==v):[...arr,v];
                              })}
                                style={{padding:"6px 12px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",
                                  border:`1.5px solid ${on?"#4f46e5":"#e2e8f0"}`,
                                  background:on?"#4f46e5":"#f8fafc",
                                  color:on?"#fff":"#64748b"}}>
                                {l}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:6}}>Departure Days</div>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                          {DAYS.map((d,i)=>{
                            const on=newDriverDays.includes(i);
                            return (
                              <button key={i} onClick={()=>setNewDriverDays(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i])}
                                style={{padding:"5px 10px",fontSize:12,fontWeight:700,borderRadius:7,cursor:"pointer",border:`1.5px solid ${on?"#4f46e5":"#e2e8f0"}`,background:on?"#4f46e5":"#f8fafc",color:on?"#fff":"#64748b"}}>
                                {d.slice(0,3)}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{display:"flex",gap:14,marginTop:8}}>
                          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                            <input type="checkbox" checked={newDriverPartTime} onChange={e=>setNewDriverPartTime(e.target.checked)} style={{width:15,height:15,accentColor:"#4f46e5"}}/>
                            <span style={{fontSize:12,fontWeight:600,color:C.text}}>Part Time</span>
                          </label>
                          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                            <input type="checkbox" checked={newDriverDock} onChange={e=>setNewDriverDock(e.target.checked)} style={{width:15,height:15,accentColor:"#4f46e5"}}/>
                            <span style={{fontSize:12,fontWeight:600,color:C.text}}>Works the Dock</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    {(newDriverCategory||[]).includes("local") && !(newDriverCategory||[]).some(c=>["crossborder","local_tx","sprinter"].includes(c)) ? (
                      <div style={{marginBottom:14,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:16}}>🍁</span>
                        <span style={{fontSize:13,fontWeight:700,color:"#14532d"}}>Ontario Only — no cross-border routes</span>
                      </div>
                    ) : (
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:8}}>
                        Preferred Lanes{(newDriverCategory||[]).includes("local_tx")&&!(newDriverCategory||[]).includes("crossborder")?" (Texas Only)":""}
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                        {RATE_CITIES.filter(c=>(newDriverCategory||[]).includes("local_tx")&&!(newDriverCategory||[]).includes("crossborder")?c.state==="TX":true).map(c => {
                          const label = `${c.city}, ${c.state}`;
                          const on = newDriverLanes.includes(label);
                          return (
                            <button key={label} onClick={()=>setNewDriverLanes(prev=>on?prev.filter(l=>l!==label):[...prev,label])}
                              style={{padding:"5px 12px",fontSize:12,fontWeight:600,borderRadius:20,cursor:"pointer",transition:"all 0.15s",
                                background:on?"#4f46e5":"#fff", color:on?"#fff":"#64748b",
                                border:`1.5px solid ${on?"#4f46e5":"#cbd5e1"}`}}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    )}
                    <button onClick={async () => {
                      if (!newDriverName.trim()) return;
                      await saveDriver({id:`drv_${Date.now()}`,name:newDriverName.trim(),truckNumber:newDriverTruck.trim(),lanes:newDriverLanes,departureDays:newDriverDays,defaultDay:newDriverDays[0]??null,driverType:newDriverType,truckType:newDriverTruckType,category:newDriverCategory,partTime:newDriverPartTime,worksDock:newDriverDock});
                      setNewDriverName(""); setNewDriverTruck(""); setNewDriverLanes([]); setNewDriverDays([]); setNewDriverPartTime(false); setNewDriverDock(false); setNewDriverType("company"); setNewDriverTruckType("semi"); setNewDriverCategory(["crossborder"]); setDriverFormOpen(false);
                    }} style={{padding:"9px 20px",background:C.navy,color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                      Save Driver
                    </button>
                  </div>
                )}
              </div>

              </>}

              {capacityTab === "planner" && <>
              {/* Weekly recurring schedule */}
              <div style={{...card, marginBottom:20, padding:"18px 20px"}}>
                <div style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:12}}>Weekly Schedule</div>
                {recurringTrucks.length > 0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                    {recurringTrucks.map(rt => (
                      <div key={rt.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:8}}>
                        <span style={{fontSize:12,fontWeight:700,color:C.navy}}>{DAYS[rt.dayOfWeek]}</span>
                        <span style={{fontSize:12,color:C.text}}>{rt.route}</span>
                        {rt.driver && <span style={{fontSize:12,color:"#4f46e5",fontWeight:600}}>· {rt.driver}</span>}
                        <span style={{fontSize:11,color:C.muted}}>×{rt.numTrucks}</span>
                        <button onClick={()=>deleteRecurringTruck(rt.id)} style={{background:"none",border:"none",color:C.error,cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:4}}>Day of Week</div>
                    <select value={newRecurDow} onChange={e=>setNewRecurDow(e.target.value)} style={{...input,width:140,fontSize:13}}>
                      {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:4}}>Route / Destination</div>
                    <AutocompleteInput
                      value={newRecurRoute}
                      onChange={setNewRecurRoute}
                      placeholder="e.g. Tennessee"
                      inputStyle={{...input, width:180, fontSize:13}}
                      suggestions={RATE_CITIES.map(c=>`${c.city}, ${c.state}`)}
                    />
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:4}}>Driver</div>
                    <AutocompleteInput
                      value={newRecurDriver}
                      onChange={v => {
                        setNewRecurDriver(v);
                        const match = drivers.find(d => d.name.toLowerCase() === v.toLowerCase());
                        if (match) {
                          if (match.lanes?.length > 0) setNewRecurRoute(match.lanes[0]);
                          if (match.defaultDay !== undefined) setNewRecurDow(String(match.defaultDay));
                        }
                      }}
                      placeholder="Driver name"
                      inputStyle={{...input, width:150, fontSize:13}}
                      suggestions={drivers.map(d => d.name)}
                    />
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.subtle,textTransform:"uppercase",marginBottom:4}}>Trucks</div>
                    <input type="number" min={1} max={20} value={newRecurCount} onChange={e=>setNewRecurCount(Math.max(1,parseInt(e.target.value)||1))}
                      style={{...input,width:70,fontSize:13}}/>
                  </div>
                  <button onClick={async () => {
                    if (!newRecurRoute.trim()) return;
                    const rt = {id:`rt_${Date.now()}`,dayOfWeek:parseInt(newRecurDow),route:newRecurRoute.trim(),numTrucks:newRecurCount,driver:newRecurDriver.trim()};
                    await saveRecurringTruck(rt);
                    setNewRecurRoute(""); setNewRecurCount(1); setNewRecurDriver("");
                  }} style={{padding:"10px 20px",background:C.navy,color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                    + Add Weekly Truck
                  </button>
                </div>
              </div>

              {allTruckDays.length === 0 && boardLoads.length === 0 && (
                <div style={{...card,textAlign:"center",padding:60,color:C.muted}}>
                  <div style={{fontSize:36,marginBottom:12}}>🚛</div>
                  <div style={{fontSize:18,fontWeight:700,color:C.navy,marginBottom:6}}>No capacity planned yet</div>
                  <div style={{fontSize:14}}>Add a weekly truck above — loads auto-assign to the best matching route.</div>
                </div>
              )}

              {/* Truck day cards */}
              {allTruckDays.map(td => {
                const trucks = truckSlots[td.id] || [];
                const totalUsed = trucks.reduce((s,t)=>s+t.footage,0);
                const totalCap  = td.numTrucks * TRUCK_FT;
                const fillPct   = totalCap > 0 ? totalUsed/totalCap : 0;
                const accentColor = fillPct>0.9?"#ef4444":fillPct>0.7?"#f59e0b":"#10b981";
                const dateObj = new Date(td.date+"T12:00:00");
                const dayName = dateObj.toLocaleDateString("en-CA",{weekday:"long"});
                const dateLabel = dateObj.toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"});
                return (
                  <div key={td.id} style={{marginBottom:24,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.08)",border:"1px solid #e2e8f0"}}>
                    {/* Header */}
                    <div style={{background:`linear-gradient(135deg, ${C.navy} 0%, #1e3a5f 100%)`,padding:"16px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:16}}>
                        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:56}}>
                          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.08em"}}>{dayName.slice(0,3)}</div>
                          <div style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1}}>{dateObj.getDate()}</div>
                        </div>
                        <div>
                          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{dayName}, {dateLabel}</div>
                          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2,display:"flex",alignItems:"center",gap:8}}>
                            <span>📍 {td.route}</span>
                            {td.driver && <><span style={{opacity:0.4}}>·</span><span>🚛 {td.driver}</span></>}
                            <span style={{opacity:0.4}}>·</span>
                            <span>{td.numTrucks} truck{td.numTrucks>1?"s":""}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        {/* Capacity pill */}
                        <div style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",minWidth:130}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:600}}>CAPACITY</span>
                            <span style={{fontSize:13,fontWeight:800,color:accentColor}}>{(fillPct*100).toFixed(0)}%</span>
                          </div>
                          <div style={{height:6,background:"rgba(255,255,255,0.12)",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${Math.min(100,fillPct*100)}%`,background:accentColor,borderRadius:3,transition:"width 0.4s"}}/>
                          </div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:4}}>{totalUsed.toFixed(0)} / {totalCap} ft used</div>
                        </div>
                        {/* Action buttons */}
                        {td.isRecurring ? (
                          <div style={{display:"flex",gap:6}}>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.08)",padding:"6px 12px",borderRadius:8,fontWeight:600}}>Weekly</span>
                            <button onClick={async()=>{
                              const override={id:`td_override_${td.date}_${Date.now()}`,date:td.date,route:td.route,numTrucks:td.numTrucks,driver:td.driver||""};
                              await saveTruckDay(override);
                              setEditingTruckDayId(override.id); setEditTruckCount(override.numTrucks); setEditTruckRoute(override.route);
                            }} style={{padding:"6px 14px",background:"rgba(251,191,36,0.15)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.35)",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                              Override
                            </button>
                          </div>
                        ) : editingTruckDayId === td.id ? (
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <input value={editTruckRoute} onChange={e=>setEditTruckRoute(e.target.value)} placeholder="Route"
                              style={{padding:"6px 10px",background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.25)",borderRadius:8,fontSize:12,width:130}}/>
                            <input type="number" min={1} max={20} value={editTruckCount} onChange={e=>setEditTruckCount(Math.max(1,parseInt(e.target.value)||1))}
                              style={{padding:"6px 8px",background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.25)",borderRadius:8,fontSize:12,width:52}}/>
                            <button onClick={async()=>{await saveTruckDay({...td,route:editTruckRoute,numTrucks:editTruckCount});setEditingTruckDayId(null);}}
                              style={{padding:"6px 12px",background:"#22c55e",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button>
                            <button onClick={()=>setEditingTruckDayId(null)}
                              style={{padding:"6px 10px",background:"rgba(255,255,255,0.08)",color:"#fff",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,fontSize:12,cursor:"pointer"}}>✕</button>
                          </div>
                        ) : (
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>{setEditingTruckDayId(td.id);setEditTruckCount(td.numTrucks);setEditTruckRoute(td.route);}}
                              style={{padding:"6px 14px",background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit</button>
                            <button onClick={()=>deleteTruckDay(td.id)}
                              style={{padding:"6px 14px",background:"rgba(239,68,68,0.15)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>Remove</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Truck slots */}
                    <div style={{background:"#f8fafc",padding:"16px 20px"}}>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
                        {trucks.map(truck => {
                          const slotFill = truck.footage / TRUCK_FT;
                          const slotColor = slotFill>0.9?"#ef4444":slotFill>0.7?"#f59e0b":"#10b981";
                          const isEmpty = truck.loads.length === 0;
                          return (
                            <div key={truck.num} style={{borderRadius:12,overflow:"hidden",background:"#fff",boxShadow:"0 1px 6px rgba(0,0,0,0.06)",border:`1px solid ${isEmpty?"#e8edf2":slotFill>0.9?"#fecaca":slotFill>0.7?"#fde68a":"#bbf7d0"}`}}>
                              {/* Slot header */}
                              <div style={{padding:"10px 14px",background:isEmpty?"#f1f5f9":`linear-gradient(135deg,${C.navy},#1e3a5f)`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                                  <span style={{fontSize:16}}>🚛</span>
                                  <AutocompleteInput
                                    value={slotDrivers[`${td.id}:${truck.num}`] ?? (td.driver || "")}
                                    onChange={val=>{
                                      const key=`${td.id}:${truck.num}`;
                                      setSlotDrivers(prev=>{const next={...prev,[key]:val};window.storage.set("bdr_slot_drivers",JSON.stringify(next));return next;});
                                    }}
                                    suggestions={drivers.filter(d=>!d.outOfService).map(d=>d.name)}
                                    placeholder={`Truck ${truck.num}`}
                                    inputStyle={{fontSize:13,fontWeight:700,background:"transparent",border:"none",borderBottom:`1px solid ${isEmpty?"#cbd5e1":"rgba(255,255,255,0.3)"}`,color:isEmpty?C.subtle:"#fff",outline:"none",width:"100%",padding:"2px 0"}}
                                  />
                                </div>
                                <span style={{fontSize:11,fontWeight:600,color:isEmpty?C.subtle:"rgba(255,255,255,0.6)",whiteSpace:"nowrap",background:isEmpty?"#e2e8f0":"rgba(255,255,255,0.1)",padding:"2px 8px",borderRadius:20}}>
                                  {truck.loads.length} load{truck.loads.length!==1?"s":""}
                                </span>
                              </div>
                              {/* Capacity bar */}
                              <div style={{padding:"10px 14px 0"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                                  <span style={{fontSize:11,color:C.muted}}>{truck.footage.toFixed(0)} / {TRUCK_FT} ft</span>
                                  <span style={{fontSize:12,fontWeight:700,color:slotColor}}>{(slotFill*100).toFixed(0)}%</span>
                                </div>
                                <div style={{height:6,background:"#f1f5f9",borderRadius:3,overflow:"hidden",marginBottom:isEmpty?10:0}}>
                                  <div style={{height:"100%",width:`${Math.min(100,slotFill*100)}%`,background:slotColor,borderRadius:3,transition:"width 0.4s"}}/>
                                </div>
                              </div>
                              {/* Loads */}
                              {isEmpty ? (
                                <div style={{padding:"14px",textAlign:"center",color:C.subtle,fontSize:12}}>Empty — ready to load</div>
                              ) : (
                                <div style={{padding:"10px 14px 14px",display:"flex",flexDirection:"row",flexWrap:"wrap",gap:8}}>
                                  {truck.loads.map(load => {
                                    const confirmed = load.outcome==="received";
                                    const isEditing = editingTruckDayId === td.id;
                                    return (
                                      <div key={load.timestamp} style={{
                                        flex:"1 1 220px",
                                        padding:"10px 12px",
                                        background:confirmed?"#f0fdf4":"#faf5ff",
                                        borderRadius:10,
                                        border:`1px solid ${confirmed?"#bbf7d0":"#ddd6fe"}`,
                                        borderLeft:`4px solid ${confirmed?C.green:"#7c3aed"}`,
                                      }}>
                                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                                          <div style={{fontSize:13,fontWeight:700,color:C.navy}}>{load.dest_city}, {load.dest_state}</div>
                                          <div style={{display:"flex",gap:4,alignItems:"center"}}>
                                            {!confirmed && <span style={{fontSize:10,fontWeight:700,color:"#7c3aed",background:"#ede9fe",padding:"2px 6px",borderRadius:20}}>Incoming</span>}
                                            {isFTL(load) && <span style={{fontSize:10,fontWeight:700,color:"#7c3aed",background:"#ede9fe",padding:"2px 6px",borderRadius:20}}>FTL</span>}
                                            {isEditing && (
                                              <button onClick={()=>toggleTruckExclusion(td.id,load.timestamp)}
                                                style={{padding:"2px 7px",background:"#fee2e2",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>
                                            )}
                                          </div>
                                        </div>
                                        <div style={{display:"flex",flexWrap:"wrap",gap:"3px 12px",fontSize:11}}>
                                          {!isFTL(load)&&<span><span style={{color:C.subtle}}>Skids </span><span style={{fontWeight:600,color:C.text}}>{load.skids||"—"}</span></span>}
                                          <span><span style={{color:C.subtle}}>Footage </span><span style={{fontWeight:700,color:C.amber}}>{load._ft} ft</span></span>
                                          <span><span style={{color:C.subtle}}>Customer </span><span style={{fontWeight:600,color:C.text}}>{load.broker_name||"—"}</span></span>
                                          <span><span style={{color:C.subtle}}>Consignee </span><span style={{color:C.text}}>{load.consignee||"—"}</span></span>
                                          <span><span style={{color:C.subtle}}>Deliver by </span><span style={{color:C.text}}>{load.delivery_date||"—"}</span></span>
                                          {load.delivery_address&&<span style={{width:"100%"}}><span style={{color:C.subtle}}>Address </span><span style={{color:C.text}}>{load.delivery_address}</span></span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Unassigned loads */}
              {unassigned.length > 0 && (
                <div style={{...card,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"12px 20px",background:"#fffbeb",borderBottom:`1px solid #fde68a`}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#92400e"}}>⏳ Unassigned Loads ({unassigned.length})</div>
                    <div style={{fontSize:12,color:"#a16207",marginTop:2}}>No truck route matches these destinations. Add a truck going to those states above.</div>
                  </div>
                  <div style={{padding:"12px 20px",display:"flex",flexDirection:"column",gap:6}}>
                    {unassigned.map(load => (
                      <div key={load.timestamp} style={{display:"flex",alignItems:"center",gap:16,padding:"8px 12px",background:"#f8fafc",borderRadius:6,flexWrap:"wrap",
                        borderLeft:`3px ${load.outcome==="received"?"solid":"dashed"} ${load.outcome==="received"?C.green:"#7c3aed"}`}}>
                        <span style={{fontSize:12,fontWeight:600,color:C.navy,minWidth:80}}>{load.pickup_date||load.date}</span>
                        <span style={{fontSize:12,color:C.text}}>{load.origin} → {load.dest_city}, {load.dest_state}</span>
                        <span style={{fontSize:12,color:C.muted}}>{load.skids} skids · {getFootage(load)} ft</span>
                        <span style={{fontSize:12,color:C.muted}}>{load.broker_name}</span>
                        {load.outcome==="broker_sending" && <span style={{fontSize:11,fontWeight:700,color:"#7c3aed",background:"#ede9fe",padding:"1px 6px",borderRadius:4}}>Incoming</span>}
                        <span style={{fontSize:13,fontWeight:700,color:C.amber,marginLeft:"auto"}}>${r5(load.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>}
            </div>
          );
        })()

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
                <div style={{ fontSize:14, color:C.muted, marginBottom:14 }}>Paste the broker email below, or upload a PDF document directly.</div>

                {/* PDF upload zone */}
                <label style={{ display:"block", marginBottom:14, cursor:"pointer" }}>
                  <input type="file" accept="application/pdf" style={{ display:"none" }}
                    onChange={e => { if (e.target.files[0]) handlePDFUpload(e.target.files[0]); e.target.value=""; }}
                  />
                  <div style={{ border:`2px dashed ${pdfLoading?"#6366f1":"#c7d2fe"}`, borderRadius:10, padding:"18px 20px", background:pdfLoading?"#eef2ff":"#f5f7ff",
                    display:"flex", alignItems:"center", gap:14, transition:"all 0.2s" }}>
                    <div style={{ fontSize:28, lineHeight:1 }}>{pdfLoading ? "⏳" : "📄"}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:pdfLoading?"#4f46e5":C.navy }}>
                        {pdfLoading ? "Reading PDF…" : "Upload PDF (rate confirmation, load tender, BOL)"}
                      </div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                        {pdfLoading ? "Claude is extracting shipment details" : "Click to browse or drop a file — Claude reads it automatically"}
                      </div>
                    </div>
                    {!pdfLoading && <div style={{ marginLeft:"auto", padding:"6px 16px", background:"#4f46e5", color:"#fff", borderRadius:7, fontSize:12, fontWeight:700 }}>Browse</div>}
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
                  style={{ marginTop:14, padding:"12px 28px", background:loading||!email.trim()?"#cbd5e1":C.amber, color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:700, cursor:loading||!email.trim()?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:8 }}>
                  {loading ? <><span style={{ display:"inline-block", animation:"spin 0.8s linear infinite" }}>⟳</span> Parsing email…</> : "Parse Email →"}
                </button>
              </div>
            </div>

            <div>
              {/* Coverage */}
              <div style={{ ...card, background:"#fdf2f4", border:`1px solid #e8b4be` }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.amber, marginBottom:10 }}>Rate Sheet Coverage</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
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

            <div style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:24, alignItems:"start" }}>
              {/* LEFT COLUMN — shipment details + stops */}
              <div>
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

                {/* Shipment details */}
                <div style={card}>
                  <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:16 }}>Shipment Details</div>
                  {parsed.missing_info?.length > 0 && (
                    <div style={{ padding:"10px 14px", background:"#fffbeb", border:`1px solid #fcd34d`, borderRadius:8, color:"#92400e", fontSize:14, marginBottom:14 }}>
                      ⚠ Missing information: {parsed.missing_info.join(", ")}
                    </div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                    {[["Origin Region","origin"],["Pickup Location","pickup_location"],["Destination City","dest_city"],["State","dest_state"],["Skids","skids"],["Footage (ft)","footage"],["Weight (lbs)","weight_lbs"],["Pickup Date","pickup_date"],["Delivery Date","delivery_date"],["Customer (Broker)","broker_name"],["Consignee","consignee"],["Commodity","commodity"]].map(([l,k]) => (
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

                {/* Generate Quote button */}
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <button onClick={handleQuote} disabled={geocoding||!base} style={{ padding:"14px 28px", fontSize:15, fontWeight:700, borderRadius:8, cursor:"pointer", background:geocoding||!base?"#cbd5e1":C.navy, color:"#fff", border:"none", width:"100%" }}>
                    {geocoding ? "Resolving location…" : "Generate Quote →"}
                  </button>
                  <button onClick={()=>{setStep("input");setError(null);}} style={{ padding:"11px 22px", fontSize:14, borderRadius:8, cursor:"pointer", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500, width:"100%" }}>
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
                }} style={{ padding:"13px 24px", fontSize:15, fontWeight:700, borderRadius:8, cursor:"pointer", background:allCopied?C.green:"#1d4ed8", color:"#fff", border:"none", transition:"background 0.3s" }}>
                  {allCopied ? "✓ All Copied!" : `Copy All ${quoteTexts.filter((qt,i) => qt && !allShipmentRates[i]?.unserviced).length} Quotes`}
                </button>
              )}
              <button onClick={()=>{setStep("review");setError(null);}} style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500 }}>
                ← Adjust
              </button>
              <button onClick={()=>{ setStep("input"); setEmail(""); setParsed(null); setShipments([]); setRateCity(null); setRateResult(null); setQuoteText(""); setQuoteTexts([]); setAllShipmentRates([]); setError(null); }}
                style={{ padding:"12px 22px", fontSize:15, borderRadius:8, cursor:"pointer", background:"#f1f5f9", color:C.text, border:`1.5px solid ${C.border}`, fontWeight:500 }}>
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
                      ✗ We do not service this area — {s.dest_city}, {s.dest_state} is within 100 miles of {asr.unserviced}.
                    </div>
                  ) : (
                    <>
                      <textarea value={qt} onChange={e=>{ setQuoteTexts(prev=>{ const u=[...prev]; u[i]=e.target.value; if(i===activeIdx) setQuoteText(e.target.value); return u; }); }}
                        style={{ ...input, height:260, resize:"vertical", lineHeight:1.75, fontFamily:"'Courier New', monospace", fontSize:13, background:"#f8f9fb" }}
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
          <div style={{ width:380, height:520, background:"#fff", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.18)", display:"flex", flexDirection:"column", overflow:"hidden", border:"1px solid #e2e8f0" }}>
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
                  <div style={{ lineHeight:1.6 }}>Ask me about your loads, get truck recommendations, or have me scan the inbox for new shipments.</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:16 }}>
                    {["What loads are on the board?","Which driver fits this week's loads?","Scan inbox for new load sheets","Any capacity issues I should know about?"].map(s=>(
                      <button key={s} onClick={()=>{ setAgentInput(""); callAgent(s); }}
                        style={{ padding:"7px 12px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, fontSize:12, fontWeight:600, color:C.navy, cursor:"pointer", textAlign:"left" }}>
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
                      <div style={{ maxWidth:"85%", background:"#f1f5f9", color:C.text, borderRadius:"14px 14px 14px 4px", padding:"9px 13px", fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                        {text}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
              {agentLoading && (
                <div style={{ display:"flex", justifyContent:"flex-start" }}>
                  <div style={{ background:"#f1f5f9", borderRadius:"14px 14px 14px 4px", padding:"9px 14px", display:"flex", gap:5, alignItems:"center" }}>
                    {[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.muted, animation:"bounce 1.2s infinite", animationDelay:`${i*0.2}s` }}/>)}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding:"10px 12px", borderTop:"1px solid #e2e8f0", display:"flex", gap:8 }}>
              <input
                value={agentInput}
                onChange={e=>setAgentInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey&&agentInput.trim()){ e.preventDefault(); const msg=agentInput.trim(); setAgentInput(""); callAgent(msg); }}}
                placeholder="Ask about loads, trucks, drivers…"
                disabled={agentLoading}
                style={{ flex:1, padding:"9px 12px", border:"1px solid #e2e8f0", borderRadius:10, fontSize:13, outline:"none", background: agentLoading?"#f8fafc":"#fff" }}
              />
              <button
                onClick={()=>{ const msg=agentInput.trim(); if(msg){ setAgentInput(""); callAgent(msg); }}}
                disabled={agentLoading||!agentInput.trim()}
                style={{ padding:"9px 14px", background: agentLoading||!agentInput.trim()?"#e2e8f0":C.amber, color:"#fff", border:"none", borderRadius:10, fontSize:13, fontWeight:700, cursor: agentLoading||!agentInput.trim()?"not-allowed":"pointer" }}>
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
