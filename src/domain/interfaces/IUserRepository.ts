import type { User } from '../entities/User.js';

export interface IUserRepository {
  findBySlackId(slackId: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updateStats(slackId: string, stats: { approved?: number; rejected?: number; explicit?: number }): Promise<void>;
}
