import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './shared/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('catlas');
  private readonly _theme = inject(ThemeService);
}
