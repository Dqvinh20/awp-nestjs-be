import { ClassesRepositoryInterface } from '@modules/classes/interfaces/classes.interface';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
	FilterQuery,
	PaginateModel,
	PaginateOptions,
	PaginateResult,
	PopulateOptions,
} from 'mongoose';
import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { Class, ClassDocument } from '@modules/classes/entities/class.entity';
import { FindAllResponse } from 'src/types/common.type';
import { BasePaginateRepositoryAbstract } from './base/base_paginate.abstract.repository';

@Injectable()
export class ClassesRepository
	extends BasePaginateRepositoryAbstract<ClassDocument>
	implements ClassesRepositoryInterface
{
	constructor(
		@InjectModel(Class.name)
		private readonly class_model: PaginateModel<ClassDocument>,
	) {
		super(class_model);
	}

	async findAllWithSubFields(
		condition: FilterQuery<ClassDocument>,
		options: {
			projection?: string;
			populate?: string[] | PopulateOptions | PopulateOptions[];
			offset?: number;
			limit?: number;
		},
	): Promise<FindAllResponse<ClassDocument>> {
		const [count, items] = await Promise.all([
			this.class_model.count({ ...condition, deleted_at: null }),
			this.class_model
				.find({ ...condition, deleted_at: null }, options?.projection || '', {
					skip: options.offset || 0,
					limit: options.limit || 10,
				})
				.populate(options.populate),
		]);
		return {
			count,
			items,
		};
	}
}
