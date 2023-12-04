import { Type } from 'class-transformer';
import {
	IsArray,
	IsDefined,
	IsMongoId,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

export class GradeColumnDto {
	@IsOptional()
	@IsMongoId()
	id?: string;

	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	name!: string;

	@IsOptional()
	@Min(0)
	ordinal!: number;

	@IsNotEmpty()
	@Min(0)
	@Max(100)
	scaleValue!: number;
}

export class UpsertGradeColumnsDto {
	@IsArray()
	@IsDefined()
	@IsNotEmpty()
	@ValidateNested({
		each: true,
	})
	@Type(() => GradeColumnDto)
	grade_columns: GradeColumnDto[];
}
