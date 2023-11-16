import {
	IsEmail,
	IsNotEmpty,
	IsOptional,
	IsStrongPassword,
	MaxLength,
	MinLength,
} from 'class-validator';
export class SignUpDto {
	@IsOptional()
	@MinLength(2)
	@MaxLength(50)
	first_name: string;

	@IsOptional()
	@MinLength(2)
	@MaxLength(50)
	last_name: string;

	@IsNotEmpty()
	@MaxLength(50)
	@IsEmail()
	email: string;

	@IsNotEmpty()
	@IsStrongPassword()
	password: string;
}
