/**
 * Reads the PrivateHealth.gov.au product XML (schema V3.1, opened 17 Nov 2026 from the November 2026 ZIP)
 * into our model. Layout, documented in docs/health-cover-columns.md:
 *   - one file per cover type and status: "Hospital Open", "Combined Closed", "GeneralHealth Open" and so on,
 *     each a flat <Products Count=".."> of <Product> (the default namespace sits on every <Product>);
 *   - one "Funds" file with a <Fund> per insurer;
 *   - sizes run to 700 MB, so product files are streamed and cut at </Product>; no file is read whole.
 * Each product is parsed on its own. Closed products are skipped unless asked for. Anything absent stays unset.
 */
import { createHash } from "node:crypto";
import { createReadStream, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";
import type {
  CoverKind,
  CoverState,
  HealthInsurer,
  HealthProduct,
  HealthWaiting,
  ProductHousehold,
} from "./types.js";

const ARRAYS = new Set(["Fund", "MedicalService", "WaitingPeriod", "DependantCover"]);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAYS.has(name),
});

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);

/** Text of an element: a plain string, or the #text of one that also has attributes. A nil element has no text. */
function tx(v: unknown): string | undefined {
  if (typeof v === "string" || typeof v === "number") return String(v).trim() || undefined;
  if (isNode(v) && "#text" in v) return tx(v["#text"]);
  return undefined;
}
const attr = (n: Node | undefined, name: string): string | undefined => {
  const v = n?.[`@_${name}`];
  return typeof v === "string" ? v : undefined;
};
const arr = (v: unknown): Node[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]).filter(isNode);

/** Dollars as published ("277.48") to whole cents. Undefined for anything that is not a non-negative number. */
export const cents = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};

const KINDS: Record<string, CoverKind> = {
  hospital: "hospital",
  generalhealth: "general_treatment",
  combined: "combined",
};
const COVERS: Record<string, CoverState> = { Covered: "covered", Restricted: "restricted", NotCovered: "not_covered" };
const LETTER: Record<CoverState, string> = { covered: "C", restricted: "R", not_covered: "N" };
/** The seven hospital tiers the schema lists; anything else is reported, not dropped. */
export const HOSPITAL_TIERS = ["Basic", "BasicPlus", "Bronze", "BronzePlus", "Silver", "SilverPlus", "Gold"] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface HealthParseReport {
  insurers: number;
  productsRead: number;
  productsKept: number;
  closedSkipped: number;
  productsWithoutPremium: number;
  duplicateIds: string[];
  unknownFunds: string[];
  unknownTiers: string[];
  byKind: Record<string, number>;
  byTier: Record<string, number>;
  byState: Record<string, number>;
  byHousehold: Record<string, number>;
  problems: string[];
}

export interface HealthParseResult {
  insurers: HealthInsurer[];
  products: HealthProduct[];
  categoryTitles: string[];
  report: HealthParseReport;
}

/** Household from the file's WhoIsCovered element: never guessed when the element is missing or odd. */
function householdOf(w: unknown): { household?: ProductHousehold; dependants: string[] } {
  if (!isNode(w)) return { dependants: [] };
  if (attr(w, "OnlyOnePerson") === "true") return { household: "single", dependants: [] };
  const cov = isNode(w.Coverage) ? w.Coverage : undefined;
  const adults = Number(attr(cov, "NumberOfAdults"));
  const dependants = arr(cov?.DependantCover)
    .filter((d) => attr(d, "Covered") === "true")
    .map((d) => attr(d, "Title") ?? "")
    .filter(Boolean);
  if (!cov || !Number.isFinite(adults)) return { dependants };
  if (adults === 0) return { household: "dependants_only", dependants };
  if (adults === 1) return { household: dependants.length ? "single_parent" : "single", dependants };
  if (adults === 2) return { household: dependants.length ? "family" : "couple", dependants };
  return { dependants };
}

function onlyAvailableWith(n: unknown): string | undefined {
  if (!isNode(n)) return undefined;
  if ("AnyHospital" in n) return "any hospital cover";
  if ("AnyGeneralHealth" in n) return "any general health cover";
  const codes = tx(n.Products);
  return codes ? `product groups ${codes.split(";").map((c) => c.trim()).filter(Boolean).join(", ")}` : undefined;
}

