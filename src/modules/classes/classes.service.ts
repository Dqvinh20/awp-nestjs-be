import { InvitationTokenPayload } from './interfaces/invitation-token-payload.interface';
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
import { PaginateModel, PaginateResult, PopulateOptions } from 'mongoose';
import { FindAllPaginateDto } from './dto/find-paginate.dto';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@modules/users/users.service';
import { InvitationSendDto } from './dto/invitation-send.dto';
import { User } from '@modules/users/entities/user.entity';
import * as XLSX from 'xlsx';
import { RemoveUserFromClassDto } from './dto/remove-user-from-class.dto';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClassCreatedEvent } from '@modules/shared/events/ClassCreatedEvent';
import { UpdateGradeDto } from '@modules/class_grades/dto/update-grade.dto';

const transform = (doc, id) => {
	return {
		...doc,
		id: id.toString(),
		full_name: `${doc?.first_name ? doc.first_name + ' ' : ''}${
			doc?.last_name
		}`,
	};
};

export const populate: PopulateOptions[] = [
	{
		path: 'news',
	},
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
		select: 'first_name last_name email avatar student_id',
		transform,
		options: {
			lean: true,
		},
	},
	{
		path: 'owner',
		select: 'first_name last_name email avatar',
		transform,
		options: {
			lean: true,
		},
	},
];

