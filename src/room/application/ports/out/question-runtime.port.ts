export const QUESTION_RUNTIME_PORT = Symbol('QUESTION_RUNTIME_PORT');
export interface QuestionRuntimePort {
  /** Monotonic milliseconds, used for authoritative elapsed-time decisions. */
  now(): number;
  /** Unix epoch milliseconds, used only for public countdown timestamps. */
  wallNow(): number;
  /** Schedule at an absolute monotonic millisecond instant. */
  schedule(at: number, callback: () => void): () => void;
}
