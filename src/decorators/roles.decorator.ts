import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { SetMetadata } from '@nestjs/common';

export const ROLES = 'roles';
export const Roles = (...roles: USER_ROLE[]) => SetMetadata(ROLES, roles);
