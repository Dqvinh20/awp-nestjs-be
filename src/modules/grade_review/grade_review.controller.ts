import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	BadRequestException,
} from '@nestjs/common';
import { GradeReviewService } from './grade_review.service';
import {
	CreateCommentDto,
	CreateGradeReviewDto,
} from './dto/create-grade_review.dto';
import { UpdateGradeReviewDto } from './dto/update-grade_review.dto';
import { AuthUser } from 'src/decorators/auth_user.decorator';
import { Role } from 'src/decorators/role.decorator';
import { User } from '@modules/users/entities/user.entity';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { NeedAuth } from 'src/decorators/need_auth.decorator';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/decorators/roles.decorator';
import { ClassGradesService } from '@modules/class_grades/class_grades.service';
import { isMongoId } from 'class-validator';
import { FinishGradeReviewDto } from './dto/finish-grade_review.dto';

@ApiTags('grade-review')
@NeedAuth()
@Controller('grade-review')
export class GradeReviewController {
	constructor(
		private readonly gradeReviewService: GradeReviewService,
		private readonly class_grades_service: ClassGradesService,
	) {}

	@Roles(USER_ROLE.STUDENT)
	@Post()
	async create(
		@AuthUser() user,
		@Body() createGradeReviewDto: CreateGradeReviewDto,
	) {
		createGradeReviewDto.request_student = user.id;
		createGradeReviewDto.request_student_id = user.student_id;
		const result = this.gradeReviewService.create(createGradeReviewDto);
		return result;
	}

	@Roles(USER_ROLE.STUDENT, USER_ROLE.TEACHER)
	@Get()
	findAll(@AuthUser() user: User, @Role() userRole: USER_ROLE) {
		if (userRole === USER_ROLE.STUDENT) {
			return this.gradeReviewService.findAllByStudent(user);
		}

		return this.gradeReviewService.findAllByTeacher(user);
	}

	@Get('class/:class_id')
	async findAllByClass(
		@Param('class_id') class_id: string,
		@AuthUser() user: User,
		@Role() userRole: USER_ROLE,
	) {
		if (!isMongoId(class_id)) {
			throw new BadRequestException('Invalid class id');
		}
		await this.class_grades_service.checkClassStudentOrTeacher(class_id, user);
		if (userRole === USER_ROLE.STUDENT) {
			return this.gradeReviewService.findAllByStudent(user, class_id);
		}

		return this.gradeReviewService.findAllByTeacher(user, class_id);
	}

	@Get(':id')
	async findOne(@Param('id') id: string) {
		if (!isMongoId(id)) {
			throw new BadRequestException('Invalid id');
		}
		const gradeReview = await this.gradeReviewService.findOne(id);
		if (!gradeReview) {
			throw new BadRequestException('Grade review not found');
		}
		return gradeReview;
	}

	@Post(':id/comment')
	async addNewComment(
		@Param('id') id: string,
		@Body() createCommentDto: CreateCommentDto,
		@AuthUser() user: User,
	) {
		if (!isMongoId(id)) {
			throw new BadRequestException('Invalid id');
		}
		const gradeReview = await this.gradeReviewService.findOne(id);
		if (!gradeReview) {
			throw new BadRequestException('Grade review not found');
		}
		const classID = gradeReview.class.toString();
		await this.class_grades_service.checkClassStudentOrTeacher(classID, user);
		createCommentDto.sender = user.id;
		return this.gradeReviewService.addNewComment(id, createCommentDto, user);
	}

	@Roles(USER_ROLE.TEACHER)
	@Patch(':id/finish')
	async markFinished(
		@Param('id') id: string,
		@AuthUser() user,
		@Body() body: FinishGradeReviewDto,
	) {
		if (!isMongoId(id)) {
			throw new BadRequestException('Invalid id');
		}
		const gradeReview = await this.gradeReviewService.findOne(id);
		await this.class_grades_service.checkClassStudentOrTeacher(
			gradeReview.class.toString(),
			user,
		);
		return this.gradeReviewService.markFinished(id, body, user);
	}

	@Roles(USER_ROLE.TEACHER)
	@Patch(':id')
	async update(
		@Param('id') id: string,
		@Body() updateGradeReviewDto: UpdateGradeReviewDto,
		@AuthUser() user,
	) {
		if (!isMongoId(id)) {
			throw new BadRequestException('Invalid id');
		}
		const gradeReview = await this.gradeReviewService.findOne(id);
		await this.class_grades_service.checkClassStudentOrTeacher(
			gradeReview.class.toString(),
			user,
		);

		return this.gradeReviewService.update(id, updateGradeReviewDto);
	}

	@Roles(USER_ROLE.ADMIN)
	@Delete(':id')
	remove(@Param('id') id: string) {
		if (!isMongoId(id)) {
			throw new BadRequestException('Invalid id');
		}
		return this.gradeReviewService.remove(id);
	}
}
