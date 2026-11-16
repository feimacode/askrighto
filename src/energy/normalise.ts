/**
 * Turns CDR list items and plan details into the normalised model. Tolerant by design:
 * anything unrecognised is kept in the raw payload and recorded in `notUnderstood`, never
 * coerced into a number.
 */
import { GST_BASIS } from "./gst.js";
import { stableHash } from "./hash.js";
import { parseMoney } from "./money.js";
import type {
  Contract,
  ControlledLoad,
  Discount,
  Eligibility,
  EnergyPlan,
  Fee,
  FeedIn,
  FuelType,
  GstBasis,
  Incentive,
  NormalisedPlan,
  PlanType,
  Rate,
  TariffPeriod,
  TimeOfUseRate,
} from "./types.js";

type Obj = Record<string, unknown>;

const PRICING_MODELS = new Set([
  "SINGLE_RATE",
  "SINGLE_RATE_CONT_LOAD",
  "TIME_OF_USE",
  "TIME_OF_USE_CONT_LOAD",
  "FLEXIBLE",
  "FLEXIBLE_CONT_LOAD",
  "QUOTA",
]);
const FUELS = new Set(["ELECTRICITY", "GAS", "DUAL"]);
const PLAN_TYPES = new Set(["STANDING", "MARKET", "REGULATED"]);

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * Rates of one rate block. `period` comes from the block (the standards put it on singleRate,
 * timeOfUseRates[] and the feed-in tariffs, not on each rate). A per-rate `period` is still
 * accepted for tolerance but is not in the standards.
 */
function rates(v: unknown, why: string[], blockPeriod?: string): Rate[] {
  const out: Rate[] = [];
  for (const r of arr(v)) {
    const unitPrice = parseMoney(r.unitPrice);
    if (unitPrice === undefined) {
      why.push("rate:unparseable_unit_price");
      continue;
    }
    const volume = typeof r.volume === "number" ? r.volume : undefined;
    const period = str(r.period) ?? blockPeriod;
    out.push({
      unitPrice,
      measureUnit: str(r.measureUnit) ?? "KWH",
      ...(volume !== undefined ? { volume } : {}),
      ...(volume !== undefined && period ? { period } : {}),
    });
  }
  return out;
}

/** Block period, with the schema default (P1Y) where the standards state one. */
const blockPeriod = (o: Obj, schemaDefault?: string): string | undefined => str(o.period) ?? schemaDefault;

function windows(v: unknown) {
  return arr(v).map((w) => ({
    days: strs(w.days),
    ...(str(w.startTime) ? { startTime: str(w.startTime) } : {}),
    ...(str(w.endTime) ? { endTime: str(w.endTime) } : {}),
  }));
}

function timeOfUse(v: unknown, why: string[], withSupply = false): TimeOfUseRate[] {
  return arr(v).map((t) => {
    const out: TimeOfUseRate = {
      type: str(t.type) ?? "UNKNOWN",
      ...(str(t.displayName) ? { displayName: str(t.displayName) } : {}),
      rates: rates(t.rates, why, blockPeriod(t, "P1Y")),
      windows: windows(t.timeOfUse),
    };
    const d = withSupply ? parseMoney(t.dailySupplyCharge) : undefined;
    if (d !== undefined) out.dailySupplyCharge = d;
    return out;
  });
}

function supply(o: Obj): number | undefined {
  // The standards (every version) name it dailySupplyCharge. dailySupplyCharges is not in the
  // standards; it is still accepted until real payloads confirm it never appears.
  return parseMoney(o.dailySupplyCharge ?? o.dailySupplyCharges);
}

