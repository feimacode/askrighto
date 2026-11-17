/**
 * Reads the PHIO product XML into our model. **The real file layout has not been opened yet**
 * (add-health-cover-data task 1.1), so this parser reads an ASSUMED layout, documented in
 * docs/health-cover-columns.md. Element names are matched loosely (case and punctuation are ignored) and any
 * field that is absent stays unset; nothing is inferred. Once a real file is opened, change `PATHS` here and
 * the fixture in test/fixtures/health/ to match it.
 *
 * Assumed layout, one file per insurer:
 *   <Insurer><Code/><Name/><Products><Product><Code/><Name/><Type/><Tier/><State/><Household/>
 *     <ExcessAmount/><ExcessType/><InfoUrl/>
 *     <Premiums><Premium><Amount/><Frequency/><Basis/><RebateTier/></Premium></Premiums>
 *     <ClinicalCategories><Category code="" label="" cover=""/></ClinicalCategories>
 *     <WaitingPeriods><WaitingPeriod type="" months=""/></WaitingPeriods>
 *   </Product></Products></Insurer>
 */
import { XMLParser } from "fast-xml-parser";
import {
  COVER_KINDS,
  FREQUENCIES,
  HOUSEHOLDS,
  type CoverKind,
  type CoverState,
  type Frequency,
  type HealthCategory,
  type HealthInsurer,
  type HealthPremium,
  type HealthProduct,
  type HealthWaiting,
  type Household,
  type PremiumBasis,
} from "./types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
type Node = Record<string, unknown>;

/** First child (or attribute) whose normalised name is one of `names`, as text. */
function text(n: Node | undefined, ...names: string[]): string | undefined {
  if (!n) return undefined;
  for (const [k, v] of Object.entries(n)) {
    const key = norm(k.replace(/^@_/, ""));
    if (names.includes(key) && (typeof v === "string" || typeof v === "number")) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return undefined;
}
/** Children named `names`, always as a list (the XML library returns a single child as an object). */
function list(n: Node | undefined, ...names: string[]): Node[] {
  if (!n) return [];
  for (const [k, v] of Object.entries(n))
    if (names.includes(norm(k))) {
      const arr = Array.isArray(v) ? v : [v];
      return arr.filter((x): x is Node => typeof x === "object" && x !== null);
    }
  return [];
}
/** The container element, then its repeated children: <Premiums><Premium/></Premiums>. */
function items(n: Node | undefined, container: string, item: string): Node[] {
  return list(n, norm(container)).flatMap((c) => list(c, norm(item)));
}

const cents = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};

function oneOf<T extends string>(raw: string | undefined, allowed: readonly T[]): T | undefined {
  if (!raw) return undefined;
  const k = norm(raw);
  return allowed.find((a) => norm(a) === k);
}

const KIND_ALIASES: Record<string, CoverKind> = {
  hospital: "hospital",
  hospitalonly: "hospital",
  generaltreatment: "general_treatment",
  extras: "general_treatment",
  combined: "combined",
  hospitalandgeneraltreatment: "combined",
};
const BASIS_ALIASES: Record<string, PremiumBasis> = {
  beforerebate: "before_rebate",
  withoutrebate: "before_rebate",
  afterrebate: "after_rebate",
  withrebate: "after_rebate",
};
const COVER_ALIASES: Record<string, CoverState> = {
  covered: "covered",
  restricted: "restricted",
  restrictedcover: "restricted",
  notcovered: "not_covered",
};
const TIER_CODE_ALIASES: Record<string, string> = {
  base: "base",
  basetier: "base",
  tier1: "tier1",
  tier2: "tier2",
  tier3: "tier3",
};

export interface HealthParseReport {
  insurers: number;
  productsRead: number;
  productsKept: number;
  productsWithoutPremium: number;
  duplicateKeys: string[];
  unknownTiers: string[];
  byTier: Record<string, number>;
  problems: string[];
}

