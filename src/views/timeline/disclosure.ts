/** Explicit open/closed overrides keyed by disclosure; missing keys fall back to each disclosure's default. */
export type OpenState = Record<string, boolean>;

export interface Disclosure {
  isOpen: (key: string, fallback: boolean) => boolean;
  toggle: (key: string, fallback: boolean) => void;
}

// Step ids are unique across runs, so keys never collide between a run and its sub-runs.
export const disclosureKey = {
  call: (stepId: string) => `call:${stepId}`,
  result: (stepId: string) => `result:${stepId}`,
  agent: (stepId: string) => `agent:${stepId}`,
  nested: (stepId: string) => `nested:${stepId}`,
};
