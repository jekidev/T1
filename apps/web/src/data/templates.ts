import type { Template } from "../types";

export const templates: Template[] = [
  {
    id: "whodunit",
    name: "Klassisk whodunit",
    subgenre: "Puzzle-krimi",
    description: "En lukket kreds af mistænkte, fair-play spor og en efterprøvelig afsløring.",
    tone: "Kølig, elegant, analytisk",
    tags: ["fair-play", "detektiv", "puzzle"],
    chapters: [
      { title: "1. Forbrydelsen", beats: ["Etabler stedet", "Præsenter kredsen", "Plant første spor"] },
      { title: "2. Detektiven", beats: ["Etabler metode", "Første afhøringer", "Plant red herring"] },
      { title: "3. Alibier", beats: ["Test motiver", "Skjulte relationer", "Et alibi krakelerer"] },
      { title: "4. Vendepunkt", beats: ["Nyt spor", "Brikkerne samles", "Læseren har nok information"] },
      { title: "5. Afsløring", beats: ["Rekonstruktion", "Motiv og mulighed", "Konsekvens"] }
    ]
  },
  {
    id: "nordic-noir",
    name: "Nordic noir",
    subgenre: "Skandinavisk krimi",
    description: "Atmosfærisk samfundskritik, et aktivt landskab og en efterforsker med et personligt sår.",
    tone: "Mørk, langsom, empatisk",
    tags: ["atmosfære", "samfund", "efterforsker"],
    chapters: [
      { title: "1. Landskabet", beats: ["Sæt stedet", "Introducer såret", "Find sagen"] },
      { title: "2. Offeret", beats: ["Giv offeret værdighed", "Første ledetråd"] },
      { title: "3. Systemet", beats: ["Institutionel modstand", "Parallel hypotese"] },
      { title: "4. Prisen", beats: ["Personligt vendepunkt", "Ingen vej tilbage"] },
      { title: "5. Efter", beats: ["Opklaring uden triumf", "Konsekvenser"] }
    ]
  },
  {
    id: "psychological",
    name: "Psykologisk thriller",
    subgenre: "Thriller",
    description: "Upålidelig perception, indre pres og et twist der er plantet fair.",
    tone: "Klaustrofobisk, intens",
    tags: ["POV", "upålidelig", "twist"],
    chapters: [
      { title: "1. Normalitet", beats: ["Tryg overflade", "Lille uoverensstemmelse"] },
      { title: "2. Sprækken", beats: ["Tvivl om erindring", "Isolation"] },
      { title: "3. Spiralen", beats: ["Modstridende beviser", "Tab af kontrol"] },
      { title: "4. Sandheden?", beats: ["Fortællingen smuldrer", "Twist"] },
      { title: "5. Ny normal", beats: ["Pris", "Efterklang"] }
    ]
  },
  {
    id: "procedural",
    name: "Politiprocedural",
    subgenre: "Procedural",
    description: "Teamdynamik, metode, beviskæde og realistisk efterforskningsarbejde.",
    tone: "Metodisk, faglig",
    tags: ["team", "procedure", "beviser"],
    chapters: [
      { title: "1. Alarm", beats: ["Gerningssted", "Roller", "Sikr spor"] },
      { title: "2. Kortlægning", beats: ["Vidner", "Tidslinje", "Teknik"] },
      { title: "3. Hypoteser", beats: ["To forklaringer", "Test antagelser"] },
      { title: "4. Fejlspor", beats: ["Ressourcer bindes", "Nyt fund"] },
      { title: "5. Bevis", beats: ["Anholdelse", "Bevisbyrde", "Konsekvens"] }
    ]
  },
  {
    id: "legal",
    name: "Courtroom thriller",
    subgenre: "Legal thriller",
    description: "Retssalsdrama, strategiske krydsforhør og etiske konflikter.",
    tone: "Skarp, argumentativ",
    tags: ["retssal", "etik", "jura"],
    chapters: [
      { title: "1. Sigtelsen", beats: ["Klient", "Anklage", "Etisk knude"] },
      { title: "2. Beviser", beats: ["Discovery", "Tvivlsomt fund"] },
      { title: "3. Retten", beats: ["Åbning", "Vidner"] },
      { title: "4. Kryds", beats: ["Modsigelser", "Vendepunkt"] },
      { title: "5. Dom", beats: ["Procedure", "Pris", "Efterspil"] }
    ]
  },
  {
    id: "true-crime",
    name: "True-crime-inspireret fiktion",
    subgenre: "Dokumentarisk fiktion",
    description: "Kildekritisk og ansvarlig fiktion uden at udnytte virkelige ofre.",
    tone: "Dokumentarisk, ansvarlig",
    tags: ["etik", "kilder", "ofre"],
    chapters: [
      { title: "1. Sagen", beats: ["Rammefortæller", "Kildeposition"] },
      { title: "2. Rekonstruktion", beats: ["Tidslinje", "Usikkerheder"] },
      { title: "3. Kilder", beats: ["Modstridende udsagn", "Kildekritik"] },
      { title: "4. Alternative fortællinger", beats: ["Magt", "Medier"] },
      { title: "5. Refleksion", beats: ["Værdighed", "Begrænsninger"] }
    ]
  },
  {
    id: "organized",
    name: "Organiseret kriminalitet",
    subgenre: "Netværkskrimi",
    description: "Hierarki, loyalitet, netværk og konsekvenser uden glorificering.",
    tone: "Rå, relationel",
    tags: ["netværk", "loyalitet", "magt"],
    chapters: [
      { title: "1. Netværket", beats: ["Magtstruktur", "Loyalitet"] },
      { title: "2. Presset", beats: ["Ekstern trussel", "Intern konflikt"] },
      { title: "3. Alliancer", beats: ["Skift", "Mistillid"] },
      { title: "4. Forræderi", beats: ["Pris", "Vendepunkt"] },
      { title: "5. Fald", beats: ["Sammenbrud", "Eftervirkning"] }
    ]
  },
  {
    id: "cyber",
    name: "Cybercrime-fiktion",
    subgenre: "Tech-krimi",
    description: "Digital efterforskning på principielt niveau uden operationelle angrebsinstruktioner.",
    tone: "Kølig, teknisk, hurtig",
    tags: ["digital", "teknologi", "etik"],
    chapters: [
      { title: "1. Bruddet", beats: ["Symptom", "Konsekvens"] },
      { title: "2. Fodspor", beats: ["Principiel sporing", "Menneskelig fejl"] },
      { title: "3. Personen", beats: ["Motiv", "Profil"] },
      { title: "4. Modtræk", beats: ["Kat og mus", "Etisk valg"] },
      { title: "5. Systemet", beats: ["Sårbarhed", "Konsekvens"] }
    ]
  },
  {
    id: "social",
    name: "Socialrealistisk krimi",
    subgenre: "Socialrealisme",
    description: "Kriminalitet forankret i miljø, institutioner og strukturelle vilkår.",
    tone: "Empatisk, konkret",
    tags: ["ulighed", "miljø", "institutioner"],
    chapters: [
      { title: "1. Miljøet", beats: ["Sted", "Vilkår", "Relationer"] },
      { title: "2. Presset", beats: ["Økonomi", "Valg"] },
      { title: "3. Skreddet", beats: ["Handling", "Konsekvens"] },
      { title: "4. Systemet reagerer", beats: ["Institutioner", "Labeling"] },
      { title: "5. Efter", beats: ["Fællesskab", "Ansvar"] }
    ]
  },
  {
    id: "case-study",
    name: "Kriminologisk case study",
    subgenre: "Analytisk fiktion",
    description: "En fiktiv sag analyseret gennem flere kriminologiske teorier.",
    tone: "Analytisk, reflekteret",
    tags: ["teori", "analyse", "case"],
    chapters: [
      { title: "1. Sagens fakta", beats: ["Neutral beskrivelse", "Afgrænsning"] },
      { title: "2. Aktørerne", beats: ["Kontekst", "Institutioner"] },
      { title: "3. Teorilag", beats: ["Routine activity", "Strain", "Labeling"] },
      { title: "4. Modanalyse", beats: ["Begrænsninger", "Alternative forklaringer"] },
      { title: "5. Refleksion", beats: ["Etik", "Konklusion"] }
    ]
  }
];