/** Cuts a text stream into <Product>…</Product> pieces. Feed chunks in order; each call returns the pieces now complete. */
export class ProductSplitter {
  private buf = "";
  feed(chunk: string): string[] {
    this.buf += chunk;
    const out: string[] = [];
    for (;;) {
      const start = /<Product[\s>]/.exec(this.buf);
      if (!start) {
        // keep only a possible partial "<Product" at the very end
        this.buf = this.buf.slice(Math.max(0, this.buf.length - 9));
        return out;
      }
      const end = this.buf.indexOf("</Product>", start.index);
      if (end < 0) {
        this.buf = this.buf.slice(start.index);
        return out;
      }
      out.push(this.buf.slice(start.index, end + "</Product>".length));
      this.buf = this.buf.slice(end + "</Product>".length);
    }
  }
}

export interface ParseOptions {
  /** Keep products that are closed to new members. Off by default. */
  includeClosed?: boolean;
}

/** Collects funds and products, then reports. Products are parsed one at a time, so memory holds only the kept rows. */
export class HealthAccumulator {
  private insurers: HealthInsurer[] = [];
  private products: HealthProduct[] = [];
  private seen = new Set<string>();
  private titleIndex = new Map<string, number>();
  private duplicateIds: string[] = [];
  private unknownFunds = new Set<string>();
  private unknownTiers = new Set<string>();
  private problems: string[] = [];
  private read = 0;
  private closedSkipped = 0;
  constructor(private opts: ParseOptions = {}) {}

  addFunds(xml: string, fileName = "Funds"): void {
    let doc: Node;
    try {
      doc = parser.parse(xml) as Node;
    } catch (e) {
      this.problems.push(`${fileName}: not valid XML (${(e as Error).message.slice(0, 80)})`);
      return;
    }
    const funds = arr(isNode(doc.Funds) ? doc.Funds.Fund : undefined);
    if (funds.length === 0) this.problems.push(`${fileName}: no <Fund> elements found`);
    for (const f of funds) {
      const code = tx(f.FundCode);
      const name = tx(f.FundName);
      if (!code || !name) {
        this.problems.push(`${fileName}: a fund has no FundCode or FundName`);
        continue;
      }
      const type = tx(f.FundType)?.toLowerCase();
      const hint = isNode(f.Restrictions) ? tx(f.Restrictions.RestrictionHint) : undefined;
      this.insurers.push({
        id: slug(code),
        name,
        ...(type === "open" || type === "restricted" ? { fundType: type } : {}),
        ...(hint ? { restrictionHint: hint } : {}),
      });
    }
  }

