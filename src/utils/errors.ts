export class NanoSeekError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'NanoSeekError'
  }
}
