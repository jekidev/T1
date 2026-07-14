import type { Project } from "../types";

export const demoProject = (): Project => ({
  id: "prj_nordhavn",
  title: "Skyggen over Nordhavn",
  genre: "Nordic noir",
  status: "udkast",
  wordGoal: 65000,
  synopsis: "Kriminalinspektør Malene Krogh graver sig ned i en anonym kvindes død på Nordhavn, mens byen omkring hende forvandles til glas og penge.",
  updatedAt: new Date().toISOString(),
  chapters: [
    { id: "ch1", title: "1. Tågen over kajen", order: 0 },
    { id: "ch2", title: "2. Kvinden i containeren", order: 1 },
    { id: "ch3", title: "3. Havnearbejderens søn", order: 2 },
    { id: "ch4", title: "4. Registret der forsvandt", order: 3 }
  ],
  scenes: [
    {
      id: "sc1",
      chapterId: "ch1",
      title: "Fund ved kaj 14",
      status: "arbejde",
      updatedAt: new Date().toISOString(),
      content: `Regnen kom ind fra Øresund i lange, grå bånd, og Malene Krogh trak kraven op om ørerne, mens hun trådte ind mellem containerne. Kaj 14 lå tavs. Kun kranerne knirkede oppe i mørket, som gamle knogler der havde stået for længe i træk.\n\n“Hun blev fundet klokken 05.42,” sagde politiassistent Vinter. Han holdt lygten lavt, som om lyset kunne vække nogen.\n\nMalene bøjede sig ned. Kvinden lå på siden, halvt inde i skyggen af en rusten container. Ingen taske, ingen telefon, ingen ring — og alligevel havde hun engang været nogens datter i denne by.`
    },
    {
      id: "sc2",
      chapterId: "ch1",
      title: "Første afhøring",
      status: "kladde",
      updatedAt: new Date().toISOString(),
      content: `Havnearbejderen hed Rasmus Ehlers, tre og fyrre år, skæg der lugtede af tobak og saltvand. Han sad på den blå plaststol og drejede en kaffekop mellem hænderne.\n\n“Jeg gik forbi den container hver morgen,” sagde han. “Hver morgen i tolv år. I dag stod låget på klem.”`
    }
  ],
  characters: [
    { id: "c1", name: "Malene Krogh", role: "Kriminalinspektør", motive: "Løser sager for at holde sin egen skyld på afstand", bio: "42 år, flyttet til København efter en sag der brændte hende." },
    { id: "c2", name: "Rasmus Ehlers", role: "Havnearbejder", motive: "Beskytter et fællesskab han ikke længere selv tilhører" },
    { id: "c3", name: "Line Bertelsen", role: "Journalist", motive: "Vil skrive Nordhavns forvandling frem — koste hvad det vil" }
  ],
  evidence: [
    { id: "e1", name: "Rustpletter på containerlåg", kind: "spor", reliability: "verificeret", notes: "Tyder på nyligt åbnet med værktøj" },
    { id: "e2", name: "Sms fra ukendt nummer 04.11", kind: "dokument", reliability: "usikker", notes: "Kan være reklame eller et mødested" },
    { id: "e3", name: "Anonym anmeldelse fra torsdag", kind: "vidneudsagn", reliability: "red_herring" }
  ],
  timeline: [
    { id: "t1", date: "2026-03-11T22:00:00Z", title: "Kvinden ses sidst i Sundkrogsgade", actorId: "c3" },
    { id: "t2", date: "2026-03-12T04:11:00Z", title: "Sms sendes fra ukendt nummer" },
    { id: "t3", date: "2026-03-12T05:42:00Z", title: "Fund på kaj 14", actorId: "c2" }
  ],
  relationships: [
    { id: "r1", fromId: "c1", toId: "c2", label: "afhører" },
    { id: "r2", fromId: "c3", toId: "c1", label: "kilde til" }
  ],
  research: [
    { id: "n1", title: "Nordhavns udvikling", body: "Fra industrikaj til boligområde.", status: "fakta" },
    { id: "n2", title: "DNA på metal", body: "Skal verificeres med retsmedicinsk kilde.", status: "skal verificeres" }
  ],
  previews: [],
  lastSceneId: "sc1"
});
