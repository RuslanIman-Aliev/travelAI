/**
 * Metadata key behind the `@Public()` decorator.
 *
 * Two places read and write it - the decorator that sets it and the guard that
 * looks for it - so it lives in neither of them. A key spelled out twice is a
 * key that eventually disagrees with itself, and the failure is silent: the
 * guard simply stops seeing the marker.
 */
export const IS_PUBLIC_KEY = 'isPublic';
