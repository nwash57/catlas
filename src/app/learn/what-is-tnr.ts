import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-what-is-tnr',
  imports: [RouterLink],
  templateUrl: './what-is-tnr.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatIsTnr {}
