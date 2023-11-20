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
import { Error } from 'mongoose';

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
			)
			.catch((err) => {
				if (err instanceof Error.ValidationError) {
					throw new BadRequestException(
						"Teacher can't be a student and vice versa",
					);
				}
				throw new BadRequestException(err.message || 'Something went wrong');
			});
	}

	async findAll(
		filter?: object,
		options?: object,
	): Promise<FindAllResponse<Class>> {
		return await this.classes_repo.findAllWithSubFields(filter, {
			...options,
			populate: ['teachers', 'students', 'owner'],
		});
	}

	findOne(id: string) {
		return this.classes_repo.findOneById(id).then((entity: ClassDocument) => {
			if (!entity)
				throw new NotFoundException("Class doesn't exist or deleted");
			return entity.populate(['teachers', 'students', 'owner']);
		});
	}

	update(id: string, updateClassDto: UpdateClassDto) {
		return this.classes_repo.update(id, updateClassDto);
	}

	remove(id: string) {
		return this.classes_repo.softDelete(id);
	}
}
