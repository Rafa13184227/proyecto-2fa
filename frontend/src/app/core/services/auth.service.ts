import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  sub: number;
  email: string;
  role: string;
}

interface JwtPayload extends User {
  exp?: number;
  iat?: number;
  iss?: string;
}

interface LoginResponse {
  requires2FA: boolean;
  tempToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: User;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface Setup2FAResponse {
  secret: string;
  qrCodeUri: string;
}

interface MeResponse {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    last_login?: string | null;
  };
}

interface Course {
  id: number;
  name: string;
  code: string;
  credits: number;
  grade?: number | null;
  enrolled_at?: string;
}

interface CoursesResponse {
  courses: Course[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private _user = signal<User | null>(null);
  private _loading = signal<boolean>(false);

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  private readonly NODE_URL = environment.nodeApiUrl;

  constructor() {
    this.restoreSession();
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    this._loading.set(true);

    return this.http.post<LoginResponse>(`${this.NODE_URL}/auth/login`, { email, password }).pipe(
      tap((res) => {
        if (!res.requires2FA && res.accessToken && res.refreshToken && res.user) {
          this.saveTokens(res.accessToken, res.refreshToken);
          this._user.set(res.user);
        } else if (res.requires2FA && res.tempToken && this.isBrowser) {
          sessionStorage.setItem('2fa_temp', res.tempToken);
        }

        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  completeLogin2FA(code: string): Observable<TokenResponse> {
    if (!this.isBrowser) {
      return throwError(() => new Error('2FA verification only runs in browser'));
    }

    const tempToken = sessionStorage.getItem('2fa_temp');

    if (!tempToken) {
      return throwError(() => new Error('No hay token temporal de 2FA'));
    }

    this._loading.set(true);

    return this.http.post<TokenResponse>(`${this.NODE_URL}/2fa/complete-login`, { tempToken, code }).pipe(
      tap((res) => {
        sessionStorage.removeItem('2fa_temp');
        this.saveTokens(res.accessToken, res.refreshToken);
        this._user.set(this.toUser(this.decodeToken(res.accessToken)));
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  setup2FA(): Observable<Setup2FAResponse> {
    return this.http.post<Setup2FAResponse>(`${this.NODE_URL}/2fa/setup`, {});
  }

  verifySetup2FA(code: string): Observable<{ verified: boolean; message?: string }> {
    this._loading.set(true);

    return this.http.post<{ verified: boolean; message?: string }>(`${this.NODE_URL}/2fa/verify`, { code }).pipe(
      tap(() => {
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.NODE_URL}/auth/me`);
  }

  getMyCourses(): Observable<CoursesResponse> {
    return this.http.get<CoursesResponse>(`${this.NODE_URL}/courses/my-courses`);
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('2fa_temp');
    }

    this._user.set(null);
    this.router.navigate(['/login']);
  }

  refreshAccessToken(): Observable<TokenResponse | null> {
    if (!this.isBrowser) {
      return of(null);
    }

    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      return of(null);
    }

    return this.http.post<TokenResponse>(`${this.NODE_URL}/auth/refresh`, { refreshToken }).pipe(
      tap((res) => this.saveTokens(res.accessToken, res.refreshToken))
    );
  }

  getAccessToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }

    return localStorage.getItem('access_token');
  }

  private saveTokens(access: string, refresh: string): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  private decodeToken(token: string): JwtPayload {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload)) as JwtPayload;
  }

  private toUser(decoded: JwtPayload): User {
    const { sub, email, role } = decoded;
    return { sub, email, role };
  }

  private restoreSession(): void {
    if (!this.isBrowser) {
      return;
    }

    const token = localStorage.getItem('access_token');

    if (!token) {
      return;
    }

    try {
      const decoded = this.decodeToken(token);

      if (decoded.exp && decoded.exp * 1000 > Date.now()) {
        this._user.set(this.toUser(decoded));
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }
}