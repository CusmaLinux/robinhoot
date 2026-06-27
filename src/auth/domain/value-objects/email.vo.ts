const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailVO {
  readonly value: string;

  private constructor(email: string) {
    this.value = email;
  }

  static create(email: string): EmailVO {
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new Error('Invalid email format');
    }
    return new EmailVO(email);
  }
}
