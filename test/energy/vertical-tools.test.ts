import { describe, expect, it } from "vitest";
import { energyVertical } from "../../src/energy/vertical.js";

describe("energy vertical", () => {
  it("serves every energy tool the instructions name", () => {
    const names = energyVertical.tools.map((t) => t.name).sort();
    expect(names).toEqual(["compare_energy_plans", "get_energy_plan", "list_current_plan_options", "search_energy_plans", "summarise_interval_readings"]);
    for (const n of names) expect(energyVertical.instructions).toContain(n);
  });
});
