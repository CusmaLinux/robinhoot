import { performance } from 'node:perf_hooks';
import type { QuestionRuntimePort } from '../../../application/ports/out/question-runtime.port';

export class SystemQuestionRuntime implements QuestionRuntimePort {
  now(): number {
    return performance.now();
  }
  wallNow(): number {
    return Date.now();
  }
  schedule(at: number, callback: () => void): () => void {
    const timer = setTimeout(callback, Math.max(0, at - this.now()));
    timer.unref();
    return () => clearTimeout(timer);
  }
}
