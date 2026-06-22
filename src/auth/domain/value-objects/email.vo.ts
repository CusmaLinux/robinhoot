export class EmailVO {
  readonly value: string;

  private constructor(email: string) {
    this.value = email;
  }

  static create(email: string): EmailVO {
    return new EmailVO(email);
  }
}
