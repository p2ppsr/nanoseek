declare module 'pushdrop' {
  export function decode(options: {
    script: string
    fieldFormat: string
  }): unknown
}
