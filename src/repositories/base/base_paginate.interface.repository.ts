import { BaseRepositoryInterface } from './base.interface.repository';
import { FilterQuery, PaginateOptions, PaginateResult } from 'mongoose';

export interface BasePaginateRepositoryInterface<T>
	extends BaseRepositoryInterface<T> {
	findWithPaginate(
		query?: FilterQuery<T>,
		options?: PaginateOptions,
		callback?: (err: any, result: PaginateResult<T>) => void,
	): Promise<PaginateResult<T>>;
}
