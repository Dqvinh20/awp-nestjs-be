import { IsNotEmpty, IsStrongPassword } from 'class-validator';

export class ResetUserPasswordDto {
	@IsNotEmpty()
	@IsStrongPassword()
	new_password: string;
}
