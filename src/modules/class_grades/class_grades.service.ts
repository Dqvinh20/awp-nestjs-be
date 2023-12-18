import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { CreateClassGradeDto } from './dto/create-class_grade.dto';
import mongoose, { Model } from 'mongoose';
import { ClassGrade } from './entities/class_grade.entity';
import { InjectModel } from '@nestjs/mongoose';
import {
	GradeColumnDto,
	UpsertGradeColumnsDto,
} from './dto/update-grade_column.dto';
import { GradeColumn } from './entities/grade_column.entity';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { User } from '@modules/users/entities/user.entity';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { keyBy, values, merge, pickBy } from 'lodash';
import { Grade } from './entities/grade.entity';
import { FinishGradeEvent } from '@modules/shared/events/FinishGrade.event';
import {
	ServerEvents,
	SocketBroadcastParams,
} from 'src/types/notifications.type';
import * as XLSX from 'xlsx';
import readXlsxFile, { Integer } from 'read-excel-file/node';
import { Schema } from 'read-excel-file';

const ObjectId = mongoose.Types.ObjectId;

@Injectable()
export class ClassGradesService {
	private readonly logger = new Logger(ClassGradesService.name);
	constructor(
		@InjectModel(ClassGrade.name)
		private readonly class_grades_model: Model<ClassGrade>,
		private readonly event_emitter: EventEmitter2,
	) {}

	// Validation Method
	async checkClassTeacher(class_id: string, teacher_id: string) {
		const class_grade = await this.class_grades_model.aggregate([
			{
				$lookup: {
					from: 'classes',
					localField: 'class',
					foreignField: '_id',
					as: 'class',
					pipeline: [
						{
							$project: {
								teachers: 1,
								owner: 1,
							},
						},
					],
				},
			},
			{ $unwind: '$class' },
			{
				$match: {
					$and: [
						{ 'class._id': new ObjectId(class_id) },
						{
							$or: [
								{ 'class.teachers': new ObjectId(teacher_id) },
								{ 'class.owner': new ObjectId(teacher_id) },
							],
						},
					],
				},
			},
		]);
		if (class_grade.length === 0) {
			throw new BadRequestException('You are not the teacher of this class');
		}
		return this;
	}

	async checkClassStudent(class_id: string, student_id: string) {
		const class_grade = await this.class_grades_model.aggregate([
			{
				$lookup: {
					from: 'classes',
					localField: 'class',
					foreignField: '_id',
					as: 'class',
					pipeline: [
						{
							$project: {
								students: 1,
							},
						},
					],
				},
			},
			{ $unwind: '$class' },
			{
				$match: {
					$and: [
						{ 'class._id': new ObjectId(class_id) },
						{ 'class.students': new ObjectId(student_id) },
					],
				},
			},
		]);
		if (class_grade.length === 0) {
			throw new BadRequestException('You are not the student of this class');
		}
		return this;
	}

	async checkClassStudentOrTeacher(class_id: string, user: User) {
		return (user.role as unknown as USER_ROLE) === USER_ROLE.STUDENT
			? this.checkClassStudent(class_id, user.id)
			: this.checkClassTeacher(class_id, user.id);
	}

	async checkGradeColumns(gradeColumns: GradeColumnDto[]) {
		if (gradeColumns.length === 0) {
			return;
		}

		const sum = gradeColumns.reduce((acc, curr) => {
			return acc + curr.scaleValue;
		}, 0);

		if (sum !== 100) {
			throw new BadRequestException(
				'Grade column scale values must sum to 100%',
			);
		}

		const sortedGradeColumns = gradeColumns.sort((a, b) => {
			return a.ordinal - b.ordinal;
		});

		const isOrdinalValid = sortedGradeColumns.every((gradeColumn, index) => {
			return gradeColumn.ordinal === index;
		});

		if (!isOrdinalValid) {
			throw new BadRequestException(
				'Grade column ordinal values must be unique and in order',
			);
		}

		const isValidName =
			new Set(gradeColumns.map(({ name }) => name)).size ===
			gradeColumns.length;

		if (!isValidName) {
			throw new BadRequestException('Grade column names must be unique');
		}
	}
	//--------------------------------------------

