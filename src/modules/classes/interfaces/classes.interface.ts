import { Class } from '../entities/class.entity';
import { FindAllResponse } from 'src/types/common.type';
import { BasePaginateRepositoryInterface } from '@repositories/base/base_paginate.interface.repository';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

export interface ClassesRepositoryInterface
	extends BasePaginateRepositoryInterface<Class> {
	addMember(
		id: string,
		member_id: string,
		member_role: USER_ROLE,
	): Promise<Class>;

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
