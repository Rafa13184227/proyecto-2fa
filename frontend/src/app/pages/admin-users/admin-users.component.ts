import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section>
      <h1>Administrar usuarios</h1>
      <p>Crea usuarios y asigna su rol.</p>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div>
          <label for="name">Nombre</label>
          <input id="name" type="text" formControlName="name" />
        </div>

        <div>
          <label for="email">Correo</label>
          <input id="email" type="email" formControlName="email" />
        </div>

        <div>
          <label for="password">Contraseña</label>
          <input id="password" type="password" formControlName="password" />
        </div>

        <div>
          <label for="role">Rol</label>
          <select id="role" formControlName="role">
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        @if (error()) {
          <p>{{ error() }}</p>
        }

        @if (success()) {
          <p>{{ success() }}</p>
        }

        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Guardando...' : 'Crear usuario' }}
        </button>
      </form>
    </section>
  `
})
export class AdminUsersComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['user', [Validators.required]]
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post(`${environment.nodeApiUrl}/admin/users`, this.form.value).subscribe({
      next: () => {
        this.success.set('Usuario creado correctamente.');
        this.form.reset({
          name: '',
          email: '',
          password: '',
          role: 'user'
        });
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'No se pudo crear el usuario.');
        this.loading.set(false);
      }
    });
  }
}