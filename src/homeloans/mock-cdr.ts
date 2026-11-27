/**
 * An in-process stand-in for the CDR Register and a few lenders, for evals and tests that must run without the
 * internet (add-cdr-home-loan-proxy, mock-lender mode). All names, ids and rates here are INVENTED; nothing in this
 * file is a real lender's data. It is used only when ASKRIGHTO_CDR_MOCK=1 and NODE_ENV is not production
 * (see getCdrProxy), and the proxy's own safety checks still apply to the fake hosts.
 */
interface MockLender {
  id: string;
  name: string;
  host: string;
  /** Highest x-v it accepts for the product list; higher versions get 406 (tests the version fallback). */
  maxListVersion: number;
  /** The lender answers every request with this status instead (tests an unavailable lender). */
  failWith?: number;
}

const LENDERS: MockLender[] = [
  { id: "mock-cba", name: "Commonwealth Bank of Australia", host: "mock-cba.example.com", maxListVersion: 5 },
  { id: "mock-westpac", name: "Westpac", host: "mock-westpac.example.com", maxListVersion: 4 },
  { id: "mock-beyond", name: "Beyond Bank Australia", host: "mock-beyond.example.com", maxListVersion: 5 },
  { id: "mock-beyond-biz", name: "Beyond Bank Business", host: "mock-beyondbiz.example.com", maxListVersion: 5 },
  { id: "mock-nicu", name: "Northern Inland Credit Union", host: "mock-nicu.example.com", maxListVersion: 5 },
  { id: "mock-down", name: "Unavailable Credit Union", host: "mock-down.example.com", maxListVersion: 5, failWith: 503 },
];

const rate = (type: string, r: string, c: string, extra: Record<string, unknown> = {}) => ({
  lendingRateType: type,
  rate: r,
  comparisonRate: c,
  loanPurpose: "OWNER_OCCUPIED",
  repaymentType: "PRINCIPAL_AND_INTEREST",
  ...extra,
});

function products(l: MockLender) {
  return [
    { productId: `${l.id}-var`, name: `${l.name} Standard Variable (invented)`, productCategory: "RESIDENTIAL_MORTGAGES", description: "Invented variable rate loan", additionalInformation: { overviewUri: `https://${l.host}/home-loans/variable` } },
    { productId: `${l.id}-fix3`, name: `${l.name} 3 Year Fixed (invented)`, productCategory: "RESIDENTIAL_MORTGAGES", description: "Invented fixed rate loan", additionalInformation: { overviewUri: `https://${l.host}/home-loans/fixed` } },
  ];
}

function detail(l: MockLender, productId: string) {
  const p = products(l).find((x) => x.productId === productId);
  if (!p) return undefined;
  const fixed = productId.endsWith("fix3");
  return {
    ...p,
    lendingRates: fixed
      ? [rate("FIXED", "0.0619", "0.0651", { additionalValue: "P3Y", tiers: [{ name: "LVR up to 80%", unitOfMeasure: "PERCENT", minimumValue: "0", maximumValue: "80" }] })]
      : [rate("VARIABLE", "0.0599", "0.0625", { tiers: [{ name: "LVR up to 80%", unitOfMeasure: "PERCENT", minimumValue: "0", maximumValue: "80" }] }), rate("VARIABLE", "0.0629", "0.0655")],
    fees: [{ name: "Application fee", feeType: "UPFRONT", amount: "395.00" }],
    features: [{ featureType: "OFFSET", additionalInfo: "Offset account available" }],
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A fetch that answers the Register and the invented lenders, and 404s everything else. */
export const mockCdrFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const v = Number(new Headers(init?.headers).get("x-v"));
  if (url.hostname === "api.cdr.gov.au")
    return json(200, {
      data: LENDERS.map((l) => ({ dataHolderBrandId: l.id, brandName: l.name, industries: ["banking"], publicBaseUri: `https://${l.host}` })),
    });
  const l = LENDERS.find((x) => x.host === url.hostname);
  if (!l) return json(404, {});
  if (l.failWith) return json(l.failWith, {});
  const m = /^\/cds-au\/v1\/banking\/products\/?([^/]*)$/.exec(url.pathname);
  if (!m) return json(404, {});
  if (m[1]) {
    if (v > 7) return json(406, {});
    const d = detail(l, decodeURIComponent(m[1]));
    return d ? json(200, { data: d }) : json(404, {});
  }
  if (v > l.maxListVersion) return json(406, {});
  const all = products(l);
  const size = Number(url.searchParams.get("page-size") ?? 25);
  const page = Number(url.searchParams.get("page") ?? 1);
  return json(200, { data: { products: all.slice((page - 1) * size, page * size) }, meta: { totalRecords: all.length, totalPages: Math.max(1, Math.ceil(all.length / size)) } });
}) as typeof fetch;

/** True only when the mock is switched on and this is not a production process. */
export const mockCdrEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.ASKRIGHTO_CDR_MOCK === "1" && env.NODE_ENV !== "production";
