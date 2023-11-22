import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class InvitationSendDto {
	@ApiProperty({
		description: 'The email of the user to invite',
	})
	@IsNotEmpty()
	@IsEmail()
	@IsString()
	invited_email!: string;

	@ApiProperty({
		description: 'The class code',
	})
	@IsNotEmpty()
	@IsString()
	@Length(7)
	code!: string;
}
