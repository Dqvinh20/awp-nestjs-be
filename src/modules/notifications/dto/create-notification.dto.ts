import { User } from '@modules/users/entities/user.entity';
import {
	IsArray,
	IsMongoId,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';

export class CreateNotificationDto {
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	title!: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	message?: string;

	@IsOptional()
	@IsString()
	ref_url?: string;

	@IsOptional()
	@IsMongoId()
	class?: string;

	@IsOptional()
	@IsArray()
	receivers?: string[] | User[];

	@IsNotEmpty()
	sender: string | User;
}
