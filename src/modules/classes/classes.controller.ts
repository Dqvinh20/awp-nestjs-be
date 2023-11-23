import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	UseInterceptors,
	Req,
	BadRequestException,
	Query,
	Res,
	StreamableFile,
	UploadedFile,
	ParseFilePipe,
	MaxFileSizeValidator,
	FileTypeValidator,
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
import { RequestWithUser } from 'src/types/requests.type';
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
	create(@Req() req: RequestWithUser, @Body() createClassDto: CreateClassDto) {
		if (!createClassDto.owner) {
			createClassDto.owner = req.user.id;
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
		const classDetail = await this.findOne(id);
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
							message: 'Bad invitation token token',
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
		if (code)
			return await this.classesService
				.joinByCode(code, user)
				.then(() => 'User joined class successfully');
		if (token)
			return await this.classesService
				.joinByToken(token, user)
				.then(() => 'User joined class successfully');
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
	findOne(@Param('id') id: string) {
		return this.classesService.findOne(id);
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
