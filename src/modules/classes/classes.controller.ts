import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	UseInterceptors,
	UnauthorizedException,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import {
	ApiBearerAuth,
	ApiBody,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Class } from './entities/class.entity';
import MongooseClassSerializerInterceptor from 'src/interceptors/mongoose-class-serializer.interceptor';

@ApiBearerAuth()
@ApiUnauthorizedResponse({
	description: 'Unauthorized',
	schema: {
		type: 'UnauthorizedException',
		example: {
			statusCode: 401,
			message: 'Unauthorized',
		},
	},
})
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
					teachers: ['Mongo ObjectId'],
					students: ['Mongo ObjectId'],
					owner: 'Mongo ObjectId',
				},
			},
		},
	})
	@Post()
	create(@Body() createClassDto: CreateClassDto) {
		return this.classesService.create(createClassDto);
	}

	@ApiOperation({
		summary: 'Get all class',
	})
	@Get()
	findAll() {
		return this.classesService.findAll();
	}

	@ApiOperation({
		summary: 'Get class detail',
	})
	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.classesService.findOne(id);
	}

	@ApiOperation({
		summary: 'Update class info',
		description: "Only admin and owner of the class can update it's info",
	})
	@Patch(':id')
	update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto) {
		return this.classesService.update(id, updateClassDto);
	}

	@ApiOperation({
		summary: 'Soft delete a class',
		description: 'Only admin can delete a class or owner of the class',
	})
	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.classesService.remove(id);
	}
}
