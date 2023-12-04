import { OmitType, PartialType } from '@nestjs/swagger';
import { FindAllPaginateDto } from '@modules/classes/dto/find-paginate.dto';
import { PopulateOptions } from 'mongoose';

export class FindNotificationsDto extends PartialType(
	OmitType(FindAllPaginateDto, ['populate']),
) {
	populate?:
		| PopulateOptions[]
		| string[]
		| PopulateOptions
		| string
		| PopulateOptions
		| undefined;
}
