import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-courses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section>
      <h1>Administrar cursos</h1>
      <p>Crea nuevos cursos.</p>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div>
          <label for="name">Nombre</label>
          <input id="name" type="text" formControlName="name" />
        </div>

        <div>
          <label for="code">Código</label>
          <input id="code" type="text" formControlName="code" />
        </div>

        <div>
          <label for="credits">Créditos</label>
          <input id="credits" type="number" formControlName="credits" />
        </div>

        <div>
          <label for="teacher_id">ID del profesor</label>
          <input id="teacher_id" type="number" formControlName="teacher_id" />
        </div>

        @if (error()) {
          <p>{{ error() }}</p>
        }

        @if (success()) {
          <p>{{ success() }}</p>
        }

        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Guardando...' : 'Crear curso' }}
        </button>
      </form>
    </section>
  `
})
export class AdminCoursesComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  form = this.fb.group({
    name: ['', [Validators.required]],
    code: ['', [Validators.required]],
    credits: [1, [Validators.required, Validators.min(1)]],
    teacher_id: [null]
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post(`${environment.nodeApiUrl}/admin/courses`, this.form.value).subscribe({
      next: () => {
        this.success.set('Curso creado correctamente.');
        this.form.reset({
          name: '',
          code: '',
          credits: 1,
          teacher_id: null
        });
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'No se pudo crear el curso.');
        this.loading.set(false);
      }
    });
  }
}