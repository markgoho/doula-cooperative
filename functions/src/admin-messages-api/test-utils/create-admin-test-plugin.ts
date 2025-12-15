import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import { createAdminMessagesPlugin } from "../plugins/admin-messages-plugin.js";
import type { MessageResponse } from "../schemas/message-schemas.js";
import type { MessageAdminService } from "../services/interface.js";

/**
 * Creates the admin-messages plugin with default mock services for testing.
 * Tests only the admin-messages plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured admin-messages plugin with mocked services
 */
export function createAdminTestPlugin(overrides?: {
  messageAdminService?: Partial<MessageAdminService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultMessageAdminService: MessageAdminService = {
    listMessages: mock(() =>
      Promise.resolve({
        messages: [] as MessageResponse[],
        total: 0,
        pendingCount: 0,
        processedCount: 0,
      }),
    ),
    getMessage: mock(() => Promise.resolve({} as MessageResponse)),
    updateMessage: mock(() => Promise.resolve({ success: true as const })),
    ...overrides?.messageAdminService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(),
    ...overrides?.authService,
  };

  return createAdminMessagesPlugin({
    messageAdminService: defaultMessageAdminService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
