import { ApiProperty } from '@nestjs/swagger';
import {
	ArrayMinSize,
	IsArray,
	IsEmail,
	IsNotEmpty,
	IsString,
	Length,
} from 'class-validator';

export class InvitationSendDto {
	@ApiProperty({
		description: 'The email of the users to be invited',
	})
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@IsEmail({}, { each: true })
	invited_emails!: string[];

	@ApiProperty({
		description: 'The class code',
	})
	@IsNotEmpty()
	@IsString()
	@Length(7)
	code!: string;
}
