import { db } from "@/lib/data/db";
import { blankAttachment, blankPerson, blankProject, blankSchedule, blankTask, defaultSettings } from "@/lib/data/factories";
import { textPdf } from "@/lib/data/sample-pdf";
import { migrateSeededProjectManager } from "@/lib/data/role-migration";
import { deleteProject, getSettings, removeSampleData, saveAttachment, savePerson, saveProject, saveSchedule, saveSettings, saveTask } from "@/lib/data/repo";
import { SEEDED_MAT_ID, SEEDED_PROFILE_NAME, SEEDED_PROFILE_ROLE } from "@/lib/data/roles";
import type { Task } from "@/lib/data/types";

/** Jobs loaded from the AKA Electric Drive read. Not a live field book. */
export const DRIVE_SEED_REVISION = "drive-2026-10-23";
export const DRIVE_AS_OF = "10/23/26";

const FINDLEY_SOURCE = "Google Drive folder 26194 Findley State Park, as of 10/23/26";
const MEETING = "Findley State Park Meeting Summary October 21 2026";
const PETER_SCHEDULE = "St. Peters Parish Hall Schedule #9-1 - Contract Baseline incl. OCO #1.pdf";

export const DRIVE_IDS = {
  findley: "sample-findley",
  peter: "sample-st-peter",
  mat: SEEDED_MAT_ID,
} as const;

let seeding: Promise<void> | null = null;

export function resetSeedGate(): void {
  seeding = null;
}

export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = seedIfNeeded()
      .then(() => migrateSeededProjectManager())
      .catch((error) => {
        seeding = null;
        throw error;
      });
  }
  return seeding;
}

async function seedIfNeeded(): Promise<void> {
  const settings = await getSettings();
  if ((settings.seedRevision ?? "") === DRIVE_SEED_REVISION) return;
  await removeSampleData();
  await seedSampleData();
  const fresh = await getSettings();
  await saveSettings({ ...fresh, samplesSeeded: true, seedRevision: DRIVE_SEED_REVISION });
}

