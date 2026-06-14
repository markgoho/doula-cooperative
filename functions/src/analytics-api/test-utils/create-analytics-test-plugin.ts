import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import { createAnalyticsPlugin } from "../plugins/analytics-plugin.js";
import type { AnalyticsService } from "../services/interface.js";
import type {
  CostOffsetRateResponse,
  MatchRequestLocationsResponse,
  MemberSignupsResponse,
  TopPagesResponse,
} from "../schemas/analytics-schemas.js";


/**
 * Creates the analytics plugin with default mock services for testing.
 */
export function createAnalyticsTestPlugin(overrides?: {
  analyticsService?: Partial<AnalyticsService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultSignupsResult: MemberSignupsResponse = { days: [] };
  const defaultCostOffsetResult: CostOffsetRateResponse = {
    withOffset: 0,
    total: 0,
    rate: 0,
  };
  const defaultLocationsResult: MatchRequestLocationsResponse = {
    locations: [],
    unmapped: 0,
  };
  const defaultTopPagesResult: TopPagesResponse = { pages: [] };

  const defaultAnalyticsService: AnalyticsService = {
    getMemberSignups: mock(() => Promise.resolve(defaultSignupsResult)),
    getCostOffsetRate: mock(() => Promise.resolve(defaultCostOffsetResult)),
    getMatchRequestLocations: mock(() =>
      Promise.resolve(defaultLocationsResult),
    ),
    getTopPages: mock(() => Promise.resolve(defaultTopPagesResult)),
    ...overrides?.analyticsService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(),
    ...overrides?.authService,
  };

  return createAnalyticsPlugin({
    analyticsService: defaultAnalyticsService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