export interface HealthParseResult {
  insurers: HealthInsurer[];
  products: HealthProduct[];
  report: HealthParseReport;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Parses the XML text of each insurer file (name, content). Problems are collected, not thrown, so one bad file is visible. */
export function parseHealthFiles(files: { name: string; xml: string }[]): HealthParseResult {
  const insurers: HealthInsurer[] = [];
  const products: HealthProduct[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  const duplicateKeys: string[] = [];
  const unknownTiers = new Set<string>();
  let productsRead = 0;

  for (const f of files) {
    let doc: Node;
    try {
      doc = parser.parse(f.xml) as Node;
    } catch (e) {
      problems.push(`${f.name}: not valid XML (${(e as Error).message.slice(0, 80)})`);
      continue;
    }
    const roots = list(doc, "insurer");
    if (roots.length === 0) {
      problems.push(`${f.name}: no <Insurer> element found (layout is assumed; see docs/health-cover-columns.md)`);
      continue;
    }
    for (const ins of roots) {
      const name = text(ins, "name", "insurername", "fundname");
      const code = text(ins, "code", "insurercode", "fundcode") ?? (name ? slug(name) : undefined);
      if (!name || !code) {
        problems.push(`${f.name}: an insurer has no name or code`);
        continue;
      }
      const insurerId = slug(code);
      if (!insurers.some((i) => i.id === insurerId)) insurers.push({ id: insurerId, name });
      for (const p of items(ins, "products", "product")) {
        productsRead++;
        const pname = text(p, "name", "productname");
        const pcode = text(p, "code", "productcode") ?? (pname ? slug(pname) : undefined);
        const kind = KIND_ALIASES[norm(text(p, "type", "covertype", "producttype") ?? "")];
        if (!pname || !pcode || !kind || !COVER_KINDS.includes(kind)) {
          problems.push(`${f.name}: a product has no name, code or recognised type (${pcode ?? pname ?? "?"})`);
          continue;
        }
        const state = text(p, "state")?.toUpperCase();
        const household = oneOf<Household>(text(p, "household", "membership", "policytype"), HOUSEHOLDS) ??
          oneOf<Household>((text(p, "household") ?? "").replace(/\s+/g, ""), HOUSEHOLDS);
        const id = [insurerId, slug(pcode), state ?? "all", household ?? "any"].join("/");
        if (seen.has(id)) {
          duplicateKeys.push(id);
          continue;
        }
        seen.add(id);

        const premiums: HealthPremium[] = [];
        for (const pr of items(p, "premiums", "premium")) {
          const amount = cents(text(pr, "amount", "premium"));
          const freq = oneOf<Frequency>(text(pr, "frequency", "paymentfrequency"), FREQUENCIES);
          if (amount === undefined || !freq) continue;
          const basis = BASIS_ALIASES[norm(text(pr, "basis", "rebatebasis") ?? "")] ?? "unknown";
          const rt = text(pr, "rebatetier");
          premiums.push({
            amountCents: amount,
            frequency: freq,
            basis,
            ...(rt && TIER_CODE_ALIASES[norm(rt)] ? { rebateTier: TIER_CODE_ALIASES[norm(rt)]! } : {}),
          });
        }
        const categories: HealthCategory[] = items(p, "clinicalcategories", "category").flatMap((c) => {
          const code2 = text(c, "code");
          const cover = COVER_ALIASES[norm(text(c, "cover", "coverstatus") ?? "")];
          if (!code2 || !cover) return [];
          return [{ code: code2, label: text(c, "label", "name") ?? code2, cover }];
        });
        const waiting: HealthWaiting[] = items(p, "waitingperiods", "waitingperiod").flatMap((w) => {
          const type = text(w, "type");
          const months = Number(text(w, "months"));
          return type && Number.isFinite(months) ? [{ type, months }] : [];
        });
        const tier = text(p, "tier", "hospitaltier");
        const excess = cents(text(p, "excessamount", "excess"));
        const infoUrl = text(p, "infourl", "phisurl", "url");
        products.push({
          id,
          insurerId,
          code: pcode,
          name: pname,
          kind,
          ...(tier ? { tier } : {}),
          ...(state ? { state } : {}),
          ...(household ? { household } : {}),
          ...(excess !== undefined ? { excessCents: excess } : {}),
          ...(text(p, "excesstype") ? { excessType: text(p, "excesstype")! } : {}),
          premiums,
          categories,
          waiting,
          ...(infoUrl && /^https?:\/\//.test(infoUrl) ? { infoUrl } : {}),
        });
      }
    }
  }

  const byTier: Record<string, number> = {};
  for (const p of products) byTier[p.tier ?? "(none)"] = (byTier[p.tier ?? "(none)"] ?? 0) + 1;
  return {
    insurers,
    products,
    report: {
      insurers: insurers.length,
      productsRead,
      productsKept: products.length,
      productsWithoutPremium: products.filter((p) => p.premiums.length === 0).length,
      duplicateKeys,
      unknownTiers: [...unknownTiers],
      byTier,
      problems,
    },
  };
}
