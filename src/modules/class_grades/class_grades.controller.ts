import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	UseInterceptors,
	BadRequestException,
	Logger,
	UnauthorizedException,
	SerializeOptions,
} from '@nestjs/common';
import { ClassGradesService } from './class_grades.service';
import { CreateClassGradeDto } from './dto/create-class_grade.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import MongooseClassSerializerInterceptor from 'src/interceptors/mongoose-class-serializer.interceptor';
import { ClassGrade } from './entities/class_grade.entity';
import { UpsertGradeColumnsDto } from './dto/update-grade_column.dto';
import { AuthUser } from 'src/decorators/auth_user.decorator';
import { ClassesService } from '@modules/classes/classes.service';
import { NeedAuth } from 'src/decorators/need_auth.decorator';
import { isMongoId } from 'class-validator';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { User } from '@modules/users/entities/user.entity';
import { UpdateGrade } from './dto/update-grade.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { Role } from 'src/decorators/role.decorator';

@ApiTags('Class Grades')
@Controller('class-grades')
@NeedAuth()
@UseInterceptors(MongooseClassSerializerInterceptor(ClassGrade))
export class ClassGradesController {
	private readonly logger = new Logger(ClassGradesController.name);
	constructor(
		private readonly classGradesService: ClassGradesService,
		private readonly classesService: ClassesService,
	) {}

	@Roles(USER_ROLE.ADMIN)
	@Post()
	async create(@Body() createClassGradeDto: CreateClassGradeDto) {
		try {
			return await this.classGradesService.create(createClassGradeDto);
		} catch (error) {
			throw new BadRequestException(error.message);
		}
	}

	@Roles(USER_ROLE.ADMIN)
	@Get()
	async findAll() {
		return await this.classGradesService.findAll();
	}

	@SerializeOptions({
		excludePrefixes: ['_'],
	})
	@ApiOperation({
		summary: 'Get class grade by class id',
	})
	@Get(':class_id')
	async findOneByClassId(
		@Param('class_id') class_id: string,
		@AuthUser() user: User,
		@Role() role: USER_ROLE,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkClassStudentOrTeacher(class_id, user);

		const result = await this.classGradesService.findOneByClassId(class_id);

		if (role === USER_ROLE.STUDENT) {
			if (!result.isFinished) {
				throw new UnauthorizedException(
					'You are not allowed to view this class grade',
				);
			}

			return await this.classGradesService.findOneByClassIdForStudent(
				class_id,
				user.id,
			);
		}

		return await this.classGradesService.findOneByClassId(class_id);
	}

	@ApiOperation({
		summary: 'Get grade columns',
	})
	@Get(':class_id/columns')
	async getGradeColmns(
		@Param('class_id') class_id: string,
		@AuthUser() user: User,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkClassStudentOrTeacher(class_id, user);

		const result = await this.classGradesService.findOneByClassId(class_id);

		if (
			!result.isFinished &&
			(user.role as unknown as USER_ROLE) === USER_ROLE.STUDENT
		) {
			throw new UnauthorizedException(
				'You are not allowed to view this class grade',
			);
		}

		return result.grade_columns;
	}

	@ApiOperation({
		summary: 'Override grade columns',
	})
	@Roles(USER_ROLE.TEACHER)
	@Post(':class_id/columns')
	async upsertGradeColumn(
		@Param('class_id') class_id: string,
		@Body() upsertGradeColumnsDto: UpsertGradeColumnsDto,
		@AuthUser() user: User,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkGradeColumns(
			upsertGradeColumnsDto.grade_columns,
		);
		return await (
			await this.classGradesService.checkClassTeacher(class_id, user.id)
		).upsertGradeColumns(class_id, upsertGradeColumnsDto);
	}

	@ApiOperation({
		summary: 'Update student grade',
	})
	@Roles(USER_ROLE.TEACHER)
	@Patch(':class_id')
	async updateGrade(
		@Param('class_id') class_id: string,
		@Body() body: UpdateGrade,
		@Body() body_and_col: any,
		@AuthUser() user: User,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkClassTeacher(class_id, user.id);
		return this.classGradesService.updateGradeOfStudent(class_id, body_and_col);
	}

	@ApiOperation({
		summary: 'Finish class grade',
	})
	@Roles(USER_ROLE.TEACHER)
	@Patch(':class_id/finish')
	async finishClassGrade(
		@Param('class_id') class_id: string,
		@AuthUser() user: User,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkClassTeacher(class_id, user.id);
		return await this.classGradesService.markFinished(class_id);
	}

	@ApiOperation({
		summary: 'UnFinish class grade',
	})
	@Roles(USER_ROLE.TEACHER)
	@Patch(':class_id/unfinish')
	async unfinishClassGrade(
		@Param('class_id') class_id: string,
		@AuthUser() user: User,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkClassTeacher(class_id, user.id);
		return await this.classGradesService.markUnfinished(class_id);
	}
}
