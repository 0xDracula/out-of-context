import type { Config } from '../../config/index.js';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum OptInStatus {
  DEFAULT = 'DEFAULT',
  OPTED_IN = 'OPTED_IN',
  OPTED_OUT = 'OPTED_OUT',
}

export interface UserProps {
  slackId: string;
  role: UserRole;
  isTrusted: boolean;
  isBanned: boolean;
  optInStatus: OptInStatus;
  cocAccepted: boolean;
  approvedCount: number;
  rejectedCount: number;
  explicitRejectionCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = { ...props };
  }

  get slackId(): string {
    return this.props.slackId;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get isTrusted(): boolean {
    return this.props.isTrusted || this.isAdmin();
  }
  get isBanned(): boolean {
    return this.props.isBanned;
  }
  get optInStatus(): OptInStatus {
    return this.props.optInStatus;
  }
  get isOptedIn(): boolean {
    return this.props.optInStatus === OptInStatus.OPTED_IN;
  }
  get cocAccepted(): boolean {
    return this.props.cocAccepted;
  }
  get approvedCount(): number {
    return this.props.approvedCount;
  }
  get rejectedCount(): number {
    return this.props.rejectedCount;
  }
  get explicitRejectionCount(): number {
    return this.props.explicitRejectionCount;
  }

  isAdmin(): boolean {
    return this.props.role === UserRole.ADMIN || this.props.role === UserRole.SUPER_ADMIN;
  }

  isSuperAdmin(): boolean {
    return this.props.role === UserRole.SUPER_ADMIN;
  }

  changeRole(newRole: UserRole): void {
    this.props.role = newRole;
    this.props.updatedAt = new Date();
  }

  isEligibleForTrust(config: Config): boolean {
    if (this.props.isTrusted) return true;
    if (this.props.isBanned) return false;

    const meetsApprovalThreshold = this.props.approvedCount >= config.moderation.approvedPostsForTrust;
    const meetsExplicitThreshold = this.props.explicitRejectionCount <= config.moderation.maxExplicitRejectionsForTrust;

    return meetsApprovalThreshold && meetsExplicitThreshold;
  }

  shouldBeBanned(config: Config): boolean {
    if (this.props.isBanned) return true;
    return this.props.explicitRejectionCount >= config.moderation.explicitRejectionsBeforeBan;
  }

  toJSON() {
    return { ...this.props };
  }
}
