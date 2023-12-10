import { IsArray, ValidateNested } from 'class-validator';
import { UpdateGradeDto } from './update-grade.dto';

export class UpdateManyGradeDto {
	@IsArray()
	@ValidateNested({ each: true })
	grade_rows: UpdateGradeDto[];
}
