import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateGradeDto {
	@IsOptional()
	@IsMongoId()
	id?: string;

	@IsNotEmpty()
	@IsString()
	student_id!: string;

	@IsOptional()
	@IsString()
	full_name!: string;

	[key: string]: any;
}
