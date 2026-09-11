import type { KeyboardEvent } from 'react';

/** Height of the sticky top bar plus the timeline toolbar, with a little breathing room. */
const STICKY_OFFSET = 96;

export const stepElementId = (anchor: string) => `step-${anchor}`;

export function scrollToStep(anchor: string) {
  scrollToElement(stepElementId(anchor));
}

/** Smooth-scrolls the element with this id to just below the sticky bars. */
export function scrollToElement(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET;
  window.scrollTo({ top, behavior: 'smooth' });
}

/** Props that make a non-button element clickable and keyboard-operable. */
export function pressable(onPress: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onPress,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPress();
      }
    },
  } as const;
}
