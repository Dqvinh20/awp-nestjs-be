import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateClassGradeDto } from './dto/create-class_grade.dto';
import mongoose, { Model } from 'mongoose';
import { ClassGrade } from './entities/class_grade.entity';
import { InjectModel } from '@nestjs/mongoose';
import {
	GradeColumnDto,
	UpsertGradeColumnsDto,
} from './dto/update-grade_column.dto';
import { GradeColumn } from './entities/grade_column.entity';
import { UpdateGrade } from './dto/update-grade.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { User } from '@modules/users/entities/user.entity';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { keyBy, values, merge } from 'lodash';
import { Grade } from './entities/grade.entity';

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
		const doc = await this.class_grades_model.create(createClassGradeDto);
		return doc.save();
	}

	findAll() {
		return this.class_grades_model.find().exec();
	}

	async findOneByClassIdForStudent(class_id: string, student_id: string) {
		const result = await this.class_grades_model.findOne(
			{
				class: class_id,
				'grade_rows.student': new ObjectId(student_id),
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
				},
			);
			await this.updateAllGrades(class_id, result.grade_columns);
			await this.event_emitter.emitAsync('class_grade.updated', class_id);
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

	async updateAllGrades(class_id, updateGradeCols: GradeColumn[]) {
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
	}

	async updateGradeOfStudent(class_id: string, updateGradeRow: UpdateGrade) {
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
				if (updateGradeRow[col.name]) {
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
								student: new ObjectId(updateGradeRow.user_id),
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
			if (
				['student_id', 'full_name', 'user_id', '_id', ...colsName].includes(key)
			) {
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
				(row) => row.student.toString() === updateGradeRow.user_id,
			)?.grades ?? [];

		updateGradeRow.grades =
			values(merge(keyBy(gradeRow, 'column'), keyBy(grades, 'column'))) ?? [];

		updateGradeRow.student = new ObjectId(updateGradeRow.user_id);
		delete updateGradeRow.user_id;

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
									$in: [
										new ObjectId(updateGradeRow.student),
										'$grade_rows.student',
									],
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
																'$$this.student',
																new ObjectId(updateGradeRow.student),
															],
														},
														updateGradeRow,
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
		await this.event_emitter.emitAsync('class_grade.updated', class_id);
		return this.findOneByClassId(class_id);
	}

	@OnEvent('class.students.joined', { async: true })
	async createStudentGrade(updateGrade: UpdateGrade) {
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
		return await this.class_grades_model.findOneAndUpdate(
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
	}

	async markFinished(class_id: string) {
		return await this.class_grades_model.findOneAndUpdate(
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
	}
}