import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ThemeToggle } from '../shared/theme-toggle.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, ThemeToggle],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  readonly pillars = [
    {
      title: 'A map of the colonies around you',
      body:
        "Caretakers place their colonies on a shared map. Neighbors see which colonies are already being cared for — so no one calls animal control on cats someone's already feeding.",
    },
    {
      title: 'A home for each cat',
      body:
        'Track TNR status, ear-tips, sightings, and the cats you lose. Photos have their GPS stripped on upload, so a picture never leaks what the map protects.',
    },
    {
      title: 'Recruit your block in one scan',
      body:
        'Print a flyer with a QR code and post it on your street. Neighbors scan, sign up, and land inside the colony as a member — no back-and-forth, no gatekeeping.',
    },
    {
      title: 'TNR, explained — and clinics that do it',
      body:
        "Plain-English guides to Trap-Neuter-Return, plus a directory of low-cost spay/neuter clinics. The part of TNR that's hardest to find, in one place.",
    },
  ];
}
