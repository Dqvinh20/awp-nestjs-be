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
	ApiBody,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOperation,
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

@NeedAuth()
@ApiTags('classes')
@Controller('classes')
@UseInterceptors(MongooseClassSerializerInterceptor(Class))
export class ClassesController {
	constructor(private readonly classesService: ClassesService) {}

	@ApiOperation({
		summary: 'Create a class',
		description:
			'Admin and teacher can create a class.<br/>Teacher and student must be unique',
	})
	@ApiBody({
		type: CreateClassDto,
		examples: {
			'Create a class': {
				value: {
					name: 'Class 1',
					description: 'Class 1 description',
					teachers: ['Mongo ObjectId'],
					students: ['Mongo ObjectId'],
					owner: 'Mongo ObjectId',
				},
			},
		},
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
