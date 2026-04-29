import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CatsService } from './cats.service';
import { PhotoService } from './photo.service';
import type {
  CatAge,
  CatFull,
  CatPublic,
  CatSex,
  CatSterilization,
  CatTemperament,
  CatWritePatch,
} from './cat.model';

type Mode = 'public' | 'full';

interface DraftForm {
  name: string;
  description: string;
  coat: string;
  approxAge: CatAge;
  sex: CatSex;
  temperament: CatTemperament;
  sterilization: CatSterilization;
  earTipped: boolean;
  scheduledFor: string; // YYYY-MM-DD or '' for null
  notes: string;
  healthConcerns: string;
  deceased: boolean;
  photoFile: File | null;
  removePhoto: boolean;
  photoPreviewUrl: string | null;
}

const EMPTY_DRAFT: DraftForm = {
  name: '',
  description: '',
  coat: '',
  approxAge: 'unknown',
  sex: 'unknown',
  temperament: 'unknown',
  sterilization: 'unknown',
  earTipped: false,
  scheduledFor: '',
  notes: '',
  healthConcerns: '',
  deceased: false,
  photoFile: null,
  removePhoto: false,
  photoPreviewUrl: null,
};

const AGE_LABELS: Record<CatAge, string> = {
  unknown: 'Age unknown',
  kitten: 'Kitten',
  juvenile: 'Juvenile',
  adult: 'Adult',
  senior: 'Senior',
};

const SEX_LABELS: Record<CatSex, string> = {
  unknown: 'Unknown',
  male: 'Male',
  female: 'Female',
};

const TEMPERAMENT_LABELS: Record<CatTemperament, string> = {
  unknown: 'Unknown',
  feral: 'Feral',
  socializable: 'Socializable',
  friendly: 'Friendly',
};

const STERILIZATION_LABELS: Record<CatSterilization, string> = {
  unknown: 'Unknown',
  intact: 'Intact',
  sterilized: 'Sterilized',
};

