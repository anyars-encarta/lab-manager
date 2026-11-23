import "dotenv/config";
import { auth } from "../auth.js";
import { db } from "./index.js";
import { asc, eq } from "drizzle-orm";
import { facilities, investigations, users } from "./schema.js";

const name = process.env.ADMIN_NAME;
const email = (process.env.ADMIN_EMAIL!).toLowerCase();
const password = process.env.ADMIN_PASSWORD;

const investigationNames = [
  "2 Hour Post Prandial Blood Glucose",
  "24hr Urine for Protein",
  "Acid Phosphatase",
  "AEC",
  "Alanine Aminotransferase (ALT)",
  "Alpha Amylase (Serum/Urine)",
  "Alpha-Fetoprotein (AFP)",
  "Anti-streptolysin test",
  "Ap-Prothrombin Time",
  "Arterial Blood Gas (ABG)",
  "A-scan",
  "ASO titre",
  "Aspartate Aminotransferase (AST)",
  "B/F for Malaria Parasites",
  "Barium Enema",
  "Barium Meal",
  "Barium Meal & Follow Through",
  "Barium Swallow",
  "Bilirubin",
  "Biopsy L/A",
  "Bleeding and Clotting Time",
  "Blood for C/S",
  "Blood Grouping",
  "Blood Grouping & Antibody Screen",
  "Blood Parasites",
  "Blood Sugar PP",
  "Blood Urea",
  "Blood Urea & Electrolytes",
  "Bone Marrow - Trephine Biopsy",
  "Bone Marrow Aspirate",
  "Bone Scan",
  "Breast tissue Biopsy",
  "Bue & Creatinine",
  "C Reactive Protein",
  "Calcium Infusion test",
  "Cancer antigen 19-9",
  "Carcino Embryonic Antigen (CEA)",
  "Cerebrospinal Fluid for C/S",
  "Chloride",
  "Clusters Of Differentiation Cells (CD4)",
  "Coombs Test (Direct)",
  "Creatine Kinase - Mb (CK - Mb)",
  "Creatine Kinase (CK)",
  "CSF Latex Agglutination",
  "Cystogram",
  "Cytology",
  "Demonstration of Heinz bodies",
  "Digoxin Level",
  "Dihydroxy Epiandesterone Sulphate (Dhea-S)",
  "Direct Bilirubin/Total Bilirubin",
  "Donor Screening for HBsAg",
  "Doppler Scan",
  "Ductologram/Galactography",
  "ECG",
  "EEG (Electroencephalogram)",
  "Erythrocyte Sedimentation Rate (ESR)",
  "Estrogen",
  "Factor IX",
  "Factor VIII",
  "Fasting Blood Sugar",
  "Fistulogram",
  "Follicle Stimulating Hormone (FSH)",
  "FT3",
  "FT4",
  "Full Blood Count FBC (Auto) & Film Comment",
  "Full Blood Count FBC (Automation)",
  "Full Blood Count with Film Comment (Manual)",
  "Fungal Cultures",
  "Gamma Glutamyl Transferase (GGT)",
  "Glucose-6-Phosphate Dehydrogenase (G6PD)",
  "Glycosylated Haemoglobin (HBA 1C)",
  "Gonioscopy",
  "Grouping/X' Matching/Unit",
  "Guthrie test",
  "Haemoglobin A2 & F Estimation",
  "Haemoglobin Electrophoresis",
  "Haemoglobin Estimation (HB)",
  "HDL - Cholesterol",
  "Helicobacter Pylori Test",
  "Hematocrit",
  "Hepatitis B Surface Antigen (HBSAG) HBV",
  "Hepatitis B Virus Profile (HBV Profile)",
  "Hepatitis C screening",
  "High Vaginal Swab for C/S",
  "High Vaginal Swab Routine Examination",
  "Histopathology  (Extra Large Sample)",
  "Histopathology  (Large Sample)",
  "Histopathology  (Medium Sample)",
  "Histopathology  (Small Sample)",
  "Holter",
  "Human Immunodeficiency Virus (HIV) Confirmation",
  "Human Immunodeficiency Virus (HIV) Screening",
  "Hysterosalpingogram",
  "Immunostaining",
  "Intravenous Urography",
  "IOPA Xray",
  "Keratometry",
  "LDL - Cholesterol",
  "LFT",
  "Lipid Profile",
  "Lupus Erythematosus Cell (Le Cell)",
  "Luteinizing Hormone (LH)",
  "Magnesium",
  "Malaria Card Test (Dipstik assay/rapid card)",
  "Mammogram",
  "Miscelllaneous Cultures (Fluids, Aspirates & Exudates)",
  "Myelogram - 1 Region",
  "Myocardial perfusion imaging",
  "NA+",
  "Oral Glucose Tolerance Test (OGTT)",
  "Orthopanthomograph (OPT)",
  "Pancreatic Amylase",
  "Pap Smear/Fine Needle Aspiration",
  "Percutaneous Biopsy - Flouroscopic Guide",
  "Phosphorus",
  "Plasma Cortisol",
  "Platelet Count",
  "Pleural fluid analysis",
  "Potassium",
  "Pregnancy Test",
  "Progesterone (Prog)",
  "Prostate Specific Antigen (PSA)",
  "Prothrombin Time",
  "Pulmonary Function test",
  "Random Blood Sugar",
  "Renal Function Test",
  "Reticulocyte Count (Retics)",
  "RH Typing",
  "Rheumatoid Factor",
  "Routine Stool Examination",
  "Routine Urine Examination",
  "Semen Analysis",
  "Serum Adrenocorticotropic Hormone (ACTH)",
  "Serum Albumin",
  "Serum Alkaline Phosphatase (ALP)",
  "Serum Beta-Human Chorionic Gonadotropin (HCG)",
  "Serum Calcium",
  "Serum Creatinine",
  "Serum Electrolyte (Na+, K+)",
  "Serum Ferritin",
  "Serum Iron (Fe)",
  "Serum Lactate Dehydrogenase (LDH)",
  "Serum Prolactin (PRL)",
  "Serum Total Protein",
  "Serum Triglyceride",
  "Serum Uric Acid",
  "Serum vitamin B12, and folate levels",
  "Sialogram",
  "Sickling Test",
  "Skin Scrapping for Fungal Elements",
  "Skin Snip",
  "Stool C/S",
  "Stool for Occult Blood",
  "T3",
  "T4",
  "Testosterone",
  "Thyroid Function Test (TSH)",
  "Thyroid Profile",
  "Total Iron Binding Capacity (TIBC)",
  "Total leucocyte count",
  "Total Proteins Blood",
  "Total Serum Cholesterol",
  "Transhepatic cholangiography (PTC)",
  "Trophozoite Count",
  "Troponin",
  "Typhi Dot",
  "Ultrasound",
  "Ultrasound - 2 Regions",
  "Ultrasound biomicroscopy",
  "Ultrasound Guided Incision & Drainage",
  "Urethrogram",
  "Urine C/S",
  "Urine For Bence Jones Protein",
  "Urine Sugar",
  "VCT",
  "Veneral Disease Research Laboratory (VDRL)",
  "Venogram - 1 Region",
  "Viral serology",
  "Vitality Test",
  "VLDL",
  "WBC+Differential",
  "Widal Test",
  "X-ray one region",
  "X-ray two region",
];

