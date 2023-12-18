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
	Delete,
	Query,
	Res,
	StreamableFile,
	UploadedFile,
	ParseFilePipe,
	MaxFileSizeValidator,
	FileTypeValidator,
	NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClassGradesService } from './class_grades.service';
import { CreateClassGradeDto } from './dto/create-class_grade.dto';
import {
	ApiBadRequestResponse,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiTags,
} from '@nestjs/swagger';
import MongooseClassSerializerInterceptor from 'src/interceptors/mongoose-class-serializer.interceptor';
import { ClassGrade } from './entities/class_grade.entity';
import { UpsertGradeColumnsDto } from './dto/update-grade_column.dto';
import { AuthUser } from 'src/decorators/auth_user.decorator';
import { ClassesService } from '@modules/classes/classes.service';
import { NeedAuth } from 'src/decorators/need_auth.decorator';
import { isMongoId } from 'class-validator';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { User } from '@modules/users/entities/user.entity';
import { Roles } from 'src/decorators/roles.decorator';
import { Role } from 'src/decorators/role.decorator';
import { UpdateManyGradeDto } from './dto/update-many-grade.dto';
import { ApiBodyWithSingleFile } from 'src/decorators/swagger-form-data.decorator';

export enum EXPORT_FILE_TYPE {
	CSV = 'csv',
	XLSX = 'xlsx',
}

export const EXPORT_FILE_TYPE_ARRAY = Object.values(EXPORT_FILE_TYPE);

