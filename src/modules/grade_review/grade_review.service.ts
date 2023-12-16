import { BadRequestException, Injectable } from '@nestjs/common';
import {
	CreateCommentDto,
	CreateGradeReviewDto,
} from './dto/create-grade_review.dto';
import { UpdateGradeReviewDto } from './dto/update-grade_review.dto';
import { GradeReview } from './entities/grade_review.entity';
import mongoose, {
	FilterQuery,
	Model,
	ProjectionType,
	QueryOptions,
	ObjectId,
} from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@modules/users/entities/user.entity';
import { ClassGradesService } from '@modules/class_grades/class_grades.service';
import {
	ReviewComment,
	ReviewCommentSchema,
} from './entities/review_comment.entity';

const ObjectId = mongoose.Types.ObjectId;

@Injectable()
export class GradeReviewService {
	findOneByClassId(class_id: string) {
		throw new Error('Method not implemented.');
	}
	constructor(
		@InjectModel(GradeReview.name)
		private readonly grade_review_model: Model<GradeReview>,
		private readonly class_grades_service: ClassGradesService,
	) {}

	async checkBeforeCreate(createGradeReviewDto: CreateGradeReviewDto) {
		const classGrade = await this.class_grades_service.findOneByClassId(
			createGradeReviewDto.class,
		);

		if (!classGrade) {
			throw new BadRequestException(
				`Class grade with ${createGradeReviewDto.class} not found: `,
			);
		}

		const column = classGrade.grade_columns.find(
			(col) => col._id.toString() === createGradeReviewDto.column.toString(),
		);

		if (!column) {
			throw new BadRequestException(
				`Column with ${createGradeReviewDto.column} not found`,
			);
		}
	}

	async create(createGradeReviewDto: CreateGradeReviewDto) {
		await this.class_grades_service.checkClassStudent(
			createGradeReviewDto.class,
			createGradeReviewDto.request_student,
		);
		await this.checkBeforeCreate(createGradeReviewDto);
		const unfinish_grade_review = await this.grade_review_model.findOne({
			class: createGradeReviewDto.class,
			request_student: createGradeReviewDto.request_student,
			request_student_id: createGradeReviewDto.request_student_id,
			column: createGradeReviewDto.column,
			isFinished: false,
		});
		if (unfinish_grade_review) {
			throw new BadRequestException(
				'Please wait for the teacher to finished the review before creating same one.',
			);
		}

		return await this.grade_review_model.create(createGradeReviewDto);
	}

	async findAllByTeacher(teacher: User, class_id?: string) {
		const query: FilterQuery<GradeReview> = {};
		if (class_id) {
			query.class = class_id;
		}

		const result = await this.grade_review_model.aggregate([
			{
				$lookup: {
					from: 'classes',
					localField: 'class',
					foreignField: '_id',
					as: 'classDetail',
				},
			},
			{
				$lookup: {
					from: 'users',
					localField: 'request_student',
					foreignField: '_id',
					as: 'request_student_info',
					pipeline: [
						{
							$project: {
								first_name: 1,
								last_name: 1,
								student_id: 1,
								email: 1,
								avatar: 1,
							},
						},
					],
				},
			},
			{
				$lookup: {
					from: 'class_grades',
					localField: 'class',
					foreignField: 'class',
					as: 'classGrade',
					let: {
						student_id: '$request_student_id',
						column_id: '$column',
					},

					pipeline: [
						{
							$match: {
								$expr: {
									$in: ['$$student_id', '$grade_rows.student_id'],
								},
							},
						},
						{
							$project: {
								grade_rows: {
									$filter: {
										input: '$grade_rows',
										as: 'grade_row',
										cond: {
											$eq: ['$$student_id', '$$grade_row.student_id'],
										},
									},
								},
							},
						},
						{ $unwind: '$grade_rows' },
					],
				},
			},
			{
				$unwind: '$classGrade',
			},
			{
				$unwind: '$request_student_info',
			},
			{
				$unwind: '$classDetail',
			},
			{
				$match: {
					$or: [
						{
							'classDetail.teacher': teacher._id,
						},
						{
							'classDetail.owner': teacher._id,
						},
					],
				},
			},
			{
				$sort: {
					created_at: -1,
					'comment.created_at': -1,
				},
			},
			{
				$addFields: {
					id: '$_id',
				},
			},
			{
				$project: {
					classDetail: 0,
				},
			},
		]);

		result.forEach((item) => {
			const currentGrade = item.classGrade.grade_rows.grades.find(
				(grade) => grade.column.toString() === item.column.toString(),
			);
			item['current_grade'] = currentGrade ? currentGrade.value : 0;
			delete item.classGrade;
		});
		return result;
	}

	findAllByStudent(student: User, class_id?: string) {
		const query: FilterQuery<GradeReview> = {
			request_student: student._id,
			request_student_id: student.student_id,
		};
		if (class_id) {
			query.class = class_id;
		}

		const classGrade = this.class_grades_service.findOneByClassId(class_id);
		// const { grade_column } = classGrade;

		const result = this.grade_review_model
			.find(query)
			.populate([
				{
					path: 'request_student',
					select: 'first_name last_name student_id email',
				},
			])
			.sort({ created_at: -1, 'comment.created_at': -1 });

		return result;
	}

	findOne(id: string) {
		return this.grade_review_model.findById(id);
	}

	update(id: string, updateGradeReviewDto: UpdateGradeReviewDto) {
		return this.grade_review_model.findByIdAndUpdate(id, updateGradeReviewDto, {
			new: true,
		});
	}

	async addNewComment(id: string, newCommentDto: CreateCommentDto) {
		return this.grade_review_model.findByIdAndUpdate(
			id,
			{
				$push: {
					comments: {
						comment: newCommentDto.comment,
						sender: new ObjectId(newCommentDto.sender),
					},
				},
			},
			{
				new: true,
			},
		);
	}

	markFinished(id: string) {
		return this.grade_review_model.findByIdAndUpdate(
			id,
			{
				isFinished: true,
			},
			{
				new: true,
			},
		);
	}

	markUnfinished(id: string) {
		return this.grade_review_model.findByIdAndUpdate(
			id,
			{
				isFinished: false,
			},
			{
				new: true,
			},
		);
	}

	remove(id: string) {
		return this.grade_review_model.findByIdAndDelete(id);
	}
}
