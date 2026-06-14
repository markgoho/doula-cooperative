import type { PageEntry } from "../schemas/analytics-schemas.js";

const PIRSCH_TOKEN_URL = "https://api.pirsch.io/api/v1/token";
const PIRSCH_PAGES_URL = "https://api.pirsch.io/api/v1/statistics/page";
const PIRSCH_DOMAIN_ID = "9Gd2A481Pv";

async function getAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch(PIRSCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!response.ok) {
    throw new Error(`Pirsch token exchange failed: ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export interface PirschClient {
  getTopPages(days: number): Promise<PageEntry[]>;
}

export function createPirschClient(): PirschClient {
  const clientId = process.env["PIRSCH_CLIENT_ID"];
  const clientSecret = process.env["PIRSCH_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    throw new Error("PIRSCH_CLIENT_ID or PIRSCH_CLIENT_SECRET not set");
  }

  return {
    async getTopPages(days: number): Promise<PageEntry[]> {
      const token = await getAccessToken(clientId, clientSecret);

      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] ?? "";
      const toDate = new Date().toISOString().split("T")[0] ?? "";

      const url = new URL(PIRSCH_PAGES_URL);
      url.searchParams.set("id", PIRSCH_DOMAIN_ID);
      url.searchParams.set("from", fromDate);
      url.searchParams.set("to", toDate);
      url.searchParams.set("limit", "5");

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Pirsch pages request failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        title: string;
        path: string;
        visitors: number;
        views: number;
      }[];

      return data
        .map(p => ({ title: p.title, path: p.path, views: p.views }))
        .toSorted((a, b) => b.views - a.views)
        .slice(0, 5);
    },
  };
}
