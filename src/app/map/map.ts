import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import circle from '@turf/circle';

import { ThemeToggle } from '../shared/theme-toggle.component';
import { ColoniesService } from './colonies.service';
import type { ColonyPublic } from './colony.model';
import type { Map as MapLibreMap } from 'maplibre-gl';

@Component({
  selector: 'app-map-page',
  imports: [RouterLink, ThemeToggle],
  templateUrl: './map.html',
  styleUrl: './map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class MapPage implements OnDestroy {
  private readonly coloniesService = inject(ColoniesService);

  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;

  protected readonly colonies = this.coloniesService.colonies;
  protected readonly loading = this.coloniesService.loading;
  protected readonly error = this.coloniesService.error;

  private map?: MapLibreMap;

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
        await this.coloniesService.load();
        this.addColonyLayers(maplibregl);
      });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private addColonyLayers(maplibregl: typeof import('maplibre-gl')): void {
    if (!this.map) return;

    const features = this.colonies().map((c: ColonyPublic) =>
      circle([c.lng, c.lat], c.fuzzRadiusM / 1000, {
        steps: 64,
        units: 'kilometers',
        properties: { id: c.id, name: c.name, description: c.description ?? '' },
      }),
    );

    this.map.addSource('colonies', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    this.map.addLayer({
      id: 'colony-fill',
      type: 'fill',
      source: 'colonies',
      paint: {
        'fill-color': '#d97706',
        'fill-opacity': 0.18,
      },
    });

    this.map.addLayer({
      id: 'colony-outline',
      type: 'line',
      source: 'colonies',
      paint: {
        'line-color': '#d97706',
        'line-width': 1.5,
        'line-opacity': 0.6,
      },
    });

    this.map.on('click', 'colony-fill', (e) => {
      if (!e.features?.[0] || !this.map) return;
      const props = e.features[0].properties as { name: string; description: string };

      new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong style="font-size:0.9rem;font-family:sans-serif">${props['name']}</strong>` +
            (props['description']
              ? `<p style="margin:4px 0 0;font-size:0.8rem;color:#666;font-family:sans-serif">${props['description']}</p>`
              : '') +
            `<p style="margin:6px 0 0;font-size:0.75rem;color:#999;font-family:sans-serif;font-style:italic">Approximate area shown for privacy</p>`,
        )
        .addTo(this.map);
    });

    this.map.on('mouseenter', 'colony-fill', () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'colony-fill', () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });
  }
}
