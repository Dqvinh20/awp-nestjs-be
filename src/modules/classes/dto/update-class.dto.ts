import { PartialType } from '@nestjs/mapped-types';
import { CreateClassDto } from './create-class.dto';
import { OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateClassDto extends PartialType(
	OmitType(CreateClassDto, ['owner', 'teachers', 'students']),
) {
	@IsOptional()
	@IsBoolean()
	isJoinable?: boolean;
}
