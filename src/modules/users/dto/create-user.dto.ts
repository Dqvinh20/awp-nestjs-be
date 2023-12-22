import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsStrongPassword,
	MaxLength,
} from 'class-validator';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

export class CreateUserDto {
	@IsNotEmpty()
	@MaxLength(50)
	@IsEmail()
	email: string;

	@IsOptional()
	@IsStrongPassword()
	password?: string;

	@IsOptional()
	@IsEnum(USER_ROLE)
	role?: string;

	@IsOptional()
	@MaxLength(50)
	@IsString()
	first_name?: string;

	@IsOptional()
	@MaxLength(50)
	@IsString()
	last_name?: string;

	@IsOptional()
	@IsString()
	student_id?: string;
}