function tariffPeriods(v: unknown, why: string[]): TariffPeriod[] {
  return arr(v).map((t) => {
    const p: TariffPeriod = { hasDemandCharges: false };
    if (str(t.displayName)) p.displayName = str(t.displayName);
    if (str(t.startDate)) p.startDate = str(t.startDate);
    if (str(t.endDate)) p.endDate = str(t.endDate);
    const supplyType = str(t.dailySupplyChargeType) ?? "SINGLE";
    if (supplyType === "BAND") {
      // Banded supply charges are recorded but not costed; the estimate stops on the missing single charge.
      p.bandedDailySupplyCharges = rates(t.bandedDailySupplyCharges, why);
      why.push("tariffPeriod:banded_supply_charge");
    } else {
      if (supplyType !== "SINGLE") why.push(`dailySupplyChargeType:${supplyType}`);
      const d = supply(t);
      if (d !== undefined) p.dailySupplyCharge = d;
      else why.push("tariffPeriod:no_supply_charge");
    }
    const u = str(t.rateBlockUType);
    // singleRate.period has no schema default, so a block threshold without one stays unperiod-ed
    // and the estimate refuses it rather than guessing.
    if (isObj(t.singleRate) && (u === "singleRate" || !u)) p.singleRate = rates(t.singleRate.rates, why, blockPeriod(t.singleRate));
    if (Array.isArray(t.timeOfUseRates) && (u === "timeOfUseRates" || !u)) p.timeOfUse = timeOfUse(t.timeOfUseRates, why);
    if (u === "demandCharges" || Array.isArray(t.demandCharges)) p.hasDemandCharges = true;
    if (u && !["singleRate", "timeOfUseRates", "demandCharges"].includes(u)) why.push(`rateBlockUType:${u}`);
    if (!p.singleRate && !p.timeOfUse && !p.hasDemandCharges) why.push("tariffPeriod:no_rates");
    return p;
  });
}

function controlledLoads(v: unknown, why: string[]): ControlledLoad[] {
  return arr(v).map((c) => {
    const o: ControlledLoad = {};
    if (str(c.displayName)) o.displayName = str(c.displayName);
    const u = str(c.rateBlockUType);
    if (isObj(c.singleRate) && (u === "singleRate" || !u)) {
      o.singleRate = rates(c.singleRate.rates, why, blockPeriod(c.singleRate, "P1Y"));
      // The standards put the controlled load supply charge inside singleRate.
      const d = parseMoney(c.singleRate.dailySupplyCharge) ?? supply(c);
      if (d !== undefined) o.dailySupplyCharge = d;
    }
    if (Array.isArray(c.timeOfUseRates) && (u === "timeOfUseRates" || !u)) o.timeOfUse = timeOfUse(c.timeOfUseRates, why, true);
    if (u && !["singleRate", "timeOfUseRates"].includes(u)) why.push(`controlledLoad:rateBlockUType:${u}`);
    if (!o.singleRate && !o.timeOfUse) why.push("controlledLoad:no_rates");
    return o;
  });
}

/**
 * Solar feed-in tariffs. In Get Generic Plan Detail v3 (EnergyPlanSolarFeedInTariffV3)
 * `timeVaryingTariffs` is an array of tariffs, each with `rates[]` and `timeVariations[]`
 * windows. In v2 it was a single object; that shape is still read for tolerance.
 */
function feedIn(v: unknown, why: string[]): FeedIn[] {
  return arr(v).map((f) => {
    const u = str(f.tariffUType);
    const single = isObj(f.singleTariff) && (u === "singleTariff" || !u) ? f.singleTariff : undefined;
    const tv = u === "timeVaryingTariffs" || !u ? f.timeVaryingTariffs : undefined;
    const varyingList = Array.isArray(tv) ? arr(tv) : isObj(tv) ? [tv] : undefined;
    if (u && u !== "singleTariff" && u !== "timeVaryingTariffs") why.push(`solarFeedIn:tariffUType:${u}`);
    if (!single && !varyingList?.length) why.push("solarFeedIn:unknown_shape");
    const out: FeedIn = {
      ...(str(f.displayName) ? { displayName: str(f.displayName) } : {}),
      ...(str(f.description) ? { description: str(f.description) } : {}),
      ...(str(f.scheme) ? { scheme: str(f.scheme) } : {}),
      ...(str(f.payerType) ? { payerType: str(f.payerType) } : {}),
      ...(str(f.startDate) ? { startDate: str(f.startDate) } : {}),
      ...(str(f.endDate) ? { endDate: str(f.endDate) } : {}),
      rates: single ? rates(single.rates, why, blockPeriod(single, "P1Y")) : [],
      timeVarying: !single && !!varyingList?.length,
    };
    if (!single && varyingList?.length) {
      out.timeVaryingTariffs = varyingList.map((t) => ({
        // An absent type means the tariff applies to all periods.
        type: str(t.type) ?? "ALL",
        ...(str(t.displayName) ? { displayName: str(t.displayName) } : {}),
        rates: rates(t.rates, why, blockPeriod(t, "P1Y")),
        windows: windows(t.timeVariations),
      }));
    }
    return out;
  });
}

