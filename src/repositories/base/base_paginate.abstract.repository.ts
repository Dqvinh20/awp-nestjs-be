import { BaseEntity } from '@modules/shared/base/base.entity';
import {
	FilterQuery,
	PaginateModel,
	PaginateOptions,
	PaginateResult,
	QueryOptions,
} from 'mongoose';
import { BasePaginateRepositoryInterface } from './base_paginate.interface.repository';
import { FindAllResponse } from 'src/types/common.type';

export abstract class BasePaginateRepositoryAbstract<T extends BaseEntity>
	implements BasePaginateRepositoryInterface<T>
{
	protected constructor(private readonly model: PaginateModel<T>) {
		this.model = model;
	}

	findWithPaginate(
		query?: FilterQuery<T>,
		options?: PaginateOptions,
		callback?: (err: any, result: PaginateResult<T>) => void,
	): Promise<PaginateResult<T>> {
		return this.model.paginate(
			{ ...query, deleted_at: null },
			{ ...options, lean: true },
			callback,
		);
	}

	async create(dto: T | any): Promise<T> {
		const created_data = await this.model.create(dto);
		return created_data.save();
	}

	async findOneById(
		id: string,
		projection?: string,
		options?: QueryOptions<T>,
	): Promise<T> {
		const item = await this.model.findById(id, projection, options);
		return item?.deleted_at ? null : item;
	}

	async findOneByCondition(condition = {}): Promise<T> {
		return await this.model
			.findOne({
				...condition,
				deleted_at: null,
			})
			.exec();
	}

	async findAll(
		condition: FilterQuery<T>,
		options?: QueryOptions<T>,
	): Promise<FindAllResponse<T>> {
		const [count, items] = await Promise.all([
			this.model.count({ ...condition, deleted_at: null }),
			this.model.find(
				{ ...condition, deleted_at: null },
				options?.projection,
				options,
			),
		]);
		return {
			count,
			items,
		};
	}

	async update(id: string, dto: Partial<T>): Promise<T> {
		return await this.model.findOneAndUpdate(
			{ _id: id, deleted_at: null },
			dto,
			{ new: true },
		);
	}

	async softDelete(id: string): Promise<boolean> {
		const delete_item = await this.model.findById(id);
		if (!delete_item) {
			return false;
		}

		return !!(await this.model
			.findByIdAndUpdate<T>(id, { deleted_at: new Date() })
			.exec());
	}

	async permanentlyDelete(id: string): Promise<boolean> {
		const delete_item = await this.model.findById(id);
		if (!delete_item) {
			return false;
		}
		return !!(await this.model.findOneAndDelete({ _id: id }));
	}
}
