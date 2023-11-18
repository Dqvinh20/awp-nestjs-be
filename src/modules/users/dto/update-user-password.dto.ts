import { IsNotEmpty, IsStrongPassword } from 'class-validator';

export class UpdateUserPasswordDto {
	@IsNotEmpty()
	old_password: string;

	@IsNotEmpty()
	@IsStrongPassword()
	new_password: string;
}
