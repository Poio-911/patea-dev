# Autenticación y Configuración

## Descripción General
Sistema de autenticación con Firebase Auth y página de configuración de preferencias de usuario.

## Rutas
- `/login` - Inicio de sesión
- `/register` - Registro de nuevo usuario
- `/forgot-password` - Recuperar contraseña
- `/settings` - Configuración del usuario
- `/profile` - Perfil público

## Autenticación

### Firebase Auth
- Email/Password
- Google Sign-In (futuro)
- Email verification

### Componentes

#### LoginForm
- Input email
- Input password
- "Olvidé mi contraseña" link
- Botón "Iniciar Sesión"
- Loading state
- Error handling

#### RegisterForm
- Input nombre completo
- Input email
- Input password
- Input confirmar password
- Validación en tiempo real
- Botón "Registrarse"

#### ForgotPasswordForm
- Input email
- Enviar link de reset
- Confirmación visual

### Server Actions
```typescript
loginAction(email, password)
registerAction(email, password, displayName)
logoutAction()
sendPasswordResetAction(email)
updatePasswordAction(newPassword)
```

## Flujo de Registro

1. Usuario completa formulario
2. Firebase crea cuenta
3. Se crea documento en `/users/{uid}`
4. Email de verificación (opcional)
5. Redirect a `/dashboard`

### Documento de Usuario
```typescript
// Firestore: /users/{uid}
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  activeGroupId?: string;
  createdAt: string;
  preferences: {
    theme: 'light' | 'dark' | 'game';
    notifications: boolean;
    publicProfile: boolean;
  };
}
```

## Settings Page

### Tabs

#### Perfil
- Cambiar foto
- Cambiar nombre
- Email (no editable)

#### Preferencias
- **Tema**: Light / Dark / Game Mode
- **Notificaciones**: Activar/Desactivar
- **Perfil Público**: Visible en búsquedas

#### Grupos
- Lista de grupos del usuario
- Botón "Salir del grupo"
- Cambiar grupo activo

#### Integraciones
- **Google Fit**: Conectar/Desconectar
- Estado de conexión

#### Cuenta
- Cambiar contraseña
- Eliminar cuenta (con confirmación)
- Logout

### Componentes
- **SettingsSheet**: Side panel con tabs
- **ThemeToggle**: Selector de tema
- **ProfilePhotoUpload**: Crop + upload
- **DangerZone**: Acciones irreversibles

## Temas

### Light Mode
- Fondo blanco
- Texto oscuro
- Colores suaves

### Dark Mode
- Fondo dark gray
- Texto claro
- Alto contraste

### Game Mode
- Fondo verde cancha
- Textura de césped sutil
- Paleta futbolística

## IA Integrada

### get-app-help
- Chat de ayuda en settings
- Responde preguntas sobre la app
- Botón "¿Necesitás ayuda?"

## Protección de Rutas

### Middleware
```typescript
// middleware.ts
if (!user && protectedRoute) {
  redirect('/login');
}
```

### Protected Routes
- `/dashboard`
- `/players`
- `/matches`
- `/groups`
- `/settings`

### Public Routes
- `/`
- `/login`
- `/register`
- `/forgot-password`

## Sesión

### useUser Hook
```typescript
const { user, loading } = useUser();
```

- Reactivo con Firebase Auth
- Auto-refresh
- Persiste en localStorage

### Logout
- Firebase signOut
- Clear local state
- Redirect a `/login`

## Security

### Password Requirements
- Mínimo 6 caracteres
- Validación client + server

### Email Verification
- Opcional en MVP
- Requerido para features sensibles (futuro)

### CSRF Protection
- State parameter en OAuth flows

## Próximas Mejoras
- [ ] 2FA (Two-Factor Auth)
- [ ] Social logins (Google, Facebook)
- [ ] Magic link login (passwordless)
- [ ] Account recovery questions
- [ ] Exportar datos del usuario (GDPR)
