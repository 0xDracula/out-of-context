import { Submission, SubmissionStatus } from '../../domain/entities/Submission.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import db from '../prisma.js';

export class PrismaSubmissionRepository implements ISubmissionRepository {
  async findById(id: string): Promise<Submission | null> {
    const submission = await db.submission.findUnique({
      where: { id },
    });

    if (!submission) return null;

    return new Submission({
      id: submission.id,
      slackLink: submission.slackLink,
      status: submission.status as SubmissionStatus,
      submitterId: submission.submitterId,
      moderatorNotes: submission.moderatorNotes || undefined,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    });
  }

  async save(submission: Submission): Promise<Submission> {
    const data = submission.toJSON();
    const saved = await db.submission.upsert({
      where: { id: data.id || '' },
      update: {
        status: data.status,
        moderatorNotes: data.moderatorNotes,
      },
      create: {
        slackLink: data.slackLink,
        status: data.status,
        submitterId: data.submitterId,
        moderatorNotes: data.moderatorNotes,
      },
    });

    return new Submission({
      id: saved.id,
      slackLink: saved.slackLink,
      status: saved.status as SubmissionStatus,
      submitterId: saved.submitterId,
      moderatorNotes: saved.moderatorNotes || undefined,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      deletedAt: saved.deletedAt || undefined,
    });
  }

  async findBySubmitterId(submitterId: string): Promise<Submission[]> {
    const submissions = await db.submission.findMany({
      where: { submitterId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map(
      (s) =>
        new Submission({
          id: s.id,
          slackLink: s.slackLink,
          status: s.status as SubmissionStatus,
          submitterId: s.submitterId,
          moderatorNotes: s.moderatorNotes || undefined,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          deletedAt: s.deletedAt || undefined,
        }),
    );
  }

  async getPendingQueue(): Promise<Submission[]> {
    const submissions = await db.submission.findMany({
      where: { status: SubmissionStatus.PENDING, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return submissions.map(
      (s) =>
        new Submission({
          id: s.id,
          slackLink: s.slackLink,
          status: s.status as SubmissionStatus,
          submitterId: s.submitterId,
          moderatorNotes: s.moderatorNotes || undefined,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          deletedAt: s.deletedAt || undefined,
        }),
    );
  }

  async delete(id: string): Promise<void> {
    await db.submission.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
