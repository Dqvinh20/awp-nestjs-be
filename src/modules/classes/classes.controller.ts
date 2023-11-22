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
