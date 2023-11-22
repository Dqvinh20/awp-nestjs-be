import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

export interface InvitationTokenPayload {
	invited_user_id: string;
	join_as: USER_ROLE.TEACHER | USER_ROLE.STUDENT;
	class_code: string;
}
