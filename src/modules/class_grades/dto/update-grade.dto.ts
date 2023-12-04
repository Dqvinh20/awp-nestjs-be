import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateGrade {
	@IsOptional()
	@IsMongoId()
	_id?: string;

	@IsNotEmpty()
	@IsMongoId()
	user_id!: string;

	@IsNotEmpty()
	@IsString()
	student_id!: string;

	@IsOptional()
	@IsString()
	full_name!: string;

	[key: string]: any;
}
