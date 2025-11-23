import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.html',
  styleUrl: './tag.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.small]': 'size() === "small"',
    '[class.accent]': 'color() === "accent"',
  },
})
export class Tag {
  label = input.required<string>();
  size = input<'default' | 'small'>('default');
  color = input<'default' | 'accent'>('default');
}
