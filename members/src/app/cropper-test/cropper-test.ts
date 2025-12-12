import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component } from '@angular/core';
import 'cropperjs';

@Component({
  selector: 'app-cropper-test',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <h1>Cropper Test</h1>

    <cropper-canvas background style="width: 400px; height: 400px; border: 2px solid red;">
      <cropper-image
        src="https://picsum.photos/400/400"
        initial-center-size="contain"
        translatable
      ></cropper-image>
      <cropper-shade></cropper-shade>
      <cropper-selection
        aspect-ratio="1"
        initial-coverage="0.5"
        movable
        resizable
        outlined
        within="canvas"
      >
        <cropper-grid role="grid" covered></cropper-grid>
        <cropper-crosshair centered></cropper-crosshair>
        <cropper-handle action="move" plain></cropper-handle>
        <cropper-handle action="n-resize"></cropper-handle>
        <cropper-handle action="e-resize"></cropper-handle>
        <cropper-handle action="s-resize"></cropper-handle>
        <cropper-handle action="w-resize"></cropper-handle>
        <cropper-handle action="ne-resize"></cropper-handle>
        <cropper-handle action="nw-resize"></cropper-handle>
        <cropper-handle action="se-resize"></cropper-handle>
        <cropper-handle action="sw-resize"></cropper-handle>
      </cropper-selection>
    </cropper-canvas>
  `,
  styles: `
    :host {
      display: block;
      padding: 2rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CropperTest {}
