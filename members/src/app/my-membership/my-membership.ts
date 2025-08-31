import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-my-membership',
  imports: [],
  templateUrl: './my-membership.html',
  styleUrl: './my-membership.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MyMembership {}
