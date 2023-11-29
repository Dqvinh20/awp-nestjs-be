import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import {
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsEnum,
	IsMongoId,
	IsNotEmpty,
} from 'class-validator';

export class RemoveUserFromClassDto {
	@IsNotEmpty()
	@IsMongoId()
	class_id!: string;

	@IsNotEmpty()
	@IsArray()
	@ArrayUnique()
	@ArrayMinSize(1)
	users_id!: string[];

	@IsNotEmpty()
	@IsEnum(USER_ROLE)
	role!: USER_ROLE;
}
