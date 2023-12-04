import { User } from '@modules/users/entities/user.entity';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
	NOTIFICATION_STATUS,
	NOTIFICATION_TYPE,
} from '../entity/notification.entity';

export class CreateNotificationDto {
	@IsNotEmpty()
	@IsString()
	title: string;

	@IsNotEmpty()
	@IsString()
	description: string;

	@IsOptional()
	@IsString()
	link?: string;

	@IsOptional()
	@IsEnum(NOTIFICATION_TYPE)
	type?: NOTIFICATION_TYPE;

	@IsOptional()
	@IsEnum(NOTIFICATION_STATUS)
	status?: NOTIFICATION_STATUS;

	@IsOptional()
	icon?: string;

	@IsNotEmpty()
	to: string | User;

	@IsNotEmpty()
	created_by: string | User;
}
