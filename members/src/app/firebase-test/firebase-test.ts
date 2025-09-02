import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  template: ` <h1>Firebase Test</h1> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FirebaseTest {}
