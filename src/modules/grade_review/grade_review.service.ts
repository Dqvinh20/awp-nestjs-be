import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import {
	CreateCommentDto,
	CreateGradeReviewDto,
} from './dto/create-grade_review.dto';
import { UpdateGradeReviewDto } from './dto/update-grade_review.dto';
import { GradeReview } from './entities/grade_review.entity';
import mongoose, {
	FilterQuery,
	Model,
	ObjectId,
	PopulateOptions,
} from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@modules/users/entities/user.entity';
import { ClassGradesService } from '@modules/class_grades/class_grades.service';
import { ClassGrade } from '@modules/class_grades/entities/class_grade.entity';
import { ClassesService } from '@modules/classes/classes.service';
import { FinishGradeReviewDto } from './dto/finish-grade_review.dto';
import { CreateNotificationDto } from '@modules/notifications/dto/create-notification.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServerEvents } from 'src/types/notifications.type';
import { getUserFullNameOrEmail } from '@modules/shared/helper';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';

const ObjectId = mongoose.Types.ObjectId;

@Injectable()
export class GradeReviewService {
	constructor(
		@InjectModel(GradeReview.name)
		private readonly grade_review_model: Model<GradeReview>,
		private readonly classes_service: ClassesService,
		private readonly class_grades_service: ClassGradesService,
		private readonly event_emitter: EventEmitter2,
	) {}

	async checkBeforeCreate(
		classGrade: ClassGrade,
		createGradeReviewDto: CreateGradeReviewDto,
	) {
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
		const classGrade = await this.class_grades_service.findOneByClassId(
			createGradeReviewDto.class,
		);
		await this.checkBeforeCreate(classGrade, createGradeReviewDto);

		const column_name = classGrade.grade_columns.find(
			(col) => col._id.toString() === createGradeReviewDto.column.toString(),
		).name;
		const current_grade = classGrade.grade_rows
			.find(
				(row) =>
					row.student_id.toString() ===
					createGradeReviewDto.request_student_id.toString(),
			)
			?.grades.find(
				(grade) =>
					grade.column.toString() === createGradeReviewDto.column.toString(),
			).value;

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

		try {
			const result = await this.grade_review_model.create({
				...createGradeReviewDto,
				column_name,
				current_grade: current_grade ?? 0,
			});

			const classDetail = await this.classes_service.findOne(
				createGradeReviewDto.class,
			);
			if (!classDetail) {
				throw new NotFoundException('Class not found');
			}
			await this.event_emitter.emitAsync(
				ServerEvents.GRADE_REVIEW_CREATED,
				ServerEvents.GRADE_REVIEW_CREATED,
				{
					title: 'New grade review request',
					message: `You've got a new grade review request from '<strong>${createGradeReviewDto.request_student_id}</strong>'`,
					ref_url: `/class/${createGradeReviewDto.class}/grade-review?review=${result._id}`,
					class: createGradeReviewDto.class,
					receivers: [
						classDetail.owner._id.toString(),
						...classDetail.teachers.map((t) => t._id.toString()),
					],
					sender: createGradeReviewDto.request_student,
				} as CreateNotificationDto,
			);

			return result;
		} catch (e) {
			throw new BadRequestException(e.message);
		}
	}

