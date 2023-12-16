import {
	IsMongoId,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

export class CreateCommentDto {
	@IsNotEmpty()
	@IsString()
	@MaxLength(500)
	comment: string;

	sender: string;
}

export class CreateGradeReviewDto {
	@IsNotEmpty()
	@IsMongoId()
	class: string;

	@IsNotEmpty()
	@IsMongoId()
	column: string;

	@IsNotEmpty()
	@IsString()
	@MaxLength(500)
	review_reason: string;

	@IsNotEmpty()
	@IsNumber()
	@Max(10)
	@Min(0)
	expected_grade: number;

	request_student: string;

	request_student_id: string;

	@IsOptional()
	comments: CreateCommentDto[];
}
