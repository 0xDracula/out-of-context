import { OptInStatus, User, UserRole } from '../../domain/entities/User.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';

export interface ToggleOptOutResponse {
  optInStatus: OptInStatus;
  message: string;
}

export class ToggleOptOut {
  constructor(private userRepository: IUserRepository) {}

  async execute(slackId: string): Promise<ToggleOptOutResponse> {
    let user = await this.userRepository.findBySlackId(slackId);

    if (!user) {
      user = new User({
        slackId,
        role: UserRole.USER,
        isTrusted: false,
        isBanned: false,
        optInStatus: OptInStatus.DEFAULT,
        cocAccepted: false,
        approvedCount: 0,
        rejectedCount: 0,
        explicitRejectionCount: 0,
      });
    }

    const newStatus = user.optInStatus === OptInStatus.OPTED_IN ? OptInStatus.OPTED_OUT : OptInStatus.OPTED_IN;

    const updated = new User({ ...user.toJSON(), optInStatus: newStatus });
    await this.userRepository.save(updated);

    return {
      optInStatus: newStatus,
      message:
        newStatus === OptInStatus.OPTED_IN
          ? "You've opted in to #out-of-context. Your messages can now be submitted to the channel, and you can submit others' messages too. Use `/b-opt-out` to opt out at any time."
          : "You've opted out of #out-of-context. Your messages can no longer be submitted to the channel. Use `/b-opt-out` to opt back in at any time.",
    };
  }
}
