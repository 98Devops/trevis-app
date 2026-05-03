// Part 1: Helpers + Seed Data
// Excel serial date → JS Date. Anchor: 46076 = 15 Feb 2026
export function xlD(v){
  if(!v&&v!==0)return null;
  if(typeof v==='string'){
    const M={JAN:0,FEB:1,MAR:2,MARCH:2,APR:3,APRIL:3,MAY:4,JUN:5,JUNE:5,JUL:6,JULY:6,AUG:7,SEP:8,SEPT:8,OCT:9,NOV:10,DEC:11};
    const m=v.toUpperCase().match(/(\d+)\s+([A-Z]+)\s+(\d+)/);
    if(m){const mo=M[m[2]];if(mo!==undefined)return new Date(+m[3]<100?2000+Number(m[3]):+m[3],mo,+m[1]);}
    return null;
  }
  if(typeof v==='number')return new Date(1900,0,v-9);
  return null;
}
export function fmtDate(d){
  if(!d)return '—';
  if(typeof d==='string'||typeof d==='number')d=xlD(d);
  if(!d||isNaN(d))return '—';
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtMoney(v){return '$'+Number(v||0).toLocaleString();}

export const SEED = {
  "King Fisher":{location:"Harare",rooms:[
    {id:"KF-1",no:"Room 1",beds:4,rent:110,students:[
      {id:"s1",name:"Bethel Mudavanhu",paid:110,status:"PAID",date:46069,notes:""},
      {id:"s2",name:"Maitaishe Manatsa",paid:110,status:"PAID",date:46082,notes:""},
      {id:"s3",name:"Dephen Chakandinakira",paid:110,status:"PAID",date:45838,notes:""},
      {id:"s4",name:"Chengeto Kanyai",paid:110,status:"PAID",date:45839,notes:""},
    ]},
    {id:"KF-2",no:"Room 2",beds:2,rent:150,students:[
      {id:"s5",name:"Patience Mhlanga",paid:150,status:"PAID",date:45871,notes:""},
      {id:"s6",name:"Maslyne Makurumidze",paid:150,status:"PAID",date:"1 MAY 2025",notes:""},
    ]},
    {id:"KF-3",no:"Room 3",beds:3,rent:130,students:[
      {id:"s7",name:"Memory Chigarisano",paid:130,status:"PAID",date:46041,notes:""},
      {id:"s8",name:"Chantel Kuvawoga",paid:130,status:"PAID",date:46041,notes:""},
      {id:"s9",name:"Rumbidzai Chipadza",paid:130,status:"PAID",date:46041,notes:""},
    ]},
    {id:"KF-4",no:"Room 4",beds:2,rent:150,students:[
      {id:"s10",name:"Lisa Mutenhure",paid:150,status:"PAID",date:45824,notes:""},
      {id:"s11",name:"Mikayla Kasirowore",paid:150,status:"PAID",date:46003,notes:""},
    ]},
    {id:"KF-5",no:"Room 5",beds:3,rent:150,students:[
      {id:"s12",name:"Shamah Nyakanda",paid:150,status:"PAID",date:"31 JULY 2025",notes:""},
      {id:"s13",name:"Makanaka Mhungu",paid:150,status:"PAID",date:46023,notes:""},
      {id:"s14",name:"Loveness Mutune",paid:150,status:"PAID",date:45901,notes:""},
    ]},
    {id:"KF-6",no:"Room 6",beds:2,rent:150,students:[
      {id:"s15",name:"Rufaro Zuze",paid:150,status:"PAID",date:"30 DEC 2025",notes:""},
    ]},
    {id:"KF-7",no:"Room 7",beds:2,rent:150,students:[
      {id:"s16",name:"Vimbai Makwaeva",paid:150,status:"PAID",date:45860,notes:""},
      {id:"s17",name:"Marvelous Mhungu",paid:150,status:"PAID",date:46025,notes:""},
    ]},
    {id:"KF-8",no:"Room 8",beds:3,rent:130,students:[
      {id:"s18",name:"Fadzaishe Purazeni",paid:130,status:"PAID",date:46037,notes:""},
      {id:"s19",name:"Faith Mukakose",paid:130,status:"PAID",date:46034,notes:""},
      {id:"s20",name:"Chiedza Chari",paid:130,status:"PAID",date:45990,notes:""},
    ]},
    {id:"KF-9",no:"Room 9",beds:4,rent:110,students:[
      {id:"s21",name:"Ashley Hosvori",paid:110,status:"PAID",date:46029,notes:""},
      {id:"s22",name:"Priscilla Maposa",paid:110,status:"PAID",date:46030,notes:""},
      {id:"s23",name:"Onenhlanhla Nyathi",paid:110,status:"PAID",date:45868,notes:""},
      {id:"s24",name:"Tariro Mufusire",paid:110,status:"PAID",date:46023,notes:""},
    ]},
    {id:"KF-10",no:"Room 10",beds:4,rent:110,students:[
      {id:"s25",name:"Shalom Phiri",paid:110,status:"PAID",date:46024,notes:""},
      {id:"s26",name:"Sarah Tsvamgirai",paid:110,status:"PAID",date:46028,notes:""},
      {id:"s27",name:"Thandiwe Sibanda",paid:110,status:"PAID",date:45915,notes:""},
      {id:"s28",name:"Thandeka Gumbo",paid:110,status:"PAID",date:46028,notes:""},
    ]},
    {id:"KF-11",no:"Room 11",beds:2,rent:180,students:[
      {id:"s29",name:"Tanatswa Shambare",paid:180,status:"PAID",date:45999,notes:""},
      {id:"s30",name:"Jady Jeche",paid:130,status:"PARTIAL",date:46052,notes:"Paid $130 of $180"},
    ]},
    {id:"KF-12",no:"Room 12",beds:3,rent:130,students:[
      {id:"s31",name:"Salome Shumbaimwe",paid:130,status:"PAID",date:46022,notes:""},
      {id:"s32",name:"Dylen Mapangera",paid:130,status:"PAID",date:45685,notes:""},
    ]},
    {id:"KF-13",no:"Room 13",beds:3,rent:130,students:[
      {id:"s33",name:"Taedza Chimurendo",paid:130,status:"PAID",date:46029,notes:"PAID TO MARCH"},
      {id:"s34",name:"Ropafadzo Shamhuyarira",paid:130,status:"PAID",date:45821,notes:""},
      {id:"s35",name:"Jennifer Mvududu",paid:130,status:"PAID",date:46069,notes:""},
    ]},
    {id:"KF-14",no:"Room 14",beds:2,rent:150,students:[
      {id:"s36",name:"Faith Chirodzera",paid:150,status:"PAID",date:46025,notes:""},
      {id:"s37",name:"Sasha Sirika",paid:150,status:"PAID",date:45994,notes:""},
    ]},
    {id:"KF-15",no:"Room 15",beds:2,rent:150,students:[
      {id:"s38",name:"Vanessa Jieman",paid:150,status:"PAID",date:46021,notes:""},
      {id:"s39",name:"Joahan Kazembe",paid:150,status:"PAID",date:45724,notes:""},
    ]},
    {id:"KF-16",no:"Room 16",beds:2,rent:150,students:[
      {id:"s40",name:"Tonovonga Manjoni",paid:150,status:"PAID",date:45839,notes:""},
      {id:"s41",name:"Tarisai Mutsumbu",paid:150,status:"PAID",date:"1 JULY 2025",notes:""},
    ]},
    {id:"KF-17",no:"Room 17",beds:2,rent:150,students:[
      {id:"s42",name:"Gamu Manyika",paid:150,status:"PAID",date:46010,notes:""},
      {id:"s43",name:"Felicity Mazhavidze",paid:150,status:"PAID",date:45801,notes:""},
    ]},
    {id:"KF-18",no:"Room 18",beds:5,rent:110,students:[
      {id:"s44",name:"Tinotenda Mambo",paid:110,status:"PAID",date:46082,notes:""},
      {id:"s45",name:"Tanya Gweru",paid:110,status:"PAID",date:46033,notes:""},
      {id:"s46",name:"Prisilla Poashayi",paid:110,status:"PAID",date:46048,notes:""},
      {id:"s47",name:"Tashley Kandoto",paid:110,status:"PAID",date:46025,notes:""},
      {id:"s48",name:"Ivne Mudakwenda",paid:110,status:"PAID",date:45868,notes:""},
    ]},
    {id:"KF-19",no:"Room 19",beds:1,rent:300,students:[
      {id:"s49",name:"Pamela Kunguva",paid:300,status:"PAID",date:45831,notes:""},
    ]},
    {id:"KF-20",no:"Room 20",beds:1,rent:360,students:[
      {id:"s50",name:"Ropafadzo Mudavanhu",paid:180,status:"PARTIAL",date:45831,notes:"Balance $180"},
    ]},
    {id:"KF-21",no:"Room 21",beds:1,rent:180,students:[
      {id:"s51",name:"Khethiwe Chuma",paid:180,status:"PAID",date:45730,notes:""},
    ]},
  ]},
  "The Chase":{location:"Harare",rooms:[
    {id:"TC-1",no:"Room 1",beds:1,rent:260,students:[
      {id:"s101",name:"Mr Matenhese",paid:260,status:"PAID",date:45394,notes:""},
    ]},
    {id:"TC-2",no:"Room 2",beds:2,rent:130,students:[
      {id:"s102",name:"Elizabeth Moyo",paid:130,status:"PAID",date:45292,notes:""},
      {id:"s103",name:"Laraine Chanakira",paid:130,status:"PAID",date:45296,notes:""},
    ]},
    {id:"TC-3",no:"Room 3",beds:3,rent:120,students:[
      {id:"s104",name:"Lisa Chimungwe",paid:120,status:"PAID",date:45885,notes:""},
      {id:"s105",name:"Rutendo Hlabati",paid:120,status:"PAID",date:45672,notes:""},
      {id:"s106",name:"Rudo Chakwanda",paid:120,status:"PAID",date:45663,notes:""},
    ]},
    {id:"TC-4",no:"Room 4",beds:2,rent:130,students:[
      {id:"s107",name:"Natasha Choto",paid:130,status:"PAID",date:46023,notes:""},
      {id:"s108",name:"Chiedza Meki",paid:130,status:"PAID",date:46023,notes:""},
    ]},
    {id:"TC-5",no:"Room 5",beds:3,rent:120,students:[
      {id:"s109",name:"Fadzishe Bakare",paid:120,status:"PAID",date:45884,notes:""},
      {id:"s110",name:"Kamuelo Mlea",paid:120,status:"PAID",date:46049,notes:""},
    ]},
    {id:"TC-6",no:"Room 6",beds:4,rent:100,students:[
      {id:"s111",name:"Melisa Muradzikwa",paid:100,status:"PAID",date:46030,notes:""},
      {id:"s112",name:"Given Chayamiti",paid:100,status:"PAID",date:45870,notes:""},
      {id:"s113",name:"Ruvarashe Ncube",paid:100,status:"PAID",date:46060,notes:""},
    ]},
    {id:"TC-7",no:"Room 7",beds:2,rent:130,students:[
      {id:"s114",name:"Olyn Chigwanda",paid:130,status:"PAID",date:46078,notes:""},
      {id:"s115",name:"Charity Masoha",paid:130,status:"PAID",date:45413,notes:""},
    ]},
    {id:"TC-8",no:"Room 8",beds:2,rent:130,students:[
      {id:"s116",name:"Nicole Chikondowa",paid:130,status:"PAID",date:46023,notes:""},
      {id:"s117",name:"Trinda Sibanda",paid:130,status:"PAID",date:45451,notes:""},
    ]},
    {id:"TC-9",no:"Room 9",beds:2,rent:130,students:[
      {id:"s118",name:"Ayan Manjonjori",paid:130,status:"PAID",date:45453,notes:""},
      {id:"s119",name:"Amanda Madawo",paid:130,status:"PAID",date:45887,notes:""},
    ]},
    {id:"TC-10",no:"Room 10",beds:2,rent:130,students:[
      {id:"s120",name:"Sharmaine Rovha",paid:130,status:"PAID",date:45870,notes:""},
      {id:"s121",name:"Reason Mlanga",paid:130,status:"PAID",date:45870,notes:""},
    ]},
    {id:"TC-11",no:"Room 11",beds:3,rent:120,students:[
      {id:"s122",name:"Bianca Harutizwi",paid:120,status:"PAID",date:45923,notes:""},
      {id:"s123",name:"Thando Phiri",paid:120,status:"PAID",date:45798,notes:""},
    ]},
    {id:"TC-12",no:"Room 12",beds:3,rent:120,students:[
      {id:"s124",name:"Natalie Kamba",paid:120,status:"PAID",date:45600,notes:""},
      {id:"s125",name:"Leona Zhuwawo",paid:120,status:"PAID",date:45598,notes:""},
      {id:"s126",name:"Natasha Jomo",paid:120,status:"PAID",date:46027,notes:""},
    ]},
    {id:"TC-13",no:"Room 13",beds:1,rent:150,students:[
      {id:"s127",name:"Yehudith Kadzutu",paid:150,status:"PAID",date:45512,notes:""},
    ]},
  ]},
  "Madden":{location:"Harare",rooms:[
    {id:"MD-1",no:"Room 1",beds:3,rent:120,students:[
      {id:"s201",name:"Obvious Matanhire",paid:120,status:"PAID",date:46076,notes:""},
      {id:"s202",name:"William Chandiwana",paid:120,status:"PARTIAL",date:46076,notes:"4 MONTHS"},
      {id:"s203",name:"Dean Chimusimbe",paid:0,status:"OVERDUE",date:45899,notes:""},
    ]},
    {id:"MD-2",no:"Room 2",beds:4,rent:100,students:[
      {id:"s204",name:"Stanley Marange",paid:100,status:"PAID",date:46041,notes:""},
      {id:"s205",name:"Nokutenda Govha",paid:100,status:"PAID",date:46056,notes:""},
      {id:"s206",name:"Simba Mwanza",paid:100,status:"PAID",date:46082,notes:""},
      {id:"s207",name:"Tinashe Tom",paid:100,status:"PAID",date:46250,notes:""},
    ]},
    {id:"MD-3",no:"Room 3",beds:1,rent:260,students:[
      {id:"s208",name:"Abel Magari",paid:260,status:"PAID",date:45474,notes:""},
    ]},
    {id:"MD-5",no:"Room 5",beds:2,rent:130,students:[
      {id:"s209",name:"Tanatswa Mapfumo",paid:130,status:"PAID",date:"6 JUNE 2025",notes:""},
      {id:"s210",name:"Donnell Manase",paid:130,status:"PAID",date:46058,notes:""},
    ]},
    {id:"MD-6",no:"Room 6",beds:2,rent:130,students:[
      {id:"s211",name:"Nyasha Mubhima",paid:130,status:"PAID",date:46054,notes:""},
      {id:"s212",name:"Jordina Muzivanhanga",paid:120,status:"PARTIAL",date:45545,notes:"BLN 10"},
    ]},
    {id:"MD-7",no:"Room 7",beds:2,rent:130,students:[
      {id:"s213",name:"Ashley Kanoyangwa",paid:130,status:"PAID",date:46049,notes:""},
      {id:"s214",name:"Prince Ntete",paid:130,status:"PAID",date:46047,notes:""},
    ]},
    {id:"MD-8",no:"Room 8",beds:2,rent:130,students:[
      {id:"s215",name:"Patrick Mukarombwa",paid:130,status:"PAID",date:46025,notes:""},
      {id:"s216",name:"Kudakwashe Muguri",paid:130,status:"PAID",date:45943,notes:""},
    ]},
    {id:"MD-9",no:"Room 9",beds:3,rent:120,students:[
      {id:"s217",name:"Tadiwa Mutambwa",paid:120,status:"PAID",date:46076,notes:""},
      {id:"s218",name:"Umali Matemba",paid:120,status:"PAID",date:46075,notes:""},
      {id:"s219",name:"Sibarashe Mavonyani",paid:120,status:"PAID",date:46075,notes:""},
    ]},
    {id:"MD-10",no:"Room 10",beds:3,rent:120,students:[
      {id:"s220",name:"Victor Makwarimba",paid:120,status:"PAID",date:46025,notes:""},
      {id:"s221",name:"Elton Matiza",paid:120,status:"PAID",date:46075,notes:""},
      {id:"s222",name:"Vincent Chimoto",paid:120,status:"PAID",date:46025,notes:""},
    ]},
    {id:"MD-11",no:"Room 11",beds:3,rent:120,students:[
      {id:"s223",name:"Takudzwa Ruzane",paid:120,status:"PAID",date:"30 APRIL 2025",notes:""},
      {id:"s224",name:"Prosper Machokoto",paid:120,status:"PAID",date:46065,notes:""},
      {id:"s225",name:"Taonga Chiwanza",paid:120,status:"PAID",date:46076,notes:""},
    ]},
    {id:"MD-12",no:"Room 12",beds:3,rent:120,students:[
      {id:"s226",name:"Timukudze Mahiya",paid:0,status:"OVERDUE",date:45900,notes:""},
      {id:"s227",name:"Nigel Marufu",paid:120,status:"PAID",date:46075,notes:""},
      {id:"s228",name:"Farai Machuwe",paid:120,status:"PAID",date:45881,notes:""},
    ]},
    {id:"MD-13",no:"Room 13",beds:2,rent:130,students:[
      {id:"s229",name:"Alfred Manyama",paid:130,status:"PAID",date:46023,notes:""},
      {id:"s230",name:"Stanford Joni",paid:130,status:"PAID",date:45627,notes:""},
    ]},
    {id:"MD-14",no:"Room 14",beds:3,rent:120,students:[
      {id:"s231",name:"Gillian Nyoni",paid:120,status:"PAID",date:46068,notes:""},
      {id:"s232",name:"Sovient Paradza",paid:120,status:"PAID",date:46034,notes:""},
      {id:"s233",name:"Leroy Pachawo",paid:120,status:"PAID",date:46076,notes:""},
    ]},
    {id:"MD-15",no:"Room 15",beds:2,rent:130,students:[
      {id:"s234",name:"Sean Muchemwa",paid:130,status:"PAID",date:46001,notes:""},
      {id:"s235",name:"Nathan Tsikirai",paid:130,status:"PAID",date:46076,notes:""},
    ]},
    {id:"MD-16",no:"Room 16",beds:3,rent:130,students:[
      {id:"s236",name:"Tamuka Mariso",paid:130,status:"PAID",date:46076,notes:""},
      {id:"s237",name:"Dillion Zvidza",paid:130,status:"PAID",date:46080,notes:""},
      {id:"s238",name:"Prince Mutenga",paid:0,status:"OVERDUE",date:null,notes:""},
    ]},
    {id:"MD-17",no:"Room 17",beds:2,rent:150,students:[
      {id:"s239",name:"Tafadzwa Chuma",paid:150,status:"PAID",date:46074,notes:""},
      {id:"s240",name:"Tinotenda Matizirofa",paid:150,status:"PAID",date:46076,notes:""},
    ]},
  ]},
  "Prices":{location:"Harare",rooms:[
    {id:"PR-1",no:"Room 1",beds:3,rent:130,students:[
      {id:"s301",name:"Wendey Madziwa",paid:130,status:"PAID",date:46076,notes:""},
      {id:"s302",name:"Lisa Tsoka",paid:130,status:"PAID",date:46076,notes:""},
    ]},
    {id:"PR-2",no:"Room 2",beds:2,rent:130,students:[
      {id:"s303",name:"Shalom Maurikire",paid:130,status:"PAID",date:45712,notes:""},
      {id:"s304",name:"Diana Muhlambi",paid:130,status:"PAID",date:46079,notes:""},
    ]},
    {id:"PR-3",no:"Room 3",beds:3,rent:130,students:[
      {id:"s305",name:"Tanatswa Nyakata",paid:130,status:"PAID",date:46076,notes:""},
      {id:"s306",name:"Zvikomborero Kadawo",paid:130,status:"PAID",date:46079,notes:""},
      {id:"s307",name:"Tafadzwa Chikowoe",paid:110,status:"PARTIAL",date:46080,notes:"Paid $110 of $130"},
    ]},
    {id:"PR-4",no:"Room 4",beds:2,rent:150,students:[
      {id:"s308",name:"Dorcus Sajeni",paid:0,status:"OVERDUE",date:null,notes:"TO 10 MARCH"},
      {id:"s309",name:"Ruvarashe Tigere",paid:150,status:"PAID",date:46076,notes:""},
    ]},
    {id:"PR-5",no:"Room 5",beds:3,rent:130,students:[
      {id:"s310",name:"Yolanda Mvunge",paid:130,status:"PAID",date:46076,notes:""},
      {id:"s311",name:"Talent Nyikadzino",paid:130,status:"PAID",date:46081,notes:""},
      {id:"s312",name:"Shallome Bereke",paid:130,status:"PAID",date:46076,notes:""},
    ]},
    {id:"PR-6",no:"Room 6",beds:2,rent:160,students:[
      {id:"s313",name:"Tamara Chitemamuswe",paid:160,status:"PAID",date:46076,notes:""},
      {id:"s314",name:"Tanya Nyakudanga",paid:160,status:"PAID",date:46076,notes:""},
    ]},
    {id:"PR-7",no:"Room 7",beds:4,rent:110,students:[
      {id:"s315",name:"Thandisile Ndebele",paid:110,status:"PAID",date:46078,notes:""},
      {id:"s316",name:"Alaine Zindere",paid:110,status:"PAID",date:46076,notes:""},
      {id:"s317",name:"Munashe Nyuke",paid:110,status:"PAID",date:46076,notes:""},
      {id:"s318",name:"Nerrisa Zindowe",paid:110,status:"PAID",date:45716,notes:""},
    ]},
  ]},
};
