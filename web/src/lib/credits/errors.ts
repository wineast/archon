export class QuotaExceededError extends Error {
  constructor(message = "平台额度已用完，请联系管理员充值。") {
    super(message);
    this.name = "QuotaExceededError";
  }
}
