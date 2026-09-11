import type { ApiMemberResponse } from './api-member-response';

export interface ApiListMembersResponse {
  members: ApiMemberResponse[];
  total: number;
  warning?: string;
}
