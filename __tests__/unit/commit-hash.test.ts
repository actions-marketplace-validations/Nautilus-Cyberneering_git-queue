import {CommitHash, nullCommitHash} from '../../src/commit-hash'
import {ShortCommitHash} from '../../src/short-commit-hash'

describe('CommitHash', () => {
  it('should contain the hash of a git commit', () => {
    const commitHash = new CommitHash(
      'ad5cea6308f69d7955d8de5f0da19f675d5ba75f'
    )

    expect(commitHash.getHash()).toBe(
      'ad5cea6308f69d7955d8de5f0da19f675d5ba75f'
    )
  })

  it('should fail when using invalid hash value', () => {
    const longHash = (): CommitHash => {
      return new CommitHash('ad5cea6308f69d7955d8de5f0da19f675d5ba75faaaaaa')
    }
    const shortHash = (): CommitHash => {
      return new CommitHash('ad5cea6')
    }
    const nonSHA1Hash = (): CommitHash => {
      return new CommitHash('ad5cea63-8f69d-955d8-e5f0da-9f675d5ba75f')
    }

    expect(longHash).toThrowError()
    expect(shortHash).toThrowError()
    expect(nonSHA1Hash).toThrowError()
  })

  it('should compare two commit hashes', () => {
    const commitHash1 = new CommitHash(
      'ad5cea6308f69d7955d8de5f0da19f675d5ba75f'
    )

    const commitHash2 = new CommitHash(
      '636144d261b355316754397a7956813a6b0e80ad'
    )

    expect(commitHash1.equalsTo(commitHash1)).toBe(true)
    expect(commitHash1.equalsTo(commitHash2)).toBe(false)
  })

  it('should be nullable', () => {
    const commitHash = nullCommitHash()

    expect(commitHash.isNull()).toBe(true)
  })

  it('could be converted to string', () => {
    const nullObject = nullCommitHash()
    expect(nullObject.toString()).toBe('--no-commit-hash--')

    const commit = new CommitHash('ad5cea6308f69d7955d8de5f0da19f675d5ba75f')
    expect(commit.toString()).toBe('ad5cea6308f69d7955d8de5f0da19f675d5ba75f')
    expect(commit.getHash()).toBe('ad5cea6308f69d7955d8de5f0da19f675d5ba75f')
  })

  it('could be converted to a short hash', () => {
    const commit = new CommitHash('ad5cea6308f69d7955d8de5f0da19f675d5ba75f')

    expect(commit.getShortHash().equalsTo(new ShortCommitHash('ad5cea6'))).toBe(
      true
    )
  })
})
