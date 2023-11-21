import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsStrongPassword,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { CreateAddressDto } from './create-address.dto';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

export class CreateUserDto {
	@IsNotEmpty()
	@MaxLength(50)
	@IsEmail()
	email: string;

	@IsNotEmpty()
	@IsStrongPassword()
	password: string;

	@IsOptional()
	@IsEnum(USER_ROLE)
	role?: string;

	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateAddressDto)
	address?: CreateAddressDto[];
}
