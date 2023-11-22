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
import { PaginateResult, PopulateOptions } from 'mongoose';
import { FindAllPaginateDto } from './dto/find-paginate.dto';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@modules/users/users.service';
import { InvitationSendDto } from './dto/invitation-send.dto';
import { User } from '@modules/users/entities/user.entity';
import * as XLSX from 'xlsx';

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
		select: 'student_id first_name last_name email avatar',
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
	s;
	constructor(
		@Inject('ClassesRepositoryInterface')
		private readonly classes_repo: ClassesRepositoryInterface,
		private readonly usersService: UsersService,
		private readonly mailerService: MailerService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
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
		return this.classes_repo
			.addMember(id, user_id, role)
			.then((entity: ClassDocument) => entity.populate(populate));
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
			throw new BadRequestException('Bad invitation token token');
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
			throw new BadRequestException('User already in class');
	}

	async joinByCode(classCode: string, authUser: User) {
		if (classCode.length !== 7)
			throw new BadRequestException('Invalid code length');

		const classDetail: Class = await this.findOneByCondition({
			classCode,
			owner: { $ne: authUser.id },
		});

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
			owner: { $ne: authUser.id },
		});

		this.checkBeforeJoin(classDetail, authUser);

		return await this.addMember(
			classDetail.id,
			authUser.id,
			authUser.role as unknown as USER_ROLE,
		).catch((err) => {
			throw new BadRequestException(err.message || 'Something went wrong');
		});
	}

	async sendInvitationLink(
		requestUser: User,
		invitationSendDto: InvitationSendDto,
	) {
		const { code, invited_email: email } = invitationSendDto;
		const invitedUser = await this.usersService
			.findOneByCondition({ email })
			.then((entity) => {
				if (!entity) throw new BadRequestException('User not found');
				return entity;
			})
			.catch((err) => {
				throw new BadRequestException(err.message || 'Something went wrong');
			});

		const classDetail = await this.findOneByCondition({
			code,
		}).then((entity) => {
			const { teachers, students, owner } = entity;

			// Check if user is teacher or owner in the class
			const onlyTeacherCanInvite =
				teachers.map((teacher) => teacher.id).includes(requestUser.id) ||
				owner.id === requestUser.id;
			if (!onlyTeacherCanInvite)
				throw new BadRequestException('Only teacher in the class can invite');

			// Check if user is already in the class
			const isAlreadyTeacher = teachers
				.map((teacher) => teacher.email)
				.includes(email);
			const isAlreadyStudent = students
				.map((student) => student.email)
				.includes(email);
			if (isAlreadyTeacher || isAlreadyStudent)
				throw new BadRequestException('User already in class');

			// Check if inviting user is owner
			const isOwner = owner.email === email;
			if (isOwner) throw new BadRequestException('Owner can not join class');

			// Check if class is closed for joining
			if (!entity.isJoinable)
				throw new BadRequestException('Class is closed for joining');

			return entity;
		});

		const url = await this.createInvitationLink(code, invitedUser);
		return this.mailerService.sendMail({
			to: invitationSendDto.invited_email,
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
