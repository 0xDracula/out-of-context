import type { Submission } from '../entities/Submission.js';

export interface ISubmissionRepository {
  findById(id: string): Promise<Submission | null>;
  save(submission: Submission): Promise<Submission>;
  findBySubmitterId(submitterId: string): Promise<Submission[]>;
  findByPostedMessage(channelId: string, messageTs: string): Promise<Submission | null>;
  getPendingQueue(): Promise<Submission[]>;
  delete(id: string): Promise<void>;
  assignNextNumber(id: string): Promise<number>;
  markPosted(id: string, channelId: string, messageTs: string): Promise<void>;
}
