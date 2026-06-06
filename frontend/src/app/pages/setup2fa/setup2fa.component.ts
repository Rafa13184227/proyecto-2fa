import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-setup2fa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './setup2fa.component.html',
  styleUrl: './setup2fa.component.scss'
})
export class Setup2faComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  qrCodeUri = signal<string | null>(null);
  secret = signal<string | null>(null);
  loading = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

  form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  ngOnInit(): void {
    this.loadSetupData();
  }

  loadSetupData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.auth.setup2FA().subscribe({
      next: (res) => {
        this.qrCodeUri.set(res.qrCodeUri);
        this.secret.set(res.secret);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'No se pudo generar la configuración 2FA');
        this.loading.set(false);
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.auth.verifySetup2FA(this.form.value.code!).subscribe({
      next: () => {
        this.success.set('2FA activado correctamente. Redirigiendo...');
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'Código incorrecto o expirado');
        this.loading.set(false);
      }
    });
  }
}