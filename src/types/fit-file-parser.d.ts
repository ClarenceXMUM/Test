declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean
    speedUnit?: string
    lengthUnit?: string
    temperatureUnit?: string
    elapsedRecordField?: boolean
    mode?: string
  }
  type ParseCallback = (err: Error | null, data: Record<string, unknown>) => void
  class FitParser {
    constructor(options?: FitParserOptions)
    parse(buffer: ArrayBuffer | Buffer, callback: ParseCallback): void
  }
  export default FitParser
}
