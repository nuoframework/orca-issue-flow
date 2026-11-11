/** Clack validates before applying defaultValue; blank explicitly accepts the default. */
export function positiveIntegerOrDefault(value) {
  return value === undefined || value === '' || (Number.isSafeInteger(Number(value)) && Number(value)>0) ? undefined : 'A positive whole number';
}
