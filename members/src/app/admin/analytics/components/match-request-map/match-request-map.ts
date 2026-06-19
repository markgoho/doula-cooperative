import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  type OnDestroy,
  computed,
  effect,
  inject,
} from '@angular/core';
import type { ResourceRef } from '@angular/core';
import type { Map as LeafletMap } from 'leaflet';
import type { MatchRequestLocationsResponse } from '../../../api-types/analytics-api.types';

type LocationsResource = ResourceRef<MatchRequestLocationsResponse | undefined>;

// Monroe County / Rochester, NY center
const MAP_CENTER: [number, number] = [43.161, -77.611];
const MAP_ZOOM = 8;

@Component({
  selector: 'app-match-request-map',
  templateUrl: './match-request-map.html',
  styleUrl: './match-request-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchRequestMap implements OnDestroy {
  @Input({ required: true }) resource!: LocationsResource;

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(
    () => this.resource.error() !== undefined,
  );
  protected readonly data = computed(() =>
    this.resource.isLoading() || this.resource.error() !== undefined
      ? undefined
      : this.resource.value(),
  );
  protected readonly unmapped = computed(() => this.data()?.unmapped ?? 0);

  private readonly el = inject(ElementRef) as ElementRef<HTMLElement>;
  private map: LeafletMap | undefined;
  private markersLayer: import('leaflet').LayerGroup | undefined;

  constructor() {
    effect(() => {
      const locations = this.data()?.locations;
      if (!locations) return;
      if (this.map) {
        void this.updateMarkers(locations);
      } else {
        void this.initMap(locations);
      }
    });
  }

  private async initMap(
    locations: MatchRequestLocationsResponse['locations'],
  ): Promise<void> {
    const leaflet = await import('leaflet');
    const L = leaflet.default ?? leaflet;

    const mapContainer =
      this.el.nativeElement.querySelector<HTMLElement>('.map-container');
    if (!mapContainer) return;


    this.map = L.map(mapContainer).setView(MAP_CENTER, MAP_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);

    await this.updateMarkers(locations);
  }

  private async updateMarkers(
    locations: MatchRequestLocationsResponse['locations'],
  ): Promise<void> {
    if (!this.map || !this.markersLayer) return;

    const leaflet = await import('leaflet');
    const L = leaflet.default ?? leaflet;
    this.markersLayer.clearLayers();

    const counts = locations.map((location) => location.count);
    const maxCount = Math.max(...counts, 1);

    for (const loc of locations) {
      const radius = 6 + Math.round((loc.count / maxCount) * 20);
      L.circleMarker([loc.lat, loc.lng], {
        radius,
        color: '#4a90d9',
        fillColor: '#4a90d9',
        fillOpacity: 0.55,
        weight: 1,
      })
        .bindTooltip(`${loc.city}, ${loc.state} ${loc.zip}: ${loc.count}`)
        .addTo(this.markersLayer);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
  }
}
