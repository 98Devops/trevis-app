import { useState, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   CORRECTED SEED DATA — February 2026 Excel (all dates verified)
═══════════════════════════════════════════════════════════ */
const SEED = {
  "King Fisher": {
    location: "Harare",
    rooms: [
      { id:"KF-1",no:"Room 1",beds:4,rent:110,students:[
        {id:"s1",name:"Bethel Mudavanhu",paid:110,status:"PAID",date:"08 Feb 2026",notes:"",payHistory:[]},
        {id:"s2",name:"Maitaishe Manatsa",paid:110,status:"PAID",date:"21 Feb 2026",notes:"",payHistory:[]},
        {id:"s3",name:"Dephen Chakandinakira",paid:110,status:"PAID",date:"26 Jul 2025",notes:"",payHistory:[]},
        {id:"s4",name:"Chengeto Kanyai",paid:110,status:"PAID",date:"27 Jul 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-2",no:"Room 2",beds:2,rent:150,students:[
        {id:"s5",name:"Patience Mhlanga",paid:150,status:"PAID",date:"07 Sep 2025",notes:"",payHistory:[]},
        {id:"s6",name:"Maslyne Makurumidze",paid:150,status:"PAID",date:"01 May 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-3",no:"Room 3",beds:3,rent:130,students:[
        {id:"s7",name:"Memory Chigarisano",paid:130,status:"PAID",date:"20 Dec 2025",notes:"",payHistory:[]},
        {id:"s8",name:"Chantel Kuvawoga",paid:130,status:"PAID",date:"20 Dec 2025",notes:"",payHistory:[]},
        {id:"s9",name:"Rumbidzai Chipadza",paid:130,status:"PAID",date:"20 Dec 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-4",no:"Room 4",beds:2,rent:150,students:[
        {id:"s10",name:"Lisa Mutenhure",paid:150,status:"PAID",date:"12 Jun 2025",notes:"",payHistory:[]},
        {id:"s11",name:"Mikayla Kasirowore",paid:150,status:"PAID",date:"21 Nov 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-5",no:"Room 5",beds:3,rent:150,students:[
        {id:"s12",name:"Shamah Nyakanda",paid:150,status:"PAID",date:"31 Jul 2025",notes:"",payHistory:[]},
        {id:"s13",name:"Makanaka Mhungu",paid:150,status:"PAID",date:"02 Dec 2025",notes:"",payHistory:[]},
        {id:"s14",name:"Loveness Mutune",paid:150,status:"PAID",date:"20 Sep 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-6",no:"Room 6",beds:2,rent:150,students:[
        {id:"s15",name:"Rufaro Zuze",paid:150,status:"PAID",date:"30 Dec 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-7",no:"Room 7",beds:3,rent:150,students:[
        {id:"s16",name:"Vimbai Makwaeva",paid:150,status:"PAID",date:"15 Jul 2025",notes:"",payHistory:[]},
        {id:"s17",name:"Marvelous Mhungu",paid:150,status:"PAID",date:"04 Dec 2025",notes:"",payHistory:[]},
        {id:"s18",name:"Fadzaishe Purazeni",paid:130,status:"PARTIAL",date:"16 Dec 2025",notes:"Rent $150, paid $130",payHistory:[]},
      ]},
      { id:"KF-8",no:"Room 8",beds:3,rent:130,students:[
        {id:"s19",name:"Faith Mukakose",paid:130,status:"PAID",date:"13 Dec 2025",notes:"",payHistory:[]},
        {id:"s20",name:"Chiedza Chari",paid:130,status:"PAID",date:"28 Nov 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-9",no:"Room 9",beds:4,rent:110,students:[
        {id:"s21",name:"Ashley Hosvori",paid:110,status:"PAID",date:"08 Dec 2025",notes:"",payHistory:[]},
        {id:"s22",name:"Priscilla Maposa",paid:110,status:"PAID",date:"09 Dec 2025",notes:"",payHistory:[]},
        {id:"s23",name:"Onenhlanhla Nyathi",paid:110,status:"PAID",date:"27 Jul 2025",notes:"",payHistory:[]},
        {id:"s24",name:"Tariro Mufusire",paid:110,status:"PAID",date:"02 Dec 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-10",no:"Room 10",beds:4,rent:110,students:[
        {id:"s25",name:"Shalom Phiri",paid:110,status:"PAID",date:"03 Dec 2025",notes:"",payHistory:[]},
        {id:"s26",name:"Sarah Tsvamgirai",paid:110,status:"PAID",date:"07 Dec 2025",notes:"",payHistory:[]},
        {id:"s27",name:"Thandiwe Sibanda",paid:110,status:"PAID",date:"27 Sep 2025",notes:"",payHistory:[]},
        {id:"s28",name:"Thandeka Gumbo",paid:110,status:"PAID",date:"07 Dec 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-11",no:"Room 11",beds:2,rent:180,students:[
        {id:"s29",name:"Tanatswa Shambare",paid:180,status:"PAID",date:"30 Nov 2025",notes:"",payHistory:[]},
        {id:"s30",name:"Jady Jeche",paid:130,status:"PARTIAL",date:"31 Jan 2026",notes:"Balance $50",payHistory:[]},
      ]},
      { id:"KF-12",no:"Room 12",beds:3,rent:130,students:[
        {id:"s31",name:"Salome Shumbaimwe",paid:130,status:"PAID",date:"01 Dec 2025",notes:"",payHistory:[]},
        {id:"s32",name:"Dylen Mapangera",paid:130,status:"PAID",date:"14 Jan 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-13",no:"Room 13",beds:3,rent:130,students:[
        {id:"s33",name:"Taedza Chimurendo",paid:130,status:"PAID",date:"08 Dec 2025",notes:"PAID TO MARCH",payHistory:[]},
        {id:"s34",name:"Ropafadzo Shamhuyarira",paid:130,status:"PAID",date:"07 Jun 2025",notes:"",payHistory:[]},
        {id:"s35",name:"Jennifer Mvududu",paid:130,status:"PAID",date:"08 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"KF-14",no:"Room 14",beds:2,rent:150,students:[
        {id:"s36",name:"Faith Chirodzera",paid:150,status:"PAID",date:"04 Dec 2025",notes:"",payHistory:[]},
        {id:"s37",name:"Sasha Sirika",paid:150,status:"PAID",date:"22 Nov 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-15",no:"Room 15",beds:2,rent:150,students:[
        {id:"s38",name:"Vanessa Jieman",paid:150,status:"PAID",date:"30 Nov 2025",notes:"",payHistory:[]},
        {id:"s39",name:"Joahan Kazembe",paid:150,status:"PAID",date:"09 May 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-16",no:"Room 16",beds:2,rent:150,students:[
        {id:"s40",name:"Tonovonga Manjoni",paid:150,status:"PAID",date:"27 Jul 2025",notes:"",payHistory:[]},
        {id:"s41",name:"Tarisai Mutsumbu",paid:150,status:"PAID",date:"01 Jul 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-17",no:"Room 17",beds:2,rent:150,students:[
        {id:"s42",name:"Gamu Manyika",paid:150,status:"PAID",date:"19 Nov 2025",notes:"",payHistory:[]},
        {id:"s43",name:"Felicity Mazhavidze",paid:150,status:"PAID",date:"01 Jul 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-18",no:"Room 18",beds:5,rent:110,students:[
        {id:"s44",name:"Tinotenda Mambo",paid:110,status:"PAID",date:"21 Feb 2026",notes:"",payHistory:[]},
        {id:"s45",name:"Tanya Gweru",paid:110,status:"PAID",date:"12 Dec 2025",notes:"",payHistory:[]},
        {id:"s46",name:"Prisilla Poashayi",paid:110,status:"PAID",date:"27 Dec 2025",notes:"",payHistory:[]},
        {id:"s47",name:"Tashley Kandoto",paid:110,status:"PAID",date:"04 Dec 2025",notes:"",payHistory:[]},
        {id:"s48",name:"Ivne Mudakwenda",paid:110,status:"PAID",date:"27 Jul 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-19",no:"Room 19",beds:1,rent:300,students:[
        {id:"s49",name:"Pamela Kunguva",paid:300,status:"PAID",date:"19 Jul 2025",notes:"",payHistory:[]},
      ]},
      { id:"KF-20",no:"Room 20",beds:1,rent:360,students:[
        {id:"s50",name:"Ropafadzo Mudavanhu",paid:180,status:"PARTIAL",date:"19 Jul 2025",notes:"Balance $180",payHistory:[]},
      ]},
      { id:"KF-21",no:"Room 21",beds:1,rent:180,students:[
        {id:"s51",name:"Khethiwe Chuma",paid:180,status:"PAID",date:"11 Apr 2025",notes:"",payHistory:[]},
      ]},
    ]
  },
  "The Chase": {
    location: "Harare",
    rooms: [
      { id:"TC-1",no:"Room 1",beds:1,rent:260,students:[
        {id:"s101",name:"Mr Matenhese",paid:260,status:"PAID",date:"13 Apr 2024",notes:"",payHistory:[]},
      ]},
      { id:"TC-2",no:"Room 2",beds:2,rent:130,students:[
        {id:"s102",name:"Elizabeth Moyo",paid:130,status:"PAID",date:"11 Jan 2024",notes:"",payHistory:[]},
        {id:"s103",name:"Laraine Chanakira",paid:130,status:"PAID",date:"15 Jan 2024",notes:"",payHistory:[]},
      ]},
      { id:"TC-3",no:"Room 3",beds:3,rent:120,students:[
        {id:"s104",name:"Lisa Chimungwe",paid:120,status:"PAID",date:"29 Sep 2025",notes:"",payHistory:[]},
        {id:"s105",name:"Rutendo Hlabati",paid:120,status:"PAID",date:"13 Mar 2025",notes:"",payHistory:[]},
        {id:"s106",name:"Rudo Chakwanda",paid:120,status:"PAID",date:"04 Mar 2025",notes:"",payHistory:[]},
      ]},
      { id:"TC-4",no:"Room 4",beds:2,rent:130,students:[
        {id:"s107",name:"Natasha Choto",paid:130,status:"PAID",date:"02 Dec 2025",notes:"",payHistory:[]},
        {id:"s108",name:"Chiedza Meki",paid:130,status:"PAID",date:"02 Dec 2025",notes:"",payHistory:[]},
      ]},
      { id:"TC-5",no:"Room 5",beds:3,rent:120,students:[
        {id:"s109",name:"Fadzishe Bakare",paid:120,status:"PAID",date:"28 Sep 2025",notes:"",payHistory:[]},
        {id:"s110",name:"Kamuelo Mlea",paid:120,status:"PAID",date:"18 Jan 2026",notes:"",payHistory:[]},
      ]},
      { id:"TC-6",no:"Room 6",beds:4,rent:100,students:[
        {id:"s111",name:"Melisa Muradzikwa",paid:100,status:"PAID",date:"09 Dec 2025",notes:"",payHistory:[]},
        {id:"s112",name:"Given Chayamiti",paid:100,status:"PAID",date:"09 Aug 2025",notes:"",payHistory:[]},
        {id:"s113",name:"Ruvarashe Ncube",paid:100,status:"PAID",date:"29 Jan 2026",notes:"",payHistory:[]},
      ]},
      { id:"TC-7",no:"Room 7",beds:2,rent:130,students:[
        {id:"s114",name:"Olyn Chigwanda",paid:130,status:"PAID",date:"17 Feb 2026",notes:"",payHistory:[]},
        {id:"s115",name:"Charity Masoha",paid:130,status:"PAID",date:"01 May 2024",notes:"",payHistory:[]},
      ]},
      { id:"TC-8",no:"Room 8",beds:2,rent:130,students:[
        {id:"s116",name:"Nicole Chikondowa",paid:130,status:"PAID",date:"02 Dec 2025",notes:"",payHistory:[]},
        {id:"s117",name:"Trinda Sibanda",paid:130,status:"PAID",date:"08 Jun 2024",notes:"",payHistory:[]},
      ]},
      { id:"TC-9",no:"Room 9",beds:2,rent:130,students:[
        {id:"s118",name:"Ayan Manjonjori",paid:130,status:"PAID",date:"10 Jun 2024",notes:"",payHistory:[]},
        {id:"s119",name:"Amanda Madawo",paid:130,status:"PAID",date:"01 Oct 2025",notes:"",payHistory:[]},
      ]},
      { id:"TC-10",no:"Room 10",beds:2,rent:130,students:[
        {id:"s120",name:"Sharmaine Rovha",paid:130,status:"PAID",date:"09 Aug 2025",notes:"",payHistory:[]},
        {id:"s121",name:"Reason Mlanga",paid:130,status:"PAID",date:"09 Aug 2025",notes:"",payHistory:[]},
      ]},
      { id:"TC-11",no:"Room 11",beds:3,rent:120,students:[
        {id:"s122",name:"Bianca Harutizwi",paid:120,status:"PAID",date:"23 Oct 2025",notes:"",payHistory:[]},
        {id:"s123",name:"Thando Phiri",paid:120,status:"PAID",date:"03 Jul 2025",notes:"",payHistory:[]},
      ]},
      { id:"TC-12",no:"Room 12",beds:3,rent:120,students:[
        {id:"s124",name:"Natalie Kamba",paid:120,status:"PAID",date:"13 Feb 2025",notes:"",payHistory:[]},
        {id:"s125",name:"Leona Zhuwawo",paid:120,status:"PAID",date:"11 Feb 2025",notes:"",payHistory:[]},
        {id:"s126",name:"Natasha Jomo",paid:120,status:"PAID",date:"06 Dec 2025",notes:"",payHistory:[]},
      ]},
      { id:"TC-13",no:"Room 13",beds:1,rent:150,students:[
        {id:"s127",name:"Yehudith Kadzutu",paid:150,status:"PAID",date:"21 Aug 2024",notes:"",payHistory:[]},
      ]},
    ]
  },
  "Madden": {
    location: "Harare",
    rooms: [
      { id:"MD-1",no:"Room 1",beds:3,rent:120,students:[
        {id:"s201",name:"Obvious Matanhire",paid:120,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s202",name:"William Chandiwana",paid:120,status:"PARTIAL",date:"15 Feb 2026",notes:"4 MONTHS",payHistory:[]},
        {id:"s203",name:"Dean Chimusimbe",paid:0,status:"OVERDUE",date:"09 Sep 2025",notes:"No payment",payHistory:[]},
      ]},
      { id:"MD-2",no:"Room 2",beds:4,rent:100,students:[
        {id:"s204",name:"Stanley Marange",paid:100,status:"PAID",date:"20 Dec 2025",notes:"",payHistory:[]},
        {id:"s205",name:"Nokutenda Govha",paid:100,status:"PAID",date:"25 Jan 2026",notes:"",payHistory:[]},
        {id:"s206",name:"Simba Mwanza",paid:100,status:"PAID",date:"21 Feb 2026",notes:"",payHistory:[]},
        {id:"s207",name:"Tinashe Tom",paid:100,status:"PAID",date:"09 Sep 2026",notes:"",payHistory:[]},
      ]},
      { id:"MD-3",no:"Room 3",beds:1,rent:260,students:[
        {id:"s208",name:"Abel Magari",paid:260,status:"PAID",date:"12 Jul 2024",notes:"",payHistory:[]},
      ]},
      { id:"MD-5",no:"Room 5",beds:2,rent:130,students:[
        {id:"s209",name:"Tanatswa Mapfumo",paid:130,status:"PAID",date:"06 Jun 2025",notes:"",payHistory:[]},
        {id:"s210",name:"Donnell Manase",paid:130,status:"PAID",date:"27 Jan 2026",notes:"",payHistory:[]},
      ]},
      { id:"MD-6",no:"Room 6",beds:2,rent:130,students:[
        {id:"s211",name:"Nyasha Mubhima",paid:130,status:"PAID",date:"23 Jan 2026",notes:"",payHistory:[]},
        {id:"s212",name:"Jordina Muzivanhanga",paid:130,status:"OVERDUE",date:"04 Apr 2025",notes:"BLN 10",payHistory:[]},
      ]},
      { id:"MD-7",no:"Room 7",beds:2,rent:130,students:[
        {id:"s213",name:"Ashley Kanoyangwa",paid:130,status:"PAID",date:"18 Jan 2026",notes:"",payHistory:[]},
        {id:"s214",name:"Prince Ntete",paid:130,status:"PAID",date:"16 Jan 2026",notes:"",payHistory:[]},
      ]},
      { id:"MD-8",no:"Room 8",beds:2,rent:130,students:[
        {id:"s215",name:"Patrick Mukarombwa",paid:130,status:"PAID",date:"04 Dec 2025",notes:"",payHistory:[]},
        {id:"s216",name:"Kudakwashe Muguri",paid:130,status:"PAID",date:"31 Oct 2025",notes:"",payHistory:[]},
      ]},
      { id:"MD-9",no:"Room 9",beds:3,rent:120,students:[
        {id:"s217",name:"Tadiwa Mutambwa",paid:120,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s218",name:"Umali Matemba",paid:120,status:"PAID",date:"14 Feb 2026",notes:"",payHistory:[]},
        {id:"s219",name:"Sibarashe Mavonyani",paid:120,status:"PAID",date:"14 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"MD-10",no:"Room 10",beds:3,rent:120,students:[
        {id:"s220",name:"Victor Makwarimba",paid:120,status:"PAID",date:"04 Dec 2025",notes:"",payHistory:[]},
        {id:"s221",name:"Elton Matiza",paid:120,status:"PAID",date:"14 Feb 2026",notes:"",payHistory:[]},
        {id:"s222",name:"Vincent Chimoto",paid:120,status:"PAID",date:"04 Dec 2025",notes:"",payHistory:[]},
      ]},
      { id:"MD-11",no:"Room 11",beds:3,rent:120,students:[
        {id:"s223",name:"Takudzwa Ruzane",paid:120,status:"PAID",date:"30 Apr 2025",notes:"",payHistory:[]},
        {id:"s224",name:"Prosper Machokoto",paid:120,status:"PAID",date:"04 Feb 2026",notes:"",payHistory:[]},
        {id:"s225",name:"Taonga Chiwanza",paid:120,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"MD-12",no:"Room 12",beds:3,rent:120,students:[
        {id:"s226",name:"Timukudze Mahiya",paid:0,status:"OVERDUE",date:"10 Sep 2025",notes:"No payment",payHistory:[]},
        {id:"s227",name:"Nigel Marufu",paid:120,status:"PAID",date:"14 Feb 2026",notes:"",payHistory:[]},
        {id:"s228",name:"Farai Machuwe",paid:120,status:"PAID",date:"19 Oct 2025",notes:"",payHistory:[]},
      ]},
      { id:"MD-13",no:"Room 13",beds:2,rent:130,students:[
        {id:"s229",name:"Alfred Manyama",paid:130,status:"PAID",date:"02 Dec 2025",notes:"",payHistory:[]},
        {id:"s230",name:"Stanford Joni",paid:130,status:"PAID",date:"16 Feb 2025",notes:"",payHistory:[]},
      ]},
      { id:"MD-14",no:"Room 14",beds:3,rent:120,students:[
        {id:"s231",name:"Gillian Nyoni",paid:120,status:"PAID",date:"07 Feb 2026",notes:"",payHistory:[]},
        {id:"s232",name:"Sovient Paradza",paid:120,status:"PAID",date:"23 Dec 2025",notes:"",payHistory:[]},
        {id:"s233",name:"Leroy Pachawo",paid:120,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"MD-15",no:"Room 15",beds:2,rent:130,students:[
        {id:"s234",name:"Sean Muchemwa",paid:130,status:"PAID",date:"20 Nov 2025",notes:"",payHistory:[]},
        {id:"s235",name:"Nathan Tsikirai",paid:130,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"MD-16",no:"Room 16",beds:3,rent:130,students:[
        {id:"s236",name:"Tamuka Mariso",paid:130,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s237",name:"Dillion Zvidza",paid:130,status:"PAID",date:"19 Feb 2026",notes:"",payHistory:[]},
        {id:"s238",name:"Prince Mutenga",paid:0,status:"OVERDUE",date:"\u2014",notes:"No date or payment",payHistory:[]},
      ]},
      { id:"MD-17",no:"Room 17",beds:2,rent:150,students:[
        {id:"s239",name:"Tafadzwa Chuma",paid:150,status:"PAID",date:"13 Feb 2026",notes:"",payHistory:[]},
        {id:"s240",name:"Tinotenda Matizirofa",paid:150,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
    ]
  },
  "Prices": {
    location: "Harare",
    rooms: [
      { id:"PR-1",no:"Room 1",beds:3,rent:130,students:[
        {id:"s301",name:"Wendey Madziwa",paid:130,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s302",name:"Lisa Tsoka",paid:130,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"PR-2",no:"Room 2",beds:2,rent:130,students:[
        {id:"s303",name:"Shalom Maurikire",paid:130,status:"PAID",date:"21 Apr 2025",notes:"",payHistory:[]},
        {id:"s304",name:"Diana Muhlambi",paid:130,status:"PAID",date:"18 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"PR-3",no:"Room 3",beds:3,rent:130,students:[
        {id:"s305",name:"Tanatswa Nyakata",paid:130,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s306",name:"Zvikomborero Kadawo",paid:130,status:"PAID",date:"18 Feb 2026",notes:"",payHistory:[]},
        {id:"s307",name:"Tafadzwa Chikowoe",paid:110,status:"PARTIAL",date:"19 Feb 2026",notes:"Balance $20",payHistory:[]},
      ]},
      { id:"PR-4",no:"Room 4",beds:2,rent:150,students:[
        {id:"s308",name:"Dorcus Sajeni",paid:0,status:"OVERDUE",date:"\u2014",notes:"TO 10 MARCH",payHistory:[]},
        {id:"s309",name:"Ruvarashe Tigere",paid:150,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"PR-5",no:"Room 5",beds:3,rent:130,students:[
        {id:"s310",name:"Yolanda Mvunge",paid:130,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s311",name:"Talent Nyikadzino",paid:130,status:"PAID",date:"20 Feb 2026",notes:"",payHistory:[]},
        {id:"s312",name:"Shallome Bereke",paid:130,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"PR-6",no:"Room 6",beds:2,rent:160,students:[
        {id:"s313",name:"Tamara Chitemamuswe",paid:160,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s314",name:"Tanya Nyakudanga",paid:160,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
      ]},
      { id:"PR-7",no:"Room 7",beds:4,rent:110,students:[
        {id:"s315",name:"Thandisile Ndebele",paid:110,status:"PAID",date:"17 Feb 2026",notes:"",payHistory:[]},
        {id:"s316",name:"Alaine Zindere",paid:110,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s317",name:"Munashe Nyuke",paid:110,status:"PAID",date:"15 Feb 2026",notes:"",payHistory:[]},
        {id:"s318",name:"Nerrisa Zindowe",paid:110,status:"PAID",date:"25 Apr 2025",notes:"",payHistory:[]},
      ]},
    ]
  }
};


/* ═══════════════════════════════════════════════════════════
   AUTH CREDENTIALS
═══════════════════════════════════════════════════════════ */
const USERS = [
  { email:"admin@trevis.co.zw", password:"admin1234", role:"admin" },
  { email:"manager@trevis.co.zw", password:"manager1234", role:"manager" },
];

/* ═══════════════════════════════════════════════════════════
   DATA HELPERS
═══════════════════════════════════════════════════════════ */
const fmt = (n) => "$" + Number(n).toLocaleString();

function buildProps(seed) {
  return Object.entries(seed).map(([name, data]) => {
    let collected = 0, expected = 0, students = 0, totalBeds = 0;
    const overdue = [];
    data.rooms.forEach(r => {
      totalBeds += r.beds;
      const real = r.students.filter(s => s.status !== "VACANT");
      real.forEach(s => {
        students++;
        collected += s.paid;
        expected += r.rent;
        if (s.status !== "PAID") overdue.push({ ...s, room: r.no, roomRent: r.rent, balance: r.rent - s.paid });
      });
    });
    const vacantBeds = totalBeds - students;
    return { name, location: data.location, rooms: data.rooms, collected, expected, students, overdue, totalBeds, vacantBeds };
  });
}

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS — deep slate + amber/gold accent
═══════════════════════════════════════════════════════════ */
const T = {
  bg:"#0D0F14", surface:"#131720", card:"#181D26", border:"#232836",
  hover:"#1E2330", text:"#E8EAF0", muted:"#6B7280", subtle:"#9CA3AF",
  gold:"#F5A623", goldDim:"#F5A62330",
  green:"#22C55E", greenDim:"#22C55E22",
  red:"#EF4444", redDim:"#EF444422",
  amber:"#F59E0B", amberDim:"#F59E0B22",
  blue:"#3B82F6", blueDim:"#3B82F622",
  purple:"#A78BFA", purpleDim:"#A78BFA22",
  prop: {
    "King Fisher": { accent:"#22D3EE", dim:"#22D3EE18" },
    "The Chase":   { accent:"#A78BFA", dim:"#A78BFA18" },
    "Madden":      { accent:"#F59E0B", dim:"#F59E0B18" },
    "Prices":      { accent:"#34D399", dim:"#34D39918" },
  }
};
const font = "'Sora','IBM Plex Mono',sans-serif";

/* ═══════════════════════════════════════════════════════════
   CSS KEYFRAMES (injected once)
═══════════════════════════════════════════════════════════ */
const globalCSS = `
* { box-sizing:border-box; margin:0; padding:0; }
::-webkit-scrollbar { width:4px; height:4px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:4px; }
select option { background:#131720; }
@keyframes pulse-overdue {
  0%,100% { opacity:1; }
  50% { opacity:0.5; }
}
@keyframes slideIn {
  from { transform:translateX(100%); opacity:0; }
  to { transform:translateX(0); opacity:1; }
}
@keyframes fadeIn {
  from { opacity:0; transform:translateY(8px); }
  to { opacity:1; transform:translateY(0); }
}
@media (max-width:768px) {
  .pn-sidebar {
    position:fixed !important; left:0 !important; top:0 !important; bottom:0 !important;
    width:260px !important; z-index:900 !important;
    transform:translateX(-100%) !important; transition:transform .25s ease !important;
  }
  .pn-sidebar.pn-sidebar-open { transform:translateX(0) !important; }
  .pn-sidebar-overlay {
    display:block !important; position:fixed; inset:0; background:rgba(0,0,0,.55);
    z-index:899; opacity:0; pointer-events:none; transition:opacity .25s ease;
  }
  .pn-sidebar-overlay.pn-sidebar-open { opacity:1; pointer-events:auto; }
  .pn-hamburger { display:flex !important; }
  .pn-main { padding:16px 14px !important; padding-top:60px !important; }
  .pn-kpi-grid { grid-template-columns:1fr 1fr !important; gap:10px !important; }
  .pn-prop-grid { grid-template-columns:1fr !important; gap:12px !important; }
  .pn-attn-table { display:none !important; }
  .pn-attn-cards { display:flex !important; }
  .pn-table-scroll { overflow-x:auto !important; -webkit-overflow-scrolling:touch !important; }
  .pn-chart-labels { font-size:8px !important; }
  .pn-modal-inner { width:95vw !important; max-width:95vw !important; max-height:90vh !important; margin:5vh auto !important; }
  .pn-profile-panel { width:100vw !important; }
  .pn-header-row { flex-direction:column !important; gap:12px !important; align-items:flex-start !important; }
  .pn-header-actions { width:100% !important; flex-wrap:wrap !important; }
  .pn-quick-actions { flex-wrap:wrap !important; }
  .pn-quick-actions button { flex:1 !important; min-width:100px !important; }
}
@media (max-width:480px) {
  .pn-kpi-grid { grid-template-columns:1fr !important; }
  .pn-main { padding:12px 10px !important; padding-top:56px !important; }
  .pn-stat-value { font-size:20px !important; }
}
`;

/* ═══════════════════════════════════════════════════════════
   TINY COMPONENTS
═══════════════════════════════════════════════════════════ */
const Badge = ({ status }) => {
  const cfg = {
    PAID:    { bg: T.greenDim, c: T.green, label:"Paid" },
    PARTIAL: { bg: T.amberDim, c: T.amber, label:"Partial" },
    OVERDUE: { bg: T.redDim,   c: T.red,   label:"Overdue" },
    VACANT:  { bg: T.purpleDim, c: T.purple, label:"Vacant" },
  }[status] || { bg:"#22283620", c:T.muted, label: status };
  const isOverdue = status === "OVERDUE";
  return (
    <span style={{ background:cfg.bg, color:cfg.c, padding:"2px 9px", borderRadius:20,
      fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
      animation: isOverdue ? "pulse-overdue 2s ease-in-out infinite" : "none" }}>
      {cfg.label}
    </span>
  );
};

const Stat = ({ label, value, sub, accent }) => (
  <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14,
    padding:"18px 22px", position:"relative", overflow:"hidden" }}>
    <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase",
      letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:24, fontWeight:800, color: accent || T.text,
      fontFamily:"'IBM Plex Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:T.subtle, marginTop:4 }}>{sub}</div>}
    <div style={{ position:"absolute", bottom:0, right:0, width:60, height:60,
      borderRadius:"50%", background: accent ? accent+"11" : "#ffffff06",
      transform:"translate(20px,20px)" }} />
  </div>
);

const Bar = ({ pct, color }) => (
  <div style={{ background:T.border, borderRadius:99, height:5, overflow:"hidden" }}>
    <div style={{ width:`${Math.min(pct,100)}%`, background: color || T.gold, height:"100%",
      borderRadius:99, transition:"width .6s ease" }} />
  </div>
);

const InputField = ({ label, value, onChange, type="text", placeholder="", style:extraStyle={} }) => (
  <div>
    {label && <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>{label}</div>}
    <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder}
      style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13,
        outline:"none", boxSizing:"border-box", fontFamily:font, ...extraStyle }} />
  </div>
);

const SelectField = ({ label, value, onChange, options, style:extraStyle={} }) => (
  <div>
    {label && <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>{label}</div>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:"9px 12px", color:T.text, fontSize:13,
        outline:"none", boxSizing:"border-box", fontFamily:font, ...extraStyle }}>
      {options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Btn = ({ children, onClick, accent, disabled, style:s={} }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ background: disabled ? T.border : (accent||T.gold), border:"none", borderRadius:9,
      padding:"10px 18px", color: disabled ? T.muted : "#0D0F14", fontWeight:700, fontSize:13,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily:font, transition:"all .15s", ...s }}>
    {children}
  </button>
);


/* ═══════════════════════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    const u = USERS.find(u => u.email === email && u.password === pass);
    if (u) onLogin(u);
    else setErr("Invalid email or password");
  };
  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:font }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:40, width:400, animation:"fadeIn .4s ease" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:32, fontWeight:800, color:T.gold, letterSpacing:"-0.02em" }}>Trevis</div>
          <div style={{ fontSize:11, color:T.muted, textTransform:"uppercase", letterSpacing:"0.15em", marginTop:4 }}>Property Manager</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <InputField label="Email" value={email} onChange={v=>{setEmail(v);setErr("");}} type="email" placeholder="admin@trevis.co.zw" />
          <InputField label="Password" value={pass} onChange={v=>{setPass(v);setErr("");}} type="password" placeholder="••••••••" />
          {err && <div style={{ color:T.red, fontSize:12, background:T.redDim, padding:"8px 12px", borderRadius:8 }}>{err}</div>}
          <Btn accent={T.gold} style={{ marginTop:8, width:"100%", padding:12, fontSize:14 }}>Sign In</Btn>
        </form>
        <div style={{ fontSize:10, color:T.muted, textAlign:"center", marginTop:20, lineHeight:1.6 }}>
          Demo: admin@trevis.co.zw / admin1234<br/>manager@trevis.co.zw / manager1234
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD STUDENT WIZARD (Multi-step modal)
═══════════════════════════════════════════════════════════ */
function AddStudentWizard({ open, onClose, properties, defaultProp, onAdd, user }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name:"", phone:"", idNumber:"", emergName:"", emergPhone:"",
    property: defaultProp || "", room:"", rent:0,
    checkIn:"", payPlan:"Monthly", notes:""
  });
  const upd = (k,v) => setForm(f => ({...f, [k]:v}));

  if (!open) return null;

  const selProp = properties.find(p => p.name === form.property);
  const availRooms = selProp ? selProp.rooms.filter(r => {
    const realStudents = r.students.filter(s => s.status !== "VACANT").length;
    return realStudents < r.beds;
  }) : [];
  const selRoom = selProp ? selProp.rooms.find(r => r.id === form.room) : null;

  const canNext = step === 1 ? form.name.trim() : step === 2 ? form.property && form.room : step === 3 ? true : true;

  const handleConfirm = () => {
    const newStudent = {
      id: "s" + Date.now(),
      name: form.name,
      paid: 0,
      status: "OVERDUE",
      date: form.checkIn || "\u2014",
      notes: form.notes,
      phone: form.phone,
      idNumber: form.idNumber,
      emergName: form.emergName,
      emergPhone: form.emergPhone,
      payPlan: form.payPlan,
      payHistory: []
    };
    onAdd(form.property, form.room, newStudent);
    setStep(1);
    setForm({ name:"",phone:"",idNumber:"",emergName:"",emergPhone:"",property:defaultProp||"",room:"",rent:0,checkIn:"",payPlan:"Monthly",notes:"" });
    onClose();
  };

  const steps = ["Personal","Room","Tenancy","Confirm"];

  return (
    <div style={{ position:"fixed",inset:0,background:"#000000cc",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:500,maxHeight:"90vh",overflow:"auto",padding:0,position:"relative",animation:"fadeIn .3s ease" }}>
        {/* Progress bar */}
        <div style={{ display:"flex",borderBottom:`1px solid ${T.border}` }}>
          {steps.map((s,i) => (
            <div key={s} style={{ flex:1,padding:"14px 0",textAlign:"center",fontSize:11,fontWeight:step===i+1?700:400,
              color:step===i+1?T.gold:i+1<step?T.green:T.muted,borderBottom:step===i+1?`2px solid ${T.gold}`:"2px solid transparent",
              background:i+1<step?T.greenDim:"none",transition:"all .2s" }}>
              {i+1}. {s}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ position:"absolute",top:14,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18,zIndex:2 }}>✕</button>

        <div style={{ padding:28 }}>
          {step === 1 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 8px" }}>Personal Details</h3>
              <InputField label="Full Name *" value={form.name} onChange={v=>upd("name",v)} placeholder="Student full name" />
              <InputField label="Phone Number" value={form.phone} onChange={v=>upd("phone",v)} placeholder="+263..." />
              <InputField label="National/Student ID" value={form.idNumber} onChange={v=>upd("idNumber",v)} placeholder="ID Number" />
              <InputField label="Emergency Contact Name" value={form.emergName} onChange={v=>upd("emergName",v)} />
              <InputField label="Emergency Contact Phone" value={form.emergPhone} onChange={v=>upd("emergPhone",v)} />
            </div>
          )}
          {step === 2 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 8px" }}>Room Assignment</h3>
              <SelectField label="Property" value={form.property} onChange={v=>{upd("property",v);upd("room","");}}
                options={[{value:"",label:"— Select property —"},...properties.map(p=>({value:p.name,label:p.name}))]} />
              {form.property && (
                <SelectField label="Room" value={form.room} onChange={v=>{upd("room",v); const rm=selProp?.rooms.find(r=>r.id===v); if(rm) upd("rent",rm.rent);}}
                  options={[{value:"",label:"— Select room —"},...availRooms.map(r=>{
                    const occ=r.students.filter(s=>s.status!=="VACANT").length;
                    return {value:r.id,label:`${r.no} — ${r.beds-occ} bed(s) free — $${r.rent}/bed`};
                  })]} />
              )}
              {selRoom && <div style={{ fontSize:12,color:T.green,background:T.greenDim,padding:"8px 12px",borderRadius:8 }}>Rent: ${selRoom.rent}/month per bed</div>}
              {form.property && availRooms.length === 0 && <div style={{ fontSize:12,color:T.amber,background:T.amberDim,padding:"8px 12px",borderRadius:8 }}>No vacant beds in this property</div>}
            </div>
          )}
          {step === 3 && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 8px" }}>Tenancy Details</h3>
              <InputField label="Check-in Date" value={form.checkIn} onChange={v=>upd("checkIn",v)} type="date" />
              <InputField label="Expected Monthly Rent ($)" value={form.rent} onChange={v=>upd("rent",v)} type="number" />
              <SelectField label="Payment Plan" value={form.payPlan} onChange={v=>upd("payPlan",v)} options={["Monthly","Semester","Annual"]} />
              <InputField label="Notes" value={form.notes} onChange={v=>upd("notes",v)} placeholder="Optional notes..." />
            </div>
          )}
          {step === 4 && (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              <h3 style={{ color:T.text,fontSize:16,margin:"0 0 12px" }}>Confirm & Add Student</h3>
              {[["Name",form.name],["Phone",form.phone||"\u2014"],["ID",form.idNumber||"\u2014"],
                ["Property",form.property],["Room",selRoom?.no||"\u2014"],["Rent",`$${form.rent}`],
                ["Check-in",form.checkIn||"\u2014"],["Plan",form.payPlan],["Notes",form.notes||"\u2014"]
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}20` }}>
                  <span style={{ fontSize:12,color:T.muted }}>{k}</span>
                  <span style={{ fontSize:12,color:T.text,fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"flex",justifyContent:"space-between",marginTop:24,gap:12 }}>
            {step > 1 ? <Btn accent={T.border} style={{color:T.text}} onClick={()=>setStep(s=>s-1)}>← Back</Btn> : <div/>}
            {step < 4 ? <Btn accent={T.gold} disabled={!canNext} onClick={()=>setStep(s=>s+1)}>Next →</Btn>
              : <Btn accent={T.green} onClick={handleConfirm}>✓ Confirm & Add</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENT RECORDING MODAL (enhanced)
═══════════════════════════════════════════════════════════ */
function PaymentModal({ open, onClose, prop, ac, onRecord, user, allProps }) {
  const [form, setForm] = useState({ student:"",amount:"",method:"Cash",notes:"",receipt:"",date:new Date().toISOString().split("T")[0],property:"" });
  const [done, setDone] = useState(false);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  if (!open) return null;

  // If prop is null, global mode - user picks property first
  const isGlobal = !prop;
  const activeProp = isGlobal ? allProps?.find(p=>p.name===form.property) : prop;
  const activeAc = activeProp ? T.prop[activeProp.name] : { accent:T.gold };

  const allStudents = activeProp ? activeProp.rooms.flatMap(r => r.students.filter(s=>s.status!=="VACANT").map(s => ({ ...s, room: r.no, roomId:r.id, roomRent:r.rent }))) : [];
  const outstanding = allStudents.filter(s => s.status !== "PAID");

  const handleSubmit = () => {
    const payment = {
      amount: Number(form.amount), date: form.date, method: form.method,
      receipt: form.receipt, notes: form.notes, recordedBy: user?.email || "system"
    };
    onRecord(activeProp.name, form.student, payment);
    setDone(true);
    setTimeout(() => { onClose(); setDone(false); setForm({ student:"",amount:"",method:"Cash",notes:"",receipt:"",date:new Date().toISOString().split("T")[0],property:"" }); }, 1500);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"#000000bb",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:18,width:440,padding:28,position:"relative",animation:"fadeIn .3s ease" }}>
        <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18 }}>✕</button>
        {done ? (
          <div style={{ textAlign:"center",padding:"24px 0" }}>
            <div style={{ fontSize:36,marginBottom:12 }}>✅</div>
            <div style={{ color:T.green,fontWeight:700,fontSize:15 }}>Payment Recorded!</div>
          </div>
        ) : (
          <>
            <h3 style={{ margin:"0 0 20px",color:T.text,fontSize:16 }}>Record Payment{activeProp ? ` — ${activeProp.name}` : ""}</h3>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {isGlobal && <SelectField label="Property" value={form.property} onChange={v=>{upd("property",v);upd("student","");}}
                options={[{value:"",label:"— Select property —"},...(allProps||[]).map(p=>({value:p.name,label:p.name}))]} />}
              <SelectField label="Student" value={form.student} onChange={v=>upd("student",v)}
                options={[{value:"",label:"— Select student —"},
                  ...outstanding.map(s=>({value:s.id,label:`${s.name} (${s.room}) — owes ${fmt(s.roomRent-s.paid)}`})),
                  ...allStudents.filter(s=>s.status==="PAID").map(s=>({value:s.id,label:`${s.name} (${s.room}) ✓`}))
                ]} />
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <InputField label="Amount ($)" value={form.amount} onChange={v=>upd("amount",v)} type="number" placeholder="e.g. 130" />
                <InputField label="Date" value={form.date} onChange={v=>upd("date",v)} type="date" />
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <SelectField label="Method" value={form.method} onChange={v=>upd("method",v)}
                  options={["Cash","EcoCash","Bank Transfer","Zipit","Swipe"]} />
                <InputField label="Receipt #" value={form.receipt} onChange={v=>upd("receipt",v)} placeholder="Optional" />
              </div>
              <InputField label="Notes" value={form.notes} onChange={v=>upd("notes",v)} placeholder="Optional note…" />
              <Btn accent={activeAc?.accent||T.gold} disabled={!form.student||!form.amount} onClick={handleSubmit}
                style={{ marginTop:4,width:"100%" }}>Confirm Payment</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENT PROFILE PANEL (slide-in)
═══════════════════════════════════════════════════════════ */
function StudentProfile({ student, room, propName, onClose, onRecordPay }) {
  if (!student) return null;
  const ac = T.prop[propName] || { accent:T.gold };
  const balance = room.rent - student.paid;
  return (
    <div style={{ position:"fixed",top:0,right:0,bottom:0,width:420,background:T.card,borderLeft:`1px solid ${T.border}`,
      zIndex:998,padding:28,overflowY:"auto",animation:"slideIn .3s ease",boxShadow:"-4px 0 20px #00000060" }}>
      <button onClick={onClose} style={{ position:"absolute",top:16,right:16,background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18 }}>✕</button>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11,color:ac.accent,textTransform:"uppercase",letterSpacing:"0.12em" }}>{propName} · {room.no}</div>
        <h2 style={{ fontSize:20,fontWeight:800,color:T.text,margin:"6px 0" }}>{student.name}</h2>
        <Badge status={student.status} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24 }}>
        <div style={{ background:T.bg,borderRadius:10,padding:14 }}>
          <div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>Rent</div>
          <div style={{ fontSize:18,fontWeight:700,color:T.text,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(room.rent)}</div>
        </div>
        <div style={{ background:T.bg,borderRadius:10,padding:14 }}>
          <div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>Balance</div>
          <div style={{ fontSize:18,fontWeight:700,color:balance>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(balance)}</div>
        </div>
      </div>
      {student.notes && <div style={{ background:T.amberDim,border:`1px solid ${T.amber}30`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.amber,marginBottom:16 }}>📝 {student.notes}</div>}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:12 }}>Payment History</div>
        {(!student.payHistory || student.payHistory.length === 0) ? (
          <div style={{ color:T.muted,fontSize:12,fontStyle:"italic" }}>No payment history recorded yet</div>
        ) : student.payHistory.map((p,i) => (
          <div key={i} style={{ borderLeft:`2px solid ${ac.accent}`,paddingLeft:12,marginBottom:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between" }}>
              <span style={{ fontSize:13,fontWeight:700,color:T.green }}>{fmt(p.amount)}</span>
              <span style={{ fontSize:11,color:T.muted }}>{p.date}</span>
            </div>
            <div style={{ fontSize:11,color:T.subtle }}>{p.method}{p.receipt ? ` · #${p.receipt}` : ""}</div>
            {p.notes && <div style={{ fontSize:11,color:T.muted,fontStyle:"italic" }}>{p.notes}</div>}
            <div style={{ fontSize:10,color:T.muted }}>by {p.recordedBy}</div>
          </div>
        ))}
      </div>
      <Btn accent={ac.accent} onClick={onRecordPay} style={{ width:"100%" }}>+ Record Payment</Btn>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   DASHBOARD VIEW
═══════════════════════════════════════════════════════════ */
function Dashboard({ props, onSelect, onAddStudent, onRecordPayment, onExport }) {
  const [timeRange, setTimeRange] = useState("month");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState(1);

  const totals = useMemo(() => props.reduce((a, p) => ({
    students:  a.students  + p.students,
    collected: a.collected + p.collected,
    expected:  a.expected  + p.expected,
    overdue:   a.overdue   + p.overdue.length,
    vacantBeds: a.vacantBeds + p.vacantBeds,
  }), { students:0, collected:0, expected:0, overdue:0, vacantBeds:0 }), [props]);

  const rate = totals.expected > 0 ? ((totals.collected / totals.expected) * 100).toFixed(1) : "0.0";
  const now = new Date();
  const monthYear = now.toLocaleString("en-US", { month:"long", year:"numeric" });

  const allOverdue = props.flatMap(p => p.overdue.map(s => ({ ...s, property: p.name })));
  const sorted = [...allOverdue].sort((a,b) => {
    if (sortCol==="name") return sortDir * a.name.localeCompare(b.name);
    if (sortCol==="property") return sortDir * a.property.localeCompare(b.property);
    if (sortCol==="balance") return sortDir * ((a.roomRent-a.paid) - (b.roomRent-b.paid));
    return 0;
  });
  const toggleSort = (col) => { if(sortCol===col) setSortDir(d=>-d); else { setSortCol(col); setSortDir(1); } };

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:13, color:T.gold, textTransform:"uppercase", letterSpacing:"0.15em", fontWeight:600, marginBottom:4 }}>{monthYear}</h2>
        <div className="pn-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h1 style={{ fontSize:28, fontWeight:800, color:T.text, margin:0 }}>Portfolio Overview</h1>
          <div style={{ display:"flex", gap:4, background:T.surface, borderRadius:8, padding:2 }}>
            {[["month","This Month"],["all","All Time"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTimeRange(k)} style={{ background:timeRange===k?T.gold:"none", border:"none", borderRadius:6,
                padding:"6px 14px", color:timeRange===k?"#0D0F14":T.muted, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:font }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="pn-kpi-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        <Stat label="Total Students" value={totals.students} accent={T.blue} />
        <Stat label="Collected" value={fmt(totals.collected)} accent={T.green} />
        <Stat label="Outstanding" value={fmt(totals.expected-totals.collected)} accent={T.red} sub={`${totals.vacantBeds} vacant beds`} />
        <Stat label="Collection Rate" value={`${rate}%`} sub={`${totals.overdue} need attention`} accent={T.gold} />
      </div>

      {/* Quick Actions */}
      <div className="pn-quick-actions" style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
        <Btn accent={T.gold} onClick={onAddStudent}>+ Add Student</Btn>
        <Btn accent={T.green} onClick={onRecordPayment}>+ Record Payment</Btn>
        <Btn accent={T.blue} onClick={onExport} style={{color:"#fff"}}>↓ Download Report</Btn>
      </div>

      {/* Collection bar chart */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>Collected vs Expected by Property</div>
        <div style={{ display:"flex", gap:24, alignItems:"flex-end", height:160 }}>
          {props.map(p => {
            const ac = T.prop[p.name];
            const maxVal = Math.max(...props.map(x=>x.expected), 1);
            const ePct = (p.expected/maxVal)*100;
            const cPct = (p.collected/maxVal)*100;
            return (
              <div key={p.name} style={{ flex:1, textAlign:"center" }}>
                <div style={{ display:"flex", gap:4, justifyContent:"center", alignItems:"flex-end", height:120 }}>
                  <div style={{ width:20, height:`${ePct}%`, background:T.border, borderRadius:"4px 4px 0 0", position:"relative" }}>
                    <div className="pn-chart-labels" style={{ position:"absolute",top:-18,width:60,left:"50%",marginLeft:-30,textAlign:"center",fontSize:9,color:T.muted }}>{fmt(p.expected)}</div>
                  </div>
                  <div style={{ width:20, height:`${cPct}%`, background:ac.accent, borderRadius:"4px 4px 0 0", position:"relative" }}>
                    <div className="pn-chart-labels" style={{ position:"absolute",top:-18,width:60,left:"50%",marginLeft:-30,textAlign:"center",fontSize:9,color:ac.accent }}>{fmt(p.collected)}</div>
                  </div>
                </div>
                <div style={{ fontSize:10, color:T.muted, marginTop:8, whiteSpace:"nowrap" }}>{p.name}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex",gap:20,justifyContent:"center",marginTop:12 }}>
          <span style={{ fontSize:10,color:T.muted }}>▪ Expected</span>
          <span style={{ fontSize:10,color:T.green }}>▪ Collected</span>
        </div>
      </div>

      {/* Property cards */}
      <div className="pn-prop-grid" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16, marginBottom:20 }}>
        {props.map(p => {
          const ac = T.prop[p.name];
          const pct = p.expected > 0 ? ((p.collected / p.expected) * 100).toFixed(0) : 0;
          const arrears = p.expected - p.collected;
          return (
            <div key={p.name} onClick={() => onSelect(p.name)}
              style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16,
                padding:24, cursor:"pointer", transition:"all .18s", borderLeft:`3px solid ${ac.accent}` }}
              onMouseEnter={e => e.currentTarget.style.background = T.hover}
              onMouseLeave={e => e.currentTarget.style.background = T.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:T.text }}>{p.name}</div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{p.rooms.length} rooms · {p.students} students</div>
                </div>
                <div style={{ background: ac.dim, color: ac.accent, padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700 }}>{pct}%</div>
              </div>
              <Bar pct={Number(pct)} color={ac.accent} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginTop:16 }}>
                {[
                  { label:"Collected", val:fmt(p.collected), c:T.green },
                  { label:"Arrears", val:fmt(arrears), c: arrears>0?T.red:T.green },
                  { label:"Vacant", val:p.vacantBeds, c:p.vacantBeds>0?T.amber:T.green },
                  { label:"Alerts", val:p.overdue.length, c:p.overdue.length>0?T.red:T.green },
                ].map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>{x.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:x.c, fontFamily:"'IBM Plex Mono',monospace" }}>{x.val}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Attention Required */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>⚠ Attention Required</div>
          <div style={{ background:T.redDim, color:T.red, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{totals.overdue} tenants</div>
        </div>
        {/* Desktop table */}
        <div className="pn-attn-table">
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr", gap:8, padding:"10px 24px", background:T.surface, borderBottom:`1px solid ${T.border}` }}>
            {[["Name","name"],["Property","property"],["Rent",""],["Balance","balance"],["Status",""]].map(([h,col]) => (
              <div key={h} onClick={()=>col&&toggleSort(col)} style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.1em",
                fontWeight:600, cursor:col?"pointer":"default" }}>{h}{sortCol===col?(sortDir===1?" ▲":" ▼"):""}</div>
            ))}
          </div>
          <div style={{ maxHeight:260, overflowY:"auto" }}>
            {sorted.length === 0 ? (
              <div style={{ padding:24, textAlign:"center", color:T.muted, fontSize:13 }}>🎉 No outstanding issues!</div>
            ) : sorted.map(s => (
              <div key={s.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr", gap:8, padding:"12px 24px",
                borderBottom:`1px solid ${T.border}20`, alignItems:"center", transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{s.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{s.room}</div>
                </div>
                <div style={{ fontSize:12, color:T.subtle }}>{s.property}</div>
                <div style={{ fontSize:12, color:T.subtle, fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.roomRent)}/mo</div>
                <div style={{ fontSize:12, fontWeight:700, color:T.red, fontFamily:"'IBM Plex Mono',monospace" }}>-{fmt(s.roomRent - s.paid)}</div>
                <Badge status={s.status} />
              </div>
            ))}
          </div>
        </div>
        {/* Mobile card layout */}
        <div className="pn-attn-cards" style={{ display:"none", flexDirection:"column", gap:8, padding:12, maxHeight:320, overflowY:"auto" }}>
          {sorted.length === 0 ? (
            <div style={{ padding:20, textAlign:"center", color:T.muted, fontSize:13 }}>🎉 No outstanding issues!</div>
          ) : sorted.map(s => (
            <div key={s.id+"m"} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{s.name}</div>
                <Badge status={s.status} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:T.muted }}>{s.property} · {s.room}</span>
                <span style={{ color:T.red, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>-{fmt(s.roomRent - s.paid)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   PROPERTY DETAIL VIEW
═══════════════════════════════════════════════════════════ */
function PropertyDetail({ name, props, onBack, onOpenPay, onAddStudent, onStudentClick }) {
  const prop = props.find(p => p.name === name);
  const ac = T.prop[name];
  const [search, setSearch] = useState("");
  const pct = prop.expected > 0 ? ((prop.collected / prop.expected)*100).toFixed(1) : "0.0";
  const filtered = prop.rooms.filter(r =>
    !search || r.no.toLowerCase().includes(search.toLowerCase()) ||
    r.students.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div>
      <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:13,padding:0,marginBottom:20,display:"flex",alignItems:"center",gap:6 }}>← Back to Dashboard</button>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11,color:ac.accent,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600 }}>{prop.location}</div>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:"4px 0 0" }}>{prop.name}</h1>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <Btn accent={T.green} onClick={onAddStudent}>+ Add Student</Btn>
          <Btn accent={ac.accent} onClick={onOpenPay}>+ Record Payment</Btn>
        </div>
      </div>
      <div className="pn-kpi-grid" style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:24 }}>
        <Stat label="Rooms" value={prop.rooms.length} accent={ac.accent} />
        <Stat label="Students" value={prop.students} accent={T.blue} />
        <Stat label="Collected" value={fmt(prop.collected)} accent={T.green} />
        <Stat label="Vacant Beds" value={prop.vacantBeds} accent={T.amber} />
        <Stat label="Rate" value={`${pct}%`} accent={T.gold} />
      </div>
      <div style={{ position:"relative",marginBottom:16 }}>
        <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:14 }}>⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search rooms or students…"
          style={{ width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px 10px 38px",
            color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:font }} />
      </div>
      {filtered.length === 0 && <div style={{ padding:32,textAlign:"center",color:T.muted,fontSize:13 }}>No rooms match your search</div>}
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {filtered.map(room => <RoomRow key={room.id} room={room} ac={ac} propName={name} onStudentClick={onStudentClick} />)}
      </div>
    </div>
  );
}

function RoomRow({ room, ac, propName, onStudentClick }) {
  const [open, setOpen] = useState(false);
  const real = room.students.filter(s=>s.status!=="VACANT");
  const paid = real.filter(s=>s.status==="PAID").length;
  const issues = real.filter(s=>s.status!=="PAID").length;
  const pct = real.length > 0 ? Math.round((paid/real.length)*100) : 0;
  const vacant = room.beds - real.length;
  return (
    <div style={{ background:T.card,border:`1px solid ${open?ac.accent+"60":T.border}`,borderRadius:12,overflow:"hidden",transition:"border .2s" }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"14px 20px",cursor:"pointer",display:"grid",
        gridTemplateColumns:"1fr auto auto auto auto auto",gap:12,alignItems:"center" }}>
        <div>
          <span style={{ fontSize:14,fontWeight:700,color:T.text }}>{room.no}</span>
          <span style={{ fontSize:11,color:T.muted,marginLeft:10 }}>{real.length}/{room.beds} beds · ${room.rent}/bed</span>
        </div>
        <div style={{ fontSize:11,color:T.green }}>{paid} paid</div>
        {issues>0 && <div style={{ background:T.redDim,color:T.red,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{issues} ⚠</div>}
        {vacant>0 && <div style={{ background:T.amberDim,color:T.amber,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700 }}>{vacant} vacant</div>}
        <div style={{ width:80 }}><Bar pct={pct} color={ac.accent} /></div>
        <span style={{ color:T.muted,fontSize:13 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${T.border}` }}>
          {room.students.map(s => (
            <div key={s.id} onClick={()=>s.status!=="VACANT"&&onStudentClick&&onStudentClick(s,room,propName)}
              style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,padding:"10px 20px",
                borderBottom:`1px solid ${T.border}20`,alignItems:"center",cursor:s.status!=="VACANT"?"pointer":"default",transition:"background .15s" }}
              onMouseEnter={e=>{if(s.status!=="VACANT")e.currentTarget.style.background=T.hover}}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ fontSize:13,color:s.status==="VACANT"?T.muted:T.text,fontWeight:s.status==="VACANT"?400:600,fontStyle:s.status==="VACANT"?"italic":"normal" }}>{s.name}</div>
              <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{s.status==="VACANT"?"\u2014":`$${s.paid} paid`}</div>
              <div style={{ fontSize:11,color:T.muted }}>{s.date||"\u2014"}</div>
              <Badge status={s.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENTS GLOBAL LIST
═══════════════════════════════════════════════════════════ */
function Students({ props, onAddStudent }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const all = useMemo(() => props.flatMap(p =>
    p.rooms.flatMap(r => r.students.filter(s=>s.status!=="VACANT").map(s => ({ ...s, property:p.name, room:r.no, rent:r.rent })))
  ), [props]);
  const filtered = all.filter(s =>
    (filter==="ALL"||s.status===filter) &&
    (!search||s.name.toLowerCase().includes(search.toLowerCase())||s.property.toLowerCase().includes(search.toLowerCase()))
  );
  const counts = { ALL:all.length, PAID:all.filter(s=>s.status==="PAID").length, PARTIAL:all.filter(s=>s.status==="PARTIAL").length, OVERDUE:all.filter(s=>s.status==="OVERDUE").length };
  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:0 }}>All Students</h1>
          <div style={{ fontSize:13,color:T.muted,marginTop:4 }}>{all.length} students across 4 properties</div>
        </div>
        <Btn accent={T.gold} onClick={onAddStudent}>+ Add Student</Btn>
      </div>
      <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
        <div style={{ position:"relative",flex:1,minWidth:200 }}>
          <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:T.muted }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or property…"
            style={{ width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:9,padding:"9px 12px 9px 34px",
              color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:font }} />
        </div>
        {["ALL","PAID","PARTIAL","OVERDUE"].map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?T.gold:T.card, border:`1px solid ${filter===f?T.gold:T.border}`,
            borderRadius:9, padding:"9px 16px", color:filter===f?"#0D0F14":T.muted, fontWeight:filter===f?700:400, fontSize:12, cursor:"pointer", fontFamily:font }}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden" }}>
        <div style={{ display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr 1fr",padding:"11px 20px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
          {["Name","Property","Room","Rent","Paid","Status"].map(h => (
            <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
          ))}
        </div>
        <div style={{ maxHeight:520,overflowY:"auto" }}>
          {filtered.length===0 ? (
            <div style={{ padding:32,textAlign:"center",color:T.muted,fontSize:13 }}>No students match your search criteria</div>
          ) : filtered.map(s => {
            const ac = T.prop[s.property];
            return (
              <div key={s.id} style={{ display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr 1fr 1fr",padding:"12px 20px",
                borderBottom:`1px solid ${T.border}15`,alignItems:"center",transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{s.name}</div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:ac.accent }} />
                  <span style={{ fontSize:12,color:T.subtle }}>{s.property}</span>
                </div>
                <div style={{ fontSize:12,color:T.muted }}>{s.room}</div>
                <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.rent)}</div>
                <div style={{ fontSize:12,fontFamily:"'IBM Plex Mono',monospace",color:s.paid>=s.rent?T.green:T.amber }}>{fmt(s.paid)}</div>
                <Badge status={s.status} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   REPORTS VIEW
═══════════════════════════════════════════════════════════ */
function Reports({ props }) {
  const [tab, setTab] = useState("income");
  const totals = props.map(p => ({ name:p.name, students:p.students, collected:p.collected, expected:p.expected,
    arrears:p.expected-p.collected, rate:p.expected>0?((p.collected/p.expected)*100).toFixed(1):"0.0", overdue:p.overdue.length,
    totalBeds:p.totalBeds, vacantBeds:p.vacantBeds }));
  const grand = totals.reduce((a,t) => ({ students:a.students+t.students, collected:a.collected+t.collected, expected:a.expected+t.expected,
    arrears:a.arrears+t.arrears, overdue:a.overdue+t.overdue, totalBeds:a.totalBeds+t.totalBeds, vacantBeds:a.vacantBeds+t.vacantBeds }),
    { students:0,collected:0,expected:0,arrears:0,overdue:0,totalBeds:0,vacantBeds:0 });

  const allOutstanding = props.flatMap(p => p.rooms.flatMap(r => r.students.filter(s=>s.status!=="PAID"&&s.status!=="VACANT").map(s=>
    ({...s, property:p.name, room:r.no, rent:r.rent, balance:r.rent-s.paid})
  ))).sort((a,b) => b.balance - a.balance);

  const handleExport = () => {
    const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    let csv = "=== MONTHLY INCOME SUMMARY ===\n";
    csv += "Property,Students,Expected,Collected,Arrears,Rate%,Overdue\n";
    totals.forEach(t => csv += `${t.name},${t.students},${t.expected},${t.collected},${t.arrears},${t.rate},${t.overdue}\n`);
    csv += `TOTAL,${grand.students},${grand.expected},${grand.collected},${grand.arrears},${grand.expected>0?((grand.collected/grand.expected)*100).toFixed(1):"0"},${grand.overdue}\n\n`;
    csv += "=== OUTSTANDING BALANCES ===\n";
    csv += "Name,Property,Room,Rent,Paid,Balance,Status,Notes\n";
    allOutstanding.forEach(s => csv += `"${s.name}",${s.property},${s.room},${s.rent},${s.paid},${s.balance},${s.status},"${s.notes||""}"\n`);
    csv += `\n=== OCCUPANCY REPORT ===\n`;
    csv += "Property,Total Beds,Occupied,Vacant,Occupancy%\n";
    totals.forEach(t => csv += `${t.name},${t.totalBeds},${t.totalBeds-t.vacantBeds},${t.vacantBeds},${t.totalBeds>0?((t.totalBeds-t.vacantBeds)/t.totalBeds*100).toFixed(1):"0"}\n`);
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `Trevis_Report_${ts}.csv`; a.click();
  };

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:13,color:T.gold,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:600,marginBottom:4 }}>February 2026</h2>
          <h1 style={{ fontSize:26,fontWeight:800,color:T.text,margin:0 }}>Reports</h1>
        </div>
        <Btn accent={T.gold} style={{background:T.goldDim,color:T.gold,border:`1px solid ${T.gold}40`}} onClick={handleExport}>↓ Export CSV</Btn>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:4,marginBottom:20,background:T.surface,borderRadius:10,padding:3,width:"fit-content" }}>
        {[["income","Income Summary"],["outstanding","Outstanding"],["occupancy","Occupancy"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ background:tab===k?T.gold:"none",border:"none",borderRadius:7,
            padding:"8px 18px",color:tab===k?"#0D0F14":T.muted,fontSize:12,fontWeight:tab===k?700:400,cursor:"pointer",fontFamily:font }}>{l}</button>
        ))}
      </div>

      {tab === "income" && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Property","Students","Expected","Collected","Arrears","Rate"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {totals.map(t => {
            const ac = T.prop[t.name];
            return (
              <div key={t.name} style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",padding:"14px 24px",
                borderBottom:`1px solid ${T.border}20`,alignItems:"center",transition:"background .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:ac.accent }} />
                  <span style={{ fontSize:13,fontWeight:600,color:T.text }}>{t.name}</span>
                </div>
                <div style={{ fontSize:13,color:T.subtle }}>{t.students}</div>
                <div style={{ fontSize:13,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(t.expected)}</div>
                <div style={{ fontSize:13,color:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(t.collected)}</div>
                <div style={{ fontSize:13,color:t.arrears>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(t.arrears)}</div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ flex:1 }}><Bar pct={Number(t.rate)} color={ac.accent} /></div>
                  <span style={{ fontSize:11,color:ac.accent,fontWeight:700,minWidth:36 }}>{t.rate}%</span>
                </div>
              </div>
            );
          })}
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr",padding:"14px 24px",background:T.surface }}>
            <div style={{ fontSize:13,fontWeight:800,color:T.text }}>TOTAL</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{grand.students}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(grand.expected)}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(grand.collected)}</div>
            <div style={{ fontSize:13,fontWeight:700,color:grand.arrears>0?T.red:T.green,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(grand.arrears)}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.gold }}>{grand.expected>0?((grand.collected/grand.expected)*100).toFixed(1):"0"}%</div>
          </div>
        </div>
      )}

      {tab === "outstanding" && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Name","Property","Room","Rent","Paid","Balance"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {allOutstanding.length===0 ? (
            <div style={{ padding:32,textAlign:"center",color:T.muted }}>🎉 No outstanding balances!</div>
          ) : allOutstanding.map(s => (
            <div key={s.id} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",padding:"12px 24px",
              borderBottom:`1px solid ${T.border}20`,alignItems:"center",transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{s.name}</div>
              <div style={{ fontSize:12,color:T.subtle }}>{s.property}</div>
              <div style={{ fontSize:12,color:T.muted }}>{s.room}</div>
              <div style={{ fontSize:12,color:T.subtle,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.rent)}</div>
              <div style={{ fontSize:12,color:T.amber,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.paid)}</div>
              <div style={{ fontSize:12,fontWeight:700,color:T.red,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(s.balance)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "occupancy" && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",padding:"12px 24px",background:T.surface,borderBottom:`1px solid ${T.border}` }}>
            {["Property","Total Beds","Occupied","Vacant","Occupancy"].map(h => (
              <div key={h} style={{ fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600 }}>{h}</div>
            ))}
          </div>
          {totals.map(t => {
            const ac = T.prop[t.name]; const occ = t.totalBeds-t.vacantBeds; const occRate = t.totalBeds>0?((occ/t.totalBeds)*100).toFixed(1):"0";
            return (
              <div key={t.name} style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",padding:"14px 24px",
                borderBottom:`1px solid ${T.border}20`,alignItems:"center" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.hover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:ac.accent }} /><span style={{ fontSize:13,fontWeight:600,color:T.text }}>{t.name}</span>
                </div>
                <div style={{ fontSize:13,color:T.subtle }}>{t.totalBeds}</div>
                <div style={{ fontSize:13,color:T.green }}>{occ}</div>
                <div style={{ fontSize:13,color:t.vacantBeds>0?T.amber:T.green }}>{t.vacantBeds}</div>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ flex:1 }}><Bar pct={Number(occRate)} color={ac.accent} /></div>
                  <span style={{ fontSize:11,color:ac.accent,fontWeight:700 }}>{occRate}%</span>
                </div>
              </div>
            );
          })}
          <div style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",padding:"14px 24px",background:T.surface }}>
            <div style={{ fontSize:13,fontWeight:800,color:T.text }}>TOTAL</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{grand.totalBeds}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.green }}>{grand.totalBeds-grand.vacantBeds}</div>
            <div style={{ fontSize:13,fontWeight:700,color:grand.vacantBeds>0?T.amber:T.green }}>{grand.vacantBeds}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.gold }}>{grand.totalBeds>0?((grand.totalBeds-grand.vacantBeds)/grand.totalBeds*100).toFixed(1):"0"}%</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"⬡" },
  { id:"students",  label:"Students",  icon:"◎" },
  { id:"reports",   label:"Reports",   icon:"▦" },
];

/* ═══════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selProp, setSelProp] = useState(null);
  const [data, setData] = useState(JSON.parse(JSON.stringify(SEED)));
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addStudentProp, setAddStudentProp] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentProp, setPaymentProp] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);
  const [profileRoom, setProfileRoom] = useState(null);
  const [profilePropName, setProfilePropName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const props = useMemo(() => buildProps(data), [data]);
  const overdueCount = props.reduce((a,p) => a + p.overdue.length, 0);

  const navTo = (v) => { setView(v); setSelProp(null); setSidebarOpen(false); };
  const handleSelect = (name) => { setSelProp(name); setView("property"); setSidebarOpen(false); };
  const handleBack = () => { setSelProp(null); setView("dashboard"); };

  const handleAddStudent = (propName, roomId, student) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const room = next[propName].rooms.find(r => r.id === roomId);
      if (room) room.students.push(student);
      return next;
    });
  };

  const handleRecordPayment = (propName, studentId, payment) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const room of next[propName].rooms) {
        const s = room.students.find(st => st.id === studentId);
        if (s) {
          s.paid += payment.amount;
          if (!s.payHistory) s.payHistory = [];
          s.payHistory.push(payment);
          if (s.paid >= room.rent) s.status = "PAID";
          else if (s.paid > 0) s.status = "PARTIAL";
          break;
        }
      }
      return next;
    });
  };

  const handleExportCSV = () => { setView("reports"); };
  const isManager = user?.role === "manager";

  if (!user) return <LoginScreen onLogin={setUser} />;

  const activePropObj = selProp ? props.find(p=>p.name===selProp) : null;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:font, color:T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{globalCSS}</style>

      {/* Mobile top bar */}
      <div className="pn-hamburger" style={{ display:"none", position:"fixed", top:0, left:0, right:0, height:52,
        background:T.surface, borderBottom:`1px solid ${T.border}`, zIndex:850, alignItems:"center", padding:"0 16px", justifyContent:"space-between" }}>
        <button onClick={()=>setSidebarOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", color:T.gold, fontSize:22, padding:4 }}>
          {sidebarOpen ? "✕" : "☰"}
        </button>
        <div style={{ fontSize:16, fontWeight:800, color:T.gold }}>Trevis</div>
        <div style={{ width:28, height:28, borderRadius:"50%", background:T.goldDim, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:11, fontWeight:700, color:T.gold }}>{user.email[0].toUpperCase()}</div>
      </div>

      {/* Sidebar overlay */}
      <div className={`pn-sidebar-overlay ${sidebarOpen?"pn-sidebar-open":""}`} onClick={()=>setSidebarOpen(false)} style={{ display:"none" }} />

      <div style={{ display:"flex", minHeight:"100vh" }}>
        {/* Sidebar */}
        <div className={`pn-sidebar ${sidebarOpen?"pn-sidebar-open":""}`} style={{ width:220, background:T.surface, borderRight:`1px solid ${T.border}`,
          display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
          <div style={{ padding:"0 22px 28px" }}>
            <div className="pn-logo-text" style={{ fontSize:20, fontWeight:800, color:T.gold, letterSpacing:"-0.02em" }}>Trevis</div>
            <div className="pn-logo-sub" style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.15em", marginTop:2 }}>Property Manager</div>
          </div>
          <div style={{ flex:1 }}>
            {NAV.map(n => {
              const active = view === n.id || (n.id==="dashboard" && view==="property");
              return (
                <button key={n.id} onClick={() => navTo(n.id)}
                  style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"11px 22px",
                    background: active ? T.goldDim : "none", border:"none",
                    borderLeft: active ? `3px solid ${T.gold}` : "3px solid transparent",
                    color: active ? T.gold : T.muted, cursor:"pointer", fontSize:13,
                    fontWeight: active ? 700 : 400, fontFamily:font, transition:"all .15s", textAlign:"left", position:"relative" }}>
                  <span style={{ fontSize:16 }}>{n.icon}</span>
                  <span className="pn-label">{n.label}</span>
                  {n.id==="dashboard" && overdueCount > 0 && (
                    <span style={{ position:"absolute", right:16, background:T.red, color:"#fff", borderRadius:10,
                      padding:"1px 6px", fontSize:9, fontWeight:700, minWidth:16, textAlign:"center" }}>{overdueCount}</span>
                  )}
                </button>
              );
            })}
            <div style={{ padding:"20px 22px 8px", fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.12em" }}><span className="pn-label">Properties</span></div>
            {props.map(p => {
              const ac = T.prop[p.name]; const active = selProp === p.name;
              return (
                <button key={p.name} onClick={() => handleSelect(p.name)}
                  style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 22px",
                    background: active ? ac.dim : "none", border:"none", color: active ? ac.accent : T.subtle,
                    cursor:"pointer", fontSize:12, fontWeight: active ? 700 : 400, fontFamily:font, textAlign:"left",
                    borderLeft:`3px solid ${active ? ac.accent : "transparent"}`, transition:"all .15s" }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background: ac.accent, opacity: active ? 1 : 0.4 }} />
                  <span className="pn-label">{p.name}</span>
                </button>
              );
            })}
          </div>
          {/* User badge */}
          <div style={{ padding:"16px 22px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:T.goldDim, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:12, fontWeight:700, color:T.gold }}>{user.email[0].toUpperCase()}</div>
              <div className="pn-label">
                <div style={{ fontSize:11, color:T.text, fontWeight:600 }}>{user.role === "admin" ? "Admin" : "Manager"}</div>
                <div style={{ fontSize:10, color:T.muted }}>{user.email}</div>
              </div>
            </div>
            <button onClick={() => setUser(null)} className="pn-label"
              style={{ width:"100%", background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 0",
                color:T.muted, fontSize:11, cursor:"pointer", fontFamily:font, transition:"all .15s" }}>Logout</button>
          </div>
        </div>

        {/* Main */}
        <div className="pn-main" style={{ flex:1, padding:"36px 40px", overflowY:"auto", maxHeight:"100vh" }}>
          {view === "dashboard" && <Dashboard props={props} onSelect={handleSelect}
            onAddStudent={()=>{if(!isManager){setAddStudentProp("");setShowAddStudent(true);}}}
            onRecordPayment={()=>{setPaymentProp(null);setShowPayment(true);}}
            onExport={handleExportCSV} />}
          {view === "property" && selProp && <PropertyDetail name={selProp} props={props} onBack={handleBack}
            onOpenPay={()=>{setPaymentProp(activePropObj);setShowPayment(true);}}
            onAddStudent={()=>{if(!isManager){setAddStudentProp(selProp);setShowAddStudent(true);}}}
            onStudentClick={(s,r,pn)=>{setProfileStudent(s);setProfileRoom(r);setProfilePropName(pn);}} />}
          {view === "students" && <Students props={props}
            onAddStudent={()=>{if(!isManager){setAddStudentProp("");setShowAddStudent(true);}}} />}
          {view === "reports" && <Reports props={props} />}
        </div>
      </div>

      {/* Modals */}
      {!isManager && <AddStudentWizard open={showAddStudent} onClose={()=>setShowAddStudent(false)}
        properties={props} defaultProp={addStudentProp} onAdd={handleAddStudent} user={user} />}
      <PaymentModal open={showPayment} onClose={()=>setShowPayment(false)}
        prop={paymentProp} ac={paymentProp?T.prop[paymentProp.name]:null}
        onRecord={handleRecordPayment} user={user} allProps={props} />
      {profileStudent && <StudentProfile student={profileStudent} room={profileRoom} propName={profilePropName}
        onClose={()=>setProfileStudent(null)}
        onRecordPay={()=>{setPaymentProp(props.find(p=>p.name===profilePropName));setShowPayment(true);setProfileStudent(null);}} />}
    </div>
  );
}

