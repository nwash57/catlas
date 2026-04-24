import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import circle from '@turf/circle';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { AuthService } from '../auth/auth.service';
import { ColoniesService } from '../map/colonies.service';
import type { ColonyFull, ColonyMembership, ColonyPublic } from '../map/colony.model';

@Component({
  selector: 'app-colony-profile',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './colony-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ColonyProfile implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly coloniesService = inject(ColoniesService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly publicData = signal<ColonyPublic | null>(null);
  protected readonly fullData = signal<ColonyFull | null>(null);
  protected readonly membership = signal<ColonyMembership | null>(null);

  protected readonly joinStatus = signal<'idle' | 'sending' | 'sent'>('idle');
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected editName = signal('');
  protected editDescription = signal('');
  protected editIsPublic = signal(false);

  protected readonly currentUser = this.auth.currentUser;

  protected readonly isActiveMember = computed(
    () => this.membership()?.status === 'active',
  );
  protected readonly isManager = computed(
    () =>
      this.isActiveMember() &&
      (this.membership()?.role === 'owner' || this.membership()?.role === 'caretaker'),
  );
  protected readonly canViewContent = computed(() => {
    const pub = this.publicData();
    if (!pub) return false;
    return pub.isPublic || this.isActiveMember();
  });

  @ViewChild('mapEl') private mapElRef?: ElementRef<HTMLDivElement>;
  private map?: MapLibreMap;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    const pub = await this.coloniesService.getById(id);
    if (!pub) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.publicData.set(pub);

    await this.auth.ready;
    if (this.auth.currentUser()) {
      const [full, mem] = await Promise.all([
        this.coloniesService.getFullById(id),
        this.coloniesService.getMembership(id),
      ]);
      if (full) this.fullData.set(full);
      if (mem) this.membership.set(mem);
    }

    this.loading.set(false);
    setTimeout(() => void this.initMap(), 0);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected startEditing(): void {
    const pub = this.publicData()!;
    this.editName.set(pub.name);
    this.editDescription.set(pub.description ?? '');
    this.editIsPublic.set(pub.isPublic);
    this.saveError.set(null);
    this.editing.set(true);
  }

  protected cancelEditing(): void {
    this.editing.set(false);
    this.saveError.set(null);
  }

  protected async saveEdits(): Promise<void> {
    const id = this.publicData()?.id;
    if (!id || this.saving()) return;
    const name = this.editName().trim();
    if (!name) { this.saveError.set('Colony name is required.'); return; }

    this.saving.set(true);
    this.saveError.set(null);

    const ok = await this.coloniesService.updateColony(id, {
      name,
      description: this.editDescription().trim() || null,
      isPublic: this.editIsPublic(),
    });

    this.saving.set(false);

    if (!ok) {
      this.saveError.set('Failed to save changes. Please try again.');
      return;
    }

    // Refresh public data so the profile reflects the update
    const updated = await this.coloniesService.getById(id);
    if (updated) this.publicData.set(updated);
    this.editing.set(false);
  }

  protected async requestToJoin(): Promise<void> {
    const id = this.publicData()?.id;
    if (!id || this.joinStatus() !== 'idle') return;
    this.joinStatus.set('sending');
    const ok = await this.coloniesService.requestToJoin(id);
    this.joinStatus.set(ok ? 'sent' : 'idle');
    if (ok) {
      // Update membership state to reflect pending status
      const mem = await this.coloniesService.getMembership(id);
      if (mem) this.membership.set(mem);
    }
  }

  private async initMap(): Promise<void> {
    const container = this.mapElRef?.nativeElement;
    const pub = this.publicData();
    if (!container || !pub || this.map) return;

    const maplibregl = await import('maplibre-gl');

    const full = this.fullData();
    const center: [number, number] = [pub.lng, pub.lat];

    this.map = new maplibregl.Map({
      container,
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
      center,
      zoom: 13,
      interactive: false,
      attributionControl: false,
    });

    this.map.on('load', () => {
      const fuzzPolygon = circle([pub.lng, pub.lat], pub.fuzzRadiusM / 1000, {
        steps: 64,
        units: 'kilometers',
      });
      this.map!.addSource('fuzz', { type: 'geojson', data: fuzzPolygon });
      this.map!.addLayer({
        id: 'fuzz-fill',
        type: 'fill',
        source: 'fuzz',
        paint: { 'fill-color': '#d97706', 'fill-opacity': 0.15 },
      });
      this.map!.addLayer({
        id: 'fuzz-outline',
        type: 'line',
        source: 'fuzz',
        paint: { 'line-color': '#d97706', 'line-width': 1.5, 'line-opacity': 0.6 },
      });

      if (full) {
        new maplibregl.Marker({ color: '#d97706' })
          .setLngLat([full.lng, full.lat])
          .addTo(this.map!);
        this.map!.setCenter([full.lng, full.lat]);
      }
    });
  }
}
