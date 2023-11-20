import { BaseRepositoryInterface } from '@repositories/base/base.interface.repository';
import { Class } from '../entities/class.entity';
import { FindAllResponse } from 'src/types/common.type';

export interface ClassesRepositoryInterface
	extends BaseRepositoryInterface<Class> {
	findAllWithSubFields(
		condition: object,
		options: {
			projection?: string;
			populate?: string[] | any;
			offset?: number;
			limit?: number;
		},
	): Promise<FindAllResponse<Class>>;
}
