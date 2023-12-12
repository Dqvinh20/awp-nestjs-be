import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	UseInterceptors,
	BadRequestException,
	Query,
	Res,
	StreamableFile,
	UploadedFile,
	ParseFilePipe,
	MaxFileSizeValidator,
	FileTypeValidator,
	UnauthorizedException,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
} from '@nestjs/swagger';
import { Class } from './entities/class.entity';
import MongooseClassSerializerInterceptor from 'src/interceptors/mongoose-class-serializer.interceptor';
import { FindAllPaginateDto } from './dto/find-paginate.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

import { User } from '@modules/users/entities/user.entity';
import { AuthUser } from 'src/decorators/auth_user.decorator';
import { NeedAuth } from 'src/decorators/need_auth.decorator';
import { InvitationSendDto } from './dto/invitation-send.dto';
import { isMongoId } from 'class-validator';
import type { Response } from 'express';
import { ApiBodyWithSingleFile } from 'src/decorators/swagger-form-data.decorator';
import { intersection } from 'lodash';
import { Role } from 'src/decorators/role.decorator';
import { RemoveUserFromClassDto } from './dto/remove-user-from-class.dto';

export enum EXPORT_FILE_TYPE {
	CSV = 'csv',
	XLSX = 'xlsx',
}

export const EXPORT_FILE_TYPE_ARRAY = Object.values(EXPORT_FILE_TYPE);

export const MAX_IMPORT_FILE_SIZE = 1000 * 1000; // 1MB

@NeedAuth()
@ApiTags('classes')
@Controller('classes')
@UseInterceptors(MongooseClassSerializerInterceptor(Class))
export class ClassesController {
	constructor(private readonly classesService: ClassesService) {}

	@ApiOperation({
		summary: 'Create a class',
		description: `
* Admin can create a class with teacher and students.
* Teacher can create a class then add students and teachers later.
* Teachers and students must be unique.`,
	})
	@ApiBody({
		type: CreateClassDto,
		examples: {
			'Admin create example class': {
				value: {
					name: 'Example Class',
					description: 'Class description',
					teachers: ['Mongo ObjectId'],
					students: ['Mongo ObjectId'],
					owner: 'Mongo ObjectId',
				},
			},
			'Teacher create example class': {
				value: {
					name: 'Example Class',
					description: 'Class description',
				},
			},
		},
	})
	@ApiCreatedResponse({
		description: 'The class has been successfully created.',
		type: Class,
	})
	@ApiForbiddenResponse({
		description: 'Permission denied',
		schema: {
			type: 'object',
			example: {
				statusCode: 403,
				message: "User doesn't have permission to access",
				error: 'Forbidden',
			},
		},
	})
	@Roles(USER_ROLE.ADMIN, USER_ROLE.TEACHER)
	@Post()
	create(
		@AuthUser() user: User,
		@Role() userRole: USER_ROLE,
		@Body() createClassDto: CreateClassDto,
	) {
		if (userRole === USER_ROLE.TEACHER) {
			createClassDto.owner = user.id;
			createClassDto.teachers = [];
			createClassDto.students = [];
		} else {
			if (!createClassDto.owner) {
				throw new BadRequestException('Owner is required');
			}

			const { teachers, students, owner } = createClassDto;
			const hasTeachers = teachers && teachers.length !== 0;
			const hasStudents = students && students.length !== 0;
			if (hasTeachers && teachers.includes(owner)) {
				throw new BadRequestException('Owner is already is a teacher');
			}

			if (hasStudents && students.includes(owner)) {
				throw new BadRequestException('Owner can not be a student');
			}

			if (
				hasStudents &&
				hasTeachers &&
				intersection(teachers, students).length !== 0
			) {
				throw new BadRequestException(
					'Teachers and students can not have same user',
				);
			}
		}

		return this.classesService.create(createClassDto).catch((err) => {
			throw new BadRequestException(err.message || 'Something went wrong');
		});
	}

