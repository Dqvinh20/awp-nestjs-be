import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsPositive, Max } from 'class-validator';
import { PopulateOptions } from 'mongoose';
import { ToBoolean } from 'src/decorators/parse.decorator';
import { PaginateParams } from 'src/types/common.type';

export class FindAllPaginateDto implements PaginateParams {
	@IsOptional()
	query?: object;

	@ApiProperty({
		required: false,
		description: 'Select fields. - is exclude fields, + is include fields',
	})
	@IsOptional()
	select?: string;

	@ApiProperty({
		required: false,
		description: 'Current page',
		minimum: 1,
		default: 1,
	})
	@IsOptional()
	@IsPositive()
	@Type(() => Number)
	page: number;

	@ApiProperty({
		required: false,
		description: 'Page size',
		default: 10,
		examples: {
			10: {
				value: 10,
				description: `Get 10 entities`,
			},
			50: {
				value: 50,
				description: `Get 50 entities`,
			},
		},
	})
	@IsOptional()
	@IsPositive()
	@Max(50)
	@Type(() => Number)
	limit: number;

	@IsOptional()
	populate?: string | PopulateOptions | PopulateOptions[] | string[];

	@ApiProperty({
		required: false,
		description: 'Toggle pagination',
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	@ToBoolean()
	pagination?: boolean;

	@ApiProperty({
		required: false,
		description: 'Sort by fields. - is descending, + is ascending',
		default: '-updated_at',
	})
	@IsOptional()
	sort?: string;
}
