import { OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, MaxLength } from 'class-validator';
import { GENDER } from '../entities/user.entity';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
	OmitType(CreateUserDto, ['email', 'password', 'role'] as const),
) {
	@IsOptional()
	@MaxLength(50)
	first_name: string;

	@IsOptional()
	@MaxLength(50)
	last_name: string;

	@IsOptional()
	@IsEnum(GENDER)
	gender?: GENDER;
}