@Injectable()
export class ClassesService extends BaseServiceAbstract<Class> {
	private readonly uid: ShortUniqueId;
	s;
	constructor(
		@Inject('ClassesRepositoryInterface')
		private readonly classes_repo: ClassesRepositoryInterface,
		private readonly usersService: UsersService,
		private readonly mailerService: MailerService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		@InjectModel(Class.name)
		private readonly class_model: PaginateModel<ClassDocument>,
		private readonly event_emitter: EventEmitter2,
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
		const result = await this.classes_repo
			.create({ ...createClassDto, code: this.uid.randomUUID() })
			.then((entity: ClassDocument) =>
				entity.populate(['owner', 'teachers', 'students']),
			);
		await this.event_emitter.emitAsync(
			'class.created',
			new ClassCreatedEvent(result.id),
		);

		return result;
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

	async findOneByCondition(filter: object) {
		return await this.classes_repo
			.findOneByCondition({
				...filter,
				deleted_at: null,
			})
			.then((entity: ClassDocument) => {
				if (!entity)
					throw new NotFoundException("Class doesn't exist or deleted");
				return entity.populate(populate);
			});
	}

	async addMember(id: string, user_id: string, role: USER_ROLE) {
		const result = await this.classes_repo
			.addMember(id, user_id, role)
			.then((entity: ClassDocument) => entity.populate(populate));

		if (role === USER_ROLE.STUDENT) {
			const newStudent = await this.usersService.findOne(user_id);
			await this.event_emitter.emit('class.students.joined', {
				class_id: id,
				student_id: newStudent.student_id,
				full_name: newStudent.full_name,
			} as UpdateGradeDto);
		}

		return result;
	}

	update(id: string, updateClassDto: UpdateClassDto) {
		return this.classes_repo.update(id, updateClassDto);
	}

	remove(id: string) {
		return this.classes_repo.softDelete(id);
	}

	private verifyInvitationToken(token: string): InvitationTokenPayload {
		try {
			return this.jwtService.verify(token, {
				secret: this.configService.get<string>('JWT_INVITATION_TOKEN_SECRET'),
			});
		} catch (error) {
			if (error?.name === 'TokenExpiredError') {
				throw new BadRequestException(
					'Invitation token expired. Please send again',
				);
			}
			throw new BadRequestException('Bad invitation token');
		}
	}

	private async createInvitationLink(class_code: string, invited_user: User) {
		const { id, role } = invited_user;
		const payload: InvitationTokenPayload = {
			invited_user_id: id,
			join_as: role as unknown as USER_ROLE.TEACHER | USER_ROLE.STUDENT,
			class_code,
		};
		const token = this.jwtService.sign(payload, {
			secret: this.configService.get<string>('JWT_INVITATION_TOKEN_SECRET'),
			expiresIn: this.configService.get<string>(
				'JWT_INVITATION_TOKEN_EXPIRATION_TIME',
			),
		});

		return `${this.configService.get<string>(
			'BASE_FE_URL',
		)}/classes/join?t=${token}`;
	}

	checkBeforeJoin(classDetail: Class, authUser: User) {
		if (!classDetail) throw new BadRequestException('Class not found');

		if (!classDetail.isJoinable)
			throw new BadRequestException('Class is closed for joining');

		const isAlreadyTeacher = classDetail.teachers
			.map((teacher) => teacher.email)
			.includes(authUser.email);
		const isAlreadyStudent = classDetail.students
			.map((student) => student.email)
			.includes(authUser.email);
		if (isAlreadyTeacher || isAlreadyStudent)
			throw new BadRequestException({
				message: 'User already in class',
				class_id: classDetail.id,
			});
	}

	async joinByCode(classCode: string, authUser: User) {
		if (classCode.length !== 7)
			throw new BadRequestException('Invalid code length');

		const classDetail: Class = await this.findOneByCondition({
			code: classCode,
		});

		if (classDetail.owner.id === authUser.id) {
			throw new BadRequestException('Owner can not join class');
		}

		this.checkBeforeJoin(classDetail, authUser);

		// Add member to class
		return await this.addMember(
			classDetail.id,
			authUser.id,
			authUser.role as unknown as USER_ROLE,
		).catch((err) => {
			throw new BadRequestException(err.message || 'Something went wrong');
		});
	}

	async joinByToken(token: string, authUser: User) {
		const { class_code, invited_user_id } = this.verifyInvitationToken(token);

		if (authUser.id !== invited_user_id) {
			throw new BadRequestException('This user is not invited');
		}

		const classDetail: Class = await this.findOneByCondition({
			code: class_code,
		});

		if (classDetail.owner.id === authUser.id) {
			throw new BadRequestException('Owner can not join class');
		}

		this.checkBeforeJoin(classDetail, authUser);

		return await this.addMember(
			classDetail.id,
			authUser.id,
			authUser.role as unknown as USER_ROLE,
		).catch((err) => {
			throw new BadRequestException(err.message || 'Something went wrong');
		});
	}

	async removeMember(removeUserFromClassDto: RemoveUserFromClassDto) {
		const { class_id: id, users_id, role } = removeUserFromClassDto;

		try {
			await this.class_model.updateOne(
				{ _id: id },
				{
					$pull: {
						[role === USER_ROLE.STUDENT ? 'students' : 'teachers']: {
							$in: users_id,
						},
					},
				},
				{
					new: true,
					includeResultMetadata: true,
				},
			);
			await this.event_emitter.emitAsync('class.students.left', users_id, id);
			return true;
		} catch (error) {
			return false;
		}
	}

	async sendInvitationLink(
		requestUser: User,
		invitationSendDto: InvitationSendDto,
	) {
		const { code, invited_emails } = invitationSendDto;

		const classDetail = await this.findOneByCondition({
			code,
		});
		const { owner, teachers, students, isJoinable } = classDetail;
		if (isJoinable === false) {
			throw new BadRequestException('Class is closed for joining');
		}

		const normailizedEmails = invited_emails.filter(
			(email) => owner.email !== email,
		);

		// Mail has joined class
		const alreadyInClass = [...teachers, ...students]
			.map((user) => user.email)
			.filter((email) => normailizedEmails.includes(email));

		const foundUsers = await this.usersService
			.findAll({
				email: {
					$nin: [...alreadyInClass],
					$in: [...normailizedEmails],
				},
			})
			.catch((err) => {
				throw new BadRequestException(err.message || 'Something went wrong');
			});

		const { items, count } = foundUsers;

		// Email is not exist in database
		const notFoundEmails = items
			.map((user) => user.email)
			.filter((email) => {
				return !normailizedEmails.includes(email);
			});

		const sendEmails = async () => {
			const results = await Promise.allSettled(
				items.map(async (user) => {
					const url = await this.createInvitationLink(code, user);
					this.mailerService.sendMail({
						to: invitationSendDto.invited_emails,
						template: 'enroll_invitation',
						subject: 'Invitation to join class',
						context: {
							class: {
								name: classDetail.name,
							},
							author: {
								avatar: requestUser.avatar,
								name: requestUser.full_name,
								email: requestUser.email,
							},
							enrollUrl: url,
						},
					});
				}),
			);

			const success = results.filter((result) => result.status === 'fulfilled');
			const failed = results.filter((result) => result.status === 'rejected');

			return {
				success: success.length,
				failed: failed.length,
			};
		};
		return await sendEmails();
	}

	async createWorkbookStudentList(data: any, file_type: XLSX.BookType) {
		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.json_to_sheet(
			[{ student_id: 'Student ID', full_name: 'Full name' }, ...data],
			{
				header: ['student_id', 'full_name'],
				skipHeader: true,
			},
		);
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Student List');
		return XLSX.write(workbook, { type: 'buffer', bookType: file_type });
	}
}
