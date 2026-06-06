import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Student {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Course {
  id: number;
  name: string;
  code: string;
  credits: number;
}

@Component({
  selector: 'app-admin-assignments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-assignments.component.html',
  styleUrl: './admin-assignments.component.scss'
})
export class AdminAssignmentsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  loading = signal(false);
  loadingData = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  students = signal<Student[]>([]);
  courses = signal<Course[]>([]);

  studentSearch = signal('');
  courseSearch = signal('');

  selectedStudent = signal<Student | null>(null);
  selectedCourse = signal<Course | null>(null);

  filteredStudents = computed(() => {
    const term = this.studentSearch().toLowerCase().trim();

    if (!term) return this.students();

    return this.students().filter(student =>
      student.name.toLowerCase().includes(term) ||
      student.email.toLowerCase().includes(term) ||
      String(student.id).includes(term)
    );
  });

  filteredCourses = computed(() => {
    const term = this.courseSearch().toLowerCase().trim();

    if (!term) return this.courses();

    return this.courses().filter(course =>
      course.name.toLowerCase().includes(term) ||
      course.code.toLowerCase().includes(term) ||
      String(course.id).includes(term)
    );
  });

  form = this.fb.group({
    student_id: [null as number | null, [Validators.required]],
    course_id: [null as number | null, [Validators.required]]
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loadingData.set(true);
    this.error.set(null);

    this.http.get<{ students: Student[] }>(`${environment.nodeApiUrl}/admin/students`).subscribe({
      next: (studentsRes) => {
        this.students.set(studentsRes.students ?? []);

        this.http.get<{ courses: Course[] }>(`${environment.nodeApiUrl}/admin/courses`).subscribe({
          next: (coursesRes) => {
            this.courses.set(coursesRes.courses ?? []);
            this.loadingData.set(false);
          },
          error: (err: { error?: { error?: string } }) => {
            this.error.set(err.error?.error ?? 'No se pudieron cargar los cursos.');
            this.loadingData.set(false);
          }
        });
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'No se pudieron cargar los estudiantes.');
        this.loadingData.set(false);
      }
    });
  }

  setStudentSearch(value: string): void {
    this.studentSearch.set(value);
  }

  setCourseSearch(value: string): void {
    this.courseSearch.set(value);
  }

  selectStudent(student: Student): void {
    this.selectedStudent.set(student);
    this.form.patchValue({ student_id: student.id });
    this.studentSearch.set(`${student.id} - ${student.name}`);
  }

  selectCourse(course: Course): void {
    this.selectedCourse.set(course);
    this.form.patchValue({ course_id: course.id });
    this.courseSearch.set(`${course.id} - ${course.name} (${course.code})`);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.http.post(`${environment.nodeApiUrl}/admin/assignments`, this.form.value).subscribe({
      next: () => {
        this.success.set('Curso asignado correctamente.');
        this.form.reset({
          student_id: null,
          course_id: null
        });
        this.selectedStudent.set(null);
        this.selectedCourse.set(null);
        this.studentSearch.set('');
        this.courseSearch.set('');
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.error.set(err.error?.error ?? 'No se pudo asignar el curso.');
        this.loading.set(false);
      }
    });
  }
}