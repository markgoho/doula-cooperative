import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AnalyticsStateService } from '../state/analytics-state.service';
import { SignupsBarChart } from './components/signups-bar-chart/signups-bar-chart';
import { CostOffsetStatCard } from './components/cost-offset-stat-card/cost-offset-stat-card';
import { TopPagesList } from './components/top-pages-list/top-pages-list';
import { MatchRequestMap } from './components/match-request-map/match-request-map';

@Component({
  selector: 'app-admin-analytics',
  imports: [SignupsBarChart, CostOffsetStatCard, TopPagesList, MatchRequestMap],
  templateUrl: './admin-analytics.html',
  styleUrl: './admin-analytics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAnalytics {
  protected readonly state = inject(AnalyticsStateService);

  constructor() {
    this.state.initialize();
  }
}
