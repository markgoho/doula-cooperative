export interface DayCount {
  date: string;
  count: number;
}

export interface MemberSignupsResponse {
  days: DayCount[];
}

export interface CostOffsetRateResponse {
  withOffset: number;
  total: number;
  rate: number;
}

export interface LocationEntry {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  count: number;
}

export interface MatchRequestLocationsResponse {
  locations: LocationEntry[];
  unmapped: number;
}

export interface PageEntry {
  title: string;
  path: string;
  views: number;
}

export interface TopPagesResponse {
  pages: PageEntry[];
}
