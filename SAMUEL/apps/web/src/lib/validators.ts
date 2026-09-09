export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateLogin(email: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isValidEmail(email)) errors.email = 'Informe um e-mail válido.';
  if (password.length < 8) errors.password = 'A senha deve ter pelo menos 8 caracteres.';
  return errors;
}

export function validateForgot(email: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isValidEmail(email)) errors.email = 'Informe um e-mail válido.';
  return errors;
}

export function validateReset(password: string, passwordConfirmation: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (password.length < 8) errors.password = 'Mínimo 8 caracteres.';
  if (passwordConfirmation !== password) errors.passwordConfirmation = 'As senhas não coincidem.';
  return errors;
}

export function validateChangePassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirmation: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!currentPassword) errors.currentPassword = 'Informe a senha atual.';
  if (newPassword.length < 8) errors.newPassword = 'Mínimo 8 caracteres.';
  if (newPassword && currentPassword && newPassword === currentPassword) {
    errors.newPassword = 'A nova senha deve ser diferente da atual.';
  }
  if (newPasswordConfirmation !== newPassword) {
    errors.newPasswordConfirmation = 'As senhas não coincidem.';
  }
  return errors;
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}