	private transformGradeRowDto(gradeRowDto: UpdateGradeDto[]) {
		return gradeRowDto.map((col) => {
			let id = col._id;

			if (col.id) {
				id = col.id ? col.id : new ObjectId();
				delete col.id;
			}

			return {
				...col,
				_id: id,
			};
		});
	}

	private transformGradeColumnDto(gradeColumnDto: GradeColumnDto[]) {
		return gradeColumnDto.map((col) => {
			const id = col.id ? col.id : new ObjectId();
			delete col.id;
			return {
				...col,
				_id: id,
			};
		});
	}

	@OnEvent('class.created', { async: true })
	async create(createClassGradeDto: CreateClassGradeDto) {
		try {
			const doc = await this.class_grades_model.create({
				...createClassGradeDto,
				grade_columns: [],
				grade_rows: [],
			} as any);
			return doc.save();
		} catch (error) {
			this.logger.error(error.message);
		}
	}

	findAll() {
		return this.class_grades_model.find().exec();
	}

	async findOneByClassIdForStudent(class_id: string, student_id: string) {
		const result = await this.class_grades_model.findOne(
			{
				class: class_id,
				'grade_rows.student_id': student_id,
			},
			{
				_id: 1,
				class: 1,
				grade_columns: 1,
				'grade_rows.$': 1,
				isFinished: 1,
				updated_at: 1,
				created_at: 1,
			},
		);

		return result;
	}

	findOneByClassId(class_id: string) {
		const classGrade = this.class_grades_model
			.findOne({
				class: class_id,
			})
			.exec();

		return classGrade;
	}

	remove(class_id: string) {
		return this.class_grades_model
			.findOneAndDelete({
				class: class_id,
			})
			.exec();
	}

	private async getGradeColumns(class_id: string) {
		const class_grade = await this.class_grades_model.findOne({
			class: class_id,
		});

		return class_grade.grade_columns;
	}

	async getStudentsInClass(class_id: string) {
		const class_grade = await this.class_grades_model
			.findOne({
				class: class_id,
			})
			.populate({
				path: 'class',
				select: 'students',
				populate: 'students',
			});

		return class_grade.class.students;
	}

	async upsertGradeColumns(
		class_id: string,
		updateGradeColumns: UpsertGradeColumnsDto,
	) {
		const currClassGrade = await this.class_grades_model.findOne({
			class: new ObjectId(class_id),
		});

		if (!currClassGrade) {
			throw new BadRequestException(
				'Class grade with the given class_id does not exist',
			);
		}

		const { grade_columns: updateGradeCols } = updateGradeColumns;

		try {
			const result = await this.class_grades_model.findOneAndUpdate(
				{
					class: new ObjectId(class_id),
				},
				{
					$set: {
						grade_columns: this.transformGradeColumnDto(updateGradeCols),
					},
				},
				{
					upsert: true,
					new: true,
				},
			);
			await this.updateAllGradesWithNewCols(class_id, result.grade_columns);
			// await this.event_emitter.emitAsync('class_grade.updated', class_id);
			return this.findOneByClassId(class_id);
		} catch (error) {
			await this.class_grades_model.findOneAndUpdate(
				{
					class: new ObjectId(class_id),
				},
				{
					$set: {
						grade_columns: currClassGrade.grade_columns,
					},
				},
			);
			throw new BadRequestException(error.message);
		}
	}

	async updateAllGradesWithNewCols(class_id, updateGradeCols: GradeColumn[]) {
		// Add new grade columns in grade_rows if not exist
		await Promise.all(
			updateGradeCols.map(async (col) => {
				const result = await this.class_grades_model.findOne({
					class: class_id,
					'grade_rows.grades.column': col._id,
				});
				if (!result) {
					await this.class_grades_model.findOneAndUpdate(
						{
							class: class_id,
						},
						{
							$addToSet: {
								'grade_rows.$[].grades': {
									column: col._id,
									value: 0,
								},
							},
						},
					);
				}
			}),
		);

		// Remove all deleted grade columns in grade_rows
		await this.class_grades_model.findOneAndUpdate(
			{
				class: class_id,
			},
			{
				$pull: {
					'grade_rows.$[].grades': {
						column: {
							$nin: updateGradeCols.map((col) => col._id),
						},
					},
				},
			},
		);
	}

