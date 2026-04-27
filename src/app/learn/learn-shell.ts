import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ThemeToggle } from '../shared/theme-toggle.component';

@Component({
  selector: 'app-learn-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggle],
  templateUrl: './learn-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearnShell {}