	@ApiOperation({
		summary: 'Get all class that user attendance. Admin can get all classes',
	})
	@Get()
	findAll(@AuthUser() user: User, @Query() body: FindAllPaginateDto) {
		let query;
		switch (user.role as unknown as USER_ROLE) {
			case USER_ROLE.TEACHER:
				query = { $or: [{ owner: user.id }, { teachers: user.id }] };
				break;
			case USER_ROLE.STUDENT:
				query = { students: user.id };
				break;
			default:
				break;
		}
		body.query = { ...query };
		return this.classesService.findWithPaginate(body);
	}

	// @Roles(USER_ROLE.TEACHER)
	@ApiParam({
		name: 'id',
		description: 'Class id',
	})
	@ApiQuery({
		required: false,
		name: 'file_type',
		examples: {
			'Export to csv': {
				value: 'csv',
			},
			'Export to xlsx': {
				value: 'xlsx',
			},
		},
		description: 'File type for download. Support csv and xlsx',
	})
	@Post(':id/download/student-list')
	async downloadStudentListTemplate(
		@Param('id') id: string,
		@Query('file_type') file_type = EXPORT_FILE_TYPE.CSV,
		@Res({ passthrough: true }) res: Response,
		@AuthUser() user: User,
	): Promise<StreamableFile> {
		if (!EXPORT_FILE_TYPE_ARRAY.includes(file_type)) {
			throw new BadRequestException(
				`Invalid file type. Support [${EXPORT_FILE_TYPE_ARRAY.join(', ')}]`,
			);
		}
		if (!isMongoId(id)) {
			throw new BadRequestException('Invalid class id');
		}
		const classDetail = await this.classesService.findOne(id);
		if (classDetail.owner.id !== user.id) {
			throw new BadRequestException('Only owner can download student list');
		}
		const data = classDetail.students.map((student) => {
			return {
				student_id: student.student_id,
				full_name: student.full_name,
			};
		});
		const buffer = await this.classesService.createWorkbookStudentList(
			data,
			file_type,
		);

		if (file_type === EXPORT_FILE_TYPE.CSV) {
			res.type('text/csv');
		} else if (file_type === EXPORT_FILE_TYPE.XLSX) {
			res.type(
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			);
		}
		res.attachment(`${classDetail.name}_student_list.${file_type}`);

		return new StreamableFile(buffer);
	}

	@ApiBodyWithSingleFile()
	@ApiBadRequestResponse({})
	@Post(':id/import/student-list')
	async importStudentList(
		@Param('id') id: string,
		@UploadedFile(
			new ParseFilePipe({
				fileIsRequired: true,
				validators: [
					new MaxFileSizeValidator({
						maxSize: MAX_IMPORT_FILE_SIZE,
						message: `File too large. Max file size ${
							MAX_IMPORT_FILE_SIZE / 1000
						}MB`,
					}),
					new FileTypeValidator({
						fileType: /^(?:(?!~\$).)+\.(?:sheet?|csv)$/g,
					}),
				],
			}),
		)
		file: Express.Multer.File,
	) {
		return file.filename;
	}

