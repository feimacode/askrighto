import { z } from "zod";
import { PUBLIC_URL } from "../config.js";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import { listDataSets } from "../core/registry.js";

interface DataSourceRow {
  id: string;
  title: string;
  publisher: string;
  url: string;
  licence: string;
  coverage: string;
  lastRefreshed: string | null;
  stats?: Record<string, unknown>;
}

export const listDataSources = defineTool({
  name: "list_data_sources",
  title: "List data sources",
  description:
    "Lists every dataset Ask Righto holds, with its publisher, licence or reuse basis, source link, coverage and when it was last refreshed. Use it when the user asks where the information comes from or how current it is.",
  inputSchema: z.object({}),
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  handler: () => {
    const sets = listDataSets();
    if (sets.length === 0) return notFound("no_data_loaded", "No datasets are loaded yet, so there are no data sources to list.");
    const rows: DataSourceRow[] = sets.map((d) => ({
      id: d.id,
      title: d.title,
      publisher: d.publisher,
      url: d.source.url,
      licence: d.source.licence,
      coverage: d.coverage,
      lastRefreshed: d.refreshedAt()?.toISOString() ?? null,
      ...(d.stats ? { stats: d.stats() } : {}),
    }));
    return found({
      data: { datasets: rows },
      source: { name: "Ask Righto data source registry", url: PUBLIC_URL, licence: "Describes the datasets held; each dataset has its own licence" },
      asOf: new Date(),
    });
  },
  render: ({ datasets }) =>
    datasets
      .map(
        (d) =>
          `- ${d.title}: published by ${d.publisher}. Licence: ${d.licence}. Covers: ${d.coverage}. Last refreshed: ${d.lastRefreshed ?? "never"}. Source: ${d.url}`,
      )
      .join("\n"),
});
