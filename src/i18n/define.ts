/**
 * Declare a namespace's Bangla and English text together. The English object must have
 * exactly the same keys and function signatures as the Bangla one (a type error otherwise),
 * so no screen can ship with a missing translation.
 */
export function defineMessages<T>(messages: { bn: T; en: NoInfer<T> }): { bn: T; en: T } {
  return messages;
}