@Component({
  selector: 'app-cat-list',
  standalone: true,
  imports: [FormsModule, DatePipe, NgTemplateOutlet],
  templateUrl: './cat-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CatList {
  private readonly catsService = inject(CatsService);
  private readonly photos = inject(PhotoService);

  readonly colonyId = input.required<string>();
  readonly mode = input.required<Mode>();
  readonly canManage = input<boolean>(false);

  protected readonly loading = signal(true);
  protected readonly cats = signal<(CatPublic | CatFull)[]>([]);
  protected readonly photoUrls = signal<Record<string, string>>({});

  protected readonly editingId = signal<string | null>(null);
  protected readonly addingNew = signal(false);
  protected readonly saving = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly errorMsg = signal<string | null>(null);

  protected draft = signal<DraftForm>({ ...EMPTY_DRAFT });

  protected readonly ageOptions: CatAge[] = ['unknown', 'kitten', 'juvenile', 'adult', 'senior'];
  protected readonly sexOptions: CatSex[] = ['unknown', 'male', 'female'];
  protected readonly temperamentOptions: CatTemperament[] = [
    'unknown',
    'feral',
    'socializable',
    'friendly',
  ];
  protected readonly sterilizationOptions: CatSterilization[] = [
    'unknown',
    'intact',
    'sterilized',
  ];

  protected readonly fullMode = computed(() => this.mode() === 'full');

  // Lazy load on first render — input() signals are read inside computed/effect
  // but we use a simple kickoff via constructor + colonyId effect.
  constructor() {
    // Use a microtask to ensure inputs are bound before loading.
    queueMicrotask(() => void this.reload());
  }

  protected ageLabel(a: CatAge): string {
    return AGE_LABELS[a];
  }
  protected sexLabel(s: CatSex): string {
    return SEX_LABELS[s];
  }
  protected temperamentLabel(t: CatTemperament): string {
    return TEMPERAMENT_LABELS[t];
  }
  protected sterilizationLabel(s: CatSterilization): string {
    return STERILIZATION_LABELS[s];
  }

  protected isFull(c: CatPublic | CatFull): c is CatFull {
    return 'sex' in c;
  }

  protected displayName(c: CatPublic | CatFull, idx: number): string {
    return c.name?.trim() || `Unnamed #${idx + 1}`;
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    const id = this.colonyId();
    const list =
      this.mode() === 'full'
        ? await this.catsService.listFullByColony(id)
        : await this.catsService.listPublicByColony(id);
    this.cats.set(list);
    this.loading.set(false);
    void this.resolvePhotoUrls(list);
  }

  private async resolvePhotoUrls(list: (CatPublic | CatFull)[]): Promise<void> {
    const have = this.photoUrls();
    const missing = list
      .map((c) => c.photoPath)
      .filter((p): p is string => !!p && !have[p]);
    if (missing.length === 0) return;

    const resolved = await Promise.all(
      missing.map(async (p) => [p, await this.photos.signedUrl(p)] as const),
    );
    const next = { ...have };
    let changed = false;
    for (const [p, url] of resolved) {
      if (url && next[p] !== url) {
        next[p] = url;
        changed = true;
      }
    }
    if (changed) this.photoUrls.set(next);
  }

  protected photoUrlFor(c: CatPublic | CatFull): string | null {
    if (!c.photoPath) return null;
    return this.photoUrls()[c.photoPath] ?? null;
  }

  protected startAdd(): void {
    this.draft.set({ ...EMPTY_DRAFT });
    this.editingId.set(null);
    this.errorMsg.set(null);
    this.addingNew.set(true);
  }

  protected startEdit(c: CatFull): void {
    this.revokePreview();
    this.draft.set({
      name: c.name ?? '',
      description: c.description ?? '',
      coat: c.coat ?? '',
      approxAge: c.approxAge,
      sex: c.sex,
      temperament: c.temperament,
      sterilization: c.sterilization,
      earTipped: c.earTipped,
      scheduledFor: c.scheduledFor ? c.scheduledFor.slice(0, 10) : '',
      notes: c.notes ?? '',
      healthConcerns: c.healthConcerns ?? '',
      deceased: !!c.deceasedAt,
      photoFile: null,
      removePhoto: false,
      photoPreviewUrl: null,
    });
    this.errorMsg.set(null);
    this.addingNew.set(false);
    this.editingId.set(c.id);
  }

  protected cancelForm(): void {
    this.revokePreview();
    this.addingNew.set(false);
    this.editingId.set(null);
    this.errorMsg.set(null);
  }

  protected onPhotoChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.revokePreview();
    const previewUrl = URL.createObjectURL(file);
    this.draft.update((d) => ({
      ...d,
      photoFile: file,
      removePhoto: false,
      photoPreviewUrl: previewUrl,
    }));
  }

  protected clearStagedPhoto(): void {
    this.revokePreview();
    this.draft.update((d) => ({ ...d, photoFile: null, photoPreviewUrl: null }));
  }

  protected markPhotoForRemoval(): void {
    this.revokePreview();
    this.draft.update((d) => ({
      ...d,
      photoFile: null,
      photoPreviewUrl: null,
      removePhoto: true,
    }));
  }

  protected currentEditingCat(): CatFull | null {
    const id = this.editingId();
    if (!id) return null;
    const found = this.cats().find((c) => c.id === id);
    return found && this.isFull(found) ? found : null;
  }

  private revokePreview(): void {
    const url = this.draft().photoPreviewUrl;
    if (url) URL.revokeObjectURL(url);
  }

  protected updateDraft<K extends keyof DraftForm>(key: K, value: DraftForm[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  private buildPatch(d: DraftForm, isNew: boolean): CatWritePatch {
    return {
      name: d.name.trim() || null,
      description: d.description.trim() || null,
      coat: d.coat.trim() || null,
      approxAge: d.approxAge,
      sex: d.sex,
      temperament: d.temperament,
      sterilization: d.sterilization,
      earTipped: d.earTipped,
      scheduledFor: d.scheduledFor ? new Date(d.scheduledFor).toISOString() : null,
      notes: d.notes.trim() || null,
      healthConcerns: d.healthConcerns.trim() || null,
      // For new cats, leave deceased_at unset (defaults to null).
      // For edits, the checkbox toggles between now() and null.
      ...(isNew
        ? {}
        : { deceasedAt: d.deceased ? new Date().toISOString() : null }),
    };
  }

  protected async saveForm(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.errorMsg.set(null);

    const d = this.draft();
    const editId = this.editingId();
    let targetId: string | null = editId;

    if (editId) {
      const ok = await this.catsService.update(editId, this.buildPatch(d, false));
      if (!ok) {
        this.saving.set(false);
        this.errorMsg.set('Could not save. Check your connection and try again.');
        return;
      }
    } else {
      targetId = await this.catsService.create(this.colonyId(), this.buildPatch(d, true));
      if (!targetId) {
        this.saving.set(false);
        this.errorMsg.set('Could not save. Check your connection and try again.');
        return;
      }
    }

    if (targetId && d.removePhoto) {
      const result = await this.photos.delete(targetId);
      if ('error' in result) {
        this.saving.set(false);
        this.errorMsg.set(`Saved, but photo removal failed: ${result.error}`);
        return;
      }
    } else if (targetId && d.photoFile) {
      const result = await this.photos.upload(targetId, d.photoFile);
      if ('error' in result) {
        this.saving.set(false);
        this.errorMsg.set(`Saved, but photo upload failed: ${result.error}`);
        return;
      }
    }

    this.revokePreview();
    this.saving.set(false);
    this.addingNew.set(false);
    this.editingId.set(null);
    await this.reload();
  }

  protected async deleteCat(id: string): Promise<void> {
    if (this.deletingId()) return;
    if (!confirm('Delete this cat? This cannot be undone.')) return;

    this.deletingId.set(id);
    const ok = await this.catsService.delete(id);
    this.deletingId.set(null);

    if (!ok) {
      this.errorMsg.set('Could not delete. Try again.');
      return;
    }

    await this.reload();
  }
}
