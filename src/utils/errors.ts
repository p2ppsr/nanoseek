export class ErrorWithCode extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'ErrorWithCode'

    // Fix the prototype chain to work correctly with instanceof
    Object.setPrototypeOf(this, ErrorWithCode.prototype)
  }
}

export class NanoSeekError extends ErrorWithCode {
  constructor(
    message: string,
    public code: string
  ) {
    super(message, code)
    this.name = 'NanoSeekError'

    Object.setPrototypeOf(this, NanoSeekError.prototype)
  }
}
