import { Module } from '@nestjs/common';
import { GradeReviewService } from './grade_review.service';
import { GradeReviewController } from './grade_review.controller';
import {
	GradeReview,
	GradeReviewSchemaFactory,
} from './entities/grade_review.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassGradesModule } from '@modules/class_grades/class_grades.module';

@Module({
	imports: [
		MongooseModule.forFeatureAsync([
			{ name: GradeReview.name, useFactory: GradeReviewSchemaFactory },
		]),
		ClassGradesModule,
	],
	controllers: [GradeReviewController],
	providers: [GradeReviewService],
})
export class GradeReviewModule {}
