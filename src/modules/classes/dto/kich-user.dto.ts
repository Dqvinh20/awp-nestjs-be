import {
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsMongoId,
	IsNotEmpty,
} from 'class-validator';

export class KickUserDto {
	@IsNotEmpty()
	@IsMongoId()
	class_id: string;

	@IsNotEmpty()
	@IsArray()
	@ArrayUnique()
	@ArrayMinSize(1)
	user_id: string[];
}