	async updateManyGrades(
		class_id: string,
		updateManyGradeRows: UpdateGradeDto[],
	) {
		await Promise.all(
			this.transformGradeRowDto(updateManyGradeRows).map((row) => {
				return this.updateGradeOfStudent(class_id, row);
			}),
		);

		return this.findOneByClassId(class_id);
	}

	async updateGradeOfStudent(class_id: string, updateGradeRow: UpdateGradeDto) {
		const classGrade = await this.class_grades_model.findOne({
			class: class_id,
		});

		if (!classGrade) {
			throw new BadRequestException('Class grade does not exist');
		}

		const colsName = [];
		const grades = [];
		await Promise.all(
			classGrade.grade_columns.map(async (col) => {
				if (updateGradeRow[col.name] || updateGradeRow[col.name] === 0) {
					grades.push({
						column: new ObjectId(col._id.toString()),
						value: updateGradeRow[col.name],
					} as unknown as Grade);

					delete updateGradeRow[col.name];
				} else {
					const result = await this.class_grades_model.findOne({
						class: class_id,
						grade_rows: {
							$elemMatch: {
								student_id: updateGradeRow.student_id,
								'grades.column': col._id,
							},
						},
					});
					if (!result) {
						grades.push({
							column: new ObjectId(col._id.toString()),
							value: 0,
						} as unknown as Grade);
					}
				}
				colsName.push(col.name);
			}),
		);

		const invalidKeys = Object.keys(updateGradeRow).reduce((acc, key) => {
			if (['student_id', 'full_name', '_id', ...colsName].includes(key)) {
				return acc;
			}
			acc.push(key);
			return acc;
		}, []);

		if (invalidKeys.length !== 0) {
			throw new BadRequestException(
				`Invalid grade column name [${invalidKeys.join(', ')}] in request body`,
			);
		}

		const gradeRow =
			classGrade.grade_rows.find(
				(row) => row.student_id === updateGradeRow.student_id,
			)?.grades ?? [];

		updateGradeRow.grades =
			values(merge(keyBy(gradeRow, 'column'), keyBy(grades, 'column'))) ?? [];
		if (!updateGradeRow._id) {
			delete updateGradeRow._id;
		} else {
			updateGradeRow._id = new ObjectId(updateGradeRow._id);
		}
		await this.class_grades_model.findOneAndUpdate(
			{
				class: new ObjectId(class_id),
			},
			[
				{
					$set: {
						grade_rows: {
							$cond: [
								{
									$in: [updateGradeRow.student_id, '$grade_rows.student_id'],
								},
								{
									$map: {
										input: '$grade_rows',
										in: {
											$mergeObjects: [
												'$$this',
												{
													$cond: [
														{
															$eq: [
																'$$this.student_id',
																updateGradeRow.student_id,
															],
														},
														{
															...updateGradeRow,
														},
														{},
													],
												},
											],
										},
									},
								},
								{
									$concatArrays: [
										'$grade_rows',
										[
											{
												...updateGradeRow,
												_id: new ObjectId(),
											},
										],
									],
								},
							],
						},
					},
				},
			],
		);
		// await this.event_emitter.emitAsync('class_grade.updated', class_id);
		return this.findOneByClassId(class_id);
	}

	async removeGradeRow(class_id: string, row_id: string) {
		const result = await this.class_grades_model.findOneAndUpdate(
			{
				class: class_id,
			},
			{
				$pull: {
					grade_rows: {
						_id: new ObjectId(row_id),
					},
				},
			},
			{ new: true },
		);
		// await this.event_emitter.emitAsync('class_grade.updated', class_id);
		return result;
	}

	@OnEvent('class.students.joined', { async: true })
	async createStudentGrade(updateGrade: UpdateGradeDto) {
		this.logger.debug("Event 'class.students.joined' is triggered");
		const classId = updateGrade.class_id;
		delete updateGrade.class_id;
		await this.updateGradeOfStudent(classId, updateGrade);
		this.logger.debug("Event 'class.students.joined' created student grade");
	}

