export class DtoDecodeError extends Error {
  public readonly source: string

  public readonly issues: string[]

  public constructor(source: string, issues: string[]) {
    super(`DTO decode failed for ${source}`)
    this.name = 'DtoDecodeError'
    this.source = source
    this.issues = issues
  }
}
