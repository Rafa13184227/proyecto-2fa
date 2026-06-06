import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  error = signal<string | null>(null);
  loading = this.auth.loading;

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);

    const { email, password } = this.form.value;
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';

    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        if (res.requires2FA) {
          this.router.navigate(['/verify-2fa'], {
            queryParams: { returnUrl }
          });
        } else {
          this.router.navigateByUrl(returnUrl);
        }
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Error al iniciar sesión');
      }
    });
  }
}