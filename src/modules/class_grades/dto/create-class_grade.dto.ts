import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateClassGradeDto {
	@IsNotEmpty()
	@IsMongoId()
	class: string;
}
