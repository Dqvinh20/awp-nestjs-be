import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { BaseServiceAbstract } from 'src/services/base/base.abstract.service';
import { ClassesRepositoryInterface } from './interfaces/classes.interface';
import { Class, ClassDocument } from './entities/class.entity';
import { FindAllResponse } from 'src/types/common.type';
import ShortUniqueId from 'short-unique-id';
import { PaginateResult, PopulateOptions } from 'mongoose';
import { FindAllPaginateDto } from './dto/find-paginate.dto';

const transform = (doc, id) => {
	return {
		...doc,
		id: id.toString(),
		full_name:
			doc.first_name && doc.last_name
				? `${doc.first_name} ${doc.last_name}`
				: '',
	};
};

export const populate: PopulateOptions[] = [
	{
		path: 'teachers',
		select: ' first_name last_name email avatar',
		transform,
		options: {
			lean: true,
		},
	},
	{
		path: 'students',
		select: ' first_name last_name email avatar',
		transform,
		options: {
			lean: true,
		},
	},
	{
		path: 'owner',
		select: ' first_name last_name email avatar',
		transform,
		options: {
			lean: true,
		},
	},
];

@Injectable()
export class ClassesService extends BaseServiceAbstract<Class> {
	private readonly uid: ShortUniqueId;

	constructor(
		@Inject('ClassesRepositoryInterface')
		private readonly classes_repo: ClassesRepositoryInterface,
	) {
		super(classes_repo);
		this.uid = new ShortUniqueId({ length: 7 });
	}

	async findWithPaginate(
		body: FindAllPaginateDto,
	): Promise<PaginateResult<Class>> {
		return await this.classes_repo.findWithPaginate(body.query, {
			populate,
			...body,
		});
	}

	async create(createClassDto: CreateClassDto) {
		if (
			createClassDto.teachers.includes(createClassDto.owner) ||
			createClassDto.students.includes(createClassDto.owner)
		) {
			throw new BadRequestException(
				"Owner can't be a teacher or student and vice versa",
			);
		}

		return await this.classes_repo
			.create({ ...createClassDto, code: this.uid.randomUUID() })
			.then((entity: ClassDocument) =>
				entity.populate(['owner', 'teachers', 'students']),
			);
	}

	async findAll(
		filter?: object,
		options?: object,
	): Promise<FindAllResponse<Class>> {
		return await this.classes_repo.findAllWithSubFields(filter, {
			...options,
			populate,
		});
	}

	findOne(id: string) {
		return this.classes_repo.findOneById(id).then((entity: ClassDocument) => {
			if (!entity)
				throw new NotFoundException("Class doesn't exist or deleted");
			return entity.populate(populate);
		});
	}

	update(id: string, updateClassDto: UpdateClassDto) {
		return this.classes_repo.update(id, updateClassDto);
	}

	remove(id: string) {
		return this.classes_repo.softDelete(id);
	}
}
