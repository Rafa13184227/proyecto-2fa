import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthService,
  Course,
  CoursesResponse,
  MeResponse,
  BackupCodesResponse
} from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.user;
  profile = signal<{
    id: number;
    name: string;
    email: string;
    role: string;
    last_login?: string | null;
  } | null>(null);

  courses = signal<Course[]>([]);
  loadingCourses = signal(false);
  coursesError = signal<string | null>(null);
  backupCodes = signal<string[] | null>(null);
  backupError = signal<string | null>(null);

  isAdmin = computed(() => this.user()?.role === 'admin');
  hasCourses = computed(() => this.courses().length > 0);
  displayName = computed(() => this.profile()?.name || this.user()?.email || 'Usuario');
  displayRole = computed(() => this.profile()?.role || this.user()?.role || 'user');

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.auth.me().subscribe({
      next: (res: MeResponse) => {
        this.profile.set(res.user);

        if (res.user?.role !== 'admin') {
          this.loadCourses();
        }
      },
      error: () => {
        this.profile.set(null);
        this.courses.set([]);
      }
    });
  }

  loadCourses(): void {
    this.loadingCourses.set(true);
    this.coursesError.set(null);

    this.auth.getMyCourses().subscribe({
      next: (res: CoursesResponse) => {
        this.courses.set(res.courses ?? []);
        this.loadingCourses.set(false);
      },
      error: () => {
        this.coursesError.set('No se pudieron cargar los cursos');
        this.loadingCourses.set(false);
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }

  getBackupCodes(): void {
    this.backupError.set(null);

    this.auth.generateBackupCodes().subscribe({
      next: (res: BackupCodesResponse) => {
        this.backupCodes.set(res.codes);
      },
      error: () => {
        this.backupError.set('No se pudieron generar los códigos de respaldo');
      }
    });
  }

  closeBackupCodes(): void {
    this.backupCodes.set(null);
    this.backupError.set(null);
  }

  downloadBackupCodes(): void {
    const codes = this.backupCodes();
    if (!codes) return;

    const content = codes.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const header = 'CÓDIGOS DE RESPALDO - Sistema 2FA\n';
    const warning = '\nGuarda estos códigos en un lugar seguro. Cada uno solo puede usarse una vez.\n' +
      'Si usás todos, generá un nuevo lote desde el dashboard.\n' +
      '━'.repeat(40) + '\n\n';
    const blob = new Blob([header + warning + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes-2fa.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  goToSetup2FA(): void {
    this.router.navigate(['/setup-2fa']);
  }

  goToAdminUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  goToAdminCourses(): void {
    this.router.navigate(['/admin/courses']);
  }

  goToAdminAssignments(): void {
    this.router.navigate(['/admin/assignments']);
  }

  trackByCourseId(_: number, course: Course): number {
    return course.id;
  }
}