function discounts(v: unknown, why: string[]): Discount[] {
  return arr(v).map((d) => {
    const method = str(d.methodUType);
    const type = str(d.type);
    const out: Discount = {
      ...(str(d.displayName) ? { displayName: str(d.displayName) } : {}),
      ...(str(d.description) ? { description: str(d.description) } : {}),
      ...(type ? { type } : {}),
      ...(str(d.category) ? { category: str(d.category) } : {}),
      ...(method ? { method } : {}),
      // Anything not explicitly guaranteed is treated as conditional, the safe side for comparisons.
      conditional: type !== "GUARANTEED",
    };
    const body = method && isObj(d[method]) ? (d[method] as Obj) : undefined;
    if (method === "fixedAmount") {
      const a = parseMoney(body?.amount);
      if (a !== undefined) out.amount = a;
    } else if (method === "percentOfBill" || method === "percentOfUse" || method === "percentOverThreshold") {
      const r = str(body?.rate);
      if (r) out.percent = r;
    } else if (method) {
      why.push(`discountMethod:${method}`);
    }
    return out;
  });
}

function fees(v: unknown): Fee[] {
  return arr(v).map((f) => {
    const amount = parseMoney(f.amount);
    return {
      ...(str(f.type) ? { type: str(f.type) } : {}),
      ...(str(f.term) ? { term: str(f.term) } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(str(f.rate) ? { rate: str(f.rate) } : {}),
      ...(str(f.description) ? { description: str(f.description) } : {}),
    };
  });
}

function incentives(v: unknown): Incentive[] {
  return arr(v).map((i) => ({
    ...(str(i.displayName) ? { displayName: str(i.displayName) } : {}),
    ...(str(i.description) ? { description: str(i.description) } : {}),
    ...(str(i.category) ? { category: str(i.category) } : {}),
  }));
}

function eligibility(v: unknown): Eligibility[] {
  return arr(v).map((e) => ({
    ...(str(e.type) ? { type: str(e.type) } : {}),
    ...(str(e.information) ? { information: str(e.information) } : {}),
    ...(str(e.description) ? { description: str(e.description) } : {}),
  }));
}

export function normaliseContract(c: Obj, why: string[], label: string, gst: GstBasis = GST_BASIS): Contract {
  const pricingModel = str(c.pricingModel) ?? "UNKNOWN";
  if (!PRICING_MODELS.has(pricingModel)) why.push(`pricingModel:${pricingModel}`);
  if (pricingModel === "QUOTA") why.push(`${label}:quota_pricing`);
  return {
    pricingModel,
    gstBasis: gst,
    ...(typeof c.isFixed === "boolean" ? { isFixed: c.isFixed } : {}),
    tariffPeriods: tariffPeriods(c.tariffPeriod, why),
    controlledLoads: controlledLoads(c.controlledLoad, why),
    solarFeedIn: feedIn(c.solarFeedInTariff, why),
    discounts: discounts(c.discounts, why),
    fees: fees(c.fees),
    incentives: incentives(c.incentives),
    eligibility: eligibility(c.eligibility),
    terms: {
      ...(str(c.termType) ? { termType: str(c.termType) } : {}),
      billFrequency: strs(c.billFrequency),
      paymentOptions: strs(c.paymentOption),
      ...(typeof c.coolingOffDays === "number" ? { coolingOffDays: c.coolingOffDays } : {}),
    },
  };
}

/** A list item (Get Generic Plans) reduced to the fields the sync needs. */
export interface ListItem {
  planId: string;
  lastUpdated: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  customerType?: string;
  fuelType?: string;
  type?: string;
  displayName?: string;
  brandName?: string;
  geography: { includedPostcodes: string[]; excludedPostcodes: string[]; distributors: string[] };
}

export function readListItem(p: unknown): ListItem | undefined {
  if (!isObj(p) || !str(p.planId)) return undefined;
  const g = isObj(p.geography) ? p.geography : {};
  return {
    planId: p.planId as string,
    lastUpdated: str(p.lastUpdated) ?? "",
    ...(str(p.effectiveFrom) ? { effectiveFrom: str(p.effectiveFrom) } : {}),
    ...(str(p.effectiveTo) ? { effectiveTo: str(p.effectiveTo) } : {}),
    ...(str(p.customerType) ? { customerType: str(p.customerType) } : {}),
    ...(str(p.fuelType) ? { fuelType: str(p.fuelType) } : {}),
    ...(str(p.type) ? { type: str(p.type) } : {}),
    ...(str(p.displayName) ? { displayName: str(p.displayName) } : {}),
    ...(str(p.brandName) ? { brandName: str(p.brandName) } : {}),
    geography: {
      includedPostcodes: strs(g.includedPostcodes),
      excludedPostcodes: strs(g.excludedPostcodes),
      distributors: strs(g.distributors),
    },
  };
}

/** Only residential plans are stored. A missing customer type is not assumed residential. */
export function isResidential(item: { customerType?: string }): boolean {
  return item.customerType === "RESIDENTIAL";
}

/**
 * Normalises one plan. `item` supplies geography and dates from the list when the detail
 * payload lacks them. The hash covers the detail payload only.
 */
export function normalisePlan(retailerSlug: string, item: ListItem, detail: unknown, gst: GstBasis = GST_BASIS): NormalisedPlan {
  const d = isObj(detail) ? detail : {};
  const why: string[] = [];
  const fuelType = str(d.fuelType) ?? item.fuelType ?? "UNKNOWN";
  const planType = str(d.type) ?? item.type ?? "UNKNOWN";
  if (!FUELS.has(fuelType)) why.push(`fuelType:${fuelType}`);
  if (!PLAN_TYPES.has(planType)) why.push(`planType:${planType}`);

  const elec = isObj(d.electricityContract) ? normaliseContract(d.electricityContract, why, "electricity", gst) : undefined;
  const gas = isObj(d.gasContract) ? normaliseContract(d.gasContract, why, "gas", gst) : undefined;
  if (!elec && !gas) why.push("missing_contract");
  if ((fuelType === "ELECTRICITY" && !elec) || (fuelType === "GAS" && !gas) || (fuelType === "DUAL" && !(elec && gas))) {
    if (elec || gas) why.push("contract_missing_for_fuel");
  }

  const info = isObj(d.additionalInformation) ? d.additionalInformation : {};
  const planUrl = str(info.overviewUri) ?? str(d.applicationUri);
  const g = isObj(d.geography) ? d.geography : undefined;
  const geography = g
    ? { includedPostcodes: strs(g.includedPostcodes), excludedPostcodes: strs(g.excludedPostcodes), distributors: strs(g.distributors) }
    : item.geography;
  const effectiveFrom = str(d.effectiveFrom) ?? item.effectiveFrom;
  const effectiveTo = str(d.effectiveTo) ?? item.effectiveTo;
  const unique = [...new Set(why)];

  const plan: NormalisedPlan["plan"] = {
    planId: item.planId,
    retailerSlug,
    brandName: str(d.brandName) ?? item.brandName ?? retailerSlug,
    displayName: str(d.displayName) ?? item.displayName ?? item.planId,
    fuelType: fuelType as FuelType,
    planType: planType as PlanType,
    customerType: "RESIDENTIAL",
    geography,
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveTo ? { effectiveTo } : {}),
    ...(elec ? { electricity: elec } : {}),
    ...(gas ? { gas } : {}),
    ...(planUrl ? { planUrl } : {}),
    sourceLastUpdated: item.lastUpdated,
    understood: unique.length === 0,
    notUnderstood: unique,
  };
  return { plan, detailHash: stableHash(detail) };
}

export type { EnergyPlan };
