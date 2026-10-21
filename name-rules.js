// Shared formatting validation. Approval by a person establishes whether the applicant is known.
export const fullNameMessage = 'Ingresá tu nombre y apellido completos (entre 3 y 100 caracteres), usando letras, espacios, apóstrofes o guiones.';
export function normalizeFullName(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/ +/g, ' ').replace(/[\u2010\u2011]/g, '-') : '';
}
export function validFullName(value) {
  const name = normalizeFullName(value);
  if (name.length < 3 || name.length > 100 || !/^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*(?: [\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*)+$/u.test(name)) return false;
  return name.split(' ').filter(part => (part.match(/\p{L}/gu) || []).length >= 2).length >= 2;
}
