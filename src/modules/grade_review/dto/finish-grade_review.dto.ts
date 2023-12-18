import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

export class FinishGradeReviewDto {
	@IsNotEmpty()
	@IsNumber()
	@Min(0)
	@Max(10)
	updated_grade: number;
}