async function seed() {
  if (password!.length < 8) {
    throw new Error("ADMIN_PASSWORD must contain at least 8 characters");
  }

  let user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    const created = await auth.api.signUpEmail({
      body: { name: String(name), email: String(email), password: String(password) },
    });
    if (!created?.user?.id) {
      throw new Error("Better Auth did not return a created user");
    }

    await db.update(users)
      .set({ role: "admin", active: true, emailVerified: true })
      .where(eq(users.id, created.user.id));
    user = await db.query.users.findFirst({
      where: eq(users.id, created.user.id),
    });
  } else {
    await db.update(users)
      .set({ role: "admin", active: true })
      .where(eq(users.id, user.id));
  }

  if (!user) {
    throw new Error("Unable to create or locate the admin user");
  }

  console.log(`Admin user seeded: ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("No ADMIN_PASSWORD was provided; the admin user may not be able to log in.");
  }
  const facility = (await db.select().from(facilities).orderBy(asc(facilities.name)).limit(1))[0];
  if (!facility) throw new Error("Seed requires at least one facility");

  const specimenFor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("urine") || lower.includes("bence")) return "Urine";
    if (lower.includes("stool")) return "Stool";
    if (lower.includes("semen")) return "Semen";
    if (lower.includes("swab") || lower.includes("pap smear") || lower.includes("biopsy") ||
        lower.includes("tissue") || lower.includes("skin") || lower.includes("aspirate") ||
        lower.includes("histopathology") || lower.includes("cytology") || lower.includes("sialogram")) return "Specimen";
    if (lower.includes("x-ray") || lower.includes("scan") || lower.includes("ultrasound") ||
        lower.includes("ecg") || lower.includes("eeg") || lower.includes("doppler") ||
        lower.includes("mammogram") || lower.includes("myelogram") || lower.includes("barium") ||
        lower.includes("urography") || lower.includes("hysterosalpingogram") || lower.includes("venogram") ||
        lower.includes("cystogram") || lower.includes("fistulogram") || lower.includes("urethrogram") ||
        lower.includes("cholangiography") || lower.includes("ductologram") || lower.includes("holter")) return "Imaging";
    if (lower.includes("cerebrospinal") || lower.includes("csf")) return "Cerebrospinal fluid";
    if (lower.includes("arterial blood")) return "Arterial blood";
    if (lower.includes("blood") || lower.includes("haem") || lower.includes("hem") ||
        lower.includes("glucose") || lower.includes("sugar") || lower.includes("hb") ||
        lower.includes("electrolyte") || lower.includes("cholesterol") || lower.includes("calcium") ||
        lower.includes("protein") || lower.includes("bilirubin") || lower.includes("creatinine") ||
        lower.includes("urea") || lower.includes("iron") || lower.includes("lft") ||
        lower.includes("lipid") || lower.includes("troponin") || lower.includes("factor") ||
        lower.includes("reticulocyte") || lower.includes("platelet") || lower.includes("phosphorus") ||
        lower.includes("magnesium") || lower.includes("potassium") || lower.includes("chloride") ||
        lower.includes("albumin") || lower.includes("hormone") || lower.includes("antigen") ||
        lower.includes("testosterone") || lower.includes("t3") || lower.includes("t4") ||
        lower.includes("ldl") || lower.includes("hdl") || lower.includes("vldl")) return "Blood";
    return "Other";
  };

  let createdCount = 0;
  let existingCount = 0;
  for (let index = 0; index < investigationNames.length; index += 1) {
    const code = `INVE${String(index + 1).padStart(2, "0")}`;
    const name = investigationNames[index];
    const existing = await db.query.investigations.findFirst({
      where: eq(investigations.code, code),
    });
    if (existing) {
      existingCount += 1;
      continue;
    }
    await db.insert(investigations).values({
      facilityId: facility.id,
      code,
      gdrgCode: code,
      name,
      category: "investigation",
      specimenType: specimenFor(name),
      price: "0.00",
      coveredTariff: "0.00",
      uncoveredTariff: "0.00",
      topUp: "0.00",
      covered: true,
      active: true,
    });
    createdCount += 1;
  }
  console.log(`Investigation seed completed: ${createdCount} created, ${existingCount} already existed`);
}

seed().catch((error) => {
  console.error("Admin seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