	async findAllByTeacher(teacher: User, class_id?: string) {
		// const result = await this.grade_review_model.aggregate([
		// 	{
		// 		$lookup: {
		// 			from: 'classes',
		// 			localField: 'class',
		// 			foreignField: '_id',
		// 			as: 'classDetail',
		// 		},
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: 'users',
		// 			localField: 'request_student',
		// 			foreignField: '_id',
		// 			as: 'request_student_info',
		// 			pipeline: [
		// 				{
		// 					$project: {
		// 						first_name: 1,
		// 						last_name: 1,
		// 						student_id: 1,
		// 						email: 1,
		// 						avatar: 1,
		// 					},
		// 				},
		// 			],
		// 		},
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: 'class_grades',
		// 			localField: 'class',
		// 			foreignField: 'class',
		// 			as: 'classGrade',
		// 			let: {
		// 				student_id: '$request_student_id',
		// 				column_id: '$column',
		// 			},

		// 			pipeline: [
		// 				{
		// 					$match: {
		// 						$expr: {
		// 							$in: ['$$student_id', '$grade_rows.student_id'],
		// 						},
		// 					},
		// 				},
		// 				{
		// 					$project: {
		// 						grade_rows: {
		// 							$filter: {
		// 								input: '$grade_rows',
		// 								as: 'grade_row',
		// 								cond: {
		// 									$eq: ['$$student_id', '$$grade_row.student_id'],
		// 								},
		// 							},
		// 						},
		// 					},
		// 				},
		// 				{ $unwind: '$grade_rows' },
		// 			],
		// 		},
		// 	},
		// 	{
		// 		$unwind: '$classGrade',
		// 	},
		// 	{
		// 		$unwind: '$request_student_info',
		// 	},
		// 	{
		// 		$unwind: '$classDetail',
		// 	},
		// 	{
		// 		$match: {
		// 			$or: [
		// 				{
		// 					'classDetail.teacher': teacher._id,
		// 				},
		// 				{
		// 					'classDetail.owner': teacher._id,
		// 				},
		// 			],
		// 		},
		// 	},
		// 	{
		// 		$unwind: '$comments',
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: 'users',
		// 			localField: 'comments.sender',
		// 			foreignField: '_id',
		// 			as: 'comment_sender',
		// 			pipeline: [
		// 				{
		// 					$project: {
		// 						first_name: 1,
		// 						last_name: 1,
		// 						student_id: 1,
		// 						email: 1,
		// 						avatar: 1,
		// 					},
		// 				},
		// 			],
		// 		},
		// 	},
		// 	{
		// 		$set: {
		// 			'comments.sender': '$comment_sender',
		// 		},
		// 	},
		// 	{
		// 		$group: {
		// 			_id: '$_id',
		// 			comments: { $push: '$comments' },
		// 		},
		// 	},
		// 	{
		// 		$sort: {
		// 			isFinished: 1,
		// 			created_at: -1,
		// 			'comment.created_at': -1,
		// 		},
		// 	},
		// 	{
		// 		$addFields: {
		// 			id: '$_id',
		// 		},
		// 	},
		// 	{
		// 		$project: {
		// 			classDetail: 0,
		// 		},
		// 	},
		// ]);

		const classes = await this.classes_service.findAll({
			$or: [
				{
					teacher: teacher._id,
				},
				{
					owner: teacher._id,
				},
			],
		});

		const query: FilterQuery<GradeReview> = {
			class: {
				$in: [...classes.items.map((cls) => cls._id.toString())],
			},
		};

		if (class_id) {
			query.class.$in.push(class_id);
		}

		const populate: PopulateOptions[] = [
			{
				path: 'request_student',
				select: 'first_name last_name student_id email avatar',
			},
			{
				path: 'comments.sender',
				select: 'first_name last_name student_id email avatar',
			},
		];
		if (!class_id) {
			populate.push({
				path: 'class',
				select: 'name _id id teacher owner',
			});
		}

		const result = await this.grade_review_model
			.find(query)
			.populate(populate)
			.sort({ isFinished: 1, created_at: -1, 'comment.created_at': -1 });

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

		const result = this.grade_review_model
			.find(query)
			.populate([
				{
					path: 'request_student',
					select: 'first_name last_name student_id email',
				},
				{
					path: 'comments.sender',
					select: 'first_name last_name student_id email avatar',
				},
			])
			.sort({ isFinished: 1, created_at: -1, 'comment.created_at': -1 });

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

	async addNewComment(
		id: string,
		newCommentDto: CreateCommentDto,
		update_teacher: User,
	) {
		const result = this.grade_review_model.findByIdAndUpdate(
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

		if ((update_teacher.role as unknown as USER_ROLE) === USER_ROLE.TEACHER) {
			const gradeReview = await this.grade_review_model.findById(id);
			await this.event_emitter.emitAsync(
				ServerEvents.GRADE_REVIEW_COMMENT,
				ServerEvents.GRADE_REVIEW_COMMENT,
				{
					title: 'New Comment',
					message: `Teacher <strong>${getUserFullNameOrEmail(
						update_teacher,
					)}</strong> has replied you in grade review request for column </strong>${
						gradeReview.column_name
					}</strong>. Click for more detail.`,
					ref_url: `/class/${gradeReview.class.toString()}/grade-review?review=${id}`,
					class: gradeReview.class.toString(),
					receivers: [gradeReview.request_student.toString()],
					sender: newCommentDto.sender,
				} as CreateNotificationDto,
			);
		}
		return result;
	}

	async markFinished(
		id: string,
		finishGradeReviewDto: FinishGradeReviewDto,
		update_teacher: User,
	) {
		try {
			const gradeReview = await this.grade_review_model.findById(id);
			if (!gradeReview) {
				throw new NotFoundException('Grade review not found');
			}

			const classGrade = await this.class_grades_service.findOneByClassId(
				gradeReview.class.toString(),
			);
			if (!classGrade) {
				throw new NotFoundException('Class grade not found');
			}

			const { updated_grade } = finishGradeReviewDto;
			const { grade_columns } = classGrade;
			const { request_student_id } = gradeReview;

			const foundCol = grade_columns.find(
				(col) => col._id.toString() === gradeReview.column.toString(),
			);
			if (!foundCol) {
				throw new NotFoundException('Column not found');
			}
			await this.class_grades_service.updateGradeOfStudent(
				gradeReview.class.toString(),
				{
					student_id: request_student_id,
					[foundCol.name]: updated_grade,
				},
			);

			await this.grade_review_model.findByIdAndUpdate(
				id,
				{
					isFinished: true,
					updated_grade,
				},
				{
					new: true,
				},
			);
			await this.event_emitter.emitAsync(
				ServerEvents.GRADE_REVIEW_FINISHED,
				ServerEvents.GRADE_REVIEW_FINISHED,
				{
					title: 'Grade Review Finished',
					message: `Teacher <strong>${getUserFullNameOrEmail(
						update_teacher,
					)}</strong> has finished the grade review of you. Click for more detail.`,
					ref_url: `/class/${gradeReview.class.toString()}/grade-review?review=${id}`,
					class: gradeReview.class.toString(),
					receivers: [gradeReview.request_student],
					sender: update_teacher._id.toString(),
				} as CreateNotificationDto,
			);
			return true;
		} catch (error) {
			throw new BadRequestException(error.message);
		}
	}

	remove(id: string) {
		return this.grade_review_model.findByIdAndDelete(id);
	}
}