  /** One <Product> element as text. */
  addProduct(xml: string, fileName = "products"): void {
    this.read++;
    // The extras and ambulance blocks are large and not used, so they are cut before parsing.
    const slim = xml
      .replace(/<GeneralHealthCover[\s>][\s\S]*?<\/GeneralHealthCover>/, "")
      .replace(/<ProductAmbulance[\s>][\s\S]*?<\/ProductAmbulance>/, "");
    let p: Node;
    try {
      const doc = parser.parse(slim) as Node;
      if (!isNode(doc.Product)) throw new Error("no Product");
      p = doc.Product;
    } catch (e) {
      this.problems.push(`${fileName}: a product is not valid XML (${(e as Error).message.slice(0, 60)})`);
      return;
    }
    const id = attr(p, "ProductID");
    const code = attr(p, "ProductCode");
    const name = tx(p.Name);
    const fundCode = tx(p.FundCode);
    const kind = KINDS[(tx(p.ProductType) ?? "").toLowerCase()];
    if (!id || !code || !name || !fundCode || !kind) {
      this.problems.push(`${fileName}: a product has no ProductID, ProductCode, Name, FundCode or recognised ProductType (${code ?? name ?? "?"})`);
      return;
    }
    const status = (tx(p.ProductStatus) ?? "").toLowerCase() === "closed" ? "closed" : "open";
    if (status === "closed" && !this.opts.includeClosed) {
      this.closedSkipped++;
      return;
    }
    if (this.seen.has(id)) {
      this.duplicateIds.push(id);
      return;
    }
    this.seen.add(id);
    const insurerId = slug(fundCode);

    const stateRaw = tx(p.State)?.toUpperCase();
    const state = stateRaw && stateRaw !== "ALL" ? stateRaw : undefined;
    const { household, dependants } = householdOf(p.WhoIsCovered);

    const ex = isNode(p.Excesses) ? p.Excesses : undefined;
    const excessType = attr(ex, "ExcessType");
    const perAdmission = cents(tx(ex?.ExcessPerAdmission));
    const perPerson = cents(tx(ex?.ExcessPerPerson));
    const perPolicy = cents(tx(ex?.ExcessPerPolicy));
    const excess = perPerson ?? perPolicy ?? perAdmission ?? (excessType === "None" ? 0 : undefined);

    const premium = cents(tx(p.PremiumNoRebate));
    const hospitalPart = cents(tx(p.PremiumHospitalComponent));

    const hc = isNode(p.HospitalCover) ? p.HospitalCover : undefined;
    const tier = tx(hc?.HospitalTier);
    if (tier && !(HOSPITAL_TIERS as readonly string[]).includes(tier)) this.unknownTiers.add(tier);
    const letters: string[] = [];
    for (const m of arr(hc?.MedicalService)) {
      const title = attr(m, "Title");
      const cover = COVERS[attr(m, "Cover") ?? ""];
      if (!title || !cover) continue;
      let idx = this.titleIndex.get(title);
      if (idx === undefined) {
        idx = this.titleIndex.size;
        this.titleIndex.set(title, idx);
      }
      while (letters.length <= idx) letters.push("?");
      letters[idx] = LETTER[cover];
    }
    const waiting: HealthWaiting[] = arr(isNode(hc?.WaitingPeriods) ? hc.WaitingPeriods.WaitingPeriod : undefined).flatMap((w) => {
      const type = attr(w, "Title");
      const months = Number(tx(w));
      return type && attr(w, "Unit") === "Month" && Number.isFinite(months) ? [{ type, months }] : [];
    });

    const infoUrl = tx(p.ProductURL);
    const corp = isNode(p.Corporate) ? attr(p.Corporate, "IsCorporate") : undefined;
    const mls = tx(p.MedicareLevySurchargeExempt);
    const copay = isNode(p.CoPayments) ? attr(p.CoPayments, "CoPaymentType") : undefined;
    const owith = onlyAvailableWith(p.OnlyAvailableWith);

    this.products.push({
      id,
      insurerId,
      code,
      name,
      kind,
      status,
      ...(tier ? { tier } : {}),
      ...(state ? { state } : {}),
      ...(household ? { household } : {}),
      ...(dependants.length ? { dependantsCovered: dependants } : {}),
      ...(excessType ? { excessType } : {}),
      ...(perAdmission !== undefined ? { excessPerAdmissionCents: perAdmission } : {}),
      ...(perPerson !== undefined ? { excessPerPersonCents: perPerson } : {}),
      ...(perPolicy !== undefined ? { excessPerPolicyCents: perPolicy } : {}),
      ...(excess !== undefined ? { excessCents: excess } : {}),
      ...(copay ? { coPaymentType: copay } : {}),
      ...(mls === "true" || mls === "false" ? { mlsExempt: mls === "true" } : {}),
      corporate: corp === "true",
      ...(owith ? { onlyAvailableWith: owith } : {}),
      // Schema V3.1: PremiumNoRebate is "the monthly premium ... the full 100% premium", so it is before any rebate.
      premiums: premium !== undefined ? [{ amountCents: premium, frequency: "monthly", basis: "before_rebate" }] : [],
      ...(hospitalPart !== undefined && hospitalPart > 0 ? { hospitalComponentCents: hospitalPart } : {}),
      coverCodes: letters.join(""),
      waiting,
      ...(infoUrl && /^https?:\/\//.test(infoUrl) ? { infoUrl } : {}),
    });
  }

  finish(): HealthParseResult {
    const ids = new Set(this.insurers.map((i) => i.id));
    for (const p of this.products) if (!ids.has(p.insurerId)) this.unknownFunds.add(p.insurerId);
    const count = (f: (p: HealthProduct) => string) => {
      const o: Record<string, number> = {};
      for (const p of this.products) o[f(p)] = (o[f(p)] ?? 0) + 1;
      return o;
    };
    const titles: string[] = [];
    for (const [t, i] of this.titleIndex) titles[i] = t;
    return {
      insurers: this.insurers,
      products: this.products,
      categoryTitles: titles,
      report: {
        insurers: this.insurers.length,
        productsRead: this.read,
        productsKept: this.products.length,
        closedSkipped: this.closedSkipped,
        productsWithoutPremium: this.products.filter((p) => p.premiums.length === 0).length,
        duplicateIds: this.duplicateIds,
        unknownFunds: [...this.unknownFunds],
        unknownTiers: [...this.unknownTiers],
        byKind: count((p) => p.kind),
        byTier: count((p) => p.tier ?? "(none)"),
        byState: count((p) => p.state ?? "ALL"),
        byHousehold: count((p) => p.household ?? "(none)"),
        problems: this.problems,
      },
    };
  }
}

/** What a file in the unzipped folder is, from its name: the Funds file, a product file, or neither. */
export function classifyFile(name: string): "funds" | "products" | undefined {
  const n = name.toLowerCase();
  if (!n.endsWith(".xml")) return undefined;
  if (/^funds\b/.test(n)) return "funds";
  if (/(hospital|generalhealth|general health|combined)/.test(n)) return "products";
  return undefined;
}

/** Date in a file name such as "Funds 02-Nov-2026.xml", as YYYY-MM-DD. */
export function dateInName(name: string): string | undefined {
  const m = /(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(name);
  if (!m) return undefined;
  const mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2]!.toLowerCase());
  return mon < 0 ? undefined : `${m[3]}-${String(mon + 1).padStart(2, "0")}-${m[1]}`;
}

