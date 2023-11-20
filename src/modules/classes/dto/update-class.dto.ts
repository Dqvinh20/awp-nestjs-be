import { PartialType } from '@nestjs/mapped-types';
import { CreateClassDto } from './create-class.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateClassDto extends PartialType(
	OmitType(CreateClassDto, ['owner', 'teachers', 'students']),
) {}
