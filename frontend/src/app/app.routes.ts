import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

    {
        path: 'login',
        loadComponent: () =>
            import('./pages/login/login.component').then(m => m.LoginComponent)
    },
    {
        path: 'verify-2fa',
        loadComponent: () =>
            import('./pages/verify2fa/verify2fa.component').then(m => m.Verify2faComponent)
    },
    {
        path: 'setup-2fa',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./pages/setup2fa/setup2fa.component').then(m => m.Setup2faComponent)
    },
    {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
    },
    {
        path: 'admin/users',
        canActivate: [authGuard, adminGuard],
        loadComponent: () =>
            import('./pages/admin-users/admin-users.component').then(m => m.AdminUsersComponent)
    },
    {
        path: 'admin/courses',
        canActivate: [authGuard, adminGuard],
        loadComponent: () =>
            import('./pages/admin-courses/admin-courses.component').then(m => m.AdminCoursesComponent)
    },
    {
        path: 'admin/assignments',
        canActivate: [authGuard, adminGuard],
        loadComponent: () =>
            import('./pages/admin-assignments/admin-assignments.component').then(m => m.AdminAssignmentsComponent)
    },

    { path: '**', redirectTo: '/login' }
];