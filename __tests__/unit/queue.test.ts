import {
  createInitializedGitRepo,
  createInitializedTempGnuPGHomeDir,
  createNotInitializedGitRepo,
  dummyPayload,
  getLatestCommitHash,
  getSecondToLatestCommitHash,
  gitLogForLatestCommit
} from '../../src/__tests__/helpers'
import {CommitAuthor} from '../../src/commit-author'
import {CommitInfo} from '../../src/commit-info'
import {CommitOptions} from '../../src/commit-options'
import {GitRepo} from '../../src/git-repo'
import {Job} from '../../src/job'
import {Queue} from '../../src/queue'
import {QueueName} from '../../src/queue-name'
import {SigningKeyId} from '../../src/signing-key-id'

import {testConfiguration} from '../../src/__tests__/config'
import {JobId} from '../../src/job-id'

function commitOptionsForTests(): CommitOptions {
  const author = CommitAuthor.fromNameAndEmail(
    'A committer',
    'committer@example.com'
  )
  const signingKeyId = new SigningKeyId('')
  const noGpgSig = true
  return new CommitOptions(author, signingKeyId, noGpgSig)
}

function commitOptionsForTestsUsingSignature(): CommitOptions {
  const author = CommitAuthor.fromNameAndEmail(
    'A committer',
    'committer@example.com'
  )
  const signingKeyId = new SigningKeyId(
    testConfiguration().gpg_signing_key.fingerprint
  )
  const noGpgSig = false
  return new CommitOptions(author, signingKeyId, noGpgSig)
}

async function createTestQueue(
  commitOptions: CommitOptions,
  queueName = 'queue-name'
): Promise<Queue> {
  const gitRepo = await createInitializedGitRepo()

  const queue = await Queue.create(
    new QueueName(queueName),
    gitRepo,
    commitOptions
  )

  return queue
}

async function createTestQueueWithGitRepo(
  commitOptions: CommitOptions,
  gitRepo: GitRepo,
  queueName = 'queue-name'
): Promise<Queue> {
  const queue = await Queue.create(
    new QueueName(queueName),
    gitRepo,
    commitOptions
  )
  return queue
}

