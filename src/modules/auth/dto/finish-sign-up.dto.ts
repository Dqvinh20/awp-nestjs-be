import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FinishSignUpDto {
	@IsNotEmpty()
	@IsEnum(USER_ROLE)
	role: string;

	@IsOptional()
	@IsString()
	student_id?: string;
}
