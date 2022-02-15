import {CommitHash} from '../../src/commit-hash'
import {CommitSubjectParser} from '../../src/commit-subject-parser'
import {QueueName} from '../../src/queue-name'

function dummyCommitSubjectText(): string {
  return '📝🈺: queue-name: job.ref.f1a69d48a01cc130a64aeac5eaf762e4ba685de7'
}

function dummyCommitSubjectText2(): string {
  return '📝🈺: queue-name: job.ref.69062fe1104d187277aaec72ea56e8d993daca33'
}

describe('CommitSubject', () => {
  it('should contain a text', () => {
    const commitSubject = CommitSubjectParser.parseText(
      dummyCommitSubjectText()
    )

    expect(commitSubject.toString()).toBe(dummyCommitSubjectText())
  })

  it('should know if a given commit subject belongs to a queue', () => {
    const commit = CommitSubjectParser.parseText(dummyCommitSubjectText())
    expect(commit.belongsToQueue(new QueueName('queue-name'))).toBe(true)
    expect(commit.belongsToQueue(new QueueName('queue-name-2'))).toBe(false)

    const commit2 = CommitSubjectParser.parseText(
      '📝🈺: Library Update [library-aaa]: job.ref.f1a69d48a01cc130a64aeac5eaf762e4ba685de7'
    )
    expect(
      commit2.belongsToQueue(new QueueName('Library Update [library-aaa]'))
    ).toBe(true)

    const commit3 = CommitSubjectParser.parseText(
      'standard commit: - this is not a queue commit - missing prefix'
    )
    expect(commit3.belongsToQueue(new QueueName('standard commit'))).toBe(false)
  })

  it('should compare two subjects', () => {
    const subject1 = CommitSubjectParser.parseText(dummyCommitSubjectText())
    const subject2 = CommitSubjectParser.parseText(dummyCommitSubjectText())
    expect(subject1.equalsTo(subject2)).toBe(true)

    const subject3 = CommitSubjectParser.parseText(dummyCommitSubjectText())
    const subject4 = CommitSubjectParser.parseText(dummyCommitSubjectText2())
    expect(subject3.equalsTo(subject4)).toBe(false)
  })

  it('should cast to string', () => {
    const subject = CommitSubjectParser.parseText(dummyCommitSubjectText())
    expect(subject.toString()).toBe(dummyCommitSubjectText())
  })

  it('should allow to include a message key', () => {
    const subject = CommitSubjectParser.parseText(dummyCommitSubjectText())
    expect(subject.getMessageKey().toString()).toBe('🈺')
  })

  it('should allow to include a reference to another job by using the commit hash', () => {
    const subject = CommitSubjectParser.parseText(dummyCommitSubjectText())
    expect(
      subject
        .getJobRef()
        .equalsTo(new CommitHash('f1a69d48a01cc130a64aeac5eaf762e4ba685de7'))
    ).toBe(true)
  })

  it('should allow to include the queue name', () => {
    const subject = CommitSubjectParser.parseText(dummyCommitSubjectText())
    expect(subject.getQueueName().equalsTo(new QueueName('queue-name'))).toBe(
      true
    )
  })
})