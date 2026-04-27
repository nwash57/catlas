import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { ThemeToggle } from '../shared/theme-toggle.component';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, ThemeToggle],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly signingOut = signal(false);

  async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
