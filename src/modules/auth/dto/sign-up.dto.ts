import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import {
	IsEmail,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsStrongPassword,
	MaxLength,
	MinLength,
} from 'class-validator';

export type SignUpRole = Exclude<USER_ROLE, USER_ROLE.ADMIN>;

export class SignUpDto {
	@IsOptional()
	@MinLength(2)
	@MaxLength(50)
	first_name?: string;

	@IsOptional()
	@MinLength(2)
	@MaxLength(50)
	last_name?: string;

	@IsOptional()
	@IsString()
	student_id?: string;

	// @IsNotEmpty()
	// @IsIn([USER_ROLE.STUDENT, USER_ROLE.TEACHER])
	// role!: SignUpRole;

	@IsNotEmpty()
	@MaxLength(50)
	@IsEmail()
	email!: string;

	@IsNotEmpty()
	@IsStrongPassword()
	password!: string;
}
