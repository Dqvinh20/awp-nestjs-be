import { ClassesRepositoryInterface } from '@modules/classes/interfaces/classes.interface';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, PaginateModel, PopulateOptions, Types } from 'mongoose';
import { Class, ClassDocument } from '@modules/classes/entities/class.entity';
import { FindAllResponse } from 'src/types/common.type';
import { BasePaginateRepositoryAbstract } from './base/base_paginate.abstract.repository';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

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

	async addMember(id: string, member_id: string, member_role: USER_ROLE) {
		const updateQuery = {
			[member_role === USER_ROLE.TEACHER ? 'teachers' : 'students']:
				new Types.ObjectId(member_id),
		};
		console.log(updateQuery);

		return await this.class_model.findOneAndUpdate(
			{
				_id: id,
				deleted_at: null,
			},
			{
				$push: updateQuery,
			},
			{
				new: true,
			},
		);
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