describe('Queue', () => {
  it('should have a name', async () => {
    const queue = await createTestQueue(commitOptionsForTests(), 'queue-name')

    expect(queue.getName().equalsTo(new QueueName('queue-name'))).toBe(true)
  })

  it('should be persisted in directory containing a Git repo', async () => {
    const gitRepo = await createInitializedGitRepo()
    const queue = await createTestQueueWithGitRepo(
      commitOptionsForTests(),
      gitRepo
    )

    expect(queue.getGitRepoDirPath()).toBe(gitRepo.getDirPath())
  })

  it('should dispatch a new job', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    const job = await queue.createJob(dummyPayload())

    const commitHash = getLatestCommitHash(queue.getGitRepoDir())
    expect(
      job.equalsTo(new Job(dummyPayload(), commitHash, new JobId(1)))
    ).toBe(true)
  })

  it('should create an additional job without waiting for the previous one to finish', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    const job1 = await queue.createJob(dummyPayload())
    const job2 = await queue.createJob(dummyPayload())

    expect(job1.getJobId().equalsTo(new JobId(1))).toBe(true)
    expect(job2.getJobId().equalsTo(new JobId(2))).toBe(true)
  })

  it('should allow marking a job as started', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    const job = await queue.createJob(dummyPayload())
    await queue.markJobAsStarted(dummyPayload())

    expect(queue.getJob(job.getJobId()).isStarted()).toBe(true)
  })

  it('should fail when trying to start a job without any pending job', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    const fn = async (): Promise<CommitInfo> => {
      return queue.markJobAsStarted(dummyPayload())
    }

    const expectedError = `Can't start job. Previous message from this job is not a new job message. Previous message commit: --no-commit-hash--`

    await expect(fn()).rejects.toThrow(expectedError)
  })

  it('should fail when trying to start the same job twice', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())
    const commitInfo = await queue.markJobAsStarted(dummyPayload())

    const expectedError = `Can't start job. Previous message from this job is not a new job message. Previous message commit: ${commitInfo.hash}`

    const fn = async (): Promise<CommitInfo> => {
      return queue.markJobAsStarted(dummyPayload())
    }

    await expect(fn()).rejects.toThrow(expectedError)
  })

  it('should allow marking a job as finished', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    const job = await queue.createJob(dummyPayload())
    await queue.markJobAsStarted(dummyPayload())
    await queue.markJobAsFinished(dummyPayload())

    expect(queue.getJob(job.getJobId()).isFinished()).toBe(true)
  })

  it('should return the hash of the commit where a job is marked as started', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())
    const startJobCommit = await queue.markJobAsStarted(dummyPayload())

    const latestCommit = getLatestCommitHash(queue.getGitRepoDir())
    expect(startJobCommit.hash.equalsTo(latestCommit)).toBe(true)
  })

  it('should return the hash of the commit where a job is marked as finished', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())
    await queue.markJobAsStarted(dummyPayload())
    const finishJobCommit = await queue.markJobAsFinished(dummyPayload())

    const latestCommit = getLatestCommitHash(queue.getGitRepoDir())
    expect(finishJobCommit.hash.equalsTo(latestCommit)).toBe(true)
  })

  it('should allow marking a job as finished even if more jobs were created after that one', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    const firstJob = await queue.createJob(dummyPayload())
    await queue.createJob(dummyPayload())
    await queue.markJobAsStarted(dummyPayload())
    await queue.markJobAsFinished(dummyPayload())

    expect(queue.getJob(firstJob.getJobId()).isFinished()).toBe(true)
  })

  it('should fail when trying to finish a job without any pending to finish job', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    const fn = async (): Promise<CommitInfo> => {
      return queue.markJobAsFinished(dummyPayload())
    }

    const expectedError = `Can't finish job. Previous message from this job is not a job started message. Previous message commit: --no-commit-hash--`

    await expect(fn()).rejects.toThrow(expectedError)
  })

  it('should fail when trying to finish a job that does not exists', async () => {
    const queue = await createTestQueue(commitOptionsForTests())
    await queue.createJob(dummyPayload())

    const fn = async (): Promise<CommitInfo> => {
      return queue.markJobAsFinished(dummyPayload())
    }

    const expectedError = `Can't finish job. Previous message from this job is not a job started message. Previous message commit: --no-commit-hash--`

    await expect(fn()).rejects.toThrow(expectedError)
  })

  it('should allow to specify the commit author', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())

    const output = gitLogForLatestCommit(queue.getGitRepoDir().getDirPath())

    expect(output.includes('Author: A committer <committer@example.com>')).toBe(
      true
    )
  })

  it('should allow to sign commits', async () => {
    const gitRepo = await createInitializedGitRepo()

    const gnuPGHomeDir = await createInitializedTempGnuPGHomeDir()
    const signingKeyFingerprint =
      testConfiguration().gpg_signing_key.fingerprint
    gitRepo.env('GNUPGHOME', gnuPGHomeDir)

    const queue = await Queue.create(
      new QueueName('queue name'),
      gitRepo,
      commitOptionsForTestsUsingSignature()
    )

    await queue.createJob(dummyPayload())

    const output = gitLogForLatestCommit(gitRepo.getDirPath())

    // nosemgrep
    expect(RegExp(`gpg:.+RSA.+${signingKeyFingerprint}`).test(output)).toBe(
      true
    )
  })

  it('should fail when it is created from an uninitialized git repo', async () => {
    const gitRepo = await createNotInitializedGitRepo()

    const fn = async (): Promise<Queue> => {
      const queue = await Queue.create(
        new QueueName('queue name'),
        gitRepo,
        commitOptionsForTests()
      )
      return queue
    }

    const expectedError = `Git dir: ${gitRepo.getDirPath()} has not been initialized`

    await expect(fn()).rejects.toThrow(expectedError)
  })

  it('should return all the messages in the queue', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())

    const messages = queue.getMessages()

    expect(messages).toContain(queue.getLatestMessage())
  })

  describe('should be empty, when ...', () => {
    it('there are no jobs', async () => {
      const queue = await createTestQueue(commitOptionsForTests())

      expect(queue.isEmpty()).toBe(true)
    })

    it('all jobs are finished', async () => {
      const queue = await createTestQueue(commitOptionsForTests())

      await queue.createJob(dummyPayload())
      await queue.markJobAsStarted(dummyPayload())
      await queue.markJobAsFinished(dummyPayload())

      expect(queue.isEmpty()).toBe(true)
    })
  })

  describe('should return the next job to do, returning ...', () => {
    it('null job when there are no pending jobs', async () => {
      const queue = await createTestQueue(commitOptionsForTests())

      const nextJob = queue.getNextJob()

      expect(nextJob.isNull()).toBe(true)
    })

    it('the job when there is one pending job', async () => {
      const queue = await createTestQueue(commitOptionsForTests())

      await queue.createJob(dummyPayload())

      const nextJob = queue.getNextJob()

      expect(nextJob.isNull()).toBe(false)
      expect(nextJob.getPayload()).toBe(dummyPayload())
    })

    it('the latest job when there is also a previous finished job', async () => {
      const queue = await createTestQueue(commitOptionsForTests())

      // First completed job
      await queue.createJob(dummyPayload())
      await queue.markJobAsStarted(dummyPayload())
      await queue.markJobAsFinished(dummyPayload())

      // Second job
      const secondJob = await queue.createJob(dummyPayload())

      const nextJob = queue.getNextJob()

      const latestCommit = getLatestCommitHash(queue.getGitRepoDir())
      expect(
        nextJob.equalsTo(
          new Job(dummyPayload(), latestCommit, secondJob.getJobId())
        )
      ).toBe(true)
    })

    it('a previous job when more recent jobs have been created', async () => {
      const queue = await createTestQueue(commitOptionsForTests())

      await queue.createJob(dummyPayload())
      const secondJobCreated = await queue.createJob(dummyPayload())
      const secondJobCommit = getLatestCommitHash(queue.getGitRepoDir())
      await queue.createJob(dummyPayload())
      await queue.markJobAsStarted(dummyPayload())
      await queue.markJobAsFinished(dummyPayload())

      const nextJob = queue.getNextJob()
      expect(
        nextJob.equalsTo(
          new Job(dummyPayload(), secondJobCommit, secondJobCreated.getJobId())
        )
      ).toBe(true)
    })
  })

  it('should dispatch a new job without mixing it up with other queues jobs', async () => {
    const queue1 = await createTestQueue(commitOptionsForTests())

    const queue2 = await Queue.create(
      new QueueName('queue name two'),
      queue1.getGitRepo(),
      commitOptionsForTests()
    )

    const payload1 = 'value1'
    const payload2 = 'value2'

    await queue1.createJob(payload1)
    await queue2.createJob(payload2)

    const nextJob1 = queue1.getNextJob()
    const nextJob2 = queue2.getNextJob()

    const newJob1Commit = getSecondToLatestCommitHash(queue1.getGitRepoDir())
    expect(
      nextJob1.equalsTo(new Job(payload1, newJob1Commit, new JobId(1)))
    ).toBe(true)

    let latestCommit = getLatestCommitHash(queue2.getGitRepoDir())
    expect(
      nextJob2.equalsTo(new Job(payload2, latestCommit, new JobId(1)))
    ).toBe(true)

    await queue1.markJobAsStarted(payload1)
    await queue1.markJobAsFinished(payload1)
    await queue1.createJob(payload2)
    const nextJob3 = queue1.getNextJob()
    latestCommit = getLatestCommitHash(queue1.getGitRepoDir())
    expect(
      nextJob3.equalsTo(new Job(payload2, latestCommit, new JobId(2)))
    ).toBe(true)
  })

  it('should find a new job by ID', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())

    const job = queue.getJob(new JobId(1))

    expect(job.getJobId().equalsTo(new JobId(1))).toBe(true)
    expect(job.isNew()).toBe(true)
  })

  it('should find an started job by ID', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())
    await queue.markJobAsStarted(dummyPayload())

    const job = queue.getJob(new JobId(1))

    expect(job.getJobId().equalsTo(new JobId(1))).toBe(true)
    expect(job.isStarted()).toBe(true)
  })

  it('should find a finished job by ID', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())
    await queue.markJobAsStarted(dummyPayload())
    await queue.markJobAsFinished(dummyPayload())

    const job = queue.getJob(new JobId(1))

    expect(job.getJobId().equalsTo(new JobId(1))).toBe(true)
    expect(job.isFinished()).toBe(true)
  })

  it('should return a null job when finding a job by ID if it does not exist', async () => {
    const queue = await createTestQueue(commitOptionsForTests())

    await queue.createJob(dummyPayload())

    const job = queue.getJob(new JobId(100))

    expect(job.isNull()).toBe(true)
  })
})