/** Parses XML text already in memory (small files and tests): same logic as the streaming path. */
export function parseHealthFiles(files: { name: string; xml: string }[], opts: ParseOptions = {}): HealthParseResult {
  const acc = new HealthAccumulator(opts);
  const problems: string[] = [];
  for (const f of files) {
    const kind = classifyFile(f.name);
    if (kind === "funds") acc.addFunds(f.xml, f.name);
    else if (kind === "products") {
      const sp = new ProductSplitter();
      for (const piece of sp.feed(f.xml)) acc.addProduct(piece, f.name);
    }
  }
  const r = acc.finish();
  r.report.problems.push(...problems);
  return r;
}

export interface DirParse extends HealthParseResult {
  dir: string;
  fileHash: string;
  /** The date in the file names, when they agree. */
  fileDate?: string;
  files: string[];
}

/** Streams every Funds and product XML in an unzipped folder. Funds are read first so products can be checked against them. */
export async function parseHealthDir(dir: string, opts: ParseOptions = {}): Promise<DirParse> {
  const root = resolve(dir);
  const names = readdirSync(root).sort();
  const funds = names.filter((n) => classifyFile(n) === "funds");
  const prods = names.filter((n) => classifyFile(n) === "products");
  const acc = new HealthAccumulator(opts);
  const hashes: string[] = [];
  const dates = new Set<string>();
  for (const n of [...funds, ...prods]) {
    const d = dateInName(n);
    if (d) dates.add(d);
    const h = createHash("sha256");
    const sp = new ProductSplitter();
    let whole = "";
    const isFunds = classifyFile(n) === "funds";
    for await (const chunk of createReadStream(join(root, n), { encoding: "utf8", highWaterMark: 1 << 20 })) {
      const s = chunk as string;
      h.update(s);
      if (isFunds) whole += s;
      else {
        for (const piece of sp.feed(s)) acc.addProduct(piece, n);
      }
    }
    if (isFunds) acc.addFunds(whole, n);
    hashes.push(`${n}:${h.digest("hex")}`);
  }
  const r = acc.finish();
  if (funds.length === 0) r.report.problems.push("no Funds XML file found in the folder");
  if (prods.length === 0) r.report.problems.push("no Hospital, GeneralHealth or Combined XML file found in the folder");
  return {
    ...r,
    dir: root,
    files: [...funds, ...prods],
    fileHash: createHash("sha256").update(hashes.join("\n")).digest("hex"),
    ...(dates.size === 1 ? { fileDate: [...dates][0]! } : {}),
  };
}