export const MAX_IMPORT_FILE_SIZE = 1000 * 1000; // 1MB

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
				throw new BadRequestException(
					'You are not allowed to view this class grade',
				);
			}

			return await this.classGradesService.findOneByClassIdForStudent(
				class_id,
				user.student_id,
			);
		}

		return await this.classGradesService.findOneByClassId(class_id);
	}

	@ApiParam({
		name: 'class_id',
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
	@Roles(USER_ROLE.TEACHER)
	@Get(':class_id/template')
	async downloadStudentListTemplate(
		@Param('class_id') id: string,
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
		await this.classGradesService.checkClassTeacher(id, user.id);

		const classDetail = await this.classesService.findOne(id);
		if (!classDetail) {
			throw new BadRequestException('Class not found');
		}
		const classGrade = await this.classGradesService.findOneByClassId(id);
		const { grade_columns: gradeColumns, grade_rows: gradeRows } = classGrade;

		const data = gradeRows.reduce((acc, row) => {
			acc.push({
				student_id: row.student_id,
				full_name: row.full_name,
			});

			return acc;
		}, []);

		const colNames = gradeColumns.reduce((acc, cur) => {
			acc[cur.name] = cur.name;
			return acc;
		}, {});

		const sheetFirstRow = {
			student_id: 'Student ID',
			full_name: 'Full name',
			...colNames,
		};

		const buffer = await this.classGradesService.createWorkbookStudentList(
			[sheetFirstRow, ...data],
			['student_id', 'full_name', ...(Object.values(colNames) as string[])],
			file_type,
		);

		if (file_type === EXPORT_FILE_TYPE.CSV) {
			res.type('text/csv');
		} else if (file_type === EXPORT_FILE_TYPE.XLSX) {
			res.type(
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			);
		}
		res.attachment(
			`${this.formatDateExcel()}_import_grade_template.${file_type}`,
		);

		return new StreamableFile(buffer);
	}

	@ApiParam({
		name: 'class_id',
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
	@Roles(USER_ROLE.TEACHER)
	@Get(':class_id/template/:column_id')
	async downloadOneColumnTemplate(
		@Param('class_id') class_id: string,
		@Param('column_id') column_id: string,
		@Query('file_type') file_type = EXPORT_FILE_TYPE.CSV,
		@Res({ passthrough: true }) res: Response,
		@AuthUser() user: User,
	): Promise<StreamableFile> {
		if (!EXPORT_FILE_TYPE_ARRAY.includes(file_type)) {
			throw new BadRequestException(
				`Invalid file type. Support [${EXPORT_FILE_TYPE_ARRAY.join(', ')}]`,
			);
		}
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		if (!isMongoId(column_id)) {
			throw new BadRequestException('Invalid class id');
		}

		await this.classGradesService.checkClassTeacher(class_id, user.id);
		const classDetail = await this.classesService.findOne(class_id);
		if (!classDetail) {
			throw new NotFoundException('Class not found');
		}

		const classGrade = await this.classGradesService.findOneByClassId(class_id);
		const { grade_columns: gradeColumns, grade_rows: gradeRows } = classGrade;
		const column = gradeColumns.find((col) => col.id === column_id);
		if (!column) {
			throw new NotFoundException('Column not found');
		}

		const data = gradeRows.reduce((acc, row) => {
			acc.push({
				student_id: row.student_id,
				grade:
					row.grades.find((grade) => grade.column.toString() === column_id)
						?.value ?? 0,
			});

			return acc;
		}, []);

		const sheetFirstRow = {
			student_id: 'Student ID',
			grade: 'Grade',
		};

		const buffer = await this.classGradesService.createWorkbookStudentList(
			[sheetFirstRow, ...data],
			['student_id', 'grade'],
			file_type,
		);

		if (file_type === EXPORT_FILE_TYPE.CSV) {
			res.type('text/csv');
		} else if (file_type === EXPORT_FILE_TYPE.XLSX) {
			res.type(
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			);
		}
		res.attachment(
			`${this.formatDateExcel()}_import_one_column_template.${file_type}`,
		);

		return new StreamableFile(buffer);
	}

	formatDateExcel() {
		const date = new Date();
		const year = date.toLocaleString('es-ES', {
			year: 'numeric',
			timeZone: 'Asia/Bangkok',
		});
		const month = date.toLocaleString('es-ES', {
			month: '2-digit',
			timeZone: 'Asia/Bangkok',
		});
		const day = date.toLocaleString('es-ES', {
			day: '2-digit',
			timeZone: 'Asia/Bangkok',
		});
		// YYYY_MM_DD
		return [year, month, day].join('_');
	}

	@ApiParam({
		name: 'class_id',
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
	@Roles(USER_ROLE.TEACHER)
	@Get(':class_id/export')
	async exportGradeBoard(
		@Param('class_id') id: string,
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
		await this.classGradesService.checkClassTeacher(id, user.id);

		const classDetail = await this.classesService.findOne(id);
		if (!classDetail) {
			throw new BadRequestException('Class not found');
		}
		const classGrade = await this.classGradesService.findOneByClassId(id);
		const { grade_columns: gradeColumns, grade_rows: gradeRows } = classGrade;

		const data = gradeRows.reduce((acc, row) => {
			const newRow = {
				student_id: row.student_id,
				full_name: row.full_name,
			};

			row.grades.forEach((grade) => {
				const column = gradeColumns.find(
					(col) => col.id === grade.column.toString(),
				)?.name;
				if (column) {
					newRow[column] = grade.value;
				}
			});
			acc.push(newRow);
			return acc;
		}, []);

		const colNames = gradeColumns.reduce((acc, cur) => {
			acc[cur.name] = cur.name;
			return acc;
		}, {});

		const sheetFirstRow = {
			student_id: 'Student ID',
			full_name: 'Full name',
			...colNames,
		};

		const buffer = await this.classGradesService.createWorkbookStudentList(
			[
				sheetFirstRow,
				...data,
				{
					student_id: 'Average',
					full_name: '',
					...Object.fromEntries(
						Object.entries(colNames).map(([key, value], index) => [
							key,
							{
								t: 'n',
								f: `AVERAGE(${String.fromCharCode(
									67 + index,
								)}2:${String.fromCharCode(67 + index)}${data.length + 1})`,
								F: `${String.fromCharCode(67 + index)}${data.length + 2}`,
								D: 1,
							},
						]),
					),
				},
			],
			['student_id', 'full_name', ...(Object.values(colNames) as string[])],
			file_type,
		);

		if (file_type === EXPORT_FILE_TYPE.CSV) {
			res.type('text/csv');
		} else if (file_type === EXPORT_FILE_TYPE.XLSX) {
			res.type(
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			);
		}

		res.attachment(
			`${this.formatDateExcel()}_${classDetail.name
				.split(' ')
				.join('_')}_grade_board.${file_type}`,
		);

		return new StreamableFile(buffer);
	}

	@ApiBodyWithSingleFile()
	@ApiBadRequestResponse({})
	@Post(':class_id/import')
	async importStudentList(
		@AuthUser() user: User,
		@Param('class_id') classId: string,
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
	): Promise<boolean> {
		if (!isMongoId(classId)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkClassTeacher(classId, user.id);
		await this.classGradesService.importGradeTable(classId, file.buffer);
		return true;
	}

	@ApiBodyWithSingleFile()
	@ApiBadRequestResponse({})
	@Post(':class_id/import/:column_id')
	async importOneColumn(
		@AuthUser() user: User,
		@Param('class_id') classId: string,
		@Param('column_id') column_id: string,
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
	): Promise<boolean> {
		if (!isMongoId(classId)) {
			throw new BadRequestException('Invalid class id');
		}
		if (!isMongoId(column_id)) {
			throw new BadRequestException('Invalid column id');
		}
		await this.classGradesService.checkClassTeacher(classId, user.id);
		await this.classGradesService.importOneColumn(
			classId,
			column_id,
			file.buffer,
		);
		return true;
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
	@Patch(':class_id/rows')
	async updateGrade(
		@Param('class_id') class_id: string,
		@Body() body: UpdateManyGradeDto,
		@Body() body_and_col: any,
		@AuthUser() user: User,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.classGradesService.checkClassTeacher(class_id, user.id);
		return this.classGradesService.updateManyGrades(
			class_id,
			body_and_col.grade_rows,
		);
	}

	@ApiOperation({
		summary: 'Remove student grade',
	})
	@Roles(USER_ROLE.TEACHER)
	@Delete(':class_id/rows/:row_id')
	async removeGradeRow(
		@Param('class_id') class_id: string,
		@Param('row_id') row_id: string,
		@AuthUser() user: User,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		if (!isMongoId(row_id)) {
			throw new BadRequestException('Invalid row id');
		}
		await this.classGradesService.checkClassTeacher(class_id, user.id);
		return this.classGradesService.removeGradeRow(class_id, row_id);
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
		return await this.classGradesService.markFinished(class_id, user);
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
