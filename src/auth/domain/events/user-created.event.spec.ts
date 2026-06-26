import { UserCreatedEvent } from './user-created.event';

describe('UserCreatedEvent', () => {
  it('should create event with userId and email', () => {
    const now = new Date();
    const event = new UserCreatedEvent('user-123', 'test@example.com', now);

    expect(event.userId).toBe('user-123');
    expect(event.email).toBe('test@example.com');
    expect(event.occurredAt).toBe(now);
  });

  it('should default occurredAt to current date if not provided', () => {
    const before = new Date();
    const event = new UserCreatedEvent('user-456', 'other@example.com');
    const after = new Date();

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
