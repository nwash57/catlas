import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import circle from '@turf/circle';

import { AuthService } from '../auth/auth.service';
import { ThemeToggle } from '../shared/theme-toggle.component';
import { ColoniesService } from './colonies.service';
import type { ColonyPublic } from './colony.model';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';

@Component({
  selector: 'app-map-page',
  imports: [RouterLink, ThemeToggle, FormsModule],
  templateUrl: './map.html',
  styleUrl: './map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class MapPage implements OnDestroy {
  private readonly coloniesService = inject(ColoniesService);
  protected readonly router = inject(Router);
  protected readonly currentUser = inject(AuthService).currentUser;

  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;

  protected readonly colonies = this.coloniesService.colonies;
  protected readonly loading = this.coloniesService.loading;
  protected readonly error = this.coloniesService.error;

  protected readonly isAddingColony = signal(false);
  protected readonly pendingLat = signal<number | null>(null);
  protected readonly pendingLng = signal<number | null>(null);
  protected readonly newColonyName = signal('');
  protected readonly newColonyDesc = signal('');
  protected readonly newColonyFuzz = signal(300);
  protected readonly submittingColony = signal(false);
  protected readonly createError = signal<string | null>(null);

  private map?: MapLibreMap;
  private pendingMarker?: Marker;

  constructor() {
    afterNextRender(async () => {
      if (!this.mapContainerRef) return;

      const maplibregl = await import('maplibre-gl');

      this.map = new maplibregl.Map({
        container: this.mapContainerRef.nativeElement,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              maxzoom: 19,
            },
          },
          layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
        },
        center: [-98.5795, 39.8283],
        zoom: 4,
      });

      this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
      this.map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        'top-right',
      );

      this.map.on('load', async () => {
        this.map!.addSource('colonies', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        this.map!.addSource('colony-points', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        this.addColonyLayers(maplibregl);
        await this.coloniesService.load();
        this.updateColonySource();
      });

      this.map.on('click', (e) => {
        if (!this.isAddingColony()) return;
        const { lng, lat } = e.lngLat;
        this.pendingLat.set(lat);
        this.pendingLng.set(lng);

        this.pendingMarker?.remove();
        this.pendingMarker = new maplibregl.Marker({ color: '#d97706' })
          .setLngLat([lng, lat])
          .addTo(this.map!);
      });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected startAddColony(): void {
    this.isAddingColony.set(true);
    this.pendingLat.set(null);
    this.pendingLng.set(null);
    this.newColonyName.set('');
    this.newColonyDesc.set('');
    this.newColonyFuzz.set(200);
    this.createError.set(null);
    if (this.map) this.map.getCanvas().style.cursor = 'crosshair';
  }

  protected cancelAddColony(): void {
    this.isAddingColony.set(false);
    this.pendingLat.set(null);
    this.pendingLng.set(null);
    this.pendingMarker?.remove();
    this.pendingMarker = undefined;
    this.submittingColony.set(false);
    this.createError.set(null);
    if (this.map) this.map.getCanvas().style.cursor = '';
  }

  protected async submitNewColony(): Promise<void> {
    const lat = this.pendingLat();
    const lng = this.pendingLng();
    const name = this.newColonyName().trim();
    if (this.submittingColony() || !lat || !lng || !name) return;

    this.submittingColony.set(true);
    this.createError.set(null);

    const id = await this.coloniesService.create(
      name,
      this.newColonyDesc().trim() || null,
      lat,
      lng,
      this.newColonyFuzz(),
    );

    this.submittingColony.set(false);

    if (!id) {
      this.createError.set(this.coloniesService.error() ?? 'Failed to create colony');
      return;
    }

    await this.coloniesService.load();
    this.updateColonySource();
    this.cancelAddColony();
  }

  private updateColonySource(): void {
    if (!this.map?.getSource('colonies')) return;
    const cols = this.colonies();

    const polygons = cols.map((c: ColonyPublic) =>
      circle([c.lng, c.lat], c.fuzzRadiusM / 1000, {
        steps: 64,
        units: 'kilometers',
        properties: { id: c.id, name: c.name, description: c.description ?? '', fuzz_radius_m: c.fuzzRadiusM },
      }),
    );
    (this.map.getSource('colonies') as import('maplibre-gl').GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: polygons,
    });

    const points = cols.map((c: ColonyPublic) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      properties: { id: c.id, name: c.name, description: c.description ?? '', fuzz_radius_m: c.fuzzRadiusM },
    }));
    (this.map.getSource('colony-points') as import('maplibre-gl').GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: points,
    });
  }

  private addColonyLayers(maplibregl: typeof import('maplibre-gl')): void {
    if (!this.map) return;

    // Low-zoom dot: pixel-based circle, scales with zoom and fuzz radius.
    this.map.addLayer({
      id: 'colony-dot',
      type: 'circle',
      source: 'colony-points',
      maxzoom: 10,
      paint: {
        'circle-color': '#d97706',
        'circle-opacity': 0.85,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          3, ['*', 6, ['/', ['get', 'fuzz_radius_m'], 300]],
          7, ['*', 12, ['/', ['get', 'fuzz_radius_m'], 300]],
          10, ['*', 18, ['/', ['get', 'fuzz_radius_m'], 300]],
        ],
      },
    });

    // High-zoom fuzz-radius polygon: geographically accurate area.
    this.map.addLayer({
      id: 'colony-fill',
      type: 'fill',
      source: 'colonies',
      minzoom: 10,
      paint: {
        'fill-color': '#d97706',
        'fill-opacity': 0.18,
      },
    });

    this.map.addLayer({
      id: 'colony-outline',
      type: 'line',
      source: 'colonies',
      minzoom: 10,
      paint: {
        'line-color': '#d97706',
        'line-width': 1.5,
        'line-opacity': 0.6,
      },
    });

    const navigateToColony = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (this.isAddingColony()) return;
      if (!e.features?.[0]) return;
      const id = e.features[0].properties['id'] as string;
      void this.router.navigate(['/colonies', id]);
    };

    this.map.on('click', 'colony-dot', navigateToColony);
    this.map.on('click', 'colony-fill', navigateToColony);

    for (const layer of ['colony-dot', 'colony-fill']) {
      this.map.on('mouseenter', layer, () => {
        if (this.map && !this.isAddingColony()) this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layer, () => {
        if (this.map && !this.isAddingColony()) this.map.getCanvas().style.cursor = '';
      });
    }
  }
}
