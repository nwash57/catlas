import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { ThemeToggle } from '../shared/theme-toggle.component';

@Component({
  selector: 'app-learn-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggle],
  templateUrl: './learn-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearnShell {
  private readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly currentUser = this.auth.currentUser;

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