	@OnEvent('class_grade.updated', { async: true })
	async handleOnClassGradeUpdated(class_id: string) {
		await this.markUnfinished(class_id);
	}

	async markUnfinished(class_id: string) {
		const result = await this.class_grades_model.findOneAndUpdate(
			{
				class: class_id,
			},
			{
				isFinished: false,
			},
			{
				new: true,
			},
		);
		this.event_emitter.emit(ServerEvents.SOCKET_BROADCAST, {
			room: class_id,
			event: ServerEvents.GRADE_UNFINISHED,
			data: {
				class_id,
			},
		} as SocketBroadcastParams);
		return result;
	}

	async markFinished(class_id: string, teacher: User) {
		const class_grade = await this.class_grades_model
			.findOne({
				class: class_id,
			})
			.populate('class');

		if (!class_grade) {
			throw new NotFoundException('Class grade not found');
		}

		if (class_grade.isFinished) {
			throw new BadRequestException('Class grade is already finished');
		}

		const result = await this.class_grades_model.findOneAndUpdate(
			{
				class: class_id,
			},
			{
				isFinished: true,
			},
			{
				new: true,
			},
		);
		await this.event_emitter.emitAsync(
			ServerEvents.GRADE_FINISHED,
			ServerEvents.GRADE_FINISHED,
			new FinishGradeEvent({
				title: class_grade.class.name,
				message: `Teacher ${
					teacher.full_name ?? teacher.email
				} has finished the grade of class. Please check it out!`,
				class: class_id,
				receivers: class_grade.class.students,
				sender: class_grade.class.owner,
				ref_url: `/class/${class_id}/grade`,
			}),
		);
		return result;
	}

	async createWorkbookStudentList(
		data: any[],
		header: string[],
		file_type: XLSX.BookType,
	) {
		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.json_to_sheet(data, {
			header,
			skipHeader: true,
		});
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Student List');
		const buffer = XLSX.write(workbook, {
			type: 'buffer',
			bookType: file_type,
		});
		return buffer;
	}

	async importGradeTable(classId: string, buffer: Buffer) {
		const classGrade = await this.findOneByClassId(classId);
		if (!classGrade) {
			throw new BadRequestException('Class grade does not exist');
		}

		const colSchema = classGrade.grade_columns.reduce(
			(acc: Schema, col: any) => {
				acc[col.name] = {
					prop: col.name,
					type: Integer,
					required: true,
					validate(value: number) {
						if (value > 10 || value < 0) {
							throw new Error('Grade must be between 0 and 10');
						}
					},
				};
				return acc;
			},
			{},
		);

		const schema: Schema = {
			'Student ID': {
				prop: 'student_id',
				type: String,
				required: true,
			},
			'Full name': {
				prop: 'full_name',
				type: String,
				required: true,
			},
			...colSchema,
		};

		const rows = await readXlsxFile(buffer, {
			schema,
			transformData(dataExcel: any[]) {
				const headerRow = dataExcel[0];
				if (headerRow.length - 2 !== classGrade.grade_columns.length) {
					throw new Error(
						'Your file is not valid. The columns in your file does not match the columns in the template file.',
					);
				}

				return dataExcel.filter(
					(rowExcel: any[]) =>
						rowExcel.filter((columnExcel) => columnExcel !== null).length > 0,
				);
			},
		})
			.then(({ rows, errors }) => {
				let duplicateStudentId = rows.reduce((a: any, e: any) => {
					a[e.student_id] = ++a[e.student_id] || 0;
					return a;
				}, {});

				duplicateStudentId = pickBy(
					duplicateStudentId,
					(value, key) => value > 1,
				);
				const duplicateStudentIdKeys = Object.keys(duplicateStudentId);
				if (duplicateStudentIdKeys.length !== 0) {
					throw new Error(
						`Duplicate Student ID: <strong class="text-red-500">${duplicateStudentIdKeys.join(
							', ',
						)}</strong>. Please check again!`,
					);
				}

				const errorsKeys = keyBy(errors, 'error');
				if (errors.length === 0) {
					return rows;
				}

				const details = () => {
					if (errorsKeys['Grade must be between 0 and 10']) {
						return 'Grade must be between 0 and 10';
					}
					if (
						errorsKeys.invalid &&
						errorsKeys.invalid.reason === 'not_a_number'
					) {
						return `Grade must be a number at row ${errorsKeys.invalid.row} in column ${errorsKeys.invalid.column}`;
					}

					if (errorsKeys.required) {
						return `Field is missing at row ${errorsKeys.required.row} in column '${errorsKeys.required.column}'`;
					}
				};
				throw new Error(details());
			})
			.catch((readExcelError: Error) => {
				throw new BadRequestException(readExcelError.message);
			});
		await this.updateManyGrades(classId, rows as UpdateGradeDto[]);
		return this.findOneByClassId(classId);
	}

