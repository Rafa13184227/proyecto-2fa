import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify2fa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './verify2fa.component.html',
  styleUrl: './verify2fa.component.scss'
})
export class Verify2faComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  error = signal<string | null>(null);
  loading = this.auth.loading;

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';

    this.auth.completeLogin2FA(this.form.value.code!).subscribe({
      next: () => this.router.navigateByUrl(returnUrl),
      error: (e) =>
        this.error.set(e.error?.error ?? 'Código incorrecto o expirado')
    });
  }
}