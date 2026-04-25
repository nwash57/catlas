import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from './auth.service';
import { AuthShell } from './auth-shell';

@Component({
  selector: 'app-sign-up',
  imports: [AuthShell, FormsModule, RouterLink],
  templateUrl: './sign-up.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUp {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly needsConfirmation = signal(false);
  readonly submitting = signal(false);

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { error } = await this.auth.signUp(this.email(), this.password());
    if (error) {
      this.errorMessage.set(error.message);
      this.submitting.set(false);
      return;
    }

    if (this.auth.currentUser()) {
      await this.router.navigateByUrl('/dashboard');
      return;
    }
    this.needsConfirmation.set(true);
    this.submitting.set(false);
  }
}