export async function seedSampleData(): Promise<void> {
  await savePerson(
    blankPerson({
      id: DRIVE_IDS.mat,
      name: SEEDED_PROFILE_NAME,
      classification: SEEDED_PROFILE_ROLE,
      phone: "",
      isSample: false,
    }),
  );

  await saveProject(
    blankProject({
      id: DRIVE_IDS.findley,
      name: "Findley State Park",
      jobNumber: "26194",
      gc: "Needs verification",
      location: "Findley State Park",
      description:
        "AKA Job 26194. From the Drive folder as of 10/23/26 (Addenda 1 and 2, the 105-sheet plan set, the specs, and the 10-21-26 meeting summary). Underground conduit is bored by others. AKA scope on record is pulling the wire. Pedestal, panel, and stub scope needs verification. Utility LMRE supplies the transformers. Scope starts at the transformer secondaries. Panels FS-1 through FS-6. All copper conductors (Addendum 2). Sch 40 PVC, 3-inch stub at each pedestal (sheet E12, rev 7/31/26). 119 pads, 4 of them ADA (sites 1, 33, 54, and 104). Street address and contacts need verification.",
      status: "unverified",
      contacts: [],
      isSample: true,
    }),
  );

  await saveProject(
    blankProject({
      id: DRIVE_IDS.peter,
      name: "St. Peter Church",
      jobNumber: "",
      gc: "Needs verification",
      location: "Needs verification",
      description: `St. Peters Parish Hall. From Drive as of ${DRIVE_AS_OF}. The only schedule found is "${PETER_SCHEDULE}" (Drive file last modified 3/10/26). It is stale. A current schedule needs verification. Job number, GC, location, contacts, and scope need verification.`,
      status: "unverified",
      contacts: [],
      isSample: true,
    }),
  );

  const findleyDates = [
    [
      "drive-findley-ntp",
      "Anticipated NTP (not executed)",
      "2026-10-06",
      "No executed NTP was in the folder. The 10/21/26 meeting notes say the GC rep recalled October 6 as the original Phase 1 start. Not confirmed.",
    ],
    [
      "drive-findley-phase2-start",
      "Phase 2 start, sites 180-183 and 234-242",
      "2026-12-01",
      "Date taken from the Drive folder review on 10/23/26. No baseline schedule was found. The 10/21/26 meeting only recalled mid-December. Needs verification.",
    ],
    [
      "drive-findley-phase2-end",
      "Phase 2 end, sites 180-183 and 234-242",
      "2027-06-30",
      "Date taken from the Drive folder review on 10/23/26. No baseline schedule was found. Needs verification.",
    ],
    [
      "drive-findley-phase1-turnover",
      "Phase 1 turnover",
      "2027-09-10",
      "Date taken from the Drive folder review on 10/23/26. No baseline schedule was found. Needs verification.",
    ],
  ] as const;

  for (const [id, label, date, notes] of findleyDates) {
    await saveSchedule(
      blankSchedule(DRIVE_IDS.findley, {
        id,
        label,
        date,
        confirmation: "tentative",
        kind: "milestone",
        notes,
      }),
    );
  }

  const findleyTasks: Array<Pick<Task, "id" | "title" | "details" | "owner" | "evidence">> = [
    {
      id: "drive-findley-scope",
      title: "Verify pedestal, panel, and stub scope",
      details:
        "AKA scope on record is pulling wire in conduit bored by others. The 10/21/26 meeting notes also say AKA installs pedestal mounts and pad stub-outs. Those statements are not reconciled here.",
      owner: "Needs verification",
      evidence: `${FINDLEY_SOURCE}. ${MEETING}.`,
    },
    {
      id: "drive-findley-handoff",
      title: "Boring handoff and conduit acceptance",
      details: "A separate contractor bores the underground conduit. No acceptance record was in the folder before AKA pulls wire.",
      owner: "Needs verification",
      evidence: `${FINDLEY_SOURCE}. ${MEETING}: AKA can pull once the required runs are complete.`,
    },
    {
      id: "drive-findley-pull",
      title: "Pull plan",
      details: "No pull plan was in the folder as of 10/23/26.",
      owner: "Needs verification",
      evidence: FINDLEY_SOURCE,
    },
    {
      id: "drive-findley-tugger",
      title: "Tugger",
      details: "Pulling equipment is not confirmed. The 10/21/26 meeting asked Mat to check what the equipment lead has.",
      owner: "Mat Hiner",
      evidence: MEETING,
    },
    {
      id: "drive-findley-ntp",
      title: "Confirm schedule and NTP",
      details: "Anticipated NTP is 10/6/26. No executed NTP was found. Phase dates are stored as tentative.",
      owner: "Needs verification",
      evidence: `${FINDLEY_SOURCE}. ${MEETING} says starts were not confirmed.`,
    },
    {
      id: "drive-findley-duration",
      title: "Contract duration conflict, 340 vs 354 days",
      details: "Both durations appear in the folder. Not resolved.",
      owner: "Needs verification",
      evidence: FINDLEY_SOURCE,
    },
    {
      id: "drive-findley-baseline",
      title: "No baseline schedule found",
      details: "A baseline schedule was not in the folder as of 10/23/26.",
      owner: "Needs verification",
      evidence: FINDLEY_SOURCE,
    },
  ];

  for (const task of findleyTasks) {
    await saveTask(
      blankTask(DRIVE_IDS.findley, {
        ...task,
        dueDate: null,
        dueConfirmation: "tentative",
        status: "open",
        isSample: true,
      }),
    );
  }

  await saveTask(
    blankTask(DRIVE_IDS.peter, {
      id: "drive-peter-schedule",
      title: "Get the current parish hall schedule",
      details: `The only schedule found is "${PETER_SCHEDULE}". Drive shows that file last modified 3/10/26. Treat it as stale.`,
      owner: "Needs verification",
      dueDate: null,
      dueConfirmation: "tentative",
      status: "open",
      evidence: `Google Drive, reviewed ${DRIVE_AS_OF}. File last modified 2026-03-10.`,
      isSample: true,
    }),
  );
  await saveTask(
    blankTask(DRIVE_IDS.peter, {
      id: "drive-peter-details",
      title: "Verify job number, GC, location, contacts, and scope",
      details: "None of those were verified from Drive as of 10/23/26.",
      owner: "Needs verification",
      dueDate: null,
      dueConfirmation: "tentative",
      status: "open",
      evidence: `Drive review ${DRIVE_AS_OF}. No other St. Peters Parish Hall project file was used.`,
      isSample: true,
    }),
  );

  const findleyNote = textPdf("Findley State Park - Drive notes 10/23/26", [
    "Not a construction document. Not a takeoff. No quantities beyond what is written here.",
    "Source: Google Drive folder 26194 Findley State Park, as of 10/23/26.",
    "Files named in that read: Addenda 1 and 2, the 105-sheet plan set,",
    "Specs-Findley State Park.pdf, Plans-Findley State Park-Campground Improvements-Complete Set.pdf,",
    "and Findley State Park Meeting Summary October 21 2026.",
    "AKA Job 26194.",
    "Underground conduit is bored by others. AKA scope on record is pulling the wire.",
    "Pedestal, panel, and stub scope: needs verification.",
    "Utility LMRE supplies the transformers. Scope starts at the transformer secondaries.",
    "Panels FS-1 through FS-6.",
    "All copper conductors (Addendum 2).",
    "Sch 40 PVC, 3-inch stub at each pedestal (sheet E12, rev 7/31/26).",
    "119 pads. 4 ADA sites: 1, 33, 54, and 104.",
    "Anticipated NTP 10/6/26. No executed NTP found.",
    "Phase 2 sites 180-183 and 234-242: 12/1/26 to 6/30/27. Tentative. No baseline schedule.",
    "Phase 1 turnover 9/10/27. Tentative. No baseline schedule.",
    "Open: contract duration 340 vs 354 days.",
    "Open: boring handoff, pull plan, tugger, schedule and NTP confirmation.",
    "GC, street address, contacts, weather, hours, and prices: needs verification.",
    "The 10/21/26 meeting is notes only. It is not an approved schedule or a purchase authorization.",
  ]);
  const peterNote = textPdf("St. Peter Church - Drive notes 10/23/26", [
    "Not a construction document.",
    "St. Peter Church (St. Peters Parish Hall).",
    "Drive review as of 10/23/26.",
    "Only schedule found: St. Peters Parish Hall Schedule #9-1 - Contract Baseline incl. OCO #1.pdf.",
    "That Drive file was last modified 3/10/26 and is treated as stale.",
    "A current schedule needs verification.",
    "Job number, GC, location, contacts, and scope: needs verification.",
    "No weather, hours, quantities, or prices were taken from this file.",
  ]);

  await saveAttachment(
    blankAttachment(DRIVE_IDS.findley, {
      id: "drive-file-findley-notes",
      parentType: "project",
      parentId: DRIVE_IDS.findley,
      fileName: "Drive-as-of-2026-10-23-Findley-26194.pdf",
      mimeType: "application/pdf",
      blob: findleyNote,
      isSample: true,
    }),
  );
  await saveAttachment(
    blankAttachment(DRIVE_IDS.peter, {
      id: "drive-file-peter-notes",
      parentType: "project",
      parentId: DRIVE_IDS.peter,
      fileName: "Drive-as-of-2026-10-23-St-Peter-Church.pdf",
      mimeType: "application/pdf",
      blob: peterNote,
      isSample: true,
    }),
  );
}

export async function reloadSampleData(): Promise<void> {
  const projects = await db.projects.filter((project) => project.isSample).toArray();
  for (const project of projects) {
    if (!project.deletedAt) await deleteProject(project.id);
  }
  await seedSampleData();
  const settings = await getSettings();
  await saveSettings({ ...settings, samplesSeeded: true, seedRevision: DRIVE_SEED_REVISION });
}

export { defaultSettings };