	async importOneColumn(classId: string, columnId: string, buffer: Buffer) {
		const classGrade = await this.findOneByClassId(classId);
		if (!classGrade) {
			throw new NotFoundException('Class grade not found');
		}
		const { grade_columns } = classGrade;
		const foundColumn = grade_columns.find(
			(col) => col._id.toString() === columnId,
		);
		if (!foundColumn) {
			throw new NotFoundException('Column not found');
		}
		const schema: Schema = {
			'Student ID': {
				prop: 'student_id',
				type: String,
				required: true,
				validate(value: string) {
					if (value.length > 10 || value.length < 0) {
						throw new Error('Student ID must be between 0 and 10 characters');
					}
				},
			},
			Grade: {
				prop: 'grade',
				type: Integer,
				required: true,
				validate(value: number) {
					if (value > 10 || value < 0) {
						throw new Error('Grade must be between 0 and 10');
					}
				},
			},
		};

		const rows = await readXlsxFile<{
			student_id: string;
			grade: number;
		}>(buffer, {
			schema,
			transformData(dataExcel: any[]) {
				return dataExcel.filter(
					(rowExcel: any[]) =>
						rowExcel.filter((columnExcel) => columnExcel !== null).length > 0,
				);
			},
		})
			.then(({ rows, errors }) => {
				let duplicateStudentId = rows.reduce((a: any, e: any) => {
					a[e.student_id] = ++a[e.student_id] || 0;
					return a;
				}, {});

				duplicateStudentId = pickBy(
					duplicateStudentId,
					(value, key) => value > 1,
				);
				const duplicateStudentIdKeys = Object.keys(duplicateStudentId);
				if (duplicateStudentIdKeys.length !== 0) {
					throw new Error(
						`Duplicate Student ID: <strong class="text-red-500">${duplicateStudentIdKeys.join(
							', ',
						)}</strong>. Please check again!`,
					);
				}

				const errorsKeys = keyBy(errors, 'error');
				if (errors.length === 0) {
					return rows;
				}

				const details = () => {
					if (errorsKeys['Grade must be between 0 and 10']) {
						return 'Grade must be between 0 and 10';
					}

					if (errorsKeys['Student ID must be between 0 and 10 characters']) {
						return 'Student ID must be between 0 and 10 characters';
					}

					if (
						errorsKeys.invalid &&
						errorsKeys.invalid.reason === 'not_a_number'
					) {
						return `Grade must be a number at row ${errorsKeys.invalid.row} in column ${errorsKeys.invalid.column}`;
					}

					if (errorsKeys.required) {
						return `Field is missing at row ${errorsKeys.required.row} in column '${errorsKeys.required.column}'`;
					}
				};

				throw new Error(details());
			})
			.catch((readExcelError: Error) => {
				throw new BadRequestException(readExcelError.message);
			});

		const updatedGradeRows = rows.map<UpdateGradeDto>((row) => {
			return {
				student_id: row.student_id,
				[foundColumn.name]: row.grade,
			};
		});
		if (updatedGradeRows.length === 0) {
			throw new NotFoundException('No data found');
		}

		await this.updateManyGrades(classId, updatedGradeRows);
		return this.findOneByClassId(classId);
	}
}
