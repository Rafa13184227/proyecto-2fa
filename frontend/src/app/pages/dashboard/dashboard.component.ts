import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface Course {
  id: number;
  name: string;
  code: string;
  credits: number;
  grade?: number | null;
  enrolled_at?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.user;
  profile = signal<any | null>(null);

  courses = signal<Course[]>([]);
  loadingCourses = signal(false);
  coursesError = signal<string | null>(null);

  isAdmin = computed(() => this.user()?.role === 'admin');
  hasCourses = computed(() => this.courses().length > 0);

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: (res) => {
        this.profile.set(res.user);

        if (res.user?.role !== 'admin') {
          this.loadCourses();
        }
      },
      error: () => this.profile.set(null)
    });
  }

  loadCourses(): void {
    this.loadingCourses.set(true);
    this.coursesError.set(null);

    this.auth.getMyCourses().subscribe({
      next: (res) => {
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
}