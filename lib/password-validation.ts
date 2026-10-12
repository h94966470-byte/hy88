export function hasPasswordDiacritics(password: string): boolean {
  return /\p{M}/u.test(password.normalize("NFD"));
}
