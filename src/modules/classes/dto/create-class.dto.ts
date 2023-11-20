import { User } from '@modules/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsMongoId,
	IsNotEmpty,
	IsOptional,
	MaxLength,
	MinLength,
} from 'class-validator';

export class CreateClassDto {
	@IsNotEmpty()
	@MinLength(1)
	@MaxLength(100)
	name!: string;

	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@ArrayMinSize(1)
	@IsMongoId({ each: true })
	teachers?: string[];

	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@ArrayMinSize(1)
	@IsMongoId({ each: true })
	students?: string[];

	@IsOptional()
	@IsMongoId()
	owner!: string;
}