	@ApiOperation({
		summary: 'Join class by code or link',
	})
	@ApiQuery({
		required: false,
		name: 'c',
		description: 'Class code.Required if not use link',
	})
	@ApiQuery({
		required: false,
		name: 't',
		description: 'Token for joining with link.Required if not use code',
	})
	@ApiBadRequestResponse({
		content: {
			'application/json': {
				examples: {
					'Invalid code length': {
						value: {
							statusCode: 400,
							message: 'Invalid code length',
							error: 'Bad Request',
						},
					},

					'Class not found': {
						value: {
							statusCode: 400,
							message: 'Class not found',
							error: 'Bad Request',
						},
					},
					'User already in class': {
						value: {
							statusCode: 400,
							message: 'User already in class',
							error: 'Bad Request',
						},
					},
					'Owner can not join class': {
						value: {
							statusCode: 400,
							message: 'Owner can not join class',
							error: 'Bad Request',
						},
					},
					'Class is closed for joining': {
						value: {
							statusCode: 400,
							message: 'Class is closed for joining',
							error: 'Bad Request',
						},
					},
					'Invitation token expired': {
						value: {
							statusCode: 400,
							message: 'Invitation token expired. Please send again',
							error: 'Bad Request',
						},
					},
					'Bad invitation token token': {
						value: {
							statusCode: 400,
							message: 'Bad invitation token',
							error: 'Bad Request',
						},
					},
				},
			},
		},
	})
	@Get('join')
	async join(
		@AuthUser() user,
		@Query('c') code?: string,
		@Query('t') token?: string,
	) {
		if (!code && !token)
			throw new BadRequestException('Must provide code or token');

		if (code) {
			return await this.classesService.joinByCode(code, user);
		}

		if (token) {
			return await this.classesService.joinByToken(token, user);
		}
	}

	@ApiOperation({
		summary: "Teacher and student leave class. Owner can't leave class",
	})
	@Delete(':class_id/leave')
	async leaveClass(
		@AuthUser() user,
		@Role() userRole,
		@Param('class_id') class_id: string,
	) {
		const classDetail = await this.classesService.findOne(class_id);
		if (classDetail.owner.id === user.id) {
			throw new BadRequestException('Owner can not left class');
		}

		const { students, teachers } = classDetail;

		if (
			students.every((student) => student.id !== user.id) &&
			teachers.every((teacher) => teacher.id !== user.id)
		) {
			throw new UnauthorizedException('You are not in this class');
		}

		return this.classesService.removeMember({
			class_id,
			users_id: [user.id],
			role: userRole,
		});
	}

	@ApiOperation({
		summary: 'Owner kick teachers, students. Teachers kick students',
	})
	@Roles(USER_ROLE.TEACHER, USER_ROLE.ADMIN)
	@Delete('kick')
	async kick(
		@AuthUser() user,
		@Role() userRole,
		@Body() kickUserDto: RemoveUserFromClassDto,
	) {
		const classDetail = await this.classesService.findOne(kickUserDto.class_id);
		const { students, teachers } = classDetail;

		if (
			classDetail.owner.id !== user.id &&
			!teachers.some((teacher) => teacher.id === user.id)
		) {
			throw new BadRequestException('You are not in this class');
		}

		const { users_id, role } = kickUserDto;

		const isKickOnwer = users_id.some((id) => id === classDetail.owner.id);
		if (isKickOnwer) {
			throw new BadRequestException('Owner can not be kicked from class');
		}

		if (role === USER_ROLE.TEACHER) {
			const invalid_ids = users_id.reduce((acc, id) => {
				if (teachers.findIndex((teacher) => teacher.id === id) === -1) {
					acc.push(id);
				}
				return acc;
			}, []);

			if (invalid_ids.length !== 0) {
				throw new UnauthorizedException(
					`Users are not in this class: ${invalid_ids.join(', ')}`,
				);
			}
		} else {
			const invalid_ids = users_id.reduce((acc, id) => {
				if (students.findIndex((student) => student.id === id) === -1) {
					acc.push(id);
				}

				return acc;
			}, []);

			if (invalid_ids.length !== 0) {
				throw new UnauthorizedException(
					`Users are not in this class: ${invalid_ids.join(', ')} `,
				);
			}
		}

		return this.classesService.removeMember(kickUserDto);
	}

	@ApiOperation({
		summary: 'Send link for student or teacher to join class by email',
		description: `
* Only teacher or owner in the class can send invitation mail
* User can not send invitation mail to himself
* Class must be joinable`,
	})
	@ApiCreatedResponse({
		content: {
			'application/json': {
				example: 'Invitation link has been sent to email',
			},
		},
	})
	@ApiBadRequestResponse({
		content: {
			'application/json': {
				examples: {
					'Invalid code length': {
						value: {
							statusCode: 400,
							message: 'Invalid code length',
							error: 'Bad Request',
						},
					},
					'User not found': {
						value: {
							statusCode: 400,
							message: 'User not found',
							error: 'Bad Request',
						},
					},
					'User already in class': {
						value: {
							statusCode: 400,
							message: 'User already in class',
							error: 'Bad Request',
						},
					},
					'Owner can not join class': {
						value: {
							statusCode: 400,
							message: 'Owner can not join class',
							error: 'Bad Request',
						},
					},
					'Only teacher in the class can invite': {
						value: {
							statusCode: 400,
							message: 'Only teacher in the class can invite',
							error: 'Bad Request',
						},
					},
					'Class is closed for joining': {
						value: {
							statusCode: 400,
							message: 'Class is closed for joining',
							error: 'Bad Request',
						},
					},
				},
			},
		},
	})
	@Roles(USER_ROLE.TEACHER)
	@Post('send-link-to-email')
	async sendInvitationLink(
		@AuthUser() user: User,
		@Body() invitationSendDto: InvitationSendDto,
	) {
		return await this.classesService
			.sendInvitationLink(user, invitationSendDto)
			.then(() => 'Invitation link has been sent to email')
			.catch((err) => {
				throw new BadRequestException(err.message || 'Something went wrong');
			});
	}

	@ApiOperation({
		summary: 'Get class detail by class code',
	})
	@ApiBadRequestResponse({
		content: {
			'application/json': {
				examples: {
					'Invalid code length': {
						value: {
							statusCode: 400,
							message: 'Invalid code length',
							error: 'Bad Request',
						},
					},
				},
			},
		},
	})
	@ApiNotFoundResponse({
		description: 'Class not found',
		schema: {
			type: 'object',
			example: {
				statusCode: 404,
				message: "Class doesn't exist or deleted",
				error: 'Not Found',
			},
		},
	})
	@Get('code/:code')
	findOneByCode(@Param('code') code: string) {
		if (code.length !== 7) throw new BadRequestException('Invalid code length');
		return this.classesService.findOneByCondition({
			code,
		});
	}

	@ApiOperation({
		summary: 'Get class detail',
	})
	@ApiNotFoundResponse({
		description: 'Class not found',
		schema: {
			type: 'object',
			example: {
				statusCode: 404,
				message: "Class doesn't exist or deleted",
				error: 'Not Found',
			},
		},
	})
	@Get(':id')
	async findOne(@Param('id') id: string, @AuthUser() user: User) {
		const classDetail = await this.classesService.findOne(id);
		if (user.email !== classDetail.owner.email) {
			const { teachers, students } = classDetail;
			if (teachers.map((teacher) => teacher.email).includes(user.email))
				return classDetail;

			if (students.map((student) => student.email).includes(user.email))
				return classDetail;

			throw new BadRequestException(
				"You don't have permission to access. You are not in this class",
			);
		}
		return classDetail;
	}

	@ApiOperation({
		summary: 'Update class info',
		description: "Only admin and owner of the class can update it's info",
	})
	@ApiForbiddenResponse({
		description: 'Permission denied',
		schema: {
			type: 'object',
			example: {
				statusCode: 403,
				message: "User doesn't have permission to access",
				error: 'Forbidden',
			},
		},
	})
	@Patch(':id')
	@Roles(USER_ROLE.ADMIN, USER_ROLE.TEACHER)
	update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto) {
		return this.classesService.update(id, updateClassDto);
	}

	@ApiOperation({
		summary: 'Soft delete a class',
		description: 'Only admin can delete a class or owner of the class',
	})
	@ApiForbiddenResponse({
		description: 'Permission denied',
		schema: {
			type: 'object',
			example: {
				statusCode: 403,
				message: "User doesn't have permission to access",
				error: 'Forbidden',
			},
		},
	})
	@Roles(USER_ROLE.ADMIN, USER_ROLE.TEACHER)
	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.classesService.remove(id);
	}
}